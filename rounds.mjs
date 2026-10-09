import {randomUUID} from 'node:crypto';
import {LIMIT} from './domain.mjs';
const catalog=[];
const add=(key,label,numbers,odds,kind)=>catalog.push({key,label,numbers,odds,kind});
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
export const RED=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
add('red','Rødt',RED,1,'outside');add('black','Svart',range(1,36).filter(n=>!RED.includes(n)),1,'outside');
add('even','Partall',range(1,36).filter(n=>n%2===0),1,'outside');add('odd','Oddetall',range(1,36).filter(n=>n%2),1,'outside');
add('low','1–18',range(1,18),1,'outside');add('high','19–36',range(19,36),1,'outside');
for(let i=0;i<3;i++){add('dozen'+i,`${i*12+1}–${i*12+12}`,range(i*12+1,i*12+12),2,'outside');add('column'+i,`Kolonne ${i+1}`,range(1,36).filter(n=>(n-1)%3===i),2,'outside')}
for(let n=0;n<=36;n++)add('n'+n,String(n),[n],35,'straight');
for(let n=1;n<=36;n++){if(n%3!==0)add('split'+n+'-'+(n+1),`${n} / ${n+1}`,[n,n+1],17,'split');if(n<=33)add('split'+n+'-'+(n+3),`${n} / ${n+3}`,[n,n+3],17,'split')}
for(const n of [1,2,3])add('split0-'+n,`0 / ${n}`,[0,n],17,'split');
for(let n=1;n<=34;n+=3)add('street'+n,`${n}–${n+2}`,[n,n+1,n+2],11,'street');
add('trio012','0 / 1 / 2',[0,1,2],11,'street');add('trio023','0 / 2 / 3',[0,2,3],11,'street');
for(let n=1;n<=32;n++)if(n%3!==0)add('corner'+n,`${n} / ${n+1} / ${n+3} / ${n+4}`,[n,n+1,n+3,n+4],8,'corner');
add('firstfour','0 / 1 / 2 / 3',[0,1,2,3],8,'corner');
for(let n=1;n<=31;n+=3)add('six'+n,`${n}–${n+5}`,range(n,n+5),5,'six');
export const CATALOG=catalog;
const byKey=new Map(catalog.map(b=>[b.key,b]));
export class RuleError extends Error{constructor(message,status=400){super(message);this.status=status}}
export function validateBets(bets,points){
 if(!Array.isArray(bets)||bets.length>100)throw new RuleError('Ugyldig innsatsliste.');
 const seen=new Set();let total=0;
 const result=bets.map(b=>{const definition=b&&byKey.get(b.key);if(!definition||seen.has(b.key)||!Number.isSafeInteger(b.stake)||b.stake<1)throw new RuleError('Bruk lovlige innsatser med hele, positive poeng.');seen.add(b.key);if(definition.kind==='straight'&&b.stake>25)throw new RuleError('Maks 25 poeng på hvert enkelttall.');total+=b.stake;return {key:b.key,stake:b.stake}});
 if(total>100)throw new RuleError('Maks 100 poeng totalt per spiller og runde.');if(total>points)throw new RuleError('Du har ikke nok poeng til disse innsatsene.');return result;
}
export function betDelta(bets,winning){if(!Number.isInteger(winning)||winning<0||winning>36)throw new RuleError('Vinnertallet må være 0–36.');return bets.reduce((sum,b)=>{const d=byKey.get(b.key);if(!d)throw new RuleError('Ukjent innsats.');return sum+(d.numbers.includes(winning)?b.stake*d.odds:-b.stake)},0)}
export function publicRound(r){if(!r)return null;const {id,number,status,book,winning,results,openedAt,lockedAt,settledAt}=r;return {id,number,status,book,winning,results,openedAt,lockedAt,settledAt}}
export function saveBets(d,b){const r=d.round;if(!r||r.id!==b.roundId||r.status!=='open')throw new RuleError('Runden er ikke åpen. Innsatsene ble ikke endret.',409);const p=d.state.players.find(p=>p.id===b.playerId);if(!p)throw new RuleError('Spilleren finnes ikke.',404);const current=(Object.hasOwn(r.book,p.id)?r.book[p.id]:null)||{version:0,bets:[]};if(!Number.isSafeInteger(b.version)||b.version!==current.version)throw new RuleError('Innsatsene på dette navnet er endret på en annen enhet. Hent lagrede innsatser før du prøver igjen.',409);const bets=validateBets(b.bets,p.points);Object.defineProperty(r.book,p.id,{value:{version:current.version+1,bets,confirmedAt:new Date().toISOString()},enumerable:true,writable:true,configurable:true});return d}
export function roundAction(d,b){const now=new Date().toISOString();if(b.action==='open'){
 if(d.round&&d.round.status!=='settled')throw new RuleError('Lås og avslutt den åpne runden først.',409);if(!d.state.players.length)throw new RuleError('Legg til spillere før du åpner en runde.');
 d.previousRound=publicRound(d.round)||d.previousRound||null;d.roundSequence=(d.roundSequence||0)+1;d.round={id:randomUUID(),number:d.roundSequence,status:'open',book:{},openedAt:now};d.resultUndo=null;d.undos=[];return d;
 }
 const r=d.round;if(!r||r.id!==b.roundId)throw new RuleError('Runden er endret. Hent tavlen på nytt.',409);
 if(b.action==='lock'){if(r.status!=='open')throw new RuleError('Runden er allerede låst eller avsluttet.',409);r.status='locked';r.lockedAt=now;return d}
 if(b.action==='reopen'){if(r.status!=='locked')throw new RuleError('Bare en låst runde uten resultat kan gjenåpnes.',409);r.status='open';delete r.lockedAt;return d}
 if(b.action==='settle'){
 if(r.status!=='locked')throw new RuleError('Runden må være låst og uten resultat.',409);if(!Number.isInteger(b.winning)||b.winning<0||b.winning>36)throw new RuleError('Velg ett vinnertall fra 0 til 36.');
 const results=d.state.players.map(p=>{const bets=validateBets(r.book[p.id]?.bets||[],p.points),delta=betDelta(bets,b.winning);if(p.points+delta>LIMIT)throw new RuleError('En saldo blir for høy. Kontakt verten.');return {playerId:p.id,before:p.points,delta,after:p.points+delta,staked:bets.reduce((s,b)=>s+b.stake,0)}});
 d.resultUndo={roundId:r.id,state:structuredClone(d.state)};d.state.players.forEach(p=>p.points=results.find(x=>x.playerId===p.id).after);d.state.log.unshift(`Runde ${r.number} · Vinnertall ${b.winning} · ${results.filter(x=>x.staked>0).length} spillere`);d.state.log=d.state.log.slice(0,500);r.status='settled';r.winning=b.winning;r.results=results;r.settledAt=now;d.undos=[];return d;
 }
 if(b.action==='undoResult'){if(r.status!=='settled'||d.resultUndo?.roundId!==r.id)throw new RuleError('Rundeoppgjøret kan ikke angres etter ny runde eller manuell korrigering.',409);d.state=d.resultUndo.state;d.resultUndo=null;r.status='locked';delete r.winning;delete r.results;delete r.settledAt;return d}
 throw new RuleError('Ukjent rundehandling.');
}
