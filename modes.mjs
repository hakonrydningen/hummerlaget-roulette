import {RuleError} from './rounds.mjs';
export const modeContext=d=>`${d.demoActive?'demo':'real'}:${d.modeEpoch||0}`;
export const activeGame=d=>d.demoActive?d.demo:d;
export function changeDemo(d,b){
 if(!['start','end','reset'].includes(b.action))throw new RuleError('Ukjent demohandling.');
 if(b.action==='start'&&d.demoActive)throw new RuleError('Demo er allerede aktiv.',409);
 if(b.action!=='start'&&!d.demoActive)throw new RuleError('Demo er ikke aktiv.',409);
 if(b.action==='end'){d.demoActive=false;d.demo=null}
 else{d.demoActive=true;d.demo={state:{players:d.state.players.map(p=>({id:p.id,name:p.name,points:1000})),log:[]},undos:[],round:null,previousRound:null,roundSequence:0,resultUndo:null}}
 d.modeEpoch=(d.modeEpoch||0)+1;
 return d;
}
