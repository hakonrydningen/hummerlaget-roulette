import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {CATALOG,validateBets} from '../rounds.mjs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function ui(){
 const nodes=new Map();const ctx=vm.createContext({CATALOG,nodes});
 vm.runInContext(`const $=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)};let board={state:{players:[{id:'test',points:1000}]},round:{id:'r',status:'open',book:{test:{version:1,bets:[]}}},host:false},selected='test',draft=null,baseVersion=0,draftRound=null,chip=25,tab='color',online=true,busy=false,pending=null,conflict=false;const player=()=>board.state.players[0],saved=()=>board.round.book.test,editable=()=>online&&!busy&&!pending&&board.round.status==='open',copy=x=>JSON.parse(JSON.stringify(x)),total=x=>x.reduce((s,b)=>s+b.stake,0),defs=new Map(CATALOG.map(d=>[d.key,d]));function renderPersonal(){};function updateAmountUi(){};`,ctx);
 for(const name of ['message','beginDraft','draftValid','addBet','chooseAmount','chooseTab']){const a=source.indexOf('function '+name+'('),b=source.indexOf('\nfunction ',a+1);vm.runInContext(source.slice(a,b),ctx)}
 return {run:s=>vm.runInContext(s,ctx),bets:()=>JSON.parse(vm.runInContext('JSON.stringify(draft)',ctx))};
}
test('Ett tall regression: 50-point chip switches to 25, including zero; repeated taps cannot exceed cap',()=>{const u=ui();u.run("chip=50;chooseTab('straight');addBet('n0');addBet('n0')");assert.deepEqual(u.bets(),[{key:'n0',stake:25}]);assert.match(u.run("$('editor-message').textContent"),/Allerede valgt/);u.run("chip=10;addBet('n0')");assert.deepEqual(u.bets(),[{key:'n0',stake:10}]);});
test('Every catalog choice remains selectable; edits replace amount and validate under existing rules',()=>{for(const d of CATALOG){const u=ui();u.run(`addBet(${JSON.stringify(d.key)});addBet(${JSON.stringify(d.key)})`);assert.deepEqual(u.bets(),[{key:d.key,stake:25}]);validateBets(u.bets(),1000);u.run(`chip=5;addBet(${JSON.stringify(d.key)})`);assert.equal(u.bets()[0].stake,5)}});
test('Invalid choices do not create phantom drafts and feedback appears inside editor',()=>{const u=ui();u.run("chip=50;addBet('n3')");assert.equal(u.bets(),null);assert.match(u.run("$('editor-message').textContent"),/Maks 25/);u.run("addBet('red');addBet('black');chip=5;addBet('even')");assert.equal(u.bets().length,2);assert.match(u.run("$('editor-message').textContent"),/Maks 100/);});
test('Saved choice repeated is unchanged; offline, lock, pending and conflict prevent edits',()=>{for(const condition of ["online=false","board.round.status='locked'","pending={}","conflict=true"]){const u=ui();u.run(condition+";addBet('n1')");assert.equal(u.bets(),null)}const u=ui();u.run("board.round.book.test.bets=[{key:'n1',stake:25}];addBet('n1')");assert.equal(u.bets(),null)});

test('Custom whole-point amounts remain available without changing total or straight limits',()=>{const u=ui();u.run("chooseAmount('15');addBet('n7')");assert.deepEqual(u.bets(),[{key:'n7',stake:15}]);u.run("chooseTab('straight');chooseAmount('26')");assert.equal(u.run('chip'),15);u.run("chooseAmount('1.5')");assert.equal(u.run('chip'),15);u.run("chooseTab('color');chooseAmount('85');addBet('red')");assert.equal(u.bets().reduce((s,b)=>s+b.stake,0),100);validateBets(u.bets(),1000)});
