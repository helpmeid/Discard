/* Local named worlds. Storage is injected so saves can be verified independently of the UI. */
(function(root){
  'use strict';
  const MAX_WORLDS=6,VERSION=2,cleanName=s=>String(s||'').trim().replace(/[\u0000-\u001f]/g,'').slice(0,36)||'A New Oath';
  function createStore(storage,owner,engine,clock=()=>Date.now(),uid=()=>crypto.randomUUID()){
    const key='discard-oakhaven-worlds-v2-'+owner;let failed=false;
    const empty=()=>({version:VERSION,worlds:[],options:{},binds:null});
    function read(){try{const d=JSON.parse(storage.getItem(key));if(!d||d.version!==VERSION||!Array.isArray(d.worlds))return empty();d.worlds=d.worlds.filter(w=>w&&typeof w.id==='string'&&typeof w.name==='string'&&['solo','couch','online'].includes(w.mode)).slice(0,MAX_WORLDS);return d;}catch{return empty();}}
    function write(data){try{storage.setItem(key,JSON.stringify(data));failed=false;return true;}catch{failed=true;return false;}}
    function add(name,mode='solo'){const data=read();if(data.worlds.length>=MAX_WORLDS||!['solo','couch','online'].includes(mode))return null;const world={id:uid(),name:cleanName(name),mode,created:clock(),updated:clock(),seconds:0,checkpoint:null};data.worlds.push(world);return write(data)?world:null;}
    function update(id,changes){const d=read(),w=d.worlds.find(w=>w.id===id);if(!w)return false;if(changes.name!==undefined)w.name=cleanName(changes.name);if(changes.checkpoint){const checkpoint=engine.save(changes.checkpoint);if(!engine.validState(checkpoint))return false;w.checkpoint=checkpoint;}if(Number.isFinite(changes.seconds)&&changes.seconds>=0)w.seconds=changes.seconds;w.updated=clock();return write(d);}
    function remove(id){const d=read(),n=d.worlds.length;d.worlds=d.worlds.filter(w=>w.id!==id);return d.worlds.length!==n&&write(d);}
    function settings(changes){const d=read();if(changes.options)d.options={...d.options,...changes.options};if(changes.binds)d.binds=changes.binds;return write(d);}
    function migrate(){let old;try{if(storage.getItem(key))return false;old=JSON.parse(storage.getItem('discard-oakhaven-reborn-1-'+owner));}catch{return false;}if(!old)return false;const d=empty();d.options=old.options||{};const legacy=[{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',attack:'KeyF',heavy:'KeyG',ranged:'KeyQ',roll:'Space',block:'KeyR',heal:'KeyH',interact:'KeyE',a1:'Digit1',a2:'Digit2',a3:'Digit3'},{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',attack:'KeyJ',heavy:'KeyK',ranged:'KeyU',roll:'KeyL',block:'KeyI',heal:'KeyP',interact:'KeyO',a1:'Semicolon',a2:'Quote',a3:'Slash'}];d.binds=old.binds?.map((b,i)=>Object.fromEntries(Object.entries(b).filter(([a,c])=>legacy[i]?.[a]!==c)))||null;const s=old.checkpoint&&engine.upgrade(old.checkpoint);if(s&&engine.validState(s))d.worlds.push({id:uid(),name:'Your Earlier Oath',mode:s.players.length>1?'couch':'solo',created:clock(),updated:clock(),seconds:s.time,checkpoint:engine.save(s)});return write(d);}
    return{read,add,update,remove,settings,migrate,failed:()=>failed,key};
  }
  const api={MAX_WORLDS,VERSION,cleanName,createStore,acceptPassword:value=>String(value).trim()==='1423'};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OakhavenSaves=api;
})(typeof globalThis!=='undefined'?globalThis:this);
