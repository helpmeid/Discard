/* Active foreground playtime, per local account. No chat minigames or offline accrual. */
(() => {
  'use strict';
  let owner=null,totals={},last=performance.now(),dirty=false;
  const storeKey=id=>`discard-game-time-v1-${id}`;
  const format=ms=>`${Math.floor(ms/3600000)}h ${Math.floor(ms/60000)%60}m played`;
  const visible=id=>{const node=document.getElementById(id);return node&&!node.classList.contains('hidden');};
  function save(){if(owner&&dirty){try{localStorage.setItem(storeKey(owner),JSON.stringify(totals));dirty=false;}catch{}}}
  function tick(){
    const now=performance.now(),elapsed=Math.max(0,Math.min(now-last,2000));last=now;
    const id=currentUser?.id||null;
    if(owner!==id){save();owner=id;try{const v=JSON.parse(localStorage.getItem(storeKey(id)))||{};totals=Object.fromEntries(['horizon','oakhaven'].map(k=>[k,Number.isFinite(v[k])&&v[k]>=0?v[k]:0]));}catch{totals={};}render();return;}
    if(owner&&!document.hidden&&document.hasFocus()){
      const active=visible('oakRoot')?(window.oakhavenIsPlaying?.()?'oakhaven':null):visible('vfRoot')?'horizon':null;
      if(active){totals[active]=(totals[active]||0)+elapsed;dirty=true;}
    }
    render();
  }
  function render(){for(const name of ['horizon','oakhaven']){const e=document.querySelector(`[data-playtime="${name}"]`);if(e)e.textContent=format(totals[name]||0);}}
  setInterval(tick,1000);setInterval(save,10000);
  document.addEventListener('visibilitychange',()=>{tick();save();});window.addEventListener('pagehide',save);
})();
