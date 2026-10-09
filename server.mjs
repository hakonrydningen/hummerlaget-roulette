import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {randomBytes,timingSafeEqual,scryptSync} from 'node:crypto';
import {valid} from './domain.mjs';
import {modeContext,activeGame,changeDemo} from './modes.mjs';
import {CATALOG,publicRound,saveBets,roundAction,RuleError} from './rounds.mjs';
const production=process.env.NODE_ENV==='production';
const password=process.env.HOST_PASSWORD;
if(!password||password.length<12)throw Error('Set HOST_PASSWORD to at least 12 characters.');
if(production&&!process.env.DATABASE_URL)throw Error('Production requires durable DATABASE_URL.');
const salt=randomBytes(32),passwordHash=scryptSync(password,salt,64);
const initial={state:{players:[],log:[]},undos:[],requests:[],revision:0,updatedAt:null};
let read,cas,close;
if(process.env.DATABASE_URL){
 const {default:pg}=await import('pg');const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3});
 await pool.query('CREATE TABLE IF NOT EXISTS roulette_board (id integer PRIMARY KEY CHECK(id=1), document jsonb NOT NULL)');
 await pool.query('INSERT INTO roulette_board(id,document) VALUES(1,$1) ON CONFLICT DO NOTHING',[initial]);
 read=async()=>(await pool.query('SELECT document FROM roulette_board WHERE id=1')).rows[0].document;
 cas=async(old,next)=>(await pool.query("UPDATE roulette_board SET document=$1 WHERE id=1 AND (document->>'revision')::bigint=$2",[next,old])).rowCount===1;
 close=()=>pool.end();
}else{
 const {DatabaseSync}=await import('node:sqlite');await mkdir('.data',{recursive:true});const db=new DatabaseSync(process.env.SQLITE_PATH||'.data/board.sqlite');db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS board(id INTEGER PRIMARY KEY, document TEXT NOT NULL)');db.prepare('INSERT OR IGNORE INTO board VALUES(1,?)').run(JSON.stringify(initial));
 read=async()=>JSON.parse(db.prepare('SELECT document FROM board WHERE id=1').get().document);
 cas=async(old,next)=>db.prepare("UPDATE board SET document=? WHERE id=1 AND json_extract(document,'$.revision')=?").run(JSON.stringify(next),old).changes===1;
 close=()=>db.close();
}
const sessions=new Map(),attempts=new Map();
const snapshot=(d,host=false)=>{const g=activeGame(d);return {state:g.state,revision:d.revision,updatedAt:d.updatedAt,host,mode:d.demoActive?'demo':'real',context:modeContext(d),round:publicRound(g.round),previousRound:publicRound(g.previousRound),canUndo:host&&!d.demoActive&&g.undos.length>0&&!['open','locked'].includes(g.round?.status),canUndoResult:host&&g.round?.status==='settled'&&g.resultUndo?.roundId===g.round.id}};
const files={'/feedback.js':['feedback.js','text/javascript; charset=utf-8'],'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/intro.js':['intro.js','text/javascript; charset=utf-8'],'/intro.css':['intro.css','text/css; charset=utf-8'],'/app.css':['app.css','text/css; charset=utf-8']};
const assets=Object.fromEntries(await Promise.all(Object.entries(files).map(async([url,[file,type]])=>[url,{data:await readFile(new URL('./public/'+file,import.meta.url)),type}])));
async function body(req){let s='';for await(const chunk of req){s+=chunk;if(Buffer.byteLength(s)>400000)throw Object.assign(Error('For stor forespørsel'),{status:413})}try{return JSON.parse(s)}catch{throw Object.assign(Error('Ugyldig JSON'),{status:400})}}
const server=http.createServer(async(req,res)=>{
 const security={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'X-Frame-Options':'DENY',...(production?{'Strict-Transport-Security':'max-age=31536000'}:{})};
 function send(status,data,headers={}){res.writeHead(status,{...security,'Content-Type':'application/json; charset=utf-8',...headers});res.end(typeof data==='string'?data:JSON.stringify(data))}
 try{
 const url=new URL(req.url,'http://local');const path=url.pathname;
 const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('roulette_host='))?.slice(14);
 const host=!!token&&sessions.get(token)>Date.now();
 if(req.method==='GET'&&assets[path])return send(200,assets[path].data.toString(),{'Content-Type':assets[path].type});
 if(req.method==='GET'&&path==='/health') {await read();return send(200,{ok:true})}
 if(req.method==='GET'&&path==='/api/state')return send(200,snapshot(await read(),host));
 if(req.method==='GET'&&path==='/api/catalog')return send(200,CATALOG);
 if(req.method==='GET'&&path==='/api/session')return send(200,{host});
 if(req.method!=='POST')return send(404,{error:'Fant ikke siden'});
 // Browser writes must originate here; custom header blocks cross-site form requests.
 if(req.headers['x-roulette-request']!=='1')return send(403,{error:'Forespørselen er avvist'});
 if(req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host)return send(403,{error:'Feil opprinnelse'})}
 if(path==='/api/login'){
 const ip=production?(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim():req.socket.remoteAddress;
 const a=attempts.get(ip)||{count:0,until:Date.now()+600000};if(a.until<Date.now()){a.count=0;a.until=Date.now()+600000}if(a.count>=10)return send(429,{error:'For mange forsøk. Vent 10 minutter.'});a.count++;attempts.set(ip,a);
 const b=await body(req);if(typeof b.password!=='string'||b.password.length>256||!timingSafeEqual(scryptSync(b.password,salt,64),passwordHash))return send(401,{error:'Feil vertspassord'});
 attempts.delete(ip);const id=randomBytes(32).toString('hex');sessions.set(id,Date.now()+43200000);return send(200,{host:true},{'Set-Cookie':`roulette_host=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${production?'; Secure':''}`});
 }
 if(path==='/api/bets'||path==='/api/round'||path==='/api/demo'){
 if(path!=='/api/bets'&&!host)return send(401,{error:'Bare verten kan styre runden.'});
 const b=await body(req);if(!b||typeof b.id!=='string'||b.id.length<8||b.id.length>100)return send(400,{error:'Ugyldig forespørsels-ID.'});
 const key=JSON.stringify([b.context,path,b.action,b.roundId,b.playerId,b.id]);
 for(let attempt=0;attempt<30;attempt++){
 const current=await read();if(current.requests.includes(key))return send(200,{...snapshot(current,host),ackId:b.id});
 if(b.context!==modeContext(current))return send(409,{error:'Modusen er endret. Oppdater siden før du fortsetter.',...snapshot(current,host)});
 let next=structuredClone(current);
 try{if(path==='/api/demo')changeDemo(next,b);else if(path==='/api/bets')saveBets(activeGame(next),b);else roundAction(activeGame(next),b)}catch(e){if(e instanceof RuleError)return send(e.status,{error:e.message,...snapshot(current,host)});throw e}
 next.revision=current.revision+1;next.updatedAt=new Date().toISOString();next.requests=[...current.requests,key].slice(-5000);
 if(await cas(current.revision,next))return send(200,{...snapshot(next,host),ackId:b.id});
 }
 return send(409,{error:'Mange oppdaterer akkurat nå. Hent tavlen og prøv igjen.',...snapshot(await read(),host)});
 }
 if(!host)return send(401,{error:'Logg inn som vert først'});
 if(path==='/api/logout'){sessions.delete(token);return send(200,{host:false},{'Set-Cookie':`roulette_host=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production?'; Secure':''}`})}
 if(path!=='/api/change')return send(404,{error:'Ukjent handling'});
 const b=await body(req);if(!Number.isSafeInteger(b.revision)||typeof b.id!=='string'||b.id.length>100||!['replace','undo'].includes(b.action))return send(400,{error:'Ugyldig endring'});
 const current=await read();if(b.context!==modeContext(current))return send(409,{error:'Modusen er endret. Oppdater siden før du fortsetter.',...snapshot(current,true)});if(current.demoActive)return send(409,{error:'Bruk Nullstill demo. Import og manuelle endringer er sperret i demo.',...snapshot(current,true)});if(['open','locked'].includes(current.round?.status))return send(409,{error:'Manuelle saldoendringer er sperret mens en runde pågår.',...snapshot(current,true)});if(current.requests.includes(b.id))return send(200,snapshot(current,true));
 if(current.revision!==b.revision)return send(409,{error:'Bordet er endret i en annen fane. Oppdatert tavle er hentet.',...snapshot(current,true)});
 let nextState,nextUndos;
 if(b.action==='undo'){if(!current.undos.length)return send(400,{error:'Ingen endring å angre'});nextState=current.undos.at(-1);nextUndos=current.undos.slice(0,-1)}
 else{if(!valid(b.state))return send(400,{error:'Ugyldige spillerdata'});nextState={players:b.state.players.map(({id,name,points})=>({id,name,points})),log:b.state.log};nextUndos=[...current.undos,current.state].slice(-50)}
 const next={...current,...(b.resetRound?{round:null,previousRound:null}:{}),state:nextState,undos:nextUndos,resultUndo:null,revision:current.revision+1,updatedAt:new Date().toISOString(),requests:[...current.requests,b.id].slice(-5000)};
 if(!await cas(current.revision,next))return send(409,{error:'En annen endring ble lagret først. Prøv igjen.',...snapshot(await read(),true)});
 return send(200,snapshot(next,true));
 }catch(e){console.error(e.code||e.name);send(e.status||500,{error:e.status?e.message:'Serveren kunne ikke lagre. Prøv igjen.'})}
});
const cleanup=setInterval(()=>{for(const [k,v]of sessions)if(v<Date.now())sessions.delete(k);for(const[k,v]of attempts)if(v.until<Date.now())attempts.delete(k)},60000);cleanup.unref();
server.listen(process.env.PORT||3000,production?'0.0.0.0':'127.0.0.1',()=>console.log('Roulette server ready'));
process.on('SIGTERM',()=>server.close(async()=>{await close();process.exit(0)}));
