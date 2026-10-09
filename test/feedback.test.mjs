import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import {betDelta} from '../rounds.mjs';
const context={};vm.runInNewContext(readFileSync(new URL('../public/feedback.js',import.meta.url),'utf8'),context);const F=context.RouletteFeedback;
function storage(){const m=new Map();return{getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)}}
function board(id,status,delta=70,staked=25,mode='real'){return{context:mode+':0',mode,round:{id,number:1,status,results:[{playerId:'p',before:1000,after:1000+delta,delta,staked}]}}}
test('feedback uses whole-round net, including mixed bets, loss, zero and nonparticipation',()=>{
 for(const [bets,win,tone] of [[[{key:'red',stake:25}],1,'win'],[[{key:'red',stake:25}],2,'loss'],[[{key:'red',stake:25},{key:'black',stake:25}],1,'neutral'],[[{key:'red',stake:5},{key:'n2',stake:25}],1,'loss']]){
 const d=betDelta(bets,win),t=F.tracker(storage());t.observe(board('r','locked'),'p');const r=t.observe(board('r','settled',d,bets.reduce((n,b)=>n+b.stake,0)),'p');assert.equal(r.tone,tone);assert.equal(r.delta,d);assert.equal(r.after,1000+d);
 }
 const t=F.tracker(storage());t.observe(board('r','open'),'p');assert.equal(t.observe(board('r','settled',0,0),'p'),null);
});
test('feedback deduplicates polling, reconnect, refresh, name switching, old history and undo/resettle',()=>{
 const s=storage(),t=F.tracker(s),done=board('r','settled');t.observe(board('r','locked'),'p');assert.ok(t.observe(done,'p'));assert.equal(t.observe(done,'p'),null);assert.equal(F.tracker(s).observe(done,'p'),null);t.observe(done,'q');assert.equal(t.observe(done,'p'),null);t.observe(board('r','locked'),'p');assert.equal(t.observe(done,'p'),null);assert.equal(F.tracker(storage()).observe(done,'p'),null);
 const reconnect=F.tracker(s);reconnect.observe(board('next','locked'),'p');assert.ok(reconnect.observe(board('next','settled'),'p'));assert.equal(reconnect.observe(board('next','settled'),'p'),null);
});
test('demo feedback isolated; mode changes and historical next rounds do not surprise players',()=>{
 const t=F.tracker(storage());t.observe(board('r','open',0,25,'demo'),'p');assert.equal(t.observe(board('r','settled',70,25,'demo'),'p').mode,'demo');assert.equal(t.observe(board('real-r','settled'),'p'),null);t.observe(board('a','open'),'p');assert.equal(t.observe(board('b','settled'),'p'),null);
});
test('storage unavailable is safe; unsupported vibration, opt-out and reduced motion produce no vibration',()=>{
 const t=F.tracker({getItem(){throw Error()},setItem(){throw Error()}});t.observe(board('r','locked'),'p');assert.ok(t.observe(board('r','settled'),'p'));assert.equal(t.observe(board('r','settled'),'p'),null);
 let count=0;const nav={vibrate:n=>{assert.equal(n,45);count++;return true}};assert.equal(F.vibrate({},true,false),false);assert.equal(F.vibrate(nav,false,false),false);assert.equal(F.vibrate(nav,true,true),false);assert.equal(count,0);assert.equal(F.vibrate(nav,true,false),true);assert.equal(count,1);assert.equal(F.vibrate({vibrate(){throw Error()}},true,false),false);
});
