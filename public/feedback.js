'use strict';
// Observe transitions, never replay the settled round present when a page/name opens.
globalThis.RouletteFeedback = {
  tracker(storage) {
    let previous=null; const memory=new Set();
    function seen(key){try{return memory.has(key)||storage?.getItem(key)==='1'}catch{return memory.has(key)}}
    function mark(key){memory.add(key);try{storage?.setItem(key,'1')}catch{}}
    return {
      observe(board,playerId) {
        const round=board.round, current={context:board.context,mode:board.mode,roundId:round?.id,status:round?.status,playerId};
        const old=previous; previous=current;
        if(!round||round.status!=='settled'||!playerId)return null;
        const key='roulette-feedback-v1:'+JSON.stringify([board.mode,round.id,playerId]);
        const already=seen(key);mark(key);
        if(already||!old||old.playerId!==playerId||old.context!==board.context||old.roundId!==round.id||!['open','locked'].includes(old.status))return null;
        const result=round.results?.find(r=>r.playerId===playerId);
        if(!result||result.staked<=0||![result.delta,result.after].every(Number.isSafeInteger))return null;
        return {...result,roundId:round.id,number:round.number,mode:board.mode,context:board.context,tone:result.delta>0?'win':result.delta<0?'loss':'neutral'};
      }
    };
  },
  vibrate(nav,enabled,reduced){if(!enabled||reduced||typeof nav?.vibrate!=='function')return false;try{return nav.vibrate(45)===true}catch{return false}}
};
