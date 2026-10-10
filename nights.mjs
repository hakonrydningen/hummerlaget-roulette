import {randomUUID} from 'node:crypto';
import {RuleError} from './rounds.mjs';
const gameKeys=['state','undos','round','previousRound','roundSequence','resultUndo'];
const capture=d=>Object.fromEntries(gameKeys.map(k=>[k,structuredClone(d[k]??(k==='undos'?[]:k==='roundSequence'?0:null))]));
export const nightArchives=d=>(d.nightArchives||[]).map(({id,savedAt,revision,game})=>({id,savedAt,revision,players:game.state.players.length,round:game.round?.number||null,status:game.round?.status||null}));
export function changeNight(d,b){
 if(!['start','restore'].includes(b.action))throw new RuleError('Ukjent kveldshandling.');
 if(d.demoActive)throw new RuleError('Avslutt demo først. Ekte kveld er ikke endret.',409);
 if(!Number.isSafeInteger(b.revision)||b.revision!==d.revision)throw new RuleError('Tavlen er endret siden bekreftelsen ble åpnet. Kontroller den oppdaterte tavlen og bekreft på nytt.',409);
 const target=b.action==='restore'?(d.nightArchives||[]).find(a=>a.id===b.backupId):null;
 if(b.action==='restore'&&!target)throw new RuleError('Denne serverkopien finnes ikke. Hent tavlen på nytt.',409);
 const archive={id:randomUUID(),savedAt:new Date().toISOString(),revision:d.revision,game:capture(d)};
 const replacement=target?structuredClone(target.game):{state:{players:[],log:['Ny kveld startet']},undos:[],round:null,previousRound:null,roundSequence:0,resultUndo:null};
 Object.assign(d,replacement);
 d.nightArchives=[...(d.nightArchives||[]),archive];
 // A restored round may have its original ID. The new epoch still rejects every old player request.
 d.modeEpoch=(d.modeEpoch||0)+1;
 return d;
}
