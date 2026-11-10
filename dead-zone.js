/* Dead Zone: host-authoritative top-down co-op zombie survival. */
(()=>{
'use strict';
const workerScriptURL=typeof document!=='undefined'&&document.currentScript?.src?new URL('dead-zone-host-worker.js?v=2.2.10',document.currentScript.src).href:'dead-zone-host-worker.js?v=2.2.10';
const Net=window.DeadZoneNet;if(!Net)throw Error('Dead Zone networking module did not load');
const DIFFICULTIES={easy:{speed:.9,hp:.75,damage:.65,count:.8},normal:{speed:1,hp:1,damage:1,count:1},hard:{speed:1.26,hp:1.3,damage:1.45,count:1.3},nightmare:{speed:1.6,hp:1.8,damage:2,count:1.6}};
const MAX=4,W=960,H=600,MAPW=3600,MAPH=2600,keys=new Set(),mouse={x:480,y:300,down:false};
let rouletteOpen=false,roulettePanel=null,rouletteSelectedSlot=-1,rouletteSelectedChoice='',roulettePending=false,rouletteLastSerial=0;
let spectatorIndex=0,previousSpectate=false,previousBarrier=false;let gameOverShown=false,previousMint=false,previousDoor=false,previousBoard=false,previousRepair=false,pauseOpen=false,selectedInventoryHand='primary';let root,canvas,ctx,miniCanvas,menu,labels,session=null,world=null,raf=0,last=0,net=0,inputs=new Map(),invite=null,localInput={},inventoryOpen=false,inventoryPanel=null,verityPanel=null,verityOpen=false,verityUIStamp='',previousUse=false,previousToggle=false,camera={x:0,y:0};
const LOBBY_API=(window.DEAD_ZONE_LOBBY_API||localStorage.getItem('deadzone-lobby-api')||'').replace(/\/$/,'');let lobbyLeaseTimer=null,lobbyJoinTimer=null;let lobbyRegistryError='';async function publishDeadZoneLobby(){if(!LOBBY_API||session?.mode!=='host'||session.phase!=='lobby')return;const current=session;try{const r=await fetch(LOBBY_API+'/lobbies/deadzone',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:current.code,host:who(),session:current.id,secret:current.secret})});if(r.status===409){current.code=createJoinCode();tabLobbyCode=current.code;if(session===current)lobby();return;}if(!r.ok)throw Error('Lobby registry returned '+r.status);lobbyRegistryError='';}catch(e){lobbyRegistryError='Public lobby directory unavailable';console.warn('Dead Zone lobby registration:',e.message);}}function stopDeadZoneLobby(){if(lobbyLeaseTimer){clearInterval(lobbyLeaseTimer);lobbyLeaseTimer=null;}if(lobbyJoinTimer){clearInterval(lobbyJoinTimer);lobbyJoinTimer=null;}if(LOBBY_API&&session?.mode==='host'&&session.code&&session.secret){fetch(LOBBY_API+'/lobbies/deadzone/'+session.code,{method:'DELETE',headers:{authorization:'Bearer '+session.secret},keepalive:true}).catch(()=>{});}}async function lookupDeadZoneLobby(code){if(!LOBBY_API){pendingJoinCode=code;for(const id of Object.keys(state?.friends||{}))if(id!==who())emit(id,{t:'dz-code-lookup',id:code});return true;}try{const r=await fetch(LOBBY_API+'/lobbies/deadzone/'+encodeURIComponent(code),{cache:'no-store'});if(!r.ok)return false;const v=await r.json();if(typeof v.host!=='string'||typeof v.session!=='string')return false;join({from:v.host,id:v.session});return true;}catch{return false;}}
const BIND_DEFAULTS={barrier:'KeyV',up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',sprint:'ShiftLeft',attack:'Space',interact:'KeyE',inventory:'KeyI',heal:'KeyC',door:'KeyF',board:'KeyB',repair:'KeyR',primary:'Digit1',secondary:'Digit2'};
let binds={...BIND_DEFAULTS};try{const saved=JSON.parse(localStorage.getItem('deadzone-keybinds')||'{}');for(const [action,code] of Object.entries(saved))if(action in binds&&typeof code==='string')binds[action]=code;}catch{}
const pressed=action=>keys.has(binds[action]);
const who=()=>currentUser?.id, name=id=>viewPerson(id)?.displayName||'Survivor';
let pendingJoinCode='',tabLobbyCode='',tabLobbyOwner='';const createJoinCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(5)),n=>String.fromCharCode(65+n%26)).join('');
const emit=(id,p)=>{if(!id)return;const packet={...p,z:'deadzone',v:1};if((p.t==='dz-state'||p.t==='dz-input')&&window.deadZoneSendRealtime?.(id,packet))return;connectTo(id);return sendTo(id,packet);};
const saveKey=()=> 'deadzone-save-v1-'+String(who()||'guest');
let totalPlaytimeFlush=0;const totalTimeKey=()=> 'deadzone-total-playtime-v1-'+String(who()||'guest');const getTotalTime=()=>{try{return Math.max(0,Number(localStorage.getItem(totalTimeKey()))||0)}catch{return 0}};let totalPlaytime=getTotalTime();function flushTotalPlaytime(){try{localStorage.setItem(totalTimeKey(),String(totalPlaytime))}catch(e){console.warn('Dead Zone playtime save failed',e)}}
let hudClock=0,snapshotSerial=0,lastSnapshotSerial=0;
let saveClock=0;let gameChatLog=null,gameChatInput=null,lastGameChatAt=0,lastVerityChatSeen=0;let announcedDeaths=new Map();let guestVisuals=new Map();
function saveGame(){if(!session||session.mode!=='host'||session.phase!=='play'||!world||world.ended)return false;if(window.__DEAD_ZONE_WORKER__){window.deadZoneHostSave?.(world);return true;}if(hostWorker){hostWorker.postMessage({type:'save'});return persistSave(hostCheckpoint||world);}return persistSave(world);}
function persistSave(source,key=saveKey(),owner=who()){try{if(!source||source.ended)return false;const copy=JSON.parse(JSON.stringify(source));copy.players=copy.players.filter(p=>p.id===owner);if(!copy.players.length)return false;copy.effects=[];copy.blood=[];copy.shots=[];localStorage.setItem(key,JSON.stringify({version:1,savedAt:Date.now(),mode:source.mode,difficulty:source.difficulty,world:copy}));return true;}catch(e){console.warn('Dead Zone save failed:',e);return false;}}
function readSave(){try{const v=JSON.parse(localStorage.getItem(saveKey())||'null');return v?.version===1&&v.world&&Array.isArray(v.world.players)&&v.world.players.length===1&&v.world.players[0].id===who()&&!v.world.ended?v:null;}catch{return null;}}
function continueGame(){const saved=readSave();if(!saved||!session||session.mode!=='host')return;world=saved.world;world.effects=[];world.blood=[];world.shots=[];world.players[0].vx=0;world.players[0].vy=0;session.gameMode=world.mode||saved.mode||'story';session.difficulty=world.difficulty||saved.difficulty||'normal';session.phase='play';saveClock=0;gameOverShown=false;pauseOpen=false;menu.style.display='none';startNetworkMatch();canvas.focus();}
const peers=()=>session?.peers||new Map();
const group=(p)=>{for(const id of peers().keys())emit(id,p);};
const itemDefs={concrete:{name:'Concrete Barrier',type:'material'},boards:{name:'Wooden Boards',type:'material'},bat:{name:'Rusty Spiked Bat',type:'weapon',damage:20,range:49,cool:.48},crowbar:{name:'Crowbar',type:'weapon',damage:30,range:55,cool:.4},axe:{name:'Fire Axe',type:'weapon',damage:44,range:62,cool:.56},pistol:{name:'Old Pistol',type:'weapon',damage:25,range:650,cool:.29},shotgun:{name:'Shotgun',type:'weapon',damage:48,range:480,cool:.68},jacket:{name:'Leather Jacket',type:'armor',defense:.14},vest:{name:'Kevlar Vest',type:'armor',defense:.32},heavy:{name:'Riot Armor',type:'armor',defense:.49},medkit:{name:'Medkit',type:'consumable'},mints:{name:'Care Mints',type:'consumable'},pipe:{name:'Steel Pipe',type:'weapon',damage:26,range:56,cool:.4},machete:{name:'Machete',type:'weapon',damage:40,range:68,cool:.4},sledge:{name:'Sledgehammer',type:'weapon',damage:72,range:70,cool:.95},katana:{name:'Katana',type:'weapon',damage:52,range:77,cool:.42},hammer:{name:'Hammer',type:'weapon',damage:33,range:49,cool:.42},revolver:{name:'Revolver',type:'weapon',damage:52,range:720,cool:.52},smg:{name:'SMG',type:'weapon',damage:18,range:530,cool:.12},rifle:{name:'Assault Rifle',type:'weapon',damage:33,range:760,cool:.2},sniper:{name:'Marksman Rifle',type:'weapon',damage:86,range:1100,cool:1.05},doublebarrel:{name:'Double Barrel Shotgun',type:'weapon',damage:70,range:440,cool:.96},tactical:{name:'Tactical Vest',type:'armor',defense:.40},military:{name:'Military Armor',type:'armor',defense:.55},hazmat:{name:'Hazmat Suit',type:'armor',defense:.25},scrapvest:{name:'Scrap Vest',type:'armor',defense:.20},ammoBox:{name:'Ammo Box',type:'consumable'},bandage:{name:'Bandages',type:'consumable'},energy:{name:'Energy Drink',type:'consumable'},chainsaw:{name:'Chainsaw',type:'weapon',damage:22,range:69,cool:.12},
sunbreaker:{name:'Sunbreaker Greatsword',type:'weapon',damage:210,range:85,cool:.6},
reaper:{name:'Reaper Scythe',type:'weapon',damage:165,range:91,cool:.39},
voidblade:{name:'Voidblade',type:'weapon',damage:135,range:79,cool:.23},
railgun:{name:'Railgun',type:'weapon',damage:410,range:1150,cool:1.1},
hellfire:{name:'Hellfire Shotgun',type:'weapon',damage:115,range:490,cool:.54},
thunderbolt:{name:'Thunderbolt LMG',type:'weapon',damage:78,range:800,cool:.14},eclipse:{name:'Eclipse Annihilator',type:'weapon',damage:550,range:1120,cool:.16}};

const WEAPON_TIERS=[['bat','pipe','hammer'],['crowbar','axe','pistol'],['machete','shotgun','smg','revolver'],['katana','rifle','sledge','doublebarrel'],['chainsaw','sniper','sunbreaker','reaper','voidblade','railgun','hellfire','thunderbolt'],['eclipse']];
const WEAPON_TIER_NAMES=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY','MYTHIC'],WEAPON_TIER_COLORS=['#839289','#65c884','#579ef5','#b880ed','#ffbd55','#ff4df2'];
const weaponTier=id=>WEAPON_TIERS.findIndex(t=>t.includes(id));
const nextWeapons=id=>WEAPON_TIERS[weaponTier(id)+1]||[];
const ROULETTE_X=1900,ROULETTE_Y=1260,ROULETTE_ODDS=[.50,.25,.15,.05,.005];
const rouletteNearby=p=>!!p&&Math.hypot(p.x-ROULETTE_X,p.y-ROULETTE_Y)<=110;
// Effective DPS bands intentionally do not overlap across adjacent rarities.
// Fast weapons do less per strike; slower weapons are much heavier hitters.
const TIER_DPS=[52,118,260,575,1280,4800];
const shotgunPellets=id=>['shotgun','doublebarrel','hellfire'].includes(id)?3:1;
function weaponDamage(id,level=1){
 const def=itemDefs[id]||itemDefs.bat,tier=Math.max(0,weaponTier(id));
 const factor=1+.095*(Math.max(1,Math.min(5,Number(level)||1))-1);
 return Math.max(1,Math.round(TIER_DPS[tier]*def.cool/shotgunPellets(id)*factor));
}
function weaponDps(id,level=1){
 const def=itemDefs[id]||itemDefs.bat;
 return Math.round(weaponDamage(id,level)*shotgunPellets(id)/def.cool);
}
function normalizeCopies(p){
 p.inventory??=[];if(!Array.isArray(p.itemLevels))p.itemLevels=p.inventory.map(id=>itemDefs[id]?.type==='weapon'?Math.max(1,Math.min(5,Math.floor(Number(p.weaponLevels?.[id])||1))):0);
 if(p.itemLevels.length!==p.inventory.length)p.itemLevels=p.inventory.map((id,i)=>itemDefs[id]?.type==='weapon'?Math.max(1,Math.min(5,Math.floor(Number(p.itemLevels[i])||1))):0);
 p.equippedIndices??={primary:p.inventory.indexOf(p.primary),secondary:p.inventory.indexOf(p.secondary)};
 for(const hand of ['primary','secondary']){let i=p.equippedIndices[hand];if(!Number.isSafeInteger(i)||i<0||i>=p.inventory.length||itemDefs[p.inventory[i]]?.type!=='weapon')i=p.inventory.findIndex(id=>id===p[hand]&&itemDefs[id]?.type==='weapon');p.equippedIndices[hand]=i;p[hand]=i>=0?p.inventory[i]:null}
 p.weapon=p[p.activeSlot]||p.primary||p.secondary||null;
}
function levelOf(p,i){normalizeCopies(p);return Math.max(1,Math.min(5,Math.floor(Number(p.itemLevels[i])||1)))}
function activeWeaponLevel(p){normalizeCopies(p);let i=p.equippedIndices[p.activeSlot];if(p.inventory[i]!==p.weapon)i=p.inventory.indexOf(p.weapon);return levelOf(p,i)}
function mergeWeapon(p,r){
 if(!world||!p||p.hp<=0||!Number.isSafeInteger(r?.target)||!Number.isSafeInteger(r?.source))return false;
 normalizeCopies(p);const {target,source}=r,id=p.inventory[target];
 if(target===source||target<0||source<0||target>=p.inventory.length||source>=p.inventory.length||id!==p.inventory[source]||itemDefs[id]?.type!=='weapon'||levelOf(p,target)>=5)return false;
 const next=levelOf(p,target)+1;p.itemLevels[target]=next;p.inventory.splice(source,1);p.itemLevels.splice(source,1);
 const dest=target>source?target-1:target;
 for(const hand of ['primary','secondary']){const i=p.equippedIndices[hand];if(i===source||i===target)p.equippedIndices[hand]=dest;else if(i>source)p.equippedIndices[hand]=i-1}
 normalizeCopies(p);world.notice=name(p.id)+' merged '+itemDefs[id].name+' → level '+next+'/5'+(next===5?' · choose next rarity!':'');return true;
}
function autoMergeCopies(p,id){
 if(itemDefs[id]?.type!=='weapon')return;
 normalizeCopies(p);
 // Keep the strongest available copy and consume weaker duplicates.
 for(let attempts=0;attempts<10;attempts++){
  const copies=p.inventory.map((v,i)=>({id:v,i,level:levelOf(p,i)})).filter(v=>v.id===id);
  const eligible=copies.filter(v=>v.level<5).sort((a,b)=>b.level-a.level||a.i-b.i);
  if(copies.length<2||!eligible.length)break;
  const target=eligible[0],source=copies.filter(v=>v.i!==target.i).sort((a,b)=>a.level-b.level||b.i-a.i)[0];
  if(!source||!mergeWeapon(p,{target:target.i,source:source.i}))break;
 }
}
function evolveWeapon(p,r){
 if(!world||world.wave<5||!p||p.hp<=0||!rouletteNearby(p)||!Number.isSafeInteger(r?.slot)||typeof r.choice!=='string')return false;
 normalizeCopies(p);const i=r.slot,id=p.inventory[i],tier=weaponTier(id);
 if(tier<0||tier>=5||!nextWeapons(id).includes(r.choice))return false;
 if(r.choice==='eclipse'&&world.mythicCreated)return false;
 const chance=ROULETTE_ODDS[tier],success=Math.random()<chance,oldName=itemDefs[id].name;
 if(success){p.inventory[i]=r.choice;p.itemLevels[i]=1;if(r.choice==='eclipse')world.mythicCreated=true;}
 else{
  p.inventory.splice(i,1);p.itemLevels.splice(i,1);
  for(const hand of ['primary','secondary']){const k=p.equippedIndices[hand];p.equippedIndices[hand]=k===i?-1:k>i?k-1:k;}
  if(!p.inventory.some(x=>itemDefs[x]?.type==='weapon')){p.primary=null;p.secondary=null;}
 }
 normalizeCopies(p);
 p.rouletteSerial=(p.rouletteSerial||0)+1;
 p.rouletteResult={success,from:id,to:success?r.choice:null,chance,serial:p.rouletteSerial};
 world.notice=name(p.id)+(success?' WON THE ROULETTE! '+oldName+' → '+itemDefs[r.choice].name:' LOST THE ROULETTE! '+oldName+' shattered');
 return true;
}

function weaponProgress(kind,slot,other){
 if(!session||session.phase!=='play')return;const p=world?.players.find(v=>v.id===who());if(!p||p.hp<=0)return;
 const request=kind==='merge'?{target:slot,source:other}:{slot,choice:other};
 if(session.mode==='host'){if(hostWorker)hostWorker.postMessage({type:kind,id:who(),request});else{kind==='merge'?mergeWeapon(p,request):evolveWeapon(p,request);showInventory();if(rouletteOpen)showRoulette();}}
 else emit(session.host,{t:'dz-'+kind,id:session.id,request});
}

const player=(id,i)=>({id,rouletteSerial:0,rouletteResult:null,x:MAPW/2+(i%2)*34-17,y:MAPH/2+Math.floor(i/2)*34-17,vx:0,vy:0,hp:100,kills:0,cool:0,invuln:0,color:['#93d1ff','#f7c576','#cda5ff','#99e3ab'][i],inventory:['bat'],itemLevels:[1],equippedIndices:{primary:0,secondary:-1},weaponLevels:{bat:1},primary:'bat',secondary:null,activeSlot:'primary',weapon:'bat',armor:null,ammo:0,face:0,swing:0,medkits:0,mints:0,boards:0,concrete:3,stamina:100,energy:0,reviveHold:0,reviveTarget:null,chestHold:0,chestTarget:null,chestComplete:false});
function makeMap(){const houses=[],chests=[];for(let y=180;y<MAPH-190;y+=430)for(let x=180;x<MAPW-190;x+=500){if(Math.hypot(x-MAPW/2,y-MAPH/2)<340)continue;const n=houses.length,type=n%5,w=[230,195,260,215,245][type],h=[185,215,175,195,225][type],px=x+(n%3)*17,py=Math.min(y+(n%2)*19-(y>MAPH-550&&x===180?85:0),MAPH-h-90);houses.push({x:px,y:py,w,h,type,doorX:px+w/2,doorY:py+h,doorOpen:false,doorHp:100,doorMaxHp:100,boards:0});chests.push({id:chests.length,x:px+45+n%3*45,y:py+68+n%2*40,opened:false});if(n%3===0)chests.push({id:chests.length,x:px+w-48,y:py+50,opened:false});}return{houses,chests};}
const lootPool=['concrete','concrete','crowbar','axe','pistol','shotgun','jacket','vest','heavy','medkit','medkit','mints','mints','boards','boards','pipe','machete','sledge','katana','hammer','revolver','smg','rifle','sniper','doublebarrel','tactical','military','hazmat','scrapvest','ammoBox','ammoBox','bandage','energy','chainsaw','sunbreaker','reaper','voidblade','railgun','hellfire','thunderbolt'];
const ZOMBIE_TYPES={walker:{hp:1,speed:1,color:'#4d6852'},runner:{hp:.7,speed:1.55,color:'#a56c4c'},brute:{hp:2.2,speed:.72,color:'#746b50'},crawler:{hp:.55,speed:1.25,color:'#738e61'},armored:{hp:3,speed:.68,color:'#5a6978'},stalker:{hp:1.15,speed:1.38,color:'#675977'},sprinter:{hp:.75,speed:1.95,color:'#b05a60'},toxic:{hp:1.35,speed:.9,color:'#82a54e'},berserker:{hp:2.0,speed:1.26,color:'#a34848'},juggernaut:{hp:4,speed:.55,color:'#816956'},boss:{hp:17,speed:.78,color:'#bd4c44'},colossus:{hp:35,speed:.63,color:'#7f5660'},plague:{hp:28,speed:1.02,color:'#67aa62'},dreadnought:{hp:52,speed:.48,color:'#496b83'},apocalypse:{hp:95,speed:.72,color:'#a34584'}};
const BOSS_NAMES={boss:'TITAN',colossus:'COLOSSUS',plague:'PLAGUE BEHEMOTH',dreadnought:'DREADNOUGHT',apocalypse:'APOCALYPSE'};
const bossSize=z=>z.kind==='apocalypse'?3.4:z.kind==='dreadnought'?3:z.kind==='colossus'?2.55:z.kind==='plague'?2.3:z.boss?2:1;
function chooseZombieType(wave){const choices=['walker','walker','walker','runner','crawler'];if(wave>=3)choices.push('stalker','toxic');if(wave>=5)choices.push('armored','brute','sprinter');if(wave>=7)choices.push('berserker');if(wave>=9)choices.push('juggernaut');return choices[Math.floor(Math.random()*choices.length)];}
function zombieSpawn(boss=false){world.zombieSerial=world.zombieSerial||0;const living=world.players.filter(p=>p.hp>0);const target=living[Math.floor(Math.random()*living.length)]||world.players[0];let x=target.x+600,y=target.y;for(let attempt=0;attempt<28;attempt++){const angle=Math.random()*Math.PI*2,dist=520+Math.random()*180;const nx=Math.max(15,Math.min(MAPW-15,target.x+Math.cos(angle)*dist)),ny=Math.max(15,Math.min(MAPH-15,target.y+Math.sin(angle)*dist));if(!solid(nx,ny,14)){x=nx;y=ny;break;}}const bossKinds=['boss','colossus','plague','dreadnought','apocalypse'];const kind=boss?bossKinds[Math.min(bossKinds.length-1,Math.floor(world.wave/10)-1)]:chooseZombieType(world.wave),cfg=ZOMBIE_TYPES[kind];const hp=Math.round(cfg.hp*(38+world.wave*12)*(DIFFICULTIES[world.difficulty||'normal']||DIFFICULTIES.normal).hp);return{netId:++world.zombieSerial,kind,maxHp:hp,hp,x,y,speed:cfg.speed*(90+Math.min(110,world.wave*6))*(DIFFICULTIES[world.difficulty||'normal']||DIFFICULTIES.normal).speed,attack:0,boss,attackPower:boss?(1.4+Math.min(1.8,world.wave/30)):1};}

const VERITY_X=MAPW/2,VERITY_Y=MAPH/2;
function makeVerity(){return{x:VERITY_X,y:VERITY_Y,hp:100,maxHp:100,state:'sleeping',weapon:null,weaponLevel:1,armor:null,ammo:0,face:0,cool:0,roll:0,rollCooldown:0,invuln:0,healCooldown:0,reviveHold:0,following:null,stuck:0,step:0,chatCooldown:0,chatTimer:7,chatMemory:{}};}
function verityInteract(p,dt){
 const v=world.verity;if(!v||p.hp<=0||Math.hypot(v.x-p.x,v.y-p.y)>72)return false;
 if(v.state==='sleeping'){v.state='active';v.following=p.id;world.notice='☀ VERITY AWAKENED! Press G nearby to open his inventory.';burst(v.x,v.y,'#ffe762',24);veritySay('Wow, {player} woke me up. Now I have to carry this whole circus.',p.id,true);return true;}
 if(v.hp<=0||v.state==='down'){if(v.reviver&&v.reviver!==p.id)return true;v.reviver=p.id;v.reviveHold=(v.reviveHold||0)+dt;if(v.reviveHold>=3){v.hp=45;v.state='active';v.reviveHold=0;v.reviver=null;v.invuln=2;world.notice=name(p.id)+' revived Verity!';burst(v.x,v.y,'#ffec77',18);veritySay('Thanks, {player}. Try not to make me regret it.',p.id,true);}return true;}
 return false;
}
function verityAction(p,req){
 const v=world?.verity;if(!v||v.state!=='active'||v.hp<=0||!p||p.hp<=0||Math.hypot(v.x-p.x,v.y-p.y)>85||!req)return false;
 if(req.type==='heal'){
  if(v.hp>=100||!p.mints){world.notice=v.hp>=100?'Verity is already fully healed':'You need Care Mints to heal Verity';return false;}
  p.mints--;v.hp=Math.min(100,v.hp+25);world.notice=name(p.id)+' healed Verity using 1 Care Mint';burst(v.x,v.y,'#86e0a1',12);return true;
 }
 if(req.type==='give'){
  normalizeCopies(p);const i=req.slot,id=p.inventory[i],def=itemDefs[id];
  if(!Number.isSafeInteger(i)||i<0||i>=p.inventory.length||!def||!['weapon','armor'].includes(def.type))return false;
  if(def.type==='weapon'&&p.inventory.filter(x=>itemDefs[x]?.type==='weapon').length<=1){world.notice='You must keep one weapon';return false;}
  const old=def.type==='weapon'?v.weapon:v.armor,oldLevel=v.weaponLevel||1,level=def.type==='weapon'?levelOf(p,i):0;
  p.inventory.splice(i,1);p.itemLevels.splice(i,1);
  for(const hand of ['primary','secondary']){const k=p.equippedIndices[hand];if(k===i)p.equippedIndices[hand]=-1;else if(k>i)p.equippedIndices[hand]=k-1;}
  if(old){p.inventory.push(old);p.itemLevels.push(def.type==='weapon'?oldLevel:0);}
  if(def.type==='weapon'){v.weapon=id;v.weaponLevel=level;if(def.range>=100){const given=Math.min(p.ammo||0,30);p.ammo-=given;v.ammo=(v.ammo||0)+given;}}
  else v.armor=id;
  normalizeCopies(p);world.notice=name(p.id)+' gave Verity '+def.name;return true;
 }
 if(req.type==='take'){
  const kind=req.kind,key=kind==='weapon'?'weapon':kind==='armor'?'armor':null;if(!key||!v[key])return false;
  normalizeCopies(p);const id=v[key];p.inventory.push(id);p.itemLevels.push(kind==='weapon'?v.weaponLevel||1:0);v[key]=null;if(kind==='weapon')v.weaponLevel=1;
  normalizeCopies(p);world.notice=name(p.id)+' retrieved '+itemDefs[id].name+' from Verity';return true;
 }
 return false;
}
function requestVerity(req){
 if(!session||session.phase!=='play'||!world?.verity)return;
 if(session.mode==='host'){if(hostWorker)hostWorker.postMessage({type:'verity',id:who(),request:req});else verityAction(world.players.find(p=>p.id===who()),req);}
 else emit(session.host,{t:'dz-verity',id:session.id,request:req});
}
function showVerityInventory(){
 if(!root)return;
 if(!verityPanel){verityPanel=document.createElement('section');verityPanel.style.cssText='position:absolute;z-index:25;inset:8% 12%;overflow:auto;background:#101e19f5;border:2px solid #e9d056;border-radius:15px;padding:22px;color:#f1efda;box-shadow:0 20px 80px #000d';root.append(verityPanel);}
 verityPanel.style.display=verityOpen?'block':'none';if(!verityOpen)return;
 const p=world?.players.find(q=>q.id===who()),v=world?.verity;
 if(!p||!v||v.state!=='active'||Math.hypot(p.x-v.x,p.y-v.y)>100){verityOpen=false;verityPanel.style.display='none';return;}
 const stamp=JSON.stringify([v.hp,v.weapon,v.weaponLevel,v.armor,v.ammo,p.inventory,p.itemLevels,p.mints,p.ammo]);
 if(verityUIStamp===stamp)return;
 verityUIStamp=stamp;const scroll=verityPanel.scrollTop;verityPanel.replaceChildren();
 const add=(tag,text,parent=verityPanel)=>{const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;};
 const heading=add('h2','☀ VERITY · COMPANION INVENTORY');heading.style.margin='0 0 12px';
 const close=add('button','✕ Close (G / Esc)');close.style.cssText='padding:9px;background:#49352d;color:white;border-radius:7px';close.onclick=()=>{verityOpen=false;showVerityInventory();canvas.focus();};
 add('p','♥ '+Math.ceil(v.hp)+'/100 HP  ·  Ammo: '+(v.ammo||0)+'  ·  Care Mints: '+(p.mints||0));
 const heal=add('button','🍬 Heal Verity · 1 Care Mint (+25 HP)');heal.disabled=!p.mints||v.hp>=100;heal.style.cssText='padding:10px;margin-bottom:12px;color:white;background:#276347;border:1px solid #95c9a0;border-radius:8px;cursor:pointer';heal.onclick=()=>requestVerity({type:'heal'});
 add('h3','VERITY EQUIPMENT');
 for(const kind of ['weapon','armor']){const id=v[kind],row=add('div',(kind==='weapon'?'⚔ Weapon: ':'🛡 Armor: ')+(itemDefs[id]?.name||'Empty')+(kind==='weapon'&&id?' · Level '+(v.weaponLevel||1):''));row.style.margin='9px 0';if(id){const take=add('button','Take back',row);take.style.marginLeft='14px';take.onclick=()=>requestVerity({type:'take',kind});}}
 add('h3','GIVE VERITY EQUIPMENT');
 const gear=p.inventory.map((id,i)=>({id,i})).filter(o=>['weapon','armor'].includes(itemDefs[o.id]?.type));
 if(!gear.length)add('p','No equipment to give.');
 for(const {id,i} of gear){const def=itemDefs[id],row=add('div',(def.type==='weapon'?'⚔ ':'🛡 ')+def.name+(def.type==='weapon'?' · Level '+levelOf(p,i):''));row.style.cssText='padding:10px;margin:5px 0;background:#1b3329;border-radius:8px;display:flex;justify-content:space-between;gap:12px';const give=add('button','Give to Verity',row);give.disabled=def.type==='weapon'&&p.inventory.filter(id=>itemDefs[id]?.type==='weapon').length<=1;give.style.cssText='background:#47623c;color:white;border-radius:7px;padding:7px';give.onclick=()=>requestVerity({type:'give',slot:i});}
 add('p','Giving equipment returns his replaced item to your backpack.');
 verityPanel.scrollTop=scroll;
}
// Lightweight, cached grid navigation keeps Verity from repeatedly walking into walls.
function verityLineClear(ax,ay,bx,by){
 const steps=Math.ceil(Math.hypot(bx-ax,by-ay)/22);
 for(let i=1;i<=steps;i++)if(solid(ax+(bx-ax)*i/steps,ay+(by-ay)*i/steps,14))return false;
 return true;
}
function verityFindPath(sx,sy,gx,gy){
 const step=30,start=[Math.round(sx/step),Math.round(sy/step)],end=[Math.round(gx/step),Math.round(gy/step)];
 const key=(x,y)=>x+','+y,heur=(x,y)=>Math.hypot(x-end[0],y-end[1]);
 const open=[{x:start[0],y:start[1],g:0,f:heur(...start)}],cost=new Map([[key(...start),0]]),prev=new Map(),closed=new Set();
 let goal=null,closest=null,best=Infinity,iterations=0;
 while(open.length&&iterations++<650){
  let ix=0;for(let i=1;i<open.length;i++)if(open[i].f<open[ix].f)ix=i;
  const n=open.splice(ix,1)[0],id=key(n.x,n.y);if(closed.has(id))continue;closed.add(id);
  const dist=heur(n.x,n.y);if(dist<best){best=dist;closest=n;}
  if(dist<1.15){goal=n;break;}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const x=n.x+dx,y=n.y+dy,k=key(x,y),wx=x*step,wy=y*step;
   if(closed.has(k)||solid(wx,wy,14))continue;
   if(dx&&dy&&(solid((n.x+dx)*step,n.y*step,14)||solid(n.x*step,(n.y+dy)*step,14)))continue;
   const g=n.g+Math.hypot(dx,dy);if(g>=(cost.get(k)??Infinity))continue;
   cost.set(k,g);prev.set(k,id);open.push({x,y,g,f:g+heur(x,y)*1.12});
  }
 }
 const last=goal||closest;if(!last||best>12)return [];
 let current=key(last.x,last.y),path=[];
 while(current!==key(...start)&&path.length<150){const [x,y]=current.split(',').map(Number);path.push({x:x*step,y:y*step});current=prev.get(current);if(!current)break;}
 return path.reverse();
}

const VERITY_IDLE_LINES=[
 '{player}, I have seen shopping carts with better survival instincts.',
 'You loot like a raccoon with a concussion, {player}.',
 'I am an actual smiley face and somehow the smartest person here.',
 '{player}, stop sightseeing. The zombies are not giving tours.',
 'If bad decisions were ammo, {player} would never run dry.',
 'I have no hands and I am still carrying this team.',
 '{player}, your survival plan appears to be panic and vibes.',
 'That aim is a public safety hazard, {player}.',
 'This squad has the tactical awareness of a soggy sandwich.',
 '{player}, I would call that strategy trash, but trash is useful for crafting.',
 'If the apocalypse had a tutorial, {player} would skip it and complain.',
 'I swear, babysitting this squad is harder than fighting zombies.'
];
const VERITY_HIT_LINES=[
 '{player}, that zombie just folded you like laundry.',
 'Nice catch, {player}. You caught the entire zombie.',
 '{player}, try dodging. It is a feature, not a rumor.',
 'That hit was so avoidable I almost feel bad. Almost.'
];
const VERITY_KILL_LINES=[
 'Whoa, {player} actually hit something. Mark the calendar.',
 'Good job, {player}. Only took the end of the world.',
 '{player} got a kill! Somebody alert the historians.',
 'Was that skill, {player}, or did the zombie trip?'
];
const VERITY_DOWN_LINES=[
 '{player}, you had ONE job: stay alive.',
 'Great. {player} is taking another dirt nap. Someone revive them.',
 '{player}, the ground is not a bed. Get up.',
 'Can someone pick up {player}? Our disaster quota is full.'
];
function veritySay(line,targetId=null,force=false){
 const v=world?.verity;if(!v||v.state==='sleeping'||!line)return false;
 if(!force&&(v.chatCooldown||0)>0)return false;
 world.verityChat??=[];world.verityChatSerial=(world.verityChatSerial||0)+1;
 world.verityChat.push({id:world.verityChatSerial,at:world.time||0,text:String(line).slice(0,200),target:targetId});
 if(world.verityChat.length>8)world.verityChat.splice(0,world.verityChat.length-8);
 v.chatCooldown=force?5:8;v.chatTimer=16+Math.random()*15;
 return true;
}
function verityBanter(dt){
 const v=world?.verity;if(!v||v.state==='sleeping')return;
 v.chatCooldown=Math.max(0,(v.chatCooldown||0)-dt);
 if(v.state!=='active'||v.hp<=0)return;
 v.chatTimer=(v.chatTimer??7)-dt;
 v.chatMemory??={};
 const players=world.players||[],alive=players.filter(p=>p.hp>0);
 for(const p of players){
  const old=v.chatMemory[p.id],cur={hp:p.hp,kills:p.kills||0};
  v.chatMemory[p.id]=cur;
  if(!old||v.chatCooldown>0)continue;
  if(old.hp>0&&p.hp<=0){veritySay(VERITY_DOWN_LINES[Math.floor(Math.random()*VERITY_DOWN_LINES.length)],p.id);return;}
  if(p.hp>0&&old.hp-p.hp>=12&&Math.random()<.7){veritySay(VERITY_HIT_LINES[Math.floor(Math.random()*VERITY_HIT_LINES.length)],p.id);return;}
  if(cur.kills>old.kills&&Math.random()<.35){veritySay(VERITY_KILL_LINES[Math.floor(Math.random()*VERITY_KILL_LINES.length)],p.id);return;}
 }
 if(v.chatTimer>0||v.chatCooldown>0||!alive.length)return;
 const target=alive[Math.floor(Math.random()*alive.length)];
 veritySay(VERITY_IDLE_LINES[Math.floor(Math.random()*VERITY_IDLE_LINES.length)],target.id);
}
function verityReplyToPlayer(id,message){
 const v=world?.verity;if(!v||v.state!=='active'||!world.players.some(p=>p.id===id)||typeof message!=='string')return;
 const msg=message.trim().toLowerCase();
 if(!msg||(!/\b(verity|varity|smiley|bot)\b/.test(msg)&&Math.random()>.16))return;
 let line;
 if(/\b(help|save|revive|heal)\b/.test(msg))line='I am trying, {player}. Maybe try staying alive for three seconds.';
 else if(/\b(hi|hey|hello|sup)\b/.test(msg))line='Oh great, {player} learned to type. Still waiting on the aiming part.';
 else if(/\b(thanks|thank you|ty)\b/.test(msg))line='You are welcome, {player}. I accept payment in competent teammates.';
 else if(/\b(shut up|quiet|stop)\b/.test(msg))line='Make me, {player}. Actually, please do not. I am busy carrying you.';
 else line='I heard that, {player}. Your chat game is almost as bad as your aim.';
 veritySay(line,id);
}

function tickVerity(dt){
 const v=world.verity;if(!v||v.state==='sleeping')return;
 v.cool=Math.max(0,(v.cool||0)-dt);v.roll=Math.max(0,(v.roll||0)-dt);v.rollCooldown=Math.max(0,(v.rollCooldown||0)-dt);v.invuln=Math.max(0,(v.invuln||0)-dt);v.healCooldown=Math.max(0,(v.healCooldown||0)-dt);
 if(v.hp<=0){v.hp=0;v.state='down';return;}
 const allies=world.players.filter(p=>p.hp>0);if(!allies.length)return;
 const leader=allies.find(p=>p.id===v.following)||allies.reduce((a,b)=>Math.hypot(a.x-v.x,a.y-v.y)<Math.hypot(b.x-v.x,b.y-v.y)?a:b);
 const nearZ=world.zombies.filter(z=>z.hp>0&&Math.hypot(z.x-v.x,z.y-v.y)<450).sort((a,b)=>Math.hypot(a.x-v.x,a.y-v.y)-Math.hypot(b.x-v.x,b.y-v.y));
 const target=nearZ.find(z=>clearShot(v.x,v.y,z.x,z.y))||nearZ[0];
 let tx=leader.x-36,ty=leader.y+34;
 if(target&&v.weapon){
  const def=itemDefs[v.weapon],distance=Math.hypot(target.x-v.x,target.y-v.y);
  const desired=def.range>=100?Math.min(245,def.range*.43):44;
  const ang=Math.atan2(target.y-v.y,target.x-v.x);v.face=ang;
  if(distance<desired*.75){tx=v.x-Math.cos(ang)*80;ty=v.y-Math.sin(ang)*80;}
  else if(distance>desired*1.2){tx=target.x-Math.cos(ang)*desired;ty=target.y-Math.sin(ang)*desired;}
  else {tx=v.x;ty=v.y;}
  if(def.range>=100&&v.ammo<1){v.cool=Math.max(v.cool,1);}
  else if(v.cool<=0&&distance<Math.min(def.range+15,760)&&clearShot(v.x,v.y,target.x,target.y)){
   v.cool=def.cool*1.08;weaponParticles(v.weapon,v.x,v.y,ang);
   if(def.range>=100){v.ammo--;world.shots.push({x:v.x+Math.cos(ang)*16,y:v.y+Math.sin(ang)*16,vx:Math.cos(ang)*730,vy:Math.sin(ang)*730,life:def.range/730,damage:Math.round(weaponDamage(v.weapon,v.weaponLevel||1)*.85),owner:'verity',kind:v.weapon,trail:[]});burst(v.x,v.y,'#ffe29b',4);}
   else if(distance<def.range+20){const dmg=Math.round(weaponDamage(v.weapon,v.weaponLevel||1)*.87);target.hp-=dmg;impact(target,v,dmg);target.hit=.12;if(target.hp<=0){world.score+=target.boss?500:10;zombieLoot(target);}}
  }
 }else if(target){v.face=Math.atan2(target.y-v.y,target.x-v.x);}
 const closeThreat=nearZ.find(z=>Math.hypot(z.x-v.x,z.y-v.y)<72);
 if(closeThreat&&v.rollCooldown<=0){v.roll=.36;v.rollCooldown=2.4;v.invuln=.4;const ang=Math.atan2(v.y-closeThreat.y,v.x-closeThreat.x)+((Math.floor(world.time*5)%2)?.5:-.5);v.dodgeX=Math.cos(ang);v.dodgeY=Math.sin(ang);burst(v.x,v.y,'#f5dc63',7);}
 const distanceToGoal=Math.hypot(tx-v.x,ty-v.y),speed=v.roll>0?355:190;
 const direct=verityLineClear(v.x,v.y,tx,ty);
 v.routeClock=(v.routeClock||0)-dt;
 if(!v.roll&&(!direct||v.stuck>.35)&&(v.routeClock<=0||(v.route?.length&&Math.hypot(tx-(v.routeGoalX||0),ty-(v.routeGoalY||0))>100))){
  v.route=verityFindPath(v.x,v.y,tx,ty);v.routeGoalX=tx;v.routeGoalY=ty;v.routeClock=.7;
 }
 if(direct&&v.stuck<.25)v.route=[];
 while(v.route?.length&&Math.hypot(v.route[0].x-v.x,v.route[0].y-v.y)<24)v.route.shift();
 let goalX=tx,goalY=ty;
 if(!v.roll&&v.route?.length&&!direct){goalX=v.route[0].x;goalY=v.route[0].y;}
 let dx=goalX-v.x,dy=goalY-v.y,dist=Math.hypot(dx,dy);
 let ux=v.roll>0?v.dodgeX:(dist>20?dx/(dist||1):0),uy=v.roll>0?v.dodgeY:(dist>20?dy/(dist||1):0);
 const oldX=v.x,oldY=v.y;
 move(v,ux*speed*dt,uy*speed*dt,14);
 let traveled=Math.hypot(v.x-oldX,v.y-oldY);
 if(traveled<speed*dt*.18&&distanceToGoal>45){
  v.stuck=(v.stuck||0)+dt;v.routeClock=0;
  // Try clear lateral escapes before returning to the cached path.
  if(v.stuck>.18){let best=null,bestScore=-Infinity;for(const angle of [Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2,Math.PI,-Math.PI/4,Math.PI/4]){
   const a=Math.atan2(dy,dx)+angle,sx=Math.cos(a),sy=Math.sin(a);
   if(solid(v.x+sx*35,v.y+sy*35,14))continue;
   const progress=(tx-v.x)*sx+(ty-v.y)*sy;
   if(progress>bestScore){bestScore=progress;best={x:sx,y:sy};}
  }
  if(best)move(v,best.x*speed*dt,best.y*speed*dt,14);
  }
  // Only emergency-reposition after prolonged obstruction and far from the squad.
  if(v.stuck>5&&Math.hypot(v.x-leader.x,v.y-leader.y)>460){
   for(const [ox,oy] of [[-45,45],[45,45],[-45,-45],[45,-45],[0,65],[65,0],[-65,0]])if(!solid(leader.x+ox,leader.y+oy,14)){
    v.x=leader.x+ox;v.y=leader.y+oy;v.route=[];v.routeClock=0;v.stuck=0;break;
   }
  }
 }else v.stuck=Math.max(0,(v.stuck||0)-dt*2);
 v.step=(v.step||0)+dt*speed/23;
 // Automatic bandage-style recovery is deliberately slow; player healing still matters.
 // Verity heals only through player-supplied Care Mints.
}
function drawVerityEquipment(v){
 // Equipment is drawn in Verity's own rotating character space, so it
 // follows his movement, rolls and facing direction rather than floating.
 if(v.armor){
  const id=v.armor,heavy=['heavy','military'].includes(id),vest=['vest','tactical','scrapvest'].includes(id);
  const base=id==='military'?'#536a45':id==='heavy'?'#626e76':id==='tactical'?'#52675c':id==='hazmat'?'#f4bc35':id==='scrapvest'?'#7b6151':id==='jacket'?'#644b3e':'#5d6971';
  ctx.save();
  ctx.fillStyle=base;ctx.strokeStyle=heavy?'#222e31':'#25302d';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,0,heavy?18.5:18,0,Math.PI*2);ctx.lineWidth=heavy?7:5;ctx.strokeStyle=base;ctx.stroke();ctx.lineWidth=1.5;ctx.strokeStyle='#25302d';ctx.beginPath();ctx.arc(0,0,heavy?21:20,0,Math.PI*2);ctx.stroke();
  if(vest||heavy){ctx.strokeStyle='#c5c9b6';ctx.lineWidth=heavy?5:3;ctx.beginPath();ctx.arc(0,0,heavy?15:16,-2.65,-.48);ctx.stroke();ctx.beginPath();ctx.arc(0,0,heavy?15:16,.48,2.65);ctx.stroke();}
  if(id==='hazmat'){ctx.strokeStyle='#fbe59b';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,15,Math.PI*1.1,Math.PI*1.9);ctx.stroke();}
  if(heavy){ctx.fillStyle='#384448';for(const x of [-15,15]){ctx.beginPath();ctx.arc(x,0,6,0,Math.PI*2);ctx.fill();}}
  ctx.restore();
 }
 if(!v.weapon||v.state==='sleeping')return;
 const id=v.weapon,def=itemDefs[id];if(!def)return;
 ctx.save();
 // Verity faces the target when fighting and carries the weapon beside him.
 // Compensate for his idle/roll animation so the weapon points forward.
 const bodyTurn=v.state==='down'?0:v.roll>0?v.step*1.8:Math.sin(v.step||0)*.11;
 ctx.rotate(-bodyTurn+(v.face||0));
 ctx.translate(17,5);
 const ranged=def.range>=100,blade=['machete','katana','axe','reaper','voidblade','sunbreaker','crowbar'].includes(id);
 const metallic=id==='voidblade'?'#ae82ed':id==='sunbreaker'?'#ffd06a':id==='reaper'?'#cc5660':'#dce5e4';
 ctx.lineCap='round';ctx.lineJoin='round';
 if(ranged){
  ctx.fillStyle=['railgun','sniper','rifle','hellfire','thunderbolt'].includes(id)?'#475e69':'#434d4f';
  ctx.strokeStyle='#1b262b';ctx.lineWidth=2;
  const long=['sniper','rifle','railgun','hellfire','thunderbolt','eclipse'].includes(id);
  ctx.fillRect(-3,-5,long?40:26,10);ctx.strokeRect(-3,-5,long?40:26,10);
  ctx.fillStyle='#aebcc0';ctx.fillRect(long?24:17,-2,long?17:10,4);
  ctx.fillStyle='#74563f';ctx.fillRect(3,4,7,11);
  if(['shotgun','doublebarrel'].includes(id)){ctx.fillStyle='#b2bdc0';ctx.fillRect(12,-5,21,3);}
  if(long){ctx.fillStyle='#293b42';ctx.fillRect(10,-10,12,5);}
 }else if(blade){
  ctx.strokeStyle='#583f32';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(6,0);ctx.stroke();
  ctx.strokeStyle='#b29c70';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(5,-6);ctx.lineTo(5,6);ctx.stroke();
  ctx.fillStyle=metallic;ctx.strokeStyle='#46525a';ctx.lineWidth=1.4;
  const reach=id==='katana'||id==='reaper'?34:id==='machete'?27:id==='axe'?24:29;
  if(id==='axe'){ctx.fillStyle='#abb7b8';ctx.beginPath();ctx.moveTo(8,-5);ctx.lineTo(21,-12);ctx.lineTo(26,-9);ctx.lineTo(26,9);ctx.lineTo(21,12);ctx.lineTo(8,5);ctx.closePath();ctx.fill();ctx.stroke();}
  else{ctx.beginPath();ctx.moveTo(7,-5);ctx.lineTo(reach,-(id==='katana'?4:8));ctx.lineTo(reach+6,0);ctx.lineTo(reach,4);ctx.lineTo(7,5);ctx.closePath();ctx.fill();ctx.stroke();}
 }else{
  ctx.strokeStyle=['bat','pipe','crowbar'].includes(id)?'#7d6552':'#b1b9bb';
  ctx.lineWidth=['sledge','hammer'].includes(id)?7:5;
  ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(30,0);ctx.stroke();
  if(['sledge','hammer'].includes(id)){ctx.fillStyle='#79888b';ctx.fillRect(23,-9,13,18);}
  if(id==='chainsaw'){ctx.fillStyle='#d18535';ctx.fillRect(0,-9,20,18);ctx.fillStyle='#b9c3c1';ctx.fillRect(17,-5,24,10);ctx.strokeStyle='#35403f';ctx.lineWidth=2;for(let x=20;x<41;x+=5){ctx.beginPath();ctx.moveTo(x,-6);ctx.lineTo(x+3,-9);ctx.stroke();}}
 }
 ctx.restore();
}
function drawVerity(v){
 ctx.save();ctx.translate(v.x,v.y);
 ctx.fillStyle='#06110e80';ctx.beginPath();ctx.ellipse(3,13,22,9,0,0,Math.PI*2);ctx.fill();
 ctx.rotate(v.state==='sleeping'?-0.25:v.roll>0?v.step*1.8:Math.sin(v.step||0)*.11);
 ctx.fillStyle=v.state==='down'?'#b28c2a':'#ffdf00';ctx.strokeStyle='#e9ba00';ctx.lineWidth=2;
 ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.fillStyle='#111';if(v.state==='sleeping'){ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(-10,-4);ctx.lineTo(-4,-4);ctx.moveTo(4,-4);ctx.lineTo(10,-4);ctx.stroke();}else{ctx.beginPath();ctx.ellipse(-7,-5,2.2,3.5,0,0,7);ctx.ellipse(7,-5,2.2,3.5,0,0,7);ctx.fill();}
 ctx.strokeStyle='#111';ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(0,-1,12,.18,Math.PI-.18);ctx.stroke();drawVerityEquipment(v);ctx.restore();
 ctx.textAlign='center';ctx.font='bold 11px system-ui';ctx.fillStyle='#ffef97';ctx.fillText('VERITY'+(v.state==='sleeping'?' · Zzz':v.state==='down'?' · DOWN':''),v.x,v.y-33);
 if(v.state!=='sleeping'){ctx.fillStyle='#1a211d';ctx.fillRect(v.x-25,v.y-28,50,5);ctx.fillStyle='#8be28b';ctx.fillRect(v.x-25,v.y-28,50*Math.max(0,v.hp)/100,5);}
}

function newWorld(ids){const m=makeMap();return{mode:session?.gameMode||'endless',story:{stage:0,hold:0,defense:0},effects:[],blood:[],eventSerial:0,time:0,won:false,wave:0,difficulty:session?.difficulty||'normal',score:0,players:ids.map((id,i)=>player(id,i)),zombies:[],zombieSerial:0,shots:[],spawned:0,remaining:0,between:2,ended:false,houses:m.houses,chests:m.chests,barriers:[],barrierSerial:0,barrierRevision:0,drops:[],dropSerial:0,mythicCreated:false,verity:null,verityChat:[],verityChatSerial:0,notice:''};}
function houseAt(x,y){return(world?.houses||[]).find(h=>x>h.x+10&&x<h.x+h.w-10&&y>h.y+10&&y<h.y+h.h-10);}
function nearDoor(p){let best=null,d=85;for(const h of world?.houses||[]){let dist=Math.hypot(p.x-h.doorX,p.y-h.doorY);if(dist<d){best=h;d=dist;}}return best;}
function carCollision(x,y,r=12){for(let i=0;i<70;i++){const cx=90+(i%7)*500,cy=155+Math.floor(i/7)*245;const nearX=Math.max(cx-24,Math.min(x,cx+29)),nearY=Math.max(cy-43,Math.min(y,cy+47));if((x-nearX)**2+(y-nearY)**2<r*r)return true;}return false;}
function solid(x,y,r=12){if(barrierCollision(x,y,r))return true;if(x<r||y<r||x>MAPW-r||y>MAPH-r||carCollision(x,y,r))return true;for(const h of world?.houses||[]){const t=6,half=34;const overlaps=(ax,ay,bx,by)=>{const closestX=Math.max(ax,Math.min(x,bx)),closestY=Math.max(ay,Math.min(y,by));return (x-closestX)**2+(y-closestY)**2<r*r;};if(overlaps(h.x-t,h.y-t,h.x+t,h.y+h.h+t)||overlaps(h.x+h.w-t,h.y-t,h.x+h.w+t,h.y+h.h+t)||overlaps(h.x-t,h.y-t,h.x+h.w+t,h.y+t))return true;if(overlaps(h.x-t,h.y+h.h-t,h.doorX-half,h.y+h.h+t)||overlaps(h.doorX+half,h.y+h.h-t,h.x+h.w+t,h.y+h.h+t))return true;if(!h.doorOpen&&h.doorHp>0&&overlaps(h.doorX-half,h.doorY-t,h.doorX+half,h.doorY+t))return true;}return false;}

// Concrete barriers use an oriented 84 × 28 rectangle. The same collision
// check is used for survivors, infected, shots and placement validation.
function barrierCollision(x,y,r=12,ignoreId=null){
 for(const b of world?.barriers||[]){
  if(b.hp<=0||b.id===ignoreId)continue;
  const dx=x-b.x,dy=y-b.y,c=Math.cos(b.angle),sn=Math.sin(b.angle);
  const lx=dx*c+dy*sn,ly=-dx*sn+dy*c;
  const ax=Math.max(-42,Math.min(42,lx)),ay=Math.max(-14,Math.min(14,ly));
  if((lx-ax)**2+(ly-ay)**2<r*r)return b;
 }
 return null;
}
function placeConcreteBarrier(p){
 if((p.concrete||0)<1){world.notice='You need a concrete barrier. Find concrete in chests.';return false;}
 if((world.barriers||[]).length>=90){world.notice='Maximum 90 concrete barriers reached';return false;}
 const angle=Math.abs(Math.cos(p.face||0))>.707?Math.PI/2:0;
 const x=Math.round((p.x+Math.cos(p.face||0)*88)/14)*14,y=Math.round((p.y+Math.sin(p.face||0)*88)/14)*14;
 const c=Math.cos(angle),sn=Math.sin(angle);
 for(const [u,v] of [[0,0],[-42,0],[42,0],[-42,-14],[42,-14],[-42,14],[42,14]]){
  const px=x+u*c-v*sn,py=y+u*sn+v*c;
  if(solid(px,py,19)){world.notice='Not enough clear space for concrete';return false;}
 }
 if((world.players||[]).some(q=>Math.hypot(q.x-x,q.y-y)<76)||(world.verity&&Math.hypot(world.verity.x-x,world.verity.y-y)<76)){world.notice='Move farther away from survivors to place concrete';return false;}
 p.concrete--;world.barrierSerial=(world.barrierSerial||0)+1;
 (world.barriers||(world.barriers=[])).push({id:world.barrierSerial,x,y,angle,hp:1800,maxHp:1800});
 world.barrierRevision=(world.barrierRevision||0)+1;
 world.notice=name(p.id)+' placed reinforced concrete (1800 HP)';
 return true;
}
// Cached reachability grid: zombies navigate around barriers, rather than
// attacking one just because it lies on the straight line to the survivor.
const NAV_STEP=64,NAV_COLS=Math.ceil(MAPW/NAV_STEP),NAV_ROWS=Math.ceil(MAPH/NAV_STEP);
let concreteNavCache=new Map(),concreteNavWorld=null;
function concreteNavFor(target){
 if(concreteNavWorld!==world){concreteNavWorld=world;concreteNavCache.clear();}
 const key=target.id,rev=world.barrierRevision||0,now=world.time||0,cached=concreteNavCache.get(key);
 if(cached&&cached.rev===rev&&now-cached.time<1.1&&Math.hypot(cached.x-target.x,cached.y-target.y)<48)return cached;
 const grid=new Int16Array(NAV_COLS*NAV_ROWS).fill(-1),queue=new Int32Array(grid.length),blocked=new Uint8Array(grid.length);
 const cell=(x,y)=>Math.min(NAV_ROWS-1,Math.max(0,Math.floor(y/NAV_STEP)))*NAV_COLS+Math.min(NAV_COLS-1,Math.max(0,Math.floor(x/NAV_STEP)));
 const free=i=>{if(blocked[i])return false;const xx=(i%NAV_COLS+.5)*NAV_STEP,yy=(Math.floor(i/NAV_COLS)+.5)*NAV_STEP;if(solid(xx,yy,11)){blocked[i]=1;return false;}return true;};
 let start=cell(target.x,target.y);if(!free(start)){let best=Infinity;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const cx=Math.floor(target.x/NAV_STEP)+dx,cy=Math.floor(target.y/NAV_STEP)+dy;if(cx<0||cx>=NAV_COLS||cy<0||cy>=NAV_ROWS)continue;const i=cy*NAV_COLS+cx,v=Math.hypot(cx+.5-target.x/NAV_STEP,cy+.5-target.y/NAV_STEP);if(v<best&&free(i)){best=v;start=i;}}}
 let head=0,tail=0;if(free(start)){queue[tail++]=start;grid[start]=0;}
 while(head<tail){const i=queue[head++],x=i%NAV_COLS,y=Math.floor(i/NAV_COLS);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=NAV_COLS||ny>=NAV_ROWS)continue;const ni=ny*NAV_COLS+nx;if(grid[ni]>=0||!free(ni))continue;let edgeBlocked=false;for(const part of [.25,.5,.75]){if(solid((x+.5+dx*part)*NAV_STEP,(y+.5+dy*part)*NAV_STEP,11)){edgeBlocked=true;break;}}if(edgeBlocked)continue;grid[ni]=grid[i]+1;queue[tail++]=ni;}
 }
 const result={grid,blocked,cell,rev,time:now,x:target.x,y:target.y};concreteNavCache.set(key,result);return result;
}
function concreteSteering(z,p){
 const barriers=world.barriers||[];if(!barriers.length)return null;
 let near=null,closest=100;
 for(const b of barriers){const d=Math.hypot(z.x-b.x,z.y-b.y);if(b.hp>0&&d<closest){near=b;closest=d;}}
 if(!near)return null;
 const nav=concreteNavFor(p),col=Math.min(NAV_COLS-1,Math.max(0,Math.floor(z.x/NAV_STEP))),row=Math.min(NAV_ROWS-1,Math.max(0,Math.floor(z.y/NAV_STEP)));
 let best=null,value=Infinity;
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
  const cx=col+dx,cy=row+dy;if(cx<0||cy<0||cx>=NAV_COLS||cy>=NAV_ROWS)continue;
  const i=cy*NAV_COLS+cx,dist=nav.grid[i];if(dist<0)continue;
  const wx=(cx+.5)*NAV_STEP,wy=(cy+.5)*NAV_STEP;
  if(Math.hypot(wx-z.x,wy-z.y)>170)continue;
  const score=dist*64+Math.hypot(wx-z.x,wy-z.y)*.65;
  if(score<value&&!solid(wx,wy,11)){value=score;best={x:wx,y:wy};}
 }
 // If a route exists, always seek it. Only attack concrete when the
 // survivor is unreachable, the zombie is next to the wall, and the
 // zombie has already spent time trying to find a route.
 return best?{point:best,reachable:true,barrier:near}:{point:null,reachable:false,barrier:near};
}
function drawConcreteBarriers(){
 for(const b of world?.barriers||[]){if(b.hp<=0||b.x<camera.x-100||b.x>camera.x+W+100||b.y<camera.y-100||b.y>camera.y+H+100)continue;
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.angle);
  ctx.fillStyle='#101a1e99';ctx.fillRect(-38,-8,84,36);
  ctx.fillStyle='#6d7779';ctx.fillRect(-42,-14,84,28);
  ctx.fillStyle='#a6afb0';ctx.fillRect(-42,-14,84,6);
  ctx.fillStyle='#4c575a';ctx.fillRect(-42,8,84,6);
  ctx.fillStyle='#858f91';ctx.fillRect(-33,-7,66,13);
  ctx.strokeStyle='#3d484b';ctx.lineWidth=2;ctx.strokeRect(-42,-14,84,28);
  for(const xx of [-27,27]){ctx.fillStyle='#424b4d';ctx.fillRect(xx-2,-11,4,22);}
  if(b.hp<b.maxHp){ctx.fillStyle='#2e2827';ctx.fillRect(-39,-25,78,5);ctx.fillStyle=b.hp<b.maxHp*.25?'#dd6a59':'#a5d1b4';ctx.fillRect(-39,-25,78*b.hp/b.maxHp,5);}
  ctx.restore();
 }
}

function repairDoor(p){const h=nearDoor(p);if(!h){world.notice='Get closer to a door to repair it';return;}if(h.doorHp<=0){if((p.boards||0)<2){world.notice='You need 2 wooden boards to rebuild this door';return;}p.boards-=2;h.doorMaxHp=100+(h.boards||0)*55;h.doorHp=Math.min(65,h.doorMaxHp);h.doorOpen=false;world.notice=name(p.id)+' rebuilt a destroyed door (65 HP)';return;}if(h.doorHp>=h.doorMaxHp){world.notice='Door is already fully repaired';return;}if(!p.boards){world.notice='You need a wooden board to repair the door';return;}p.boards--;h.doorHp=Math.min(h.doorMaxHp,h.doorHp+65);world.notice=name(p.id)+' repaired a door (+65 HP)';}
function toggleDoor(p,board=false){const h=nearDoor(p);if(!h)return false;if(board){if(h.doorHp<=0){world.notice='This door is destroyed';return false;}if(h.boards>=4){world.notice='Door fully reinforced (4/4)';return false;}if(!(p.boards>0)){world.notice='You need wooden boards! Loot them from chests.';return false;}p.boards--;h.boards=Math.min(4,(h.boards||0)+1);h.doorMaxHp=100+h.boards*55;h.doorHp=Math.min(h.doorMaxHp,h.doorHp+55);h.doorOpen=false;world.notice=name(p.id)+' boarded a door ('+h.boards+'/4)';}else{if(h.doorHp<=0){world.notice='This door is broken';return true;}h.doorOpen=!h.doorOpen;world.notice=name(p.id)+(h.doorOpen?' opened':' closed')+' a door';}return true;}
function move(entity,dx,dy,r=12){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/Math.max(4,r*.75)));for(let i=0;i<steps;i++){if(!solid(entity.x+dx/steps,entity.y,r))entity.x+=dx/steps;else if(entity.vx)entity.vx=0;if(!solid(entity.x,entity.y+dy/steps,r))entity.y+=dy/steps;else if(entity.vy)entity.vy=0;}}
function grantLoot(p,id){if(itemDefs[id]?.type==='weapon'&&itemDefs[id].range>100)p.ammo+=24;if(id==='ammoBox'){p.ammo+=48;return;}if(id==='bandage'){p.hp=Math.min(100,p.hp+28);return;}if(id==='energy'){p.energy=(p.energy||0)+1;world.notice=name(p.id)+' picked up an energy drink';return;}if(id==='concrete')p.concrete=(p.concrete||0)+2;else if(id==='medkit')p.medkits++;else if(id==='mints')p.mints=(p.mints||0)+2;else if(id==='boards')p.boards=(p.boards||0)+2;else {normalizeCopies(p);p.inventory.push(id);p.itemLevels.push(itemDefs[id]?.type==='weapon'?1:0);if(itemDefs[id]?.type==='armor'&&!p.armor)p.armor=id;if(itemDefs[id]?.type==='weapon')autoMergeCopies(p,id);}world.notice=name(p.id)+' collected '+(itemDefs[id]?.name||id)+'!';}
const LOOT_WEIGHTS={concrete:7,boards:18,mints:17,bandage:14,medkit:10,ammoBox:12,energy:10,pipe:12,hammer:11,crowbar:10,jacket:9,scrapvest:8,axe:7,pistol:6,machete:6,vest:6,hazmat:5,revolver:4,shotgun:4,smg:3,tactical:3,sledge:2.5,rifle:2,katana:1.7,doublebarrel:1.5,heavy:1.3,military:.6,sniper:.5,chainsaw:.35,sunbreaker:.16,reaper:.2,voidblade:.16,railgun:.12,hellfire:.17,thunderbolt:.14};
const LOOT_UNLOCK={smg:3,sledge:4,rifle:5,katana:5,doublebarrel:5,heavy:5,military:7,sniper:7,chainsaw:6,sunbreaker:10,reaper:9,voidblade:10,railgun:12,hellfire:10,thunderbolt:11};
function randomLoot(wave=1,options){if(wave>=15&&!world?.mythicCreated&&Math.random()<.0005){world.mythicCreated=true;world.notice='✦ A MYTHIC WEAPON HAS APPEARED THIS MATCH!';return 'eclipse';}const available=(options||lootPool).filter(id=>(LOOT_UNLOCK[id]||1)<=wave);const pool=available.filter(id=>id!=='eclipse');if(!pool.length)return 'boards';const weight=id=>(LOOT_WEIGHTS[id]||1)*(itemDefs[id]?.type==='weapon'?3.5:1);let total=0;for(const id of pool)total+=weight(id);let roll=Math.random()*total;for(const id of pool){roll-=weight(id);if(roll<0)return id;}return pool[pool.length-1];}
function spawnDrop(){const living=world.players.filter(p=>p.hp>0);if(!living.length)return;const p=living[Math.floor(Math.random()*living.length)],pool=lootPool;const id=randomLoot(world.wave,pool);for(let i=0;i<20;i++){const angle=Math.random()*Math.PI*2,dist=105+Math.random()*170,x=Math.max(20,Math.min(MAPW-20,p.x+Math.cos(angle)*dist)),y=Math.max(20,Math.min(MAPH-20,p.y+Math.sin(angle)*dist));if(!solid(x,y,23)){world.drops.push({id:++world.dropSerial,item:id,x,y});world.notice='A supply drop landed nearby!';return;}}}
function zombieLoot(z){if(Math.random()>.36)return;const pool=['mints','boards','medkit','bandage','ammoBox','energy','crowbar','pipe','machete','hammer','axe','pistol','revolver','smg','shotgun','rifle','chainsaw','vest','tactical','sunbreaker','reaper','voidblade','railgun','hellfire','thunderbolt'];const id=randomLoot(world.wave,pool);world.drops.push({id:++world.dropSerial,item:id,x:z.x,y:z.y});}
function action(p,a){if(p.hp<=0)return;if(a.barrier){placeConcreteBarrier(p);return;}if(a.repair){repairDoor(p);return;}if(a.board){toggleDoor(p,true);return;}if(a.door){toggleDoor(p);return;}if(!a.use)return;let drop=null,dropDist=65;for(const d of world.drops||[]){const k=Math.hypot(d.x-p.x,d.y-p.y);if(k<dropDist){drop=d;dropDist=k;}}if(drop){if(drop.kind&&!pickupPlayerDrop(p,drop))return;world.drops=world.drops.filter(d=>d.id!==drop.id);if(!drop.kind)grantLoot(p,drop.item);return;}const nearest=nearbyChest(p);if(nearest){p.chestHold=Math.min(1.25,(p.chestHold||0)+.05);return;}if(p.medkits&&p.hp<100){p.medkits--;p.hp=Math.min(100,p.hp+55);world.notice=name(p.id)+' used a medkit';}}

const DROP_TYPES={concrete:'concrete',ammo:'ammoBox',medkits:'medkit',mints:'mints',boards:'boards',energy:'energy'};
function dropInventoryItem(p,req){
 if(!world||!p||!world.players.includes(p)||p.hp<=0||!req)return false;
 let item,props;
 if(req.kind==='gear'){
  normalizeCopies(p);const i=req.slot;if(!Number.isSafeInteger(i)||i<0||i>=p.inventory.length)return false;
  item=p.inventory[i];const def=itemDefs[item];if(!def||!['weapon','armor'].includes(def.type))return false;
  if(def.type==='weapon'&&p.inventory.filter(v=>itemDefs[v]?.type==='weapon').length<=1)return false;
  props={kind:'gear',level:itemDefs[item]?.type==='weapon'?levelOf(p,i):0};p.inventory.splice(i,1);p.itemLevels.splice(i,1);for(const hand of ['primary','secondary']){const k=p.equippedIndices[hand];if(k===i)p.equippedIndices[hand]=-1;else if(k>i)p.equippedIndices[hand]=k-1;}
  if(def.type==='weapon'&&!p.inventory.includes(item))delete p.weaponLevels?.[item];
  const fallback=p.inventory.find(v=>itemDefs[v]?.type==='weapon')||null;
  for(const hand of ['primary','secondary'])if(p[hand]===item&&!p.inventory.includes(item))p[hand]=fallback;
  if(p.armor===item&&!p.inventory.includes(item))p.armor=p.inventory.find(v=>itemDefs[v]?.type==='armor')||null;
  normalizeCopies(p);
 }else if(req.kind==='stack'&&Object.prototype.hasOwnProperty.call(DROP_TYPES,req.resource)){
  const key=req.resource,n=req.amount,total=Math.floor(Number(p[key])||0);
  if(!Number.isSafeInteger(n)||n<1||n>9999||n>total)return false;
  p[key]=total-n;item=DROP_TYPES[key];props={kind:'stack',resource:key,quantity:n};
 }else return false;
 let x=p.x+Math.cos(p.face||0)*40,y=p.y+Math.sin(p.face||0)*40;
 for(const [px,py] of [[x,y],[p.x+25,p.y],[p.x-25,p.y],[p.x,p.y+30],[p.x,p.y]])if(!solid(px,py,11)){x=px;y=py;break}
 world.drops??=[];world.dropSerial=(world.dropSerial||0)+1;world.drops.push({id:world.dropSerial,item,x,y,owner:p.id,...props});
 world.notice=name(p.id)+' dropped '+(props.quantity?props.quantity+' × ':'')+(req.resource==='ammo'?'Ammo':itemDefs[item]?.name||item);
 return true;
}
function pickupPlayerDrop(p,d){
 if(d.kind==='stack'){
  if(!Object.prototype.hasOwnProperty.call(DROP_TYPES,d.resource)||!Number.isSafeInteger(d.quantity)||d.quantity<1||d.quantity>9999)return false;
  p[d.resource]=Math.max(0,Number(p[d.resource])||0)+d.quantity;
 }else if(d.kind==='gear'&&['weapon','armor'].includes(itemDefs[d.item]?.type)){
  normalizeCopies(p);p.inventory.push(d.item);p.itemLevels.push(itemDefs[d.item].type==='weapon'?Math.max(1,Math.min(5,Math.floor(Number(d.level)||1))):0);if(itemDefs[d.item].type==='armor'&&!p.armor)p.armor=d.item;if(itemDefs[d.item].type==='weapon')autoMergeCopies(p,d.item);
 }else return false;
 world.notice=name(p.id)+' picked up '+(d.quantity?d.quantity+' × ':'')+(d.resource==='ammo'?'Ammo':itemDefs[d.item]?.name||d.item);
 return true;
}
function requestInventoryDrop(kind,key,amount=1){
 if(!session||session.phase!=='play')return;const me=world?.players.find(p=>p.id===who());if(!me||me.hp<=0)return;
 const request=kind==='gear'?{kind,slot:key}:{kind:'stack',resource:key,amount};
 if(session.mode==='host'){if(hostWorker)hostWorker.postMessage({type:'drop',id:who(),request});else{dropInventoryItem(me,request);showInventory()}}
 else emit(session.host,{t:'dz-drop',id:session.id,request});
}

function equip(p,slot,hand='primary'){if(hostWorker){hostWorker.postMessage({type:'equip',id:p.id,slot,hand});return;}normalizeCopies(p);const id=p.inventory[slot];if(!itemDefs[id])return;if(itemDefs[id].type==='weapon'){const key=hand==='secondary'?'secondary':'primary';p.equippedIndices[key]=slot;p[key]=id;p.activeSlot=key;p.weapon=id;}else if(itemDefs[id].type==='armor')p.armor=id;}
function swapWeapon(p,hand){if(hostWorker){hostWorker.postMessage({type:'swap',id:p.id,hand});return;}normalizeCopies(p);const k=hand==='secondary'?'secondary':'primary';if(p[k]&&itemDefs[p[k]]?.type==='weapon'){p.activeSlot=k;p.weapon=p[k];}}

const button=(label,fn,parent=menu)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='padding:10px 17px;background:#345a56;border:1px solid #719c7f;border-radius:8px;color:white;cursor:pointer;margin:5px';b.onclick=fn;parent.append(b);return b;};
function addGameMessage(from,message){if(!gameChatLog)return;const row=document.createElement('div');row.style.cssText='padding:3px;overflow-wrap:anywhere';const n=document.createElement('b');n.textContent=name(from)+': ';n.style.color='#9de6a9';row.append(n,document.createTextNode(String(message).slice(0,220)));gameChatLog.append(row);while(gameChatLog.children.length>35)gameChatLog.firstChild.remove();gameChatLog.scrollTop=gameChatLog.scrollHeight;}
function renderVerityChat(){
 if(!world||!gameChatLog||session?.phase!=='play')return;
 for(const entry of world.verityChat||[]){
  if(!entry||!Number.isSafeInteger(entry.id)||entry.id<=lastVerityChatSeen)continue;
  lastVerityChatSeen=entry.id;
  if((world.time||0)-(entry.at||0)>18)continue;
  const row=document.createElement('div');row.style.cssText='padding:5px 4px;color:#f2df9a;overflow-wrap:anywhere;background:#27272063;border-left:2px solid #e2c95b;margin:2px 0';
  const sender=document.createElement('b');sender.textContent='☀ VERITY: ';sender.style.color='#ffe55b';
  const msg=String(entry.text||'').replace(/\{player\}/g,name(entry.target));
  row.append(sender,document.createTextNode(msg));gameChatLog.append(row);
  while(gameChatLog.children.length>35)gameChatLog.firstChild.remove();
  gameChatLog.scrollTop=gameChatLog.scrollHeight;
 }
}
function announceDeaths(){
 if(!world||!session||session.phase!=='play')return;
 for(const p of world.players){
  const alive=p.hp>0,previous=announcedDeaths.get(p.id);
  if(previous===true&&!alive&&gameChatLog){
   const row=document.createElement('div');row.style.cssText='padding:5px;color:#ffaaa5;font-weight:700;overflow-wrap:anywhere';
   row.textContent='☠ '+name(p.id)+' died!';gameChatLog.append(row);
   while(gameChatLog.children.length>35)gameChatLog.firstChild.remove();
   gameChatLog.scrollTop=gameChatLog.scrollHeight;
  }
  announcedDeaths.set(p.id,alive);
 }
}
function sendGameMessage(){if(!session||!gameChatInput)return;const msg=gameChatInput.value.trim().slice(0,220);if(!msg||performance.now()-lastGameChatAt<220)return;lastGameChatAt=performance.now();gameChatInput.value='';addGameMessage(who(),msg);if(session.mode==='host'){group({t:'dz-chat',id:session.id,message:msg,from:who()});if(hostWorker)hostWorker.postMessage({type:'verityChat',id:who(),message:msg});else verityReplyToPlayer(who(),msg);}else emit(session.host,{t:'dz-chat',id:session.id,message:msg});}
function build(){if(root)return;root=document.createElement('section');root.id='deadZoneRoot';root.style.cssText='position:fixed;inset:0;z-index:20000;background:#071411;display:none;align-items:stretch;justify-content:stretch;color:#e4f0de;font:15px system-ui';const style=document.createElement('style');style.textContent='@keyframes dz-roulette-spin{from{transform:rotate(-12deg)}to{transform:rotate(348deg)}}'+"#deadZoneRoot .dz-merge-button{background:#254d43;border:1px solid #69ab8d;color:#d9ffe5;border-radius:7px;padding:7px;font-weight:800;cursor:pointer}#deadZoneRoot .dz-merge-button:disabled{opacity:.35;cursor:default}#deadZoneRoot .dz-evolve-label{color:#ffe5a4;font-size:10px;font-weight:800}#deadZoneRoot .dz-evolve-options{display:flex;flex-wrap:wrap;gap:5px}#deadZoneRoot .dz-evolve-button{background:#493253;border:1px solid #b887d1;border-radius:6px;color:#fff0ff;padding:6px;font-size:10px;cursor:pointer}"+"#deadZoneRoot .dz-drop-supply{display:flex;flex-wrap:wrap;gap:6px;align-items:center}#deadZoneRoot .dz-drop-supply span{flex:1 1 95px}#deadZoneRoot .dz-drop-button{background:#4c2c2f;color:#ffe0d4;border:1px solid #b78575;border-radius:6px;padding:6px 8px;font-size:10px;cursor:pointer}#deadZoneRoot .dz-drop-button:disabled{opacity:.4;cursor:default}#deadZoneRoot .dz-drop-item{display:flex;flex-direction:column;gap:5px;min-width:0}#deadZoneRoot .dz-drop-item>.dz-inv-item{width:100%;flex:1}"+'\n'+`#deadZoneRoot .dz-lobby-screen{background:radial-gradient(ellipse at top,#17392d 0,#071411 68%);padding:18px 24px!important;color:#e4f0de}#deadZoneRoot .dz-lobby-shell{max-width:1020px;margin:0 auto;text-align:left}#deadZoneRoot .dz-lobby-kicker{color:#90c8aa;font-size:11px;font-weight:900;letter-spacing:3px}#deadZoneRoot .dz-lobby-heading{font-size:clamp(32px,5vw,58px);line-height:1;margin:6px 0;color:#e5f5df;font-weight:1000;letter-spacing:4px;text-shadow:0 0 30px #7fac7555}#deadZoneRoot .dz-lobby-subtitle{color:#a9bcb3;margin:8px 0 20px}#deadZoneRoot .dz-lobby-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:16px}#deadZoneRoot .dz-lobby-card,#deadZoneRoot .dz-lobby-bottom{padding:20px;border:1px solid #3b6755;background:linear-gradient(155deg,#1b3329,#0c1b18);border-radius:16px;box-shadow:0 15px 35px #0007}#deadZoneRoot .dz-lobby-label{display:block;font-size:11px;color:#a9c7aa;letter-spacing:2px;font-weight:800;margin:10px 0}#deadZoneRoot .dz-lobby-code{font:900 clamp(35px,5vw,62px) monospace;letter-spacing:.22em;color:#f4df94;text-align:center;background:#071411;border:1px solid #617f52;border-radius:12px;padding:14px 8px;user-select:all}#deadZoneRoot .dz-lobby-action,#deadZoneRoot .dz-lobby-secondary,#deadZoneRoot .dz-lobby-start{border-radius:9px;border:1px solid #6c9874;color:#e5f7e5;background:#254c38;padding:11px 17px;cursor:pointer;font-weight:800}#deadZoneRoot .dz-lobby-action:hover,#deadZoneRoot .dz-lobby-start:hover{filter:brightness(1.2)}#deadZoneRoot .dz-lobby-action{margin:10px 0}#deadZoneRoot .dz-lobby-help{font-size:12px;line-height:1.5;color:#a4bdad}#deadZoneRoot .dz-lobby-slots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#deadZoneRoot .dz-lobby-seat{padding:12px;border-radius:9px;border:1px dashed #54665c;color:#869d91;display:grid;gap:5px;background:#0b1d18}#deadZoneRoot .dz-lobby-seat.filled{border:1px solid #72bd88;background:#1c3b2d;color:#e5f6df}#deadZoneRoot .dz-lobby-seat small{font-size:10px;opacity:.7}#deadZoneRoot .dz-lobby-select,#deadZoneRoot .dz-lobby-input{box-sizing:border-box;width:100%;background:#091a16;border:1px solid #567a62;padding:13px;color:#f2faea;border-radius:10px;font:inherit}#deadZoneRoot .dz-lobby-start{width:100%;font-size:17px;margin-top:20px;background:linear-gradient(90deg,#457c4a,#659c61);padding:16px}#deadZoneRoot .dz-lobby-bottom{margin-top:14px}#deadZoneRoot .dz-lobby-bottom-title{font-size:13px;letter-spacing:2px;font-weight:900}#deadZoneRoot .dz-lobby-join{display:flex;gap:12px;align-items:center}#deadZoneRoot .dz-lobby-input{max-width:240px;text-align:center;font-size:26px;letter-spacing:6px;text-transform:uppercase}#deadZoneRoot .dz-lobby-footer{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:16px 0;color:#bcd4b9}#deadZoneRoot .dz-lobby-secondary{background:#14291f;font-size:12px}#deadZoneRoot .dz-lobby-footer span{margin-right:auto;font-size:12px}@media(max-width:680px){#deadZoneRoot .dz-lobby-grid{grid-template-columns:1fr}#deadZoneRoot .dz-lobby-join{flex-wrap:wrap}#deadZoneRoot .dz-lobby-card{padding:14px}}#deadZoneRoot{font-family:Inter,system-ui,sans-serif!important}#deadZoneRoot .dz-hud-top,#deadZoneRoot .dz-hud-bottom{display:flex;align-items:center;gap:9px;flex-wrap:wrap;max-width:max-content;box-shadow:0 6px 30px #0008;backdrop-filter:blur(12px);pointer-events:auto}#deadZoneRoot .dz-hud-top{align-self:center}#deadZoneRoot .dz-hud-bottom{align-self:flex-start}#deadZoneRoot .dz-inventory-toggle{pointer-events:auto}#deadZoneRoot .dz-health-track{width:130px!important}#deadZoneRoot .dz-stamina-track{width:125px;height:10px;border-radius:9px;background:#25364b;overflow:hidden}#deadZoneRoot .dz-stamina-track i{display:block;height:100%;background:linear-gradient(90deg,#579ec8,#91dfd2)}#deadZoneRoot .dz-hud-top{background:#0c1817;padding:10px 14px;border:1px solid #34564c;border-radius:12px 12px 0 0}#deadZoneRoot .dz-hud-bottom{background:#0c1817;padding:9px 13px;border:1px solid #34564c;border-radius:0 0 12px 12px}#deadZoneRoot .dz-badge{color:#bbdf91;font-weight:900;letter-spacing:2px}#deadZoneRoot .dz-wave{padding:5px 12px;background:#263d30;border-radius:7px}#deadZoneRoot .dz-wave b{color:#e4c37e;font-size:19px}#deadZoneRoot .dz-score{color:#dec48a;font-weight:700}#deadZoneRoot .dz-inventory-toggle{margin-left:auto;background:#243d37;border:1px solid #769886;color:#d9f0de;padding:7px 14px;border-radius:7px;cursor:pointer}#deadZoneRoot .dz-health{display:flex;gap:8px;align-items:center}#deadZoneRoot .dz-health-track{width:110px;height:11px;border-radius:9px;background:#4c2020;overflow:hidden}#deadZoneRoot .dz-health-track i{display:block;height:100%;background:linear-gradient(90deg,#b44743,#69d38f)}#deadZoneRoot small{font-size:10px;letter-spacing:1px;color:#a2b2a8}#deadZoneRoot .dz-equipped{display:flex;flex-direction:column}#deadZoneRoot .dz-resource{padding:6px 9px;background:#20332e;border-radius:7px}#deadZoneRoot .dz-inventory{position:absolute;top:8%;right:2%;width:min(420px,90%);max-height:84%;overflow:auto;padding:20px;background:linear-gradient(145deg,#12231f,#0b1415);border:1px solid #779780;box-shadow:0 22px 80px #000b;border-radius:16px;z-index:20;color:#e8f0e4}#deadZoneRoot .dz-inv-header{position:relative;border-bottom:1px solid #3d5548;padding-bottom:9px}#deadZoneRoot .dz-inv-header h2{font-size:25px;letter-spacing:3px;margin:2px 0}#deadZoneRoot .dz-inv-eyebrow{color:#9fb884;letter-spacing:2px;font-size:11px}#deadZoneRoot .dz-inv-close{position:absolute;right:0;top:0;background:#442d30;border:0;border-radius:6px;padding:7px 12px;color:white;cursor:pointer}#deadZoneRoot .dz-inv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:14px 0}#deadZoneRoot .dz-inv-stat{background:#24372f;padding:9px;border-radius:8px;display:flex;flex-direction:column}#deadZoneRoot .dz-inv-stat strong{font-size:17px}#deadZoneRoot .dz-inv-equipped{background:#1c302a;border-left:3px solid #b5d78c;padding:11px;display:grid;gap:6px;margin-bottom:15px}#deadZoneRoot .dz-inv-title{font-weight:800;color:#d9cc96;letter-spacing:2px;font-size:11px;margin:8px 0}#deadZoneRoot .dz-inv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}#deadZoneRoot .dz-inv-item{text-align:left;display:grid;gap:4px;padding:10px;border-radius:9px;background:#22342e;border:1px solid #4b6453;color:#eef4e9;cursor:pointer}#deadZoneRoot .dz-inv-item.selected{border-color:#dfc788;box-shadow:inset 0 0 0 1px #dfc788}#deadZoneRoot .dz-inv-icon{font-size:26px}#deadZoneRoot .dz-inv-item small{color:#a9bcb1}#deadZoneRoot .dz-item-stats{display:block;color:#d4e8a8!important;font-size:12px;line-height:1.55;white-space:normal}#deadZoneRoot .dz-inv-supplies{border-top:1px solid #43564a;margin-top:14px}#deadZoneRoot .dz-inv-supplies p{font-size:13px;margin:8px 0}#deadZoneRoot .dz-inv-foot{display:block;margin-top:14px}`;style.textContent+=`#deadZoneRoot .dz-screen{background:radial-gradient(ellipse at 50% 27%,#27483adf,#07120ff8 70%)!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;overflow:auto}#deadZoneRoot .dz-screen-icon{font-size:72px;color:#c1da81;text-shadow:0 0 40px #80ba60}#deadZoneRoot .dz-screen h1{font-size:clamp(44px,8vw,86px);margin:0;letter-spacing:9px;color:#e2eddb;text-shadow:0 5px 20px #000}#deadZoneRoot .dz-screen p{max-width:570px;color:#b9cabe;font-size:16px;line-height:1.6;margin:0 0 14px}#deadZoneRoot .dz-screen button{min-width:230px;background:linear-gradient(120deg,#315b46,#517a50)!important;box-shadow:0 8px 23px #0008;font-weight:750;text-transform:uppercase;letter-spacing:1px}#deadZoneRoot .dz-screen button:hover{filter:brightness(1.2)}#deadZoneRoot .dz-screen select{min-width:230px;padding:12px!important;border:1px solid #7a997d!important}#deadZoneRoot .dz-inventory{position:fixed!important;inset:0!important;width:100vw!important;max-height:100vh!important;overflow:auto!important;z-index:20002!important;border:0!important;border-radius:0!important;display:flex;flex-direction:column;background:radial-gradient(circle at 80% 0%,#223a32 0,#07120f 68%)!important;padding:clamp(16px,3vw,45px)!important}#deadZoneRoot .dz-full-header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #4b6d59;padding-bottom:18px;gap:15px}#deadZoneRoot .dz-full-brand{font-size:clamp(15px,2vw,27px);font-weight:900;letter-spacing:3px;color:#bce0a2}#deadZoneRoot .dz-full-layout{display:grid;grid-template-columns:minmax(240px,360px) 1fr;gap:30px;padding-top:25px;flex:1;min-height:0}#deadZoneRoot .dz-full-side{background:#14251f;border:1px solid #496552;border-radius:14px;padding:22px;overflow:auto}#deadZoneRoot .dz-full-backpack{background:#111f1a;border:1px solid #385549;border-radius:14px;padding:24px;overflow:auto}#deadZoneRoot .dz-full-backpack h2,#deadZoneRoot .dz-full-side h2{font-size:clamp(24px,3vw,41px);letter-spacing:3px;margin:8px 0}#deadZoneRoot .dz-muted{color:#9aaa9f;font-size:13px}#deadZoneRoot .dz-full-slots{display:grid;gap:12px;margin:24px 0}#deadZoneRoot .dz-slot{display:grid;text-align:left;gap:8px;padding:18px;background:#24392f;border:1px solid #496454;border-radius:10px;color:#e7f2e5;cursor:pointer}#deadZoneRoot .dz-slot.active{border:2px solid #c2cf8b;background:#334c38}#deadZoneRoot .dz-slot strong{font-size:17px}#deadZoneRoot .dz-full-armor{display:grid;gap:9px;margin-bottom:24px;padding:14px;border-radius:9px;background:#26372f}#deadZoneRoot .dz-supply{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #34473d;color:#d6e8db}#deadZoneRoot .dz-inv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:13px;margin-top:24px}#deadZoneRoot .dz-inv-item{min-height:145px;padding:17px}#deadZoneRoot .dz-inv-icon{font-size:37px}#deadZoneRoot .dz-inv-foot{margin-top:25px;color:#acb9ac}@media(max-width:700px){#deadZoneRoot .dz-full-layout{grid-template-columns:1fr}#deadZoneRoot .dz-full-side{overflow:visible}#deadZoneRoot .dz-inventory{padding:13px!important}}`;style.textContent+=`#deadZoneRoot .dz-hud-top{align-self:flex-end;font-size:11px;background:#111a1ee8;border-radius:3px;border-color:#566166;gap:7px}#deadZoneRoot .dz-badge{color:#d4b47a}#deadZoneRoot .dz-hud-bottom{border-radius:3px;background:#111a1eee;max-width:94%;font-size:12px;gap:12px}#deadZoneRoot .dz-health-track{width:170px!important;height:16px;border:2px solid #c4c1ad;border-radius:2px;background:#401d24}#deadZoneRoot .dz-health-track i{background:linear-gradient(#f06555,#a92f36)}#deadZoneRoot .dz-stamina-track{height:8px;border-radius:1px}#deadZoneRoot .dz-screen{background:radial-gradient(ellipse at 65% 30%,#35453bdf,#090f15fa 75%)!important}#deadZoneRoot .dz-screen h1{color:#e7ddc8;letter-spacing:12px}#deadZoneRoot .dz-screen button{border-radius:3px!important;background:#394d48!important} @media(max-width:850px){#deadZoneRoot .dz-badge,#deadZoneRoot .dz-score{display:none}#deadZoneRoot .dz-health-track{width:85px!important}#deadZoneRoot .dz-hud-bottom{gap:5px;padding:6px}#deadZoneRoot .dz-resource{padding:4px}}`;root.append(style);const wrap=document.createElement('div');wrap.style.cssText='width:100%;height:100%;position:relative;display:flex;flex-direction:column;padding:10px;box-sizing:border-box;min-height:0';root.append(wrap);const title=document.createElement('h2');title.textContent='☣ DEAD ZONE · SURVIVAL';title.style.cssText='display:none';wrap.append(title);labels=document.createElement('div');labels.style.cssText='position:absolute;inset:0;z-index:6;pointer-events:none;display:flex;flex-direction:column;justify-content:space-between;padding:20px;box-sizing:border-box';wrap.append(labels);canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;canvas.style.cssText='position:absolute;display:block;background:#152722;border:1px solid #4c7260;box-sizing:border-box;cursor:crosshair';canvas.tabIndex=0;const stage=document.createElement('div');stage.style.cssText='position:relative;flex:1;min-height:0;width:100%;overflow:hidden;display:flex;align-items:center;justify-content:flex-start;background:#071411';const playArea=document.createElement('div');playArea.style.cssText='display:flex;flex:1;min-height:0;min-width:0;gap:12px';wrap.append(playArea);playArea.append(stage);stage.append(canvas);const sidebar=document.createElement('aside');sidebar.style.cssText='width:clamp(210px,23vw,300px);flex-shrink:0;display:flex;flex-direction:column;gap:12px;min-height:0;box-sizing:border-box;align-items:stretch';playArea.append(sidebar);miniCanvas=document.createElement('canvas');miniCanvas.width=260;miniCanvas.height=260;miniCanvas.style.cssText='width:100%;aspect-ratio:1;max-height:45vh;object-fit:contain;background:#071a18;border:2px solid #87bba4;border-radius:10px;box-sizing:border-box';sidebar.append(miniCanvas);const chat=document.createElement('section');chat.style.cssText='position:relative;z-index:8;flex:1;min-height:180px;width:100%;display:flex;flex-direction:column;background:#091c18d9;border:1px solid #658a7290;border-radius:8px;pointer-events:auto;font:12px system-ui';const heading=document.createElement('div');heading.textContent='💬 TEAM CHAT · Enter to type';heading.style.cssText='padding:5px 8px;background:#294633;color:#e2f1de;font-weight:bold';gameChatLog=document.createElement('div');gameChatLog.style.cssText='flex:1;overflow-y:auto;padding:5px;color:white';const form=document.createElement('form');form.style.cssText='display:flex';gameChatInput=document.createElement('input');gameChatInput.placeholder='Message teammates';gameChatInput.maxLength=220;gameChatInput.style.cssText='min-width:0;flex:1;background:#13281e;border:0;color:white;padding:7px';const send=document.createElement('button');send.textContent='SEND';send.style.cssText='background:#3f674c;color:white;border:0';form.append(gameChatInput,send);form.onsubmit=e=>{e.preventDefault();sendGameMessage();gameChatInput.blur();canvas.focus()};chat.append(heading,gameChatLog,form);sidebar.append(chat);const fitCanvas=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;const scale=Math.min(w/W,h/H);canvas.style.width=Math.floor(W*scale)+'px';canvas.style.height=Math.floor(H*scale)+'px';labels.style.inset='auto';labels.style.width=Math.floor(W*scale)+'px';labels.style.height=Math.floor(H*scale)+'px';labels.style.left=(stage.offsetLeft)+'px';labels.style.top=(stage.offsetTop+(h-H*scale)/2)+'px';};new ResizeObserver(fitCanvas).observe(stage);requestAnimationFrame(fitCanvas);ctx=canvas.getContext('2d');menu=document.createElement('div');menu.style.cssText='position:absolute;inset:0;background:#071411e8;overflow:auto;text-align:center;padding:45px 12px';wrap.append(menu);document.body.append(root);
canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect();mouse.x=(e.clientX-r.left)*W/r.width;mouse.y=(e.clientY-r.top)*H/r.height;});canvas.addEventListener('mousedown',()=>{mouse.down=true;canvas.focus();});window.addEventListener('mouseup',()=>mouse.down=false);window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.code==='KeyR')return;if(root.style.display==='none')return;const editing=e.target?.matches?.('input, textarea, select, [contenteditable="true"]')||document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]');if(editing){if(e.code==='Escape'&&document.activeElement===gameChatInput){e.preventDefault();gameChatInput.blur();canvas.focus()}return;}if(e.code==='Enter'&&session?.phase==='play'&&!inventoryOpen&&!rouletteOpen&&!pauseOpen){e.preventDefault();gameChatInput.focus();return;}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab',...Object.values(binds)].includes(e.code))e.preventDefault();if(e.repeat&&e.code==='Escape')return;keys.add(e.code);if(e.code===binds.interact&&!e.repeat&&session?.phase==='play'&&!pauseOpen&&!inventoryOpen&&!verityOpen){const p=world?.players.find(p=>p.id===who());if(rouletteOpen){rouletteOpen=false;showRoulette();keys.delete(e.code);}else if(world?.wave>=5&&p?.hp>0&&rouletteNearby(p)){const down=world.players.some(q=>q.id!==p.id&&q.hp<=0&&Math.hypot(q.x-p.x,q.y-p.y)<64);const verityDown=['down','sleeping'].includes(world.verity?.state)&&Math.hypot(world.verity.x-p.x,world.verity.y-p.y)<72;const pickup=(world.drops||[]).some(d=>Math.hypot(d.x-p.x,d.y-p.y)<65);const chest=world.chests?.some(c=>!c.opened&&Math.hypot(c.x-p.x,c.y-p.y)<80);if(!down&&!verityDown&&!pickup&&!chest){rouletteOpen=true;rouletteLastSerial=p.rouletteSerial||0;roulettePending=false;keys.delete(e.code);showRoulette();}}}if(e.code==='KeyG'&&!e.repeat&&session?.phase==='play'&&!pauseOpen&&!rouletteOpen){const p=world?.players.find(p=>p.id===who()),v=world?.verity;if(verityOpen){verityOpen=false;showVerityInventory();}else if(p?.hp>0&&v?.state==='active'&&Math.hypot(p.x-v.x,p.y-v.y)<85){inventoryOpen=false;showInventory();verityOpen=true;verityUIStamp='';showVerityInventory();}}if(e.code==='KeyV'&&!e.repeat&&session?.phase==='play'&&!inventoryOpen&&!verityOpen&&!rouletteOpen&&!pauseOpen){const p=world?.players.find(p=>p.id===who()),v=world?.verity;if(p?.hp>0&&v?.state==='active'&&v.hp<100&&Math.hypot(p.x-v.x,p.y-v.y)<85)requestVerity({type:'heal'});}if(e.code===binds.inventory&&!e.repeat&&session?.phase==='play'&&!pauseOpen){rouletteOpen=false;showRoulette();verityOpen=false;showVerityInventory();inventoryOpen=!inventoryOpen;showInventory();}if(e.code==='Escape'){e.preventDefault();if(rouletteOpen){rouletteOpen=false;showRoulette();}else if(verityOpen){verityOpen=false;showVerityInventory();}else if(inventoryOpen){inventoryOpen=false;showInventory();}else if(session?.phase==='play'){pauseOpen=!pauseOpen;showPause();}else if(pauseOpen){pauseOpen=false;showPause();}}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();mouse.down=false;});}
function screen(text){menu.replaceChildren();menu.style.display='block';menu.style.pointerEvents='auto';menu.style.zIndex='10';menu.classList.add('dz-screen');const insignia=document.createElement('div');insignia.className='dz-screen-icon';insignia.textContent='☣';menu.append(insignia);const title=document.createElement('h1');title.textContent='DEAD ZONE';menu.append(title);const p=document.createElement('p');p.textContent=text;menu.append(p);}
function showPause(){if(!session)return;if(!pauseOpen){menu.style.display='none';canvas.focus();return;}screen('SURVIVAL MENU · Game continues online while this menu is open');button('▶ Resume survival',()=>{pauseOpen=false;showPause();});button('🎒 Inventory',()=>{pauseOpen=false;menu.style.display='none';inventoryOpen=true;showInventory();});button('💾 Save progress',()=>{const ok=saveGame();screen(ok?'Progress saved on this device.':'Saving is available in an active host game.');button('← Back to pause menu',showPause);});button('⚙ Settings / Keybinds',showSettings);button('✕ Leave game',returnToMenu);}
function showSettings(){screen('Customize controls · click a key binding, then press the new key. Escape cancels.');const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(175px,1fr));gap:7px;max-width:600px;margin:auto';menu.append(grid);const names={barrier:'Place concrete barrier',up:'Move up',down:'Move down',left:'Move left',right:'Move right',sprint:'Sprint',attack:'Attack',interact:'Open chest / Pick up',inventory:'Inventory',heal:'Use mints',door:'Door',board:'Board door',repair:'Repair door',primary:'Primary weapon',secondary:'Secondary weapon'};for(const action of Object.keys(BIND_DEFAULTS)){const b=button(names[action]+': '+binds[action],()=>{b.textContent='Press a key…';const listen=e=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.code==='KeyR'){window.removeEventListener('keydown',listen,true);return;}e.stopPropagation();e.preventDefault();if(e.code!=='Escape'){for(const k of Object.keys(binds))if(k!==action&&binds[k]===e.code)binds[k]=BIND_DEFAULTS[k]===e.code?'Unassigned':binds[action];binds[action]=e.code;localStorage.setItem('deadzone-keybinds',JSON.stringify(binds));}keys.clear();showSettings();};window.addEventListener('keydown',listen,{capture:true,once:true});},grid);b.style.cssText+='font-size:12px;min-width:0;margin:0';}button('Restore defaults',()=>{binds={...BIND_DEFAULTS};localStorage.setItem('deadzone-keybinds',JSON.stringify(binds));showSettings();});button('← Back',()=>{if(pauseOpen)showPause();else if(session?.mode==='host'&&session.phase==='lobby')lobby();else if(session?.phase==='play'){menu.style.display='none';canvas.focus();}else screen('Waiting for host to start');});}
function open(){if(!who())return;resetNetwork();totalPlaytime=getTotalTime();totalPlaytimeFlush=0;pauseOpen=false;gameOverShown=false;inventoryOpen=false;verityOpen=false;rouletteOpen=false;roulettePending=false;rouletteSelectedSlot=-1;verityUIStamp='';build();root.style.display='flex';screen('Host a survival party or join with a lobby code.');session={mode:'host',gameMode:'story',difficulty:'normal',id:crypto.randomUUID(),secret:crypto.randomUUID()+crypto.randomUUID(),code:(tabLobbyOwner===who()&&tabLobbyCode?tabLobbyCode:(tabLobbyOwner=who(),tabLobbyCode=createJoinCode())),peers:new Map(),phase:'lobby',host:who(),seat:0};world=newWorld([who()]);if(invite){const b=button('Join '+name(invite.from),()=>join(invite));button('Decline invitation',()=>{invite=null;open();});}else lobby();if(LOBBY_API){publishDeadZoneLobby();if(lobbyLeaseTimer)clearInterval(lobbyLeaseTimer);lobbyLeaseTimer=setInterval(publishDeadZoneLobby,35000);}if(!raf){last=0;raf=requestAnimationFrame(frame);}if(!networkTimer)networkTimer=setInterval(()=>advanceGame(performance.now()),8);}
function lobby(){if(!session||session.mode!=='host')return;screen('');menu.classList.add('dz-lobby-screen');const add=(parent,tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;parent.append(e);return e;};const shell=add(menu,'div','dz-lobby-shell');add(shell,'div','dz-lobby-kicker','☣ OUTBREAK OPERATIONS / MULTIPLAYER');add(shell,'h1','dz-lobby-heading','DEAD ZONE');add(shell,'p','dz-lobby-subtitle','Build your squad. Prepare your loadout. Survive together.');const grid=add(shell,'div','dz-lobby-grid');const left=add(grid,'section','dz-lobby-card');add(left,'small','dz-lobby-label','YOUR LOBBY CODE');const codeBox=add(left,'div','dz-lobby-code',session.code);const copy=add(left,'button','dz-lobby-action','▣ COPY CODE');copy.onclick=async()=>{try{await navigator.clipboard.writeText(session.code);copy.textContent='✓ COPIED';}catch{copy.textContent='SELECT THE CODE';const range=document.createRange();range.selectNodeContents(codeBox);getSelection()?.removeAllRanges();getSelection()?.addRange(range);}setTimeout(()=>{if(copy.isConnected)copy.textContent='▣ COPY CODE';},1800);};add(left,'p','dz-lobby-help','Share your code with up to three other survivors.');add(left,'small','dz-lobby-label','SQUAD · '+(1+peers().size)+'/4');const slots=add(left,'div','dz-lobby-slots');for(let i=0;i<4;i++){const id=[who(),...peers().keys()][i];const slot=add(slots,'div','dz-lobby-seat'+(id?' filled':''));add(slot,'b','',id?(i===0?'★ ':'● ')+name(id):'＋ OPEN SLOT');add(slot,'small','',id?(i===0?'HOST':'CONNECTED'):'Waiting for survivor');}const right=add(grid,'section','dz-lobby-card');add(right,'small','dz-lobby-label','MISSION SETTINGS');const field=(title,choices,value,change)=>{add(right,'label','dz-lobby-label',title);const select=add(right,'select','dz-lobby-select');for(const [v,label]of choices){const o=add(select,'option','',label);o.value=v;}select.value=value;select.onchange=()=>change(select.value);return select;};field('GAME MODE',[['story','STORY · Last Signal'],['endless','ENDLESS · Hold the district']],session.gameMode||'story',v=>{session.gameMode=v;world.mode=v;});field('DIFFICULTY',[['easy','EASY · Survivor'],['normal','NORMAL · Infected'],['hard','HARD · Outbreak'],['nightmare','NIGHTMARE · Extinction']],session.difficulty||'normal',v=>{session.difficulty=v;world.difficulty=v;});add(right,'p','dz-lobby-help','STORY: recover supplies and restore the radio. ENDLESS: survive escalating waves and boss fights.');const start=add(right,'button','dz-lobby-start','▶ DEPLOY INTO DEAD ZONE');start.onclick=()=>{world.mode=session.gameMode||'story';world.difficulty=session.difficulty;session.phase='play';stopDeadZoneLobby();menu.style.display='none';startNetworkMatch();canvas.focus();};const bottom=add(shell,'section','dz-lobby-bottom');add(bottom,'div','dz-lobby-bottom-title','JOIN ANOTHER SQUAD');const row=add(bottom,'div','dz-lobby-join');const enter=add(row,'input','dz-lobby-input');enter.placeholder='ABCDE';enter.maxLength=5;enter.autocomplete='off';enter.autocapitalize='characters';enter.spellcheck=false;enter.inputMode='text';enter.setAttribute('aria-label','Enter five-letter lobby code');enter.oninput=()=>enter.value=enter.value.replace(/[^a-z]/gi,'').toUpperCase();const go=add(row,'button','dz-lobby-action','JOIN LOBBY');const status=add(bottom,'small','dz-lobby-help',LOBBY_API?'Enter a five-letter code to join a lobby.':'Public joins require the lobby registry to be deployed. Friend-code lookup is available.');go.onclick=async()=>{const code=enter.value.trim().toUpperCase();if(!/^[A-Z]{5}$/.test(code)){status.textContent='Enter exactly five letters.';return;}status.textContent='Searching for lobby…';go.disabled=true;const ok=await lookupDeadZoneLobby(code);if(!ok){status.textContent='Couldn’t find lobby';go.disabled=false;return;}if(!LOBBY_API){setTimeout(()=>{if(pendingJoinCode===code&&session?.mode==='host'&&session.phase==='lobby'){pendingJoinCode='';if(status.isConnected){status.textContent='Couldn’t find lobby';go.disabled=false;}}},6000);}};const foot=add(shell,'div','dz-lobby-footer');const total=add(foot,'span','','⏱ ALL-TIME PLAYTIME · '+formatPlaytime(totalPlaytime));const saved=readSave();if(saved){const resume=add(foot,'button','dz-lobby-secondary','▶ CONTINUE SAVED GAME · WAVE '+saved.world.wave);resume.onclick=continueGame;const del=add(foot,'button','dz-lobby-secondary','DELETE SAVE');del.onclick=()=>{if(confirm('Delete your saved Dead Zone progress?')){localStorage.removeItem(saveKey());lobby();}};}const settings=add(foot,'button','dz-lobby-secondary','⚙ SETTINGS');settings.onclick=showSettings;const exit=add(foot,'button','dz-lobby-secondary','← BACK TO GAMES');exit.onclick=close;}
function join(i){resetNetwork();if(lobbyLeaseTimer){clearInterval(lobbyLeaseTimer);lobbyLeaseTimer=null;}if(session?.mode==='host'&&LOBBY_API)stopDeadZoneLobby();window.deadZoneConnectPublic?.(i.from);session={mode:'guest',id:i.id,host:i.from,seat:1,peers:new Map(),phase:'lobby'};world=null;invite=null;screen('Joining '+name(i.from)+'…');emit(i.from,{t:'dz-join',id:i.id});if(lobbyJoinTimer)clearInterval(lobbyJoinTimer);lobbyJoinTimer=setInterval(()=>{if(session?.mode!=='guest'||session.host!==i.from||session.phase!=='lobby'){clearInterval(lobbyJoinTimer);lobbyJoinTimer=null;return;}window.deadZoneConnectPublic?.(i.from);emit(i.from,{t:'dz-join',id:i.id});},1500);button('← Back to Games',close);}
function close(){stopDeadZoneLobby();flushTotalPlaytime();saveGame();
// Preserve the final authoritative checkpoint before terminating the worker.
if(hostWorker){const leaving=hostWorker,key=saveKey(),owner=who();hostWorker=null;const timer=setTimeout(()=>leaving.terminate(),750);leaving.onmessage=({data})=>{if(data.type==='checkpoint'&&data.save){persistSave(data.world,key,owner);clearTimeout(timer);leaving.terminate();}};leaving.postMessage({type:'save'});}
pauseOpen=false;gameOverShown=false;inventoryOpen=false;verityOpen=false;rouletteOpen=false;if(roulettePanel)roulettePanel.style.display='none';if(verityPanel)verityPanel.style.display='none';if(inventoryPanel)inventoryPanel.style.display='none';if(session){if(session.mode==='host')group({t:'dz-end',id:session.id});else emit(session.host,{t:'dz-leave',id:session.id});}if(session?.mode==='guest')window.deadZoneRevokePublicPeer?.(session.host);if(session?.mode==='host')for(const id of peers().keys())window.deadZoneRevokePublicPeer?.(id);resetNetwork();session=null;world=null;if(gameChatLog)gameChatLog.replaceChildren();announcedDeaths.clear();guestVisuals.clear();if(root)root.style.display='none';document.querySelector('#gamesHub')?.classList.remove('hidden');keys.clear();mouse.down=false;}
function returnToMenu(){close();invite=null;open();}
function input(){const watch=keys.has('Tab');if(watch&&!previousSpectate)spectatorIndex++;previousSpectate=watch;const use=pressed('interact'),toggle=pressed('inventory'),mint=pressed('heal'),door=pressed('door'),board=pressed('board'),repair=pressed('repair'),barrier=pressed('barrier');const barrierOnce=barrier&&!previousBarrier;previousBarrier=barrier;previousToggle=toggle;previousUse=use;const mintOnce=mint&&!previousMint;previousMint=mint;const doorOnce=door&&!previousDoor,boardOnce=board&&!previousBoard,repairOnce=repair&&!previousRepair;previousDoor=door;previousBoard=board;previousRepair=repair;return {barrier:barrierOnce,repair:repairOnce,use,mint:mintOnce,door:doorOnce,board:boardOnce,swap:pressed('primary')?1:pressed('secondary')?2:0,x:Number(pressed('right')||keys.has('ArrowRight'))-Number(pressed('left')||keys.has('ArrowLeft')),y:Number(pressed('down')||keys.has('ArrowDown'))-Number(pressed('up')||keys.has('ArrowUp')),ax:mouse.x+camera.x,ay:mouse.y+camera.y,sprint:pressed('sprint'),fire:mouse.down||pressed('attack')};}
function tick(dt){if(!world||world.ended)return;const w=world;w.time=(w.time||0)+dt;w.effects=(w.effects||[]).filter(e=>(e.life-=dt)>0);for(const e of w.effects){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vx*=Math.max(0,1-dt*4);e.vy*=Math.max(0,1-dt*4);}storyTick(dt);if(w.players.every(p=>p.hp<=0)){w.ended=true;return;}if(w.ended)return;
for(const p of w.players){const a={...(p.id===who()&&!window.__DEAD_ZONE_WORKER__?localInput:hostInput(p.id,dt))};if(p.id!==who()){const pending=inputs.get(p.id);if(pending)for(const k of ['mint','door','board','repair','barrier','swap'])pending[k]=false;}if(p.hp<=0){p.reviveHold=0;p.reviveTarget=null;continue;}const down=w.players.find(q=>q.id!==p.id&&q.hp<=0&&Math.hypot(q.x-p.x,q.y-p.y)<64);const verityNear=w.verity&&Math.hypot(w.verity.x-p.x,w.verity.y-p.y)<66;if(a.use&&down){if(p.reviveTarget!==down.id){p.reviveTarget=down.id;p.reviveHold=0;}p.reviveHold=(p.reviveHold||0)+dt;if(p.reviveHold>=3){down.hp=45;down.invuln=2;down.stamina=60;p.reviveHold=0;p.reviveTarget=null;w.notice=name(p.id)+' revived '+name(down.id)+'!';burst(down.x,down.y,'#9ee5ad',20);}}else{p.reviveHold=0;p.reviveTarget=null;}advancePlayerMovement(p,a,dt);p.cool=Math.max(0,p.cool-dt);p.invuln=Math.max(0,p.invuln-dt);p.flash=Math.max(0,(p.flash||0)-dt);p.recoil=Math.max(0,(p.recoil||0)-dt*65);p.swing=Math.max(0,(p.swing||0)-dt);if(Number.isFinite(a.ax)&&Number.isFinite(a.ay))p.face=Math.atan2(a.ay-p.y,a.ax-p.x);
if(a.swap===1||a.swap===2)swapWeapon(p,a.swap===1?'primary':'secondary');if(a.mint&&p.mints>0&&p.hp<100){p.mints--;p.hp=Math.min(100,p.hp+22);w.notice=name(p.id)+' used Care Mints';}
const chest=nearbyChest(p);if(down||!a.use||!chest||Math.hypot(p.x-chest.x,p.y-chest.y)>80){p.chestHold=0;p.chestTarget=null;p.chestComplete=false;}else if(p.chestTarget!==chest.id){p.chestTarget=chest.id;p.chestHold=0;p.chestComplete=false;}else if(!p.chestComplete){p.chestHold=Math.min(1.25,(p.chestHold||0)+dt);if(p.chestHold>=1.25){chest.opened=true;p.chestComplete=true;p.useLatch=true;const item=randomLoot(w.wave);const offsets=[[-25,-18],[25,-18],[-25,22],[25,22],[0,0]];let pos={x:chest.x,y:chest.y};for(const [ox,oy] of offsets){if(!solid(chest.x+ox,chest.y+oy,10)){pos={x:chest.x+ox,y:chest.y+oy};break;}}w.drops.push({id:++w.dropSerial,item,x:pos.x,y:pos.y});w.notice='Chest opened! Press E to pick up '+itemDefs[item].name;}}if(a.use&&!down&&!p.useLatch&&(!verityNear||w.verity.state==='active')&&(!chest||w.drops.some(d=>Math.hypot(d.x-p.x,d.y-p.y)<65))&&!(w.mode==='story'&&w.story.stage<2&&Math.hypot(p.x-missionSites[w.story.stage].x,p.y-missionSites[w.story.stage].y)<70)){action(p,{use:true});p.useLatch=true;}if(a.use&&!down&&verityNear){if(w.verity.state==='down'){verityInteract(p,dt);}else if(w.verity.state==='sleeping'&&!p.useLatch){verityInteract(p,dt);p.useLatch=true;}}if(!a.use){p.useLatch=false;if(w.verity?.reviver===p.id){w.verity.reviveHold=0;w.verity.reviver=null;}}if(a.door||a.board||a.repair||a.barrier)action(p,a);
const semiAuto=['pistol','revolver','shotgun','doublebarrel','sniper','sledge','hammer','axe','sunbreaker','reaper','railgun','hellfire'];const heldFire=Boolean(a.fire)||!!a._firePressed;const firePressed=!!a._firePressed||(heldFire&&!p.fireHeld);p.fireHeld=heldFire;
if(heldFire&&itemDefs[p.weapon]?.type==='weapon'&&p.cool<=0&&(!semiAuto.includes(p.weapon)||firePressed)){p.attackSerial=(p.attackSerial||0)+1;const weapon=itemDefs[p.weapon],vx=(Number(a.ax)||p.x+1)-p.x,vy=(Number(a.ay)||p.y)-p.y,angle=Math.atan2(vy,vx);p.face=angle;p.cool=weapon.cool;weaponParticles(p.weapon,p.x,p.y,angle);
if(weapon.range<100){p.swing=Math.min(.62,weapon.cool+.1);p.swingTotal=p.swing;p.swingWeapon=weapon.name;p.swingDir=(p.swingDir||1)*-1;p.swingImpact=0;for(const z of w.zombies){const handX=p.x+Math.cos(angle)*9-Math.sin(angle)*10,handY=p.y+Math.sin(angle)*9+Math.cos(angle)*10,forward=(z.x-handX)*Math.cos(angle)+(z.y-handY)*Math.sin(angle),side=Math.abs(-(z.x-handX)*Math.sin(angle)+(z.y-handY)*Math.cos(angle));if(z.hp>0&&clearShot(p.x,p.y,z.x,z.y)&&forward>-14&&forward<weapon.range+24+(z.boss?bossSize(z)*7:0)&&side<Math.min(z.boss?65:43,23+forward*.44+(z.boss?bossSize(z)*5:0))){const hitDamage=weaponDamage(p.weapon,activeWeaponLevel(p));z.hp-=hitDamage;impact(z,p,hitDamage);z.hit=.12;if(z.hp<=0){w.score+=z.boss?500:10;p.kills++;zombieLoot(z);if(z.boss){for(let reward=0;reward<3;reward++)w.drops.push({id:++w.dropSerial,item:randomLoot(Math.max(10,w.wave)),x:z.x+(reward%2?25:-25),y:z.y+(reward>1?20:-20)});w.notice='☠ '+(BOSS_NAMES[z.kind]||'BOSS')+' DEFEATED · BONUS LOOT!';}}}}}
else if(p.ammo>0){p.ammo--;p.flash=.14;const muzzleX=p.x+Math.cos(angle)*46-Math.sin(angle)*10,muzzleY=p.y+Math.sin(angle)*46+Math.cos(angle)*10;burst(muzzleX,muzzleY,'#ffe0a0',shotgunPellets(p.weapon)>1?22:12);burst(muzzleX,muzzleY,'#f28d48',shotgunPellets(p.weapon)>1?11:5);p.recoil=(shotgunPellets(p.weapon)>1?12:6);p.flashX=muzzleX;p.flashY=muzzleY;p.flashAngle=angle;const side=angle+Math.PI/2;burst(p.x+Math.cos(angle)*10+Math.cos(side)*13,p.y+Math.sin(angle)*10+Math.sin(side)*13,'#b8a26c',4);const spread=shotgunPellets(p.weapon)===3?[-.2,0,.2]:[0];for(const diff of spread)w.shots.push({x:p.x+Math.cos(angle)*18-Math.sin(angle)*10,y:p.y+Math.sin(angle)*18+Math.cos(angle)*10,vx:Math.cos(angle+diff)*730,vy:Math.sin(angle+diff)*730,life:weapon.range/730,damage:weaponDamage(p.weapon,activeWeaponLevel(p)),owner:p.id,kind:p.weapon,trail:[]});}else w.notice='Out of ammo — use your melee weapon';}}
if(w.between>0){w.between-=dt;if(w.between<=0){w.wave++;if(w.mode==='endless'&&w.wave===10&&!w.verity){w.verity=makeVerity();w.notice='☀ WAVE 10 OBJECTIVE: GO TO THE MIDDLE! Verity is sleeping. Press E to wake him!';}w.remaining=Math.ceil((5+w.wave*4)*(DIFFICULTIES[w.difficulty||'normal']||DIFFICULTIES.normal).count);w.spawned=0;if(w.wave%10===0){const boss=zombieSpawn(true);w.zombies.push(boss);w.notice='☠ BOSS HORDE · THE '+BOSS_NAMES[boss.kind]+' HAS ARRIVED!';}if(w.wave>=2)spawnDrop();}}
if(w.remaining>0&&w.between<=0){w.spawned+=dt*(1.3+w.wave*.25)*(DIFFICULTIES[w.difficulty||'normal']||DIFFICULTIES.normal).count;while(w.spawned>=1&&w.remaining>0&&w.zombies.length<65){w.zombies.push(zombieSpawn());w.spawned--;w.remaining--;if(w.wave>=4&&w.remaining===Math.floor((5+w.wave*4)*(DIFFICULTIES[w.difficulty||'normal']||DIFFICULTIES.normal).count/2))spawnDrop();}}
tickVerity(dt);verityBanter(dt);
for(const z of w.zombies){if(z.hp<=0)continue;if(z.kvx||z.kvy){move(z,(z.kvx||0)*dt,(z.kvy||0)*dt,11);z.kvx*=Math.max(0,1-dt*12);z.kvy*=Math.max(0,1-dt*12);}
const living=w.players.filter(p=>p.hp>0);if(w.verity?.state==='active'&&w.verity.hp>0)living.push({...w.verity,id:'verity'});if(!living.length){w.ended=true;break;}
// Zombies retain targets until another survivor is significantly more attractive.
// This prevents flickering between teammates, while runners actively hunt the closest one.
let best=null,bestScore=Infinity;for(const candidate of living){const dist=Math.hypot(candidate.x-z.x,candidate.y-z.y);const same=candidate.id===z.targetId;const score=dist*(same?.72:1)+(houseAt(candidate.x,candidate.y)&&!houseAt(z.x,z.y)?65:0);if(score<bestScore){best=candidate;bestScore=score;}}
const p=best;z.targetId=p.id;const targetHouse=houseAt(p.x,p.y),zHouse=houseAt(z.x,z.y);let tx=p.x,ty=p.y,door=null;
// Spread the horde around exposed survivors rather than stacking on one exact pixel.
if(!targetHouse&&!zHouse&&Math.hypot(p.x-z.x,p.y-z.y)>55){const flank=(z.netId%7-3)*.18;const angle=Math.atan2(p.y-z.y,p.x-z.x)+flank;tx=p.x-Math.cos(angle)*16;ty=p.y-Math.sin(angle)*16;}
z.hit=Math.max(0,(z.hit||0)-dt);z.attack=Math.max(0,z.attack-dt);
// Doorway routing: approach from a clear outside lane, align to the opening,
// then pass straight through it. Never steer sideways while crossing the sill.
let doorCorridor=false;
if(zHouse!==targetHouse&&(zHouse||targetHouse)){
  const h=zHouse||targetHouse;door=h;
  const entering=targetHouse===h;
  const outsideY=h.doorY+42,insideY=h.doorY-42;
  const aligned=Math.abs(z.x-h.doorX)<17;
  const isOutside=z.y>=h.doorY-9;
  const goalY=entering?insideY:outsideY;
  if(entering&&isOutside){
    if(z.y<outsideY+10&&aligned){tx=h.doorX;ty=insideY;doorCorridor=true;}
    else if(z.y<outsideY+10){tx=h.doorX;ty=outsideY;doorCorridor=true;}
    else if(z.x>=h.x-28&&z.x<=h.x+h.w+28){tx=h.doorX;ty=outsideY;doorCorridor=true;}
    else {tx=z.x<h.doorX?h.x-42:h.x+h.w+42;ty=outsideY;}
  }else if(!entering&&!isOutside){
    tx=h.doorX;ty=outsideY;doorCorridor=true;
  }else{
    tx=h.doorX;ty=goalY;doorCorridor=true;
  }
  // A closed door must be attacked from either side, even when completely broken
  // or the zombie approached from inside the building.
  if(!h.doorOpen&&h.doorHp>0&&Math.abs(z.x-h.doorX)<45&&Math.abs(z.y-h.doorY)<54){
    if(z.attack<=0){h.doorHp=Math.max(0,h.doorHp-(12+w.wave*2));z.attack=.8;
      if(h.doorHp<=0){h.doorOpen=true;h.boards=0;w.notice='Zombies broke down a door!';}}
    continue;
  }
}else{z.navHouse=null;z.navStage=0;}
const oldX=z.x,oldY=z.y;
let goalX=tx,goalY=ty;
if(doorCorridor){z.avoidTime=0;z.stuck=0;}
const concreteRoute=!doorCorridor?concreteSteering(z,p):null;
if(concreteRoute?.reachable&&concreteRoute.point){goalX=concreteRoute.point.x;goalY=concreteRoute.point.y;z.concreteStuck=0;}
else if(concreteRoute&&!concreteRoute.reachable)z.concreteStuck=(z.concreteStuck||0)+dt;
else z.concreteStuck=0;
if(!concreteRoute?.reachable&&!doorCorridor&&(z.avoidTime||0)>0){z.avoidTime-=dt;if(Math.hypot(z.x-(z.avoidX||0),z.y-(z.avoidY||0))>13){goalX=z.avoidX;goalY=z.avoidY;}else z.avoidTime=0;}
let dx=goalX-z.x,dy=goalY-z.y,l=Math.hypot(dx,dy)||1;
let dirX=dx/l,dirY=dy/l;
// Look ahead and steer around cars, house corners and other narrow obstacles.
// Test multiple short-range headings; score each for clear movement, forward
// progress and how much steering it requires. Avoid expensive full-map scans.
const probe=Math.min(58,Math.max(28,z.speed*.28));const directBlocked=solid(z.x+dirX*probe,z.y+dirY*probe,11);
if(!doorCorridor&&(directBlocked||((z.stuck||0)>.24))){let chosen=null,score=-Infinity;
const base=Math.atan2(dirY,dirX);
for(const offset of [0,.28,-.28,.57,-.57,.95,-.95,1.4,-1.4,2.1,-2.1,Math.PI]){
const angle=base+offset,ux=Math.cos(angle),uy=Math.sin(angle);
const near=!solid(z.x+ux*24,z.y+uy*24,11),far=!solid(z.x+ux*probe,z.y+uy*probe,11);
if(!near)continue;
const progress=(tx-z.x)*ux+(ty-z.y)*uy;
const value=(far?110:0)+progress*.13-Math.abs(offset)*12+(offset===z.lastSteer?16:0);
if(value>score){score=value;chosen={x:ux,y:uy,offset};}}
if(chosen){dirX=chosen.x;dirY=chosen.y;z.lastSteer=chosen.offset;}
}
if(doorCorridor){const vertical=Math.abs(z.x-door.doorX)<13;const speed=z.speed*dt;const nextX=vertical?0:Math.sign(door.doorX-z.x)*Math.min(Math.abs(door.doorX-z.x),speed);const nextY=vertical?Math.sign(ty-z.y)*Math.min(Math.abs(ty-z.y),speed):0;move(z,nextX,nextY,10);}else move(z,dirX*z.speed*dt,dirY*z.speed*dt,11);separateZombieFromSurvivors(z);
const moved=Math.hypot(z.x-oldX,z.y-oldY);
if(l>22&&moved<Math.min(1.3,z.speed*dt*.33))z.stuck=(z.stuck||0)+dt;
else z.stuck=Math.max(0,(z.stuck||0)-dt*2);
// When truly stuck, select a reachable waypoint and follow it long enough
// to actually round the obstacle instead of resetting the route every frame.
if(!doorCorridor&&!concreteRoute?.reachable&&z.stuck>.7){z.stuck=0;let bestPoint=null,bestValue=Infinity;
const obstacles=[zHouse,targetHouse].filter(Boolean);
for(const h of obstacles){for(const point of [{x:h.x-38,y:h.y-38},{x:h.x+h.w+38,y:h.y-38},{x:h.x-38,y:h.doorY+43},{x:h.x+h.w+38,y:h.doorY+43},{x:h.doorX,y:h.doorY+47},{x:h.doorX,y:h.doorY-42}]){
if(solid(point.x,point.y,11))continue;
const travel=Math.hypot(point.x-z.x,point.y-z.y);
if(travel<25)continue;
const val=travel+Math.hypot(tx-point.x,ty-point.y)*.7;
if(val<bestValue){bestValue=val;bestPoint=point;}}}
for(let a=0;a<12;a++){const angle=a*Math.PI/6,point={x:z.x+Math.cos(angle)*78,y:z.y+Math.sin(angle)*78};if(solid(point.x,point.y,11))continue;const val=Math.hypot(tx-point.x,ty-point.y)+65;if(val<bestValue){bestValue=val;bestPoint=point;}}
if(bestPoint){z.avoidX=bestPoint.x;z.avoidY=bestPoint.y;z.avoidTime=1.8;}
}
// Concrete is only attacked after an attempted detour fails and no viable\n// reachability path exists. It takes many repeated hits to destroy.\nif(concreteRoute&&!concreteRoute.reachable&&z.concreteStuck>1.6&&z.attack<=0){\n const b=concreteRoute.barrier;if(b?.hp>0&&Math.hypot(z.x-b.x,z.y-b.y)<65){b.hp=Math.max(0,b.hp-(8+Math.min(12,w.wave)));z.attack=1.1;if(!b.hp){w.barrierRevision=(w.barrierRevision||0)+1;w.barriers=w.barriers.filter(q=>q.hp>0);w.notice='A concrete barrier was destroyed!';}}\n}\n// At doorway, chip away at a barricade even if the approach angle is imperfect.
if(door&&!door.doorOpen&&door.doorHp>0&&Math.abs(z.x-door.doorX)<52&&Math.abs(z.y-door.doorY)<55&&z.attack<=0){door.doorHp=Math.max(0,door.doorHp-(12+w.wave*2));z.attack=.8;if(door.doorHp<=0){door.doorOpen=true;door.boards=0;w.notice='Zombies broke down a door!';}}

if(p.hp>0&&Math.hypot(p.x-z.x,p.y-z.y)<(z.boss?31+bossSize(z)*9:34)&&z.attack<=0&&(p.id==='verity'?w.verity.invuln:p.invuln)<=0){const victim=p.id==='verity'?w.verity:p;victim.hp=Math.max(0,victim.hp-Math.ceil(16*(z.attackPower||1)*(DIFFICULTIES[w.difficulty||'normal']||DIFFICULTIES.normal).damage*(1-(itemDefs[victim.armor]?.defense||0))));burst(victim.x,victim.y,'#d15a48',12);victim.invuln=.4;z.attack=.65;if(victim===w.verity&&victim.hp===0){victim.state='down';w.notice='Verity is down! Hold E nearby to revive him';}}
}
separateZombies(dt);for(const z of w.zombies)separateZombieFromSurvivors(z);for(const shot of w.shots){const steps=Math.max(1,Math.ceil(Math.hypot(shot.vx,shot.vy)*dt/7));for(let step=0;step<steps&&shot.life>0;step++){shot.trail=shot.trail||[];if(step===0)shot.trail.push({x:shot.x,y:shot.y});shot.x+=shot.vx*dt/steps;shot.y+=shot.vy*dt/steps;shot.life-=dt/steps;if(solid(shot.x,shot.y,3)){burst(shot.x,shot.y,'#e9c68a',12);burst(shot.x,shot.y,'#faf1ce',6);shot.life=0;continue;}for(const z of w.zombies)if(z.hp>0&&Math.hypot(z.x-shot.x,z.y-shot.y)<(z.boss?14+bossSize(z)*9:16)){burst(shot.x,shot.y,'#e6b7a0',7);z.hp-=shot.damage;impact(z,shot,shot.damage);z.hit=.12;shot.life=0;if(z.hp<=0){w.score+=z.boss?500:10;zombieLoot(z);if(z.boss){for(let reward=0;reward<3;reward++)w.drops.push({id:++w.dropSerial,item:randomLoot(Math.max(10,w.wave)),x:z.x+(reward%2?25:-25),y:z.y+(reward>1?20:-20)});w.notice='☠ '+(BOSS_NAMES[z.kind]||'BOSS')+' DEFEATED · BONUS LOOT!';}const p=w.players.find(p=>p.id===shot.owner);if(p)p.kills++;}break;}}}
w.shots=w.shots.filter(b=>b.life>0);w.zombies=w.zombies.filter(z=>z.hp>0);if(w.between<=0&&!w.remaining&&!w.zombies.length){w.between=9;for(const p of w.players)if(p.hp>0)p.hp=Math.min(100,p.hp+15);}}
let rouletteStamp='';
function showRoulette(){
 if(!root)return;
 if(!roulettePanel){roulettePanel=document.createElement('section');roulettePanel.style.cssText='position:absolute;z-index:27;inset:10% 16%;max-height:80%;overflow:auto;padding:24px;background:linear-gradient(150deg,#142723,#251a24);border:2px solid #dfb66c;border-radius:17px;box-shadow:0 20px 90px #000e;color:#f9efd7';root.append(roulettePanel);}
 roulettePanel.style.display=rouletteOpen?'block':'none';if(!rouletteOpen){rouletteStamp='';roulettePending=false;return;}
 const p=world?.players.find(q=>q.id===who());
 if(!p||p.hp<=0||world.wave<5||!rouletteNearby(p)){rouletteOpen=false;roulettePanel.style.display='none';rouletteStamp='';roulettePending=false;return;}
 normalizeCopies(p);
 if((p.rouletteSerial||0)>rouletteLastSerial){rouletteLastSerial=p.rouletteSerial;roulettePending=false;rouletteSelectedSlot=-1;rouletteSelectedChoice='';}
 const gear=p.inventory.map((id,i)=>({id,i})).filter(q=>weaponTier(q.id)>=0&&weaponTier(q.id)<5&&!(weaponTier(q.id)===4&&world.mythicCreated));
 if(!gear.some(g=>g.i===rouletteSelectedSlot)){rouletteSelectedSlot=gear[0]?.i??-1;rouletteSelectedChoice='';}
 const picked=gear.find(g=>g.i===rouletteSelectedSlot),choices=picked?nextWeapons(picked.id):[];
 if(!choices.includes(rouletteSelectedChoice))rouletteSelectedChoice=choices[0]||'';
 const result=p.rouletteResult||null;
 const stamp=JSON.stringify([p.inventory,p.itemLevels,p.rouletteSerial,rouletteSelectedSlot,rouletteSelectedChoice,roulettePending,p.hp,world.wave,world.mythicCreated]);
 if(stamp===rouletteStamp)return;rouletteStamp=stamp;
 const scroll=roulettePanel.scrollTop;roulettePanel.replaceChildren();
 const make=(tag,text,parent=roulettePanel)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 const heading=make('div');heading.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:12px';
 const title=make('h2','🎰 THE RARITY ROULETTE',heading);title.style.cssText='margin:0;color:#ffe3a1;font-size:25px';
 const close=make('button','✕ CLOSE',heading);close.onclick=()=>{rouletteOpen=false;showRoulette();canvas?.focus();};close.style.cssText='background:#3a3036;color:#fff;border:1px solid #7a6565;border-radius:8px;padding:9px 13px;cursor:pointer';
 const intro=make('p','Select a weapon and the next rarity reward. WIN: upgrade to the chosen weapon at level 1. LOSE: the original weapon is permanently destroyed.');intro.style.cssText='font-size:13px;color:#e3cbb2;line-height:1.5';
 const rates=make('div','COMMON 50%  ·  UNCOMMON 25%  ·  RARE 15%  ·  EPIC 5%  ·  LEGENDARY 0.5%');rates.style.cssText='padding:12px;background:#322b24;border:1px solid #74644a;border-radius:10px;font-weight:800;font-size:12px;color:#ffd98f';
 const wheel=make('div',roulettePending?'🎰 ROLLING…':result&&rouletteLastSerial===result.serial?(result.success?'★ JACKPOT ★':'✕ SHATTERED ✕'):'🎰');wheel.style.cssText='font-size:33px;margin:12px auto 2px;text-align:center;color:'+(result?.success?'#9fefb1':'#ffc47f');
 if(roulettePending){wheel.style.animation='dz-roulette-spin .5s linear infinite';}
 if(result&&rouletteLastSerial===result.serial&&!roulettePending){const output=make('p',result.success?'SUCCESS! '+(itemDefs[result.from]?.name||result.from)+' became '+(itemDefs[result.to]?.name||result.to):'FAILED! '+(itemDefs[result.from]?.name||result.from)+' broke and is gone.');output.style.cssText='text-align:center;font-size:14px;font-weight:800;color:'+(result.success?'#9eedb4':'#ff9993');}
 make('h3','CHOOSE WEAPON').style.cssText='color:#ffdeaa;margin:15px 0 8px';
 const weapons=make('div');weapons.style.cssText='display:flex;gap:7px;flex-wrap:wrap';
 for(const {id,i} of gear){const b=make('button',(i===rouletteSelectedSlot?'✓ ':'')+(itemDefs[id]?.name||id)+' · LV '+levelOf(p,i),weapons);b.disabled=roulettePending;b.style.cssText='padding:9px;background:'+(i===rouletteSelectedSlot?'#75603e':'#273b37')+';color:#fff;border:1px solid #ab9c74;border-radius:8px;cursor:pointer';b.onclick=()=>{rouletteSelectedSlot=i;rouletteSelectedChoice='';rouletteStamp='';showRoulette();};}
 if(!gear.length)make('p','No eligible weapons. The Mythic can only be created once per match.');
 if(picked){
  make('h3','CHOOSE '+WEAPON_TIER_NAMES[weaponTier(picked.id)+1]+' REWARD').style.cssText='color:#ffdeaa;margin:15px 0 8px';
  const options=make('div');options.style.cssText='display:flex;flex-wrap:wrap;gap:7px';
  for(const id of choices){const b=make('button',(id===rouletteSelectedChoice?'✓ ':'')+itemDefs[id].name,options);b.disabled=roulettePending;b.style.cssText='padding:8px 11px;color:white;border:1px solid '+WEAPON_TIER_COLORS[weaponTier(id)]+';background:'+(id===rouletteSelectedChoice?'#513c5c':'#242d32')+';border-radius:8px;cursor:pointer';b.onclick=()=>{rouletteSelectedChoice=id;rouletteStamp='';showRoulette();};}
  const odds=ROULETTE_ODDS[weaponTier(picked.id)];
  const gamble=make('button',roulettePending?'🎰 ROLLING…':'ROLL FOR '+WEAPON_TIER_NAMES[weaponTier(picked.id)+1]+' · '+Math.round(odds*100)+'% CHANCE');
  gamble.disabled=roulettePending||!rouletteSelectedChoice;
  gamble.style.cssText='margin-top:18px;padding:14px;width:100%;background:#af8245;border:2px solid #ffdaa2;border-radius:12px;color:#14120d;font-weight:900;cursor:pointer;opacity:'+(gamble.disabled?'.6':'1');
  gamble.onclick=()=>{if(roulettePending||!rouletteSelectedChoice)return;roulettePending=true;rouletteLastSerial=p.rouletteSerial||0;rouletteStamp='';const selectedSlot=rouletteSelectedSlot,selectedChoice=rouletteSelectedChoice;showRoulette();weaponProgress('evolve',selectedSlot,selectedChoice);};
  const warn=make('p','⚠ A failed roll destroys the selected weapon, even if it is equipped or your only weapon.');warn.style.cssText='font-size:12px;color:#f7a6a0';
 }
 roulettePanel.scrollTop=scroll;
}

function showInventory(){if(!root)return;if(!inventoryPanel){inventoryPanel=document.createElement('div');inventoryPanel.className='dz-inventory';root.append(inventoryPanel);}inventoryPanel.style.display=inventoryOpen?'flex':'none';if(!inventoryOpen)return;const scrollPositions={panel:inventoryPanel.scrollTop,backpack:inventoryPanel.querySelector('.dz-full-backpack')?.scrollTop||0,side:inventoryPanel.querySelector('.dz-full-side')?.scrollTop||0};inventoryPanel.replaceChildren();const p=world?.players.find(q=>q.id===who());if(!p)return;normalizeCopies(p);
const el=(tag,cls,txt,parent=inventoryPanel)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;parent.append(n);return n;};
const top=el('header','dz-full-header');const brand=el('div','dz-full-brand','☣ DEAD ZONE  /  SURVIVOR INVENTORY',top);const exit=el('button','dz-inv-close','✕  RETURN TO GAME',top);exit.onclick=()=>{inventoryOpen=false;showInventory();};const layout=el('div','dz-full-layout');const left=el('aside','dz-full-side','',layout);el('h2','','LOADOUT',left);el('p','dz-muted','Select a weapon slot, then equip an item from your backpack.',left);
const rarity=id=>{const n=weaponTier(id)>=0?weaponTier(id):id==='military'?4:id==='heavy'?3:id==='tactical'?2:['vest','hazmat'].includes(id)?1:0;return {label:WEAPON_TIER_NAMES[n],color:WEAPON_TIER_COLORS[n]};};const statText=(id,i)=>{const d=itemDefs[id];if(!d)return 'Unknown item';if(d.type==='weapon'){const level=levelOf(p,Number.isSafeInteger(i)?i:p.inventory.indexOf(id));return '★ LEVEL '+level+' / 5 · ⚔ '+weaponDamage(id,level)+' damage'+(shotgunPellets(id)>1?' × 3 pellets':'')+' · ★ '+weaponDps(id,level)+' DPS · ◎ '+d.range+' range · ⏱ '+(1/d.cool).toFixed(1)+' attacks/sec';}if(d.type==='armor')return '🛡 '+Math.round(d.defense*100)+'% damage reduction';return d.type.toUpperCase();};const slots=el('div','dz-full-slots','',left);for(const [key,label,icon] of [['primary','PRIMARY WEAPON','⚔'],['secondary','SECONDARY WEAPON','🔫']]){const b=el('button','dz-slot '+(p.activeSlot===key?'active':''),'',slots);el('small','',label,b);el('strong','',icon+'  '+(itemDefs[p[key]]?.name||'EMPTY'),b);if(p[key])el('small','dz-item-stats',statText(p[key],p.equippedIndices[key]),b);b.onclick=()=>{if(session.mode==='host')swapWeapon(p,key);else emit(session.host,{t:'dz-swap',id:session.id,hand:key});showInventory();};}
const armor=el('div','dz-full-armor','',left);el('small','','BODY ARMOR',armor);el('strong','','🛡 '+(itemDefs[p.armor]?.name||'No armor equipped'),armor);if(p.armor)el('small','dz-item-stats',statText(p.armor),armor);
el('h3','','SUPPLIES · DROP TO SHARE',left);for(const [icon,label,key] of [['🧱','CONCRETE','concrete'],['🪵','BOARDS','boards'],['🍬','CARE MINTS','mints'],['➕','MEDKITS','medkits'],['⚡','ENERGY DRINKS','energy'],['◈','AMMO','ammo']]){const count=Math.max(0,Math.floor(Number(p[key])||0)),row=el('div','dz-supply dz-drop-supply','',left);el('span','',icon+'  '+label,row);el('b','',String(count),row);const btn=el('button','dz-drop-button','DROP '+(key==='ammo'?Math.min(12,count):1),row);btn.disabled=count<1;btn.onclick=()=>requestInventoryDrop('stack',key,key==='ammo'?Math.min(12,count):1);if(key==='ammo'&&count>12){const all=el('button','dz-drop-button','DROP ALL',row);all.onclick=()=>requestInventoryDrop('stack',key,count);}}
const right=el('main','dz-full-backpack','',layout);el('div','dz-inv-eyebrow','SCAVENGED EQUIPMENT',right);el('h2','','BACKPACK',right);el('p','dz-muted','All weapons start at level 1. Duplicate pickups automatically merge into your highest available copy to raise its level (maximum 5). From wave 5, take any weapon to the roulette table to gamble for the next rarity. Failure destroys the weapon permanently.',right);const grid=el('div','dz-inv-grid','',right);const icons={bat:'🏏',crowbar:'🔧',axe:'🪓',pistol:'🔫',shotgun:'💥',jacket:'🧥',vest:'🦺',heavy:'🛡️'};p.inventory.forEach((id,i)=>{const def=itemDefs[id];if(!def)return;const active=id===p.weapon||id===p.armor;const wrapper=el('div','dz-drop-item','',grid);const tile=el('button','dz-inv-item'+(active?' selected':''),'',wrapper);const tier=rarity(id);tile.style.borderColor=tier.color;tile.style.boxShadow='inset 0 0 0 1px '+tier.color+'55,0 0 14px '+tier.color+'22';el('div','dz-inv-icon',icons[id]||'📦',tile);el('strong','',def.name,tile);el('small','',tier.label+' · '+def.type.toUpperCase()+(active?' · ACTIVE':''),tile);el('small','dz-item-stats',statText(id,i),tile);tile.onclick=()=>{const hand=selectedInventoryHand;if(session.mode==='host')equip(p,i,hand);else emit(session.host,{t:'dz-equip',id:session.id,slot:i,hand});showInventory();};const drop=el('button','dz-drop-button','DROP ITEM',wrapper);drop.disabled=def.type==='weapon'&&p.inventory.filter(v=>itemDefs[v]?.type==='weapon').length<=1;drop.onclick=()=>requestInventoryDrop('gear',i);if(def.type==='weapon'){const level=levelOf(p,i),duplicate=p.inventory.findIndex((v,j)=>j!==i&&v===id);const merge=el('button','dz-merge-button','MERGE DUPLICATE · '+level+'/5',wrapper);merge.disabled=level>=5||duplicate<0;merge.onclick=()=>weaponProgress('merge',i,duplicate);if(nextWeapons(id).length)el('small','dz-evolve-label','🎰 Roulette upgrade available at the wave 5 table',wrapper);else el('small','dz-evolve-label','MAXED LEGENDARY',wrapper)}});
el('p','dz-inv-foot','1 / 2: change weapons  ·  Hold Shift: sprint  ·  I: close inventory  ·  B: reinforce doors with boards',right);
function selectHand(hand){selectedInventoryHand=hand;for(const b of slots.children)b.classList.toggle('active',b.dataset.hand===hand);}
for(let i=0;i<slots.children.length;i++){const b=slots.children[i],key=i===0?'primary':'secondary';b.dataset.hand=key;b.onclick=()=>{selectHand(key);if(p[key]){if(session.mode==='host')swapWeapon(p,key);else emit(session.host,{t:'dz-swap',id:session.id,hand:key});}};}
selectHand(selectedInventoryHand);inventoryPanel.scrollTop=scrollPositions.panel;right.scrollTop=scrollPositions.backpack;left.scrollTop=scrollPositions.side;}
function visualHouse(h){const c=['#54615a','#62584d','#555e67','#685849','#4a6158'][h.type||0],floor=['#675f52','#6f6659','#555d5b','#776b5c','#59685f'][h.type||0];ctx.fillStyle='#0c1818';ctx.fillRect(h.x+9,h.y+11,h.w,h.h);ctx.fillStyle=c;ctx.fillRect(h.x,h.y,h.w,h.h);ctx.fillStyle=floor;ctx.fillRect(h.x+11,h.y+11,h.w-22,h.h-22);drawInterior(h);ctx.fillStyle='#393b33';ctx.fillRect(h.x+24,h.y+24,64,25);ctx.fillRect(h.x+h.w-90,h.y+35,65,33);ctx.fillStyle='#90806c';ctx.fillRect(h.x+27,h.y+29,58,9);ctx.fillStyle='#8f9b92';ctx.fillRect(h.x+h.w-70,h.y+h.h-55,48,24);ctx.strokeStyle='#d0c8b5';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(h.x,h.y+h.h);ctx.lineTo(h.x,h.y);ctx.lineTo(h.x+h.w,h.y);ctx.lineTo(h.x+h.w,h.y+h.h);ctx.lineTo(h.doorX+31,h.y+h.h);ctx.moveTo(h.doorX-31,h.y+h.h);ctx.lineTo(h.x,h.y+h.h);ctx.stroke();ctx.strokeStyle='#354e51';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(h.x+25,h.y);ctx.lineTo(h.x+70,h.y);ctx.moveTo(h.x+h.w,h.y+45);ctx.lineTo(h.x+h.w,h.y+85);ctx.stroke();if(h.type===2){ctx.fillStyle='#8b826f';ctx.fillRect(h.x+95,h.y+28,75,45);}if(h.type===3){ctx.fillStyle='#35352f';ctx.fillRect(h.x+14,h.y+82,90,18);}ctx.fillStyle=h.doorHp<=0?'#24211c':h.doorOpen?'#887354':h.boards>=3?'#9c372e':h.boards>=1?'#cd8e36':'#79502d';if(h.doorOpen){ctx.fillRect(h.doorX-34,h.doorY-30,9,35);}else{ctx.fillRect(h.doorX-30,h.doorY-11,60,14);ctx.fillStyle='#c6b16c';for(let b=0;b<(h.boards||0);b++)ctx.fillRect(h.doorX-28,h.doorY-10+b*3,56,2);ctx.fillStyle='#181915';ctx.fillRect(h.doorX-30,h.doorY-19,60,3);ctx.fillStyle=h.doorHp/(h.doorMaxHp||100)>.5?'#6fdb85':'#e9b05e';ctx.fillRect(h.doorX-30,h.doorY-19,60*Math.max(0,Math.min(1,h.doorHp/(h.doorMaxHp||100))),3);}}
function nearbyChest(p){if(!p||!world)return null;let nearest=null,best=80;for(const c of world.chests){if(c.opened)continue;const d=Math.hypot(c.x-p.x,c.y-p.y);if(d<best){best=d;nearest=c;}}return nearest;}
function formatPlaytime(seconds){const n=Math.max(0,Math.floor(Number(seconds)||0)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),sec=n%60;return h>0?[h,m,sec].map(v=>String(v).padStart(2,'0')).join(':'):[m,sec].map(v=>String(v).padStart(2,'0')).join(':');}
let lastDamagePlayer='',lastDamageHp=null,lastDamageWorld=null,hitOverlayAt=-Infinity,hitOverlaySeed=0;
function drawHitOverlay(now){
 const age=now-hitOverlayAt;if(age>1050)return;
 const fade=Math.pow(Math.max(0,1-age/1050),1.45);
 ctx.save();ctx.globalAlpha=fade;
 const edge=ctx.createRadialGradient(W/2,H/2,90,W/2,H/2,Math.max(W,H)*.72);
 edge.addColorStop(0,'#50000000');edge.addColorStop(.58,'#8c08000a');edge.addColorStop(1,'#9b0900bb');
 ctx.fillStyle=edge;ctx.fillRect(0,0,W,H);
 const rand=n=>{const x=Math.sin(n*127.1+hitOverlaySeed*31.7)*43758.5453;return x-Math.floor(x);};
 for(let i=0;i<9;i++){
  const x=(i%3===0?30+rand(i+1)*170:i%3===1?W-210+rand(i+1)*180:rand(i+1)*W);
  const y=(i%3===2?(rand(i+20)>.5?30:H-80):rand(i+20)*H);
  const radius=5+rand(i+10)*14;
  ctx.fillStyle=i%3?'#870b0bc7':'#c1261ad8';
  ctx.beginPath();ctx.ellipse(x,y,radius,radius*(.55+rand(i+30)*.6),rand(i+44)*6,0,Math.PI*2);ctx.fill();
  for(let j=0;j<4;j++){const a=rand(i*9+j+30)*Math.PI*2,d=radius*(1.5+rand(i*7+j)*2.2);ctx.beginPath();ctx.arc(x+Math.cos(a)*d,y+Math.sin(a)*d,1.5+rand(i+j+76)*3,0,Math.PI*2);ctx.fill();}
 }
 ctx.lineCap='round';
 for(let i=0;i<3;i++){const x=(i===0?W*.17:i===1?W*.83:W*.5)+(rand(i+91)-.5)*90,y=(i===2?H*.85:H*.2)+(rand(i+97)-.5)*90;
 ctx.strokeStyle='#350404e0';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x-25,y-36);ctx.quadraticCurveTo(x+12,y-3,x+26,y+37);ctx.stroke();
 ctx.strokeStyle='#d9342bbb';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x-23,y-35);ctx.quadraticCurveTo(x+14,y-3,x+28,y+37);ctx.stroke();}
 ctx.restore();
}
function drawRouletteTable(){if((world?.wave||0)<5)return;ctx.save();ctx.translate(ROULETTE_X,ROULETTE_Y);ctx.fillStyle='#080f11ac';ctx.beginPath();ctx.ellipse(5,18,72,33,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#372820';ctx.fillRect(-63,-19,126,44);ctx.fillStyle='#b88d52';ctx.fillRect(-62,-23,124,37);ctx.strokeStyle='#e7bb72';ctx.lineWidth=4;ctx.strokeRect(-62,-23,124,37);const colors=['#839289','#65c884','#579ef5','#b880ed','#ffbd55'];for(let i=0;i<10;i++){const a=i*Math.PI/5;ctx.fillStyle=colors[i%5];ctx.beginPath();ctx.moveTo(0,-5);ctx.arc(0,-5,23,a,a+Math.PI/5);ctx.fill();}ctx.fillStyle='#10171b';ctx.beginPath();ctx.arc(0,-5,6,0,Math.PI*2);ctx.fill();ctx.font='bold 13px monospace';ctx.textAlign='center';ctx.fillStyle='#ffe09c';ctx.fillText('ROULETTE',0,-40);ctx.font='11px monospace';ctx.fillText('PRESS E TO GAMBLE',0,42);ctx.restore();}
function drawScene(){if(!ctx)return;const own=world?.players.find(q=>q.id===who());
 if(session?.id!==lastDamageWorld||own?.id!==lastDamagePlayer){lastDamageWorld=session?.id;lastDamagePlayer=own?.id||'';lastDamageHp=own?.hp??null;hitOverlayAt=-Infinity;}
 else if(own&&lastDamageHp!==null&&own.hp<lastDamageHp&&session?.phase==='play'){hitOverlayAt=performance.now();hitOverlaySeed++;lastDamageHp=own.hp;}
 else if(own)lastDamageHp=own.hp;const living=world?.players.filter(q=>q.hp>0)||[];const p=own?.hp<=0&&living.length?living[spectatorIndex%living.length]:own||world?.players[0];camera.x=Math.max(0,Math.min(MAPW-W,(p?.x??MAPW/2)-W/2));camera.y=Math.max(0,Math.min(MAPH-H,(p?.y??MAPH/2)-H/2));ctx.fillStyle='#25342b';ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(-camera.x,-camera.y);for(let x=Math.floor(camera.x/70)*70;x<camera.x+W+70;x+=70)for(let y=Math.floor(camera.y/70)*70;y<camera.y+H+70;y+=70){const n=Math.abs(Math.sin(x*12.9898+y*78.233));ctx.fillStyle=n>.55?'#3e4937':'#2d3d30';ctx.fillRect(x+n*18,y+n*24,3+n*5,4+n*5);}ctx.fillStyle='#414743';for(let x=90;x<MAPW;x+=500){ctx.fillRect(x-55,0,115,MAPH);ctx.fillStyle='#85837b';ctx.fillRect(x-57,0,3,MAPH);ctx.fillRect(x+58,0,3,MAPH);ctx.fillStyle='#414743';}ctx.fillStyle='#4a4a45';for(let y=65;y<MAPH;y+=430)ctx.fillRect(0,y-43,MAPW,93);ctx.setLineDash([24,22]);ctx.strokeStyle='#c6bfa1';ctx.lineWidth=2;for(let x=90;x<MAPW;x+=500){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,MAPH);ctx.stroke();}for(let y=65;y<MAPH;y+=430){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(MAPW,y);ctx.stroke();}ctx.setLineDash([]);
if(world){drawDistrict();for(const h of world.houses){if(h.x>camera.x+W||h.x+h.w<camera.x||h.y>camera.y+H||h.y+h.h<camera.y)continue;visualHouse(h);}
drawConcreteBarriers();drawRouletteTable();drawBlood();drawObjectives();for(const c of world.chests)if(!c.opened){ctx.fillStyle='#a67a3a';ctx.fillRect(c.x-11,c.y-9,22,18);ctx.strokeStyle='#f2d088';ctx.lineWidth=2;ctx.strokeRect(c.x-11,c.y-9,22,18);}
for(const d of world.drops||[]){ctx.fillStyle=d.owner?'#252349d9':'#0a201ac9';ctx.fillRect(d.x-17,d.y-16,34,32);ctx.strokeStyle='#f0d174';ctx.lineWidth=3;ctx.strokeRect(d.x-17,d.y-16,34,32);ctx.fillStyle='#ffda74';ctx.font='bold 17px system-ui';ctx.textAlign='center';ctx.fillText('✦',d.x,d.y+6);ctx.font='11px system-ui';ctx.fillText((d.quantity?d.quantity+' × ':'')+(d.resource==='ammo'?'Ammo':itemDefs[d.item]?.name||'Loot'),d.x,d.y-24);}for(const z of world.zombies){if(z.x<camera.x-65||z.x>camera.x+W+65||z.y<camera.y-65||z.y>camera.y+H+65)continue;drawSurvivor(z,true);if(z.boss){ctx.strokeStyle='#ff5d4d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(z.x,z.y,18+bossSize(z)*14,0,Math.PI*2);ctx.stroke();ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffe9bd';ctx.fillText('☠ '+(BOSS_NAMES[z.kind]||'TITAN'),z.x,z.y-32-bossSize(z)*13);}if(z.hit>0||z.boss){ctx.fillStyle='#cf7763';ctx.fillRect(z.x-(z.boss?48:17),z.y-(z.boss?43+bossSize(z)*12:29),(z.boss?96:34)*Math.max(0,z.hp)/(z.maxHp||z.hp),z.boss?7:3);}}
if(world.verity){drawVerity(world.verity);if(world.verity.state==='down'){const v=world.verity;ctx.save();ctx.strokeStyle='#ffe05a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(v.x,v.y,29+Math.sin(performance.now()/250)*3,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffe05a';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText('✚ REVIVE VERITY',v.x,v.y-56);ctx.restore();}}
for(const q of world.players){if(q.x<camera.x-75||q.x>camera.x+W+75||q.y<camera.y-75||q.y>camera.y+H+75)continue;if(q.hp<=0){ctx.fillStyle='#9e4a47';ctx.beginPath();ctx.arc(q.x,q.y,14,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f7d2d0';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText('DOWN',q.x,q.y-20);continue;}ctx.fillStyle='#091816';ctx.beginPath();ctx.ellipse(q.x+4,q.y+8,16,10,0,0,Math.PI*2);ctx.fill();drawSurvivor(q,false);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.face||0);ctx.translate(9,10);ctx.lineCap='round';const weapon=q.weapon||'bat';if(itemDefs[weapon]?.range<100&&q.swing>0){const progress=1-q.swing/(q.swingTotal||.2);const eased=progress<.18?-.20*(progress/.18):progress<.70?-.20+1.32*(1-Math.pow(1-(progress-.18)/.52,3)):1.12+.20*Math.sin((progress-.70)/.30*Math.PI/2);const dir=q.swingDir||1;ctx.rotate(dir*(-1.4+eased*2.8));const alpha=Math.max(0,Math.sin(Math.PI*progress));ctx.strokeStyle='rgba(225,239,200,'+(.12+alpha*.48)+')';ctx.lineWidth=2+alpha*6;ctx.beginPath();ctx.arc(0,0,49,dir<0?-1.2:-.4,dir<0?.4:1.2);ctx.stroke();ctx.strokeStyle='rgba(255,243,188,'+(alpha*.36)+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,57,-.5,.5);ctx.stroke();}const isGun=(itemDefs[weapon]?.range||0)>100;
// Keep weapon artwork proportional to the survivor sprite without changing combat range.
ctx.scale(.58,.58);
ctx.lineJoin='round';ctx.lineCap='round';ctx.shadowColor='#060e0c';ctx.shadowBlur=3;ctx.shadowOffsetY=2;
if(weapon==='chainsaw'){ctx.fillStyle='#1b2424';ctx.fillRect(4,-13,39,26);ctx.fillStyle='#de842f';ctx.fillRect(10,-10,32,20);ctx.fillStyle='#f9b05d';ctx.fillRect(12,-9,23,4);ctx.strokeStyle='#28312e';ctx.lineWidth=5;ctx.strokeRect(17,-16,18,29);ctx.fillStyle='#aab9b3';ctx.fillRect(39,-7,37,14);ctx.strokeStyle='#343a39';ctx.lineWidth=3;ctx.strokeRect(39,-7,37,14);ctx.fillStyle='#ece8d3';for(let t=43;t<77;t+=5){ctx.fillRect(t,-9,3,4);ctx.fillRect(t,5,3,4);}if(q.swing>0){ctx.fillStyle='#ffd176';ctx.fillRect(70,-4,7,8);}}
else if(isGun){const long=['rifle','sniper','shotgun','doublebarrel','railgun','thunderbolt','hellfire','eclipse'].includes(weapon),length=weapon==='sniper'?70:long?58:weapon==='smg'?42:35;ctx.fillStyle=weapon==='eclipse'?'#722a8f':weapon==='railgun'?'#2a657b':weapon==='hellfire'?'#83412d':weapon==='thunderbolt'?'#41658f':'#292f2c';ctx.fillRect(2,-7,length-3,14);ctx.fillStyle='#83928b';ctx.fillRect(length-23,-4,24,8);ctx.fillStyle='#afc1b8';ctx.fillRect(length-5,-3,7,6);ctx.fillStyle='#6f5035';ctx.fillRect(8,6,13,11);ctx.fillStyle='#1c2627';ctx.fillRect(15,-12,10,5);if(long){ctx.fillStyle='#493d2f';ctx.fillRect(23,-7,14,14);ctx.fillStyle='#131b1d';ctx.fillRect(24,7,8,11);}if(weapon==='sniper'){ctx.fillStyle='#171c1c';ctx.fillRect(25,-14,20,6);ctx.fillStyle='#9eaba7';ctx.fillRect(29,-13,12,2);}if(weapon==='eclipse'){ctx.fillStyle='#f472f5';ctx.fillRect(12,-10,length-14,5);ctx.fillStyle='#78f3ed';ctx.fillRect(length-7,-5,14,10);}if(weapon==='revolver'){ctx.fillStyle='#9aa6a2';ctx.beginPath();ctx.arc(20,0,7,0,Math.PI*2);ctx.fill();}if(weapon==='doublebarrel'){ctx.fillStyle='#c4d1c7';ctx.fillRect(38,-5,19,3);ctx.fillRect(38,2,19,3);}}
else if(['axe','sledge','hammer'].includes(weapon)){ctx.strokeStyle='#795739';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(42,0);ctx.stroke();ctx.fillStyle='#aebbb7';if(weapon==='axe'){ctx.beginPath();ctx.moveTo(34,-15);ctx.lineTo(54,-12);ctx.lineTo(51,13);ctx.lineTo(34,16);ctx.closePath();ctx.fill();}else{ctx.fillRect(33,weapon==='sledge'?-14:-10,weapon==='sledge'?24:16,weapon==='sledge'?28:20);}}
else if(['katana','machete','sunbreaker','reaper','voidblade'].includes(weapon)){ctx.strokeStyle='#49372e';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(19,0);ctx.stroke();ctx.fillStyle=weapon==='sunbreaker'?'#ffce58':weapon==='reaper'?'#cc538f':weapon==='voidblade'?'#ab84f9':'#c9d7d0';ctx.beginPath();ctx.moveTo(19,-5);ctx.lineTo(['katana','sunbreaker','reaper'].includes(weapon)?70:56,-3);ctx.lineTo(['katana','sunbreaker','reaper'].includes(weapon)?75:59,0);ctx.lineTo(19,5);ctx.closePath();ctx.fill();ctx.fillStyle='#d6b27c';ctx.fillRect(16,-8,4,16);}
else{ctx.strokeStyle=weapon==='crowbar'||weapon==='pipe'?'#8d9b98':'#9c7046';ctx.lineWidth=weapon==='bat'?11:7;ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(weapon==='pipe'?49:44,0);ctx.stroke();if(weapon==='crowbar'){ctx.lineTo(51,-9);ctx.stroke();}if(weapon==='bat'){ctx.strokeStyle='#bfc1b4';ctx.lineWidth=2;for(const t of [22,32,41]){ctx.beginPath();ctx.moveTo(t,-6);ctx.lineTo(t+5,7);ctx.stroke();}}}
ctx.restore();if(q.flash>0){const a=q.flashAngle??q.face,x=q.x+Math.cos(a)*46-Math.sin(a)*10,y=q.y+Math.sin(a)*46+Math.cos(a)*10;const alpha=Math.min(1,q.flash/.14);ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha=alpha;ctx.fillStyle='#fff3bc';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(17,-4);ctx.lineTo(40,0);ctx.lineTo(17,4);ctx.lineTo(0,8);ctx.closePath();ctx.fill();ctx.fillStyle='#f5a447';ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(13,-5);ctx.lineTo(25,0);ctx.lineTo(13,5);ctx.lineTo(0,13);ctx.closePath();ctx.fill();ctx.restore();glow(x,y,q.weapon==='shotgun'?105:78,'#ffd173');}ctx.fillStyle='#f1f1e5';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText(name(q.id),q.x,q.y-30);ctx.fillStyle='#d65855';ctx.fillRect(q.x-19,q.y-25,38*q.hp/100,4);}
for(const b of world.shots){const speed=Math.hypot(b.vx,b.vy)||1,ux=b.vx/speed,uy=b.vy/speed;ctx.save();ctx.lineCap='round';ctx.strokeStyle=b.kind==='shotgun'?'#f5bb77aa':'#ffe5a8b3';ctx.lineWidth=b.kind==='shotgun'?3:2.5;ctx.beginPath();ctx.moveTo(b.x-ux*26,b.y-uy*26);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle='#fff6d7';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(b.x-ux*12,b.y-uy*12);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.fillStyle='#fff5c7';ctx.beginPath();ctx.arc(b.x,b.y,2.6,0,Math.PI*2);ctx.fill();ctx.restore();}drawEffects();updateHUD(p);if(world.ended&&!gameOverShown){gameOverShown=true;verityOpen=false;if(verityPanel)verityPanel.style.display='none';inventoryOpen=false;if(inventoryPanel)inventoryPanel.style.display='none';localStorage.removeItem(saveKey());screen((world.won?'EXTRACTION COMPLETE · ':'GAME OVER · ')+'Wave '+world.wave+' · Score '+world.score);button('⌂ Return to Start Menu',returnToMenu);}}ctx.restore();drawAtmosphere(p);if(own?.hp>0||own?.hp===0)drawHitOverlay(performance.now());drawMissionHUD(p);if(performance.now()-radarClock>=100){radarClock=performance.now();drawMiniMap();}const house=own?.hp>0?nearDoor(own):null,near=own?.hp>0?nearbyChest(own):null,drop=(world?.drops||[]).find(d=>p&&Math.hypot(d.x-p.x,d.y-p.y)<65);
if(session?.phase==='play'&&!world.ended){
const hints=[];const down=world?.players.find(q=>own?.hp>0&&q.id!==own.id&&q.hp<=0&&Math.hypot(q.x-own.x,q.y-own.y)<64);if(down)hints.push({text:'REVIVE '+name(down.id)+' · Hold '+binds.interact.replace('Key','')+'  '+Math.round((own.reviveTarget===down.id?own.reviveHold||0:0)/3*100)+'%',progress:Math.min(1,(own.reviveTarget===down.id?own.reviveHold||0:0)/3),color:'#9ce7b3'});if(own?.hp<=0&&living.length)hints.push({text:'SPECTATING '+name(p.id)+' · Press Tab to switch player',color:'#efc48d'});
if(near)hints.push({text:'CHEST · Hold '+binds.interact.replace('Key','')+' to open  '+Math.round((p?.chestTarget===near.id?p?.chestHold||0:0)/1.25*100)+'%',progress:Math.min(1,(p?.chestTarget===near.id?p?.chestHold||0:0)/1.25),color:'#e8c67a'});
if(drop)hints.push({text:'LOOT · Press '+binds.interact.replace('Key','')+' to pick up '+((drop.quantity?drop.quantity+' × ':'')+(drop.resource==='ammo'?'Ammo':itemDefs[drop.item]?.name||'supplies')),color:'#9fe1ac'});
if(own?.hp>0&&world?.verity&&Math.hypot(own.x-world.verity.x,own.y-world.verity.y)<85){const v=world.verity;if(v.state==='sleeping')hints.push({text:'☀ VERITY · Press E to wake up',color:'#ffe087'});else if(v.state==='down')hints.push({text:'✚ REVIVE VERITY · Hold E · '+Math.round((v.reviveHold||0)/3*100)+'%',progress:Math.min(1,(v.reviveHold||0)/3),color:'#ffd368'});else hints.push({text:'☀ VERITY · G: Inventory · V: Heal (1 Mint) · '+Math.round(v.hp)+' HP',color:'#ffe087'});}
if(house)hints.push({text:'DOOR · '+binds.door.replace('Key','')+' '+(house.doorOpen?'Close':'Open')+'   '+binds.board.replace('Key','')+' Board   '+binds.repair.replace('Key','')+' Repair  🪵'+(p?.boards||0),color:'#d3e3d2'});
const baseY=H-180;
hints.forEach((hint,i)=>{const y=baseY-i*49,w=420,x=(W-w)/2;ctx.fillStyle='#091b19ed';ctx.fillRect(x,y,w,43);ctx.strokeStyle=hint.color;ctx.lineWidth=1.5;ctx.strokeRect(x+.5,y+.5,w-1,42);ctx.fillStyle=hint.color;ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillText(hint.text,W/2,y+23);if(hint.progress!==undefined){ctx.fillStyle='#27332b';ctx.fillRect(x+12,y+32,w-24,5);ctx.fillStyle=hint.color;ctx.fillRect(x+12,y+32,(w-24)*hint.progress,5);}});
}
if(world?.verity?.state==='down'){const v=world.verity,sx=v.x-camera.x,sy=v.y-camera.y;if(sx<35||sx>W-35||sy<35||sy>H-35){const a=Math.atan2(sy-H/2,sx-W/2),x=Math.max(35,Math.min(W-35,W/2+Math.cos(a)*390)),y=Math.max(70,Math.min(H-75,H/2+Math.sin(a)*215));ctx.save();ctx.fillStyle='#ffdc65';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText('✚ VERITY DOWN · '+Math.round(Math.hypot(v.x-(own?.x||0),v.y-(own?.y||0)))+'m',x,y);ctx.restore();}}
if(world?.notice){ctx.textAlign='center';ctx.font='bold 14px system-ui';ctx.fillStyle='#f6d78b';ctx.fillText(world.notice,W/2,36);}
 // Red, gently pulsing screen edges warn only the local survivor below 35 HP.
 const local=world?.players.find(q=>q.id===who());
 if(session?.phase==='play'&&local?.hp>0&&local.hp<35){
  const severity=Math.min(1,(35-local.hp)/35),pulse=.88+.12*Math.sin((performance.now()/1000)*5.5);
  const edge=Math.max(W,H)*.65,shade=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.19,W/2,H/2,edge);
  shade.addColorStop(0,'rgba(125,0,0,0)');
  shade.addColorStop(.54,'rgba(130,0,0,'+(.025+severity*.06)*pulse+')');
  shade.addColorStop(1,'rgba(175,5,12,'+(.26+severity*.50)*pulse+')');
  ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(175,5,12,'+(.015+severity*.075)*pulse+')';ctx.fillRect(0,0,W,H);
 }
}


// Protocol 2: fixed-step input commands, exact acknowledgements and independent render state.
let hostWorker=null,hostCheckpoint=null,workerFailed=false,workerPaused=false,inputEpoch='';
const hostStreams=new Map(),metadataSent=new Map(),remoteSnapshots=new Net.SnapshotBuffer();
const prediction=new Net.Prediction(move);
let networkTimer=0,pumpAt=0,accumulator=0,sendClock=0,metadataClock=0,lastDrawAt=0,lastVisualAt=0,radarClock=0,metadataSerial=0,lastMetadataSerial=0,resyncAt=0,fireTap=false,previousFireSample=false;
let hudNodes=null,lastInventorySignature='',guestEffectsSeen=new Set();
let attackPreview={cool:0,swing:0,flash:0},previewShots=[],previewFireHeld=false;
const edgeKeys=['mint','door','board','repair','barrier','swap'];
function resetNetwork(){
 if(hostWorker){hostWorker.terminate();hostWorker=null;}hostCheckpoint=null;workerPaused=false;inputEpoch='';
 hostStreams.clear();metadataSent.clear();remoteSnapshots.reset();prediction.reset();guestVisuals.clear();guestEffectsSeen.clear();
 snapshotSerial=lastSnapshotSerial=metadataSerial=lastMetadataSerial=0;lastVerityChatSeen=0;accumulator=sendClock=metadataClock=0;pumpAt=0;lastVisualAt=0;localInput={};fireTap=previousFireSample=false;
 attackPreview={cool:0,swing:0,flash:0};previewShots=[];previewFireHeld=false;
 if(networkTimer){clearInterval(networkTimer);networkTimer=0;}
}
function startNetworkMatch(){
 resetNetwork();
 if(!window.__DEAD_ZONE_WORKER__&&!workerFailed&&peers().size&&typeof Worker!=='undefined'){
  try{
   const worker=new Worker(workerScriptURL);hostWorker=worker;inputEpoch=crypto.randomUUID();hostCheckpoint=JSON.parse(JSON.stringify(world));prediction.seed(world.players.find(p=>p.id===who()));
   worker.onmessage=({data})=>{if(hostWorker!==worker)return;
    if(data.type==='view')receiveSnapshot(data.packet,performance.now());
    else if(data.type==='checkpoint'){hostCheckpoint=data.world;if(data.save)persistSave(data.world);}
    else if(data.type==='network'){if(data.to===who()){if(data.packet.t==='dz-meta')receiveMetadata(data.packet);}else emit(data.to,data.packet);}
   };
   worker.onerror=e=>{console.error('Dead Zone host worker failed',e.message);workerFailed=true;const backup=hostCheckpoint;worker.terminate();hostWorker=null;if(backup)world=backup;startNetworkMatch();};
   worker.postMessage({type:'init',hostEpoch:inputEpoch,host:who(),players:world.players.map(p=>p.id),names:Object.fromEntries(world.players.map(p=>[p.id,name(p.id)])),session:{id:session.id,gameMode:world.mode,difficulty:world.difficulty},peers:[...peers().keys()],world});
   networkTimer=setInterval(()=>advanceGame(performance.now()),8);return;
  }catch(e){workerFailed=true;hostWorker=null;console.warn('Dead Zone worker unavailable',e.message);}
 }
for(const [id,g]of peers()){g.netReady=false;g.epoch=crypto.randomUUID();g.startSent=performance.now();emit(id,{t:'dz-start',id:session.id,protocol:2,epoch:g.epoch,world});}
 if(!networkTimer)networkTimer=setInterval(()=>advanceGame(performance.now()),8);
}
function hostInput(id,dt){return hostStreams.get(id)?.consume(dt,performance.now())||inputs.get(id)||{};}
function advancePlayerMovement(p,a,dt){
 const energy=p.energy||0;
 if(a._network){for(const c of a._steps)Net.stepMovement(p,c.input,move);}
 else Net.stepMovement(p,a,move,dt);
 if((p.energy||0)<energy)world.notice=name(p.id)+' automatically used an energy drink';
}
const motionFields=['x','y','vx','vy','hp','stamina','exhausted','energy','face','swing','swingTotal','swingDir','flash','flashX','flashY','flashAngle','recoil','invuln','reviveHold','reviveTarget','chestHold','chestTarget','chestComplete','attackSerial'];
const inventoryFields=['rouletteSerial','rouletteResult','inventory','itemLevels','equippedIndices','weaponLevels','primary','secondary','activeSlot','weapon','armor','ammo','medkits','mints','boards','concrete','energy','kills','color'];
function networkSnapshot(){
 const players=world.players.map(p=>{const q={id:p.id};for(const k of motionFields)if(p[k]!==undefined)q[k]=typeof p[k]==='number'?Math.round(p[k]*1000)/1000:p[k];return q;});
 const zombies=world.zombies.map(z=>[z.netId??(z.netId=world.zombieSerial=(world.zombieSerial||0)+1),Math.round(z.x*10)/10,Math.round(z.y*10)/10,z.hp,z.maxHp,z.kind,z.hit||0,!!z.boss,z.attackPower||1]);
 const shots=world.shots.slice(-32).map(b=>[Math.round(b.x),Math.round(b.y),Math.round(b.vx),Math.round(b.vy),b.life,b.kind,b.owner]);
 const effects=world.effects.slice(-12).map(e=>[e.id,Math.round(e.x),Math.round(e.y),Math.round(e.vx),Math.round(e.vy),e.color,e.life,e.max,e.size,e.blood?1:0]);
 const ack={};for(const [id,stream]of hostStreams)ack[id]=stream.ack;
 return{t:'dz-state',protocol:2,epoch:inputEpoch,id:session.id,seq:++snapshotSerial,ack,world:{players,zombies,shots,effects,time:world.time,wave:world.wave,score:world.score,remaining:world.remaining,between:world.between,ended:world.ended,won:world.won,story:{...world.story},notice:world.notice,verity:world.verity,verityChat:(world.verityChat||[]).slice(-8),verityChatSerial:world.verityChatSerial||0,mythicCreated:!!world.mythicCreated}};
}
function sendMetadata(){
 const data={mythicCreated:!!world.mythicCreated,barriers:world.barriers||[],players:world.players.map(p=>{const q={id:p.id};for(const k of inventoryFields)q[k]=p[k];return q;}),doors:world.houses.map(h=>[h.doorOpen,h.doorHp,h.boards,h.doorMaxHp]),chests:world.chests.map(c=>!!c.opened),drops:world.drops};
 const signature=JSON.stringify(data);
 for(const [id,g]of [...peers(),...(window.__DEAD_ZONE_WORKER__?[[who(),{netReady:true}]]:[])]){
  if(!g.netReady)continue;const previous=metadataSent.get(id)||{blood:0};
  const blood=[];for(const b of world.blood){if(!b.netId)b.netId=world.bloodSerial=(world.bloodSerial||0)+1;if(b.netId>previous.blood)blood.push(b);}
  if(previous.signature===signature&&!blood.length)continue;
  if(emit(id,{t:'dz-meta',epoch:id===who()?inputEpoch:g.epoch,id:session.id,seq:++metadataSerial,data:previous.signature===signature?undefined:data,blood})===false)continue;
  metadataSent.set(id,{signature,blood:world.blood.at(-1)?.netId||previous.blood});
 }
}
function receiveMetadata(d){
 if(!world||(inputEpoch&&d.epoch!==inputEpoch)||!Number.isSafeInteger(d.seq)||d.seq<=lastMetadataSerial)return;lastMetadataSerial=d.seq;
 const data=d.data;if(data){if(typeof data.mythicCreated==='boolean')world.mythicCreated=data.mythicCreated;
  if(Array.isArray(data.players))for(const value of data.players){const p=world.players.find(p=>p.id===value.id);if(p)for(const k of inventoryFields)if(value[k]!==undefined)p[k]=value[k];}
  if(Array.isArray(data.doors)&&data.doors.length===world.houses.length)world.houses.forEach((h,i)=>{[h.doorOpen,h.doorHp,h.boards,h.doorMaxHp]=data.doors[i];});
  if(Array.isArray(data.chests))world.chests.forEach((c,i)=>c.opened=!!data.chests[i]);
  if(Array.isArray(data.drops))world.drops=data.drops;if(Array.isArray(data.barriers)){world.barriers=data.barriers;world.barrierRevision=(world.barrierRevision||0)+1;}
 }
 if(Array.isArray(d.blood)){const ids=new Set(world.blood.map(b=>b.netId));for(const b of d.blood)if(!ids.has(b.netId)){world.blood.push(b);ids.add(b.netId);}if(world.blood.length>160)world.blood.splice(0,world.blood.length-160);}
 if(rouletteOpen)showRoulette();if(inventoryOpen){const p=world.players.find(p=>p.id===who()),signature=JSON.stringify(p&&inventoryFields.map(k=>p[k]));if(signature!==lastInventorySignature){lastInventorySignature=signature;showInventory();}}if(verityOpen)showVerityInventory();
}
function receiveSnapshot(d,now){
 if(!world||(inputEpoch&&d.epoch!==inputEpoch)||d.protocol!==2||!Number.isSafeInteger(d.seq)||d.seq<=lastSnapshotSerial||!d.world||!Array.isArray(d.world.players)||d.world.players.length>MAX||!Array.isArray(d.world.zombies)||d.world.zombies.length>100)return;
 lastSnapshotSerial=d.seq;const next=d.world,oldPlayers=new Map(world.players.map(p=>[p.id,p])),oldZombies=new Map(world.zombies.map(z=>[z.netId,z]));
 world.players=next.players.map(value=>Object.assign(oldPlayers.get(value.id)||player(value.id,0),value));
 world.zombies=next.zombies.map(z=>Object.assign(oldZombies.get(z[0])||{},{netId:z[0],x:z[1],y:z[2],hp:z[3],maxHp:z[4],kind:z[5],hit:z[6],boss:z[7],attackPower:z[8]||1}));
 world.shots=(next.shots||[]).map(b=>({x:b[0],y:b[1],vx:b[2],vy:b[3],life:b[4],kind:b[5],owner:b[6]}));
 for(const k of ['time','wave','score','remaining','between','ended','won','story','notice','verity','verityChat','verityChatSerial','mythicCreated'])if(next[k]!==undefined)world[k]=next[k];
 for(const e of next.effects||[]){if(guestEffectsSeen.has(e[0]))continue;guestEffectsSeen.add(e[0]);world.effects.push({id:e[0],x:e[1],y:e[2],vx:e[3],vy:e[4],color:e[5],life:e[6],max:e[7],size:e[8],blood:e[9]===1});}
 if(guestEffectsSeen.size>1024)guestEffectsSeen=new Set([...guestEffectsSeen].slice(-256));if(world.effects.length>180)world.effects.splice(0,world.effects.length-180);
 const own=world.players.find(p=>p.id===who());if(own)prediction.reconcile(own,d.ack?.[who()]||0);
 const entities=new Map();for(const p of world.players)entities.set('p:'+p.id,{x:p.x,y:p.y,vx:p.vx,vy:p.vy,face:p.face,hp:p.hp});for(const z of world.zombies)entities.set('z:'+z.netId,{x:z.x,y:z.y,hp:z.hp});
 remoteSnapshots.push(next.time,entities,now);
 if(world.ended&&session?.mode==='host')localStorage.removeItem?.(saveKey());if(!world.ended){gameOverShown=false;if(!pauseOpen)menu.style.display='none';}
}
function updateGuestVisuals(now){
 const dt=Math.max(0,Math.min(.1,lastVisualAt?(now-lastVisualAt)/1000:0));lastVisualAt=now;
 const view=remoteSnapshots.sample(now);guestVisuals.clear();for(const [key,value]of view)guestVisuals.set(key,value);
 const own=world.players.find(p=>p.id===who());
 if(own){if(!prediction.state)prediction.seed(own);const visual=prediction.visual(dt);if(visual){visual.face=Math.atan2((localInput.ay??own.y)-visual.y,(localInput.ax??own.x+1)-visual.x);guestVisuals.set('p:'+own.id,visual);}}
}
function stepAttackPreview(){
 const dt=Net.STEP,p=world.players.find(p=>p.id===who()),v=prediction.state;
 for(const k of ['cool','swing','flash'])attackPreview[k]=Math.max(0,(attackPreview[k]||0)-dt);
 const fire=!!localInput.fire,weapon=itemDefs[p?.weapon]||itemDefs.bat,semi=['pistol','revolver','shotgun','doublebarrel','sniper','sledge','hammer','axe'].includes(p?.weapon);
 if(p?.hp>0&&itemDefs[p.weapon]?.type==='weapon'&&v&&fire&&(!semi||!previewFireHeld)&&attackPreview.cool<=0&&(weapon.range<100||p.ammo>0)){
  const face=Math.atan2((localInput.ay??v.y)-v.y,(localInput.ax??v.x+1)-v.x);attackPreview.cool=weapon.cool;
  if(weapon.range<100){attackPreview.swing=attackPreview.swingTotal=Math.min(.62,weapon.cool+.1);attackPreview.swingDir=-(attackPreview.swingDir||1);}
  else{attackPreview.flash=.12;attackPreview.flashX=v.x+Math.cos(face)*46-Math.sin(face)*10;attackPreview.flashY=v.y+Math.sin(face)*46+Math.cos(face)*10;attackPreview.flashAngle=face;for(const spread of ['shotgun','doublebarrel'].includes(p.weapon)?[-.2,0,.2]:[0])previewShots.push({x:v.x+Math.cos(face)*18,y:v.y+Math.sin(face)*18,vx:Math.cos(face+spread)*730,vy:Math.sin(face+spread)*730,life:Math.min(.25,weapon.range/730),kind:p.weapon,owner:who()});}
 }
 previewFireHeld=fire;
 for(const b of previewShots){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(solid(b.x,b.y,3))b.life=0;}previewShots=previewShots.filter(b=>b.life>0).slice(-24);
}
function draw(){
 announceDeaths();renderVerityChat();if(verityOpen)showVerityInventory();if(rouletteOpen)showRoulette();
 if((session?.mode!=='guest'&&!hostWorker)||!world){drawScene();return;}
 const authority=world,now=performance.now();updateGuestVisuals(now);const age=Math.min(.1,Math.max(0,(now-(remoteSnapshots.samples.at(-1)?.at||now))/1000));
 const view=q=>{const v=guestVisuals.get(q.id!==undefined?'p:'+q.id:'z:'+q.netId),result=v?{...q,x:v.x,y:v.y,face:v.face??q.face,vx:v.vx??q.vx,vy:v.vy??q.vy}:q;return q.id===who()&&q.hp>0?{...result,...(attackPreview.swing>0?{swing:attackPreview.swing,swingTotal:attackPreview.swingTotal,swingDir:attackPreview.swingDir}:{}),...(attackPreview.flash>0?{flash:attackPreview.flash,flashX:attackPreview.flashX,flashY:attackPreview.flashY,flashAngle:attackPreview.flashAngle}:{})}:result;};
 world={...authority,players:authority.players.map(view),zombies:authority.zombies.map(view),shots:[...authority.shots.filter(b=>!previewShots.length||b.owner!==who()).map(b=>({...b,x:b.x+b.vx*age,y:b.y+b.vy*age})),...previewShots]};
 try{drawScene();}finally{world=authority;}
}
function advanceGame(now){
 if(!session||session.phase!=='play'||!world){pumpAt=now;return;}
 if(hostWorker){const paused=!!((pauseOpen||inventoryOpen)&&!peers().size);if(paused!==workerPaused){workerPaused=paused;hostWorker.postMessage({type:'pause',paused});}}
 if(!pumpAt){pumpAt=now;return;}const elapsed=Math.max(0,Math.min(.25,(now-pumpAt)/1000));pumpAt=now;
 if(!world.ended){totalPlaytime+=elapsed;totalPlaytimeFlush+=elapsed;if(totalPlaytimeFlush>=5){flushTotalPlaytime();totalPlaytimeFlush=0;}}
 accumulator=Math.min(accumulator+elapsed,Net.STEP*8);
 while(accumulator>=Net.STEP-1e-7){
  const heldFire=localInput.fire;localInput.fire=heldFire||fireTap;
  if(session.mode==='host'&&!hostWorker){if(!((pauseOpen||inventoryOpen)&&!peers().size))tick(Net.STEP);}
  else if(!world.ended&&!workerPaused){const own=world.players.find(p=>p.id===who());if(own&&!prediction.state)prediction.seed(own);prediction.step(localInput);stepAttackPreview();for(const e of world.effects){e.life-=Net.STEP;e.x+=e.vx*Net.STEP;e.y+=e.vy*Net.STEP;}world.effects=world.effects.filter(e=>e.life>0);}
  localInput.fire=heldFire;fireTap=false;
  for(const k of edgeKeys)localInput[k]=k==='swap'?0:false;
  accumulator-=Net.STEP;
 }
 sendClock+=elapsed;metadataClock+=elapsed;
 if(session.mode==='host'&&!hostWorker){
  saveClock+=elapsed;if(saveClock>=12){saveGame();saveClock=0;}
  if(sendClock>=.05){sendClock%=.05;let snapshot=null;for(const [id,g]of peers()){
   if(!g.netReady){if(now-(g.startSent||0)>1000){g.startSent=now;emit(id,{t:'dz-start',id:session.id,protocol:2,epoch:g.epoch,world});}continue;}
   if(!snapshot)snapshot=networkSnapshot();emit(id,{...snapshot,epoch:g.epoch});
  }if(window.deadZoneHostFrame)window.deadZoneHostFrame(snapshot||networkSnapshot());}
  if(metadataClock>=.1){metadataClock%=.1;sendMetadata();}
 }else{
  if(sendClock>=.05){sendClock%=.05;if(hostWorker)hostWorker.postMessage({type:'input',epoch:inputEpoch,commands:prediction.packet()});else emit(session.host,{t:'dz-input',epoch:inputEpoch,id:session.id,protocol:2,commands:prediction.packet()});}
  if(!hostWorker&&prediction.pending.length>=Net.MAX_PENDING&&now-resyncAt>3000){resyncAt=now;emit(session.host,{t:'dz-resync',epoch:inputEpoch,id:session.id});}
 }
}
function frame(now){
 raf=requestAnimationFrame(frame);if(!session||root.style.display==='none')return;
 const sample=document.activeElement===gameChatInput||pauseOpen||inventoryOpen||verityOpen||rouletteOpen||document.hidden?{}:input();
 if(sample.fire&&!previousFireSample)fireTap=true;previousFireSample=!!sample.fire;
 for(const k of edgeKeys)sample[k]=sample[k]||localInput[k];localInput=sample;
 advanceGame(now);
 // A high-refresh display must not multiply canvas work or network traffic.
 if(now-lastDrawAt>=1000/60-1){lastDrawAt=now;draw();}
}
function updateHUD(p){
 if(performance.now()-hudClock<100)return;hudClock=performance.now();
 if(!hudNodes||!labels.firstChild){
  labels.innerHTML='<div class="dz-hud-top"><span class="dz-badge">☣ DEAD ZONE</span><span class="dz-wave">WAVE <b data-dz="wave"></b></span><span class="dz-score" data-dz="score"></span><span class="dz-resource" data-dz="time"></span><span class="dz-resource" data-dz="enemies"></span><span class="dz-resource" data-dz="countdown"></span><button id="dzInventoryToggle" class="dz-inventory-toggle" type="button">▣ INVENTORY</button></div><div class="dz-hud-bottom"><div class="dz-health"><small>HEALTH</small><div class="dz-health-track" role="meter" aria-label="Health" aria-valuemin="0" aria-valuemax="100"><i data-dz="hpBar"></i></div><b data-dz="hp"></b></div><div class="dz-health"><small>STAMINA</small><div class="dz-stamina-track"><i data-dz="staminaBar"></i></div><b data-dz="stamina"></b></div><div class="dz-equipped"><small>WEAPON</small><b data-dz="weapon"></b></div><div class="dz-resource" data-dz="armor"></div><div class="dz-resource" data-dz="ammo"></div><div class="dz-resource" data-dz="boards"></div><div class="dz-resource" data-dz="medkits"></div><div class="dz-resource" data-dz="mints"></div><div class="dz-resource" data-dz="energy"></div><div class="dz-equipped"><small>PRIMARY · 1</small><b data-dz="primary"></b></div><div class="dz-equipped"><small>SECONDARY · 2</small><b data-dz="secondary"></b></div></div>';
  hudNodes=Object.fromEntries([...labels.querySelectorAll('[data-dz]')].map(e=>[e.dataset.dz,e]));labels.querySelector('#dzInventoryToggle').onclick=()=>{inventoryOpen=!inventoryOpen;showInventory();};
 }
 const values={wave:world.wave,score:'★ '+world.score+' PTS',time:'🕒 '+formatPlaytime(world.time),enemies:'☣ '+(world.zombies.length+world.remaining)+' ENEMIES LEFT',countdown:world.between>0?Math.ceil(world.between)+'s UNTIL WAVE '+(world.wave+1):'WAVE ACTIVE',hp:Math.round(p?.hp||0)+'/100',stamina:Math.round(p?.stamina??100),weapon:itemDefs[p?.weapon]?.name||'Bat',armor:'🛡 '+(itemDefs[p?.armor]?.name||'No armor'),ammo:'▣ '+(p?.ammo||0)+' AMMO',boards:'🪵 '+(p?.boards||0)+' BOARDS',medkits:'🩹 '+(p?.medkits||0)+' MEDKITS',mints:'🍬 '+(p?.mints||0)+' MINTS',energy:'⚡ '+(p?.energy||0)+' ENERGY · AUTO',primary:itemDefs[p?.primary]?.name||'Empty',secondary:itemDefs[p?.secondary]?.name||'Empty'};
 for(const [key,value]of Object.entries(values))if(hudNodes[key].textContent!==String(value))hudNodes[key].textContent=value;
 hudNodes.hpBar.style.width=Math.round(Math.max(0,p?.hp||0))+'%';hudNodes.hpBar.parentElement.setAttribute('aria-valuenow',Math.round(p?.hp||0));hudNodes.staminaBar.style.width=Math.round(p?.stamina??100)+'%';
}

window.deadZoneHandle=(from,d)=>{if(!d||d.v!==1||typeof d.id!=='string')return;if(!state?.friends?.[from]&&d.t!=='dz-join'&&!(session?.mode==='host'&&peers().has(from))&&from!==session?.host)return;
if(d.t==='dz-code-lookup'){if(session?.mode==='host'&&session.phase==='lobby'&&session.code===d.id&&peers().size<MAX-1)emit(from,{t:'dz-code-found',id:session.id,code:session.code});return;}
if(d.t==='dz-code-found'){if(session?.mode==='host'&&session.phase==='lobby'&&pendingJoinCode&&pendingJoinCode===d.code){pendingJoinCode='';join({from,id:d.id});}return;}
if(d.t==='dz-invite'){invite={from,id:d.id};if(session)return;build();const status=document.querySelector('#deadZoneInviteStatus');if(status)status.textContent=name(from)+' invited you to Dead Zone. Open Games → Dead Zone to join.';return;}
if(session?.mode==='host'&&session.phase==='lobby'&&d.t==='dz-join'&&d.id===session.id&&!peers().has(from)&&peers().size<MAX-1){peers().set(from,{ready:false,seen:performance.now(),input:{}});window.deadZoneAuthorizePublicPeer?.(from);}
if(!session||d.id!==session.id)return;if(d.t==='dz-chat'&&typeof d.message==='string'){if(session.mode==='host'){if(!peers().has(from))return;addGameMessage(from,d.message);group({t:'dz-chat',id:session.id,from,message:d.message.slice(0,220)});if(hostWorker)hostWorker.postMessage({type:'verityChat',id:from,message:d.message.slice(0,220)});else verityReplyToPlayer(from,d.message);}else if(from===session.host)addGameMessage(d.from||from,d.message);return;}
if(session.mode==='host'&&hostWorker&&['dz-input','dz-ready','dz-resync','dz-swap','dz-equip','dz-drop','dz-merge','dz-evolve','dz-verity','dz-leave'].includes(d.t)){hostWorker.postMessage({type:'packet',from,packet:d});if(d.t==='dz-leave')peers().delete(from);return;}
if(session.mode==='host'){const g=peers().get(from);if(!g)return;g.seen=performance.now();
if(d.t==='dz-join'){g.ready=true;if(!world.players.some(p=>p.id===from))world.players.push(player(from,world.players.length));group({t:'dz-lobby',id:session.id,players:world.players});lobby();}
if(d.t==='dz-input'&&Array.isArray(d.commands)){if(d.epoch!==g.epoch)return;let stream=hostStreams.get(from);if(!stream){stream=new Net.HostInputs();hostStreams.set(from,stream);}stream.receive(d.commands,performance.now());return;}
if(d.t==='dz-ready'){if(d.epoch!==g.epoch)return;g.netReady=true;return;}
if(d.t==='dz-resync'){if(d.epoch!==g.epoch)return;hostStreams.delete(from);g.netReady=false;g.epoch=crypto.randomUUID();g.startSent=performance.now();emit(from,{t:'dz-start',id:session.id,protocol:2,epoch:g.epoch,world});return;}
if(d.t==='dz-input'&&d.input&&typeof d.input==='object'){const v=d.input;const previous=inputs.get(from)||{};inputs.set(from,{x:Math.max(-1,Math.min(1,Number(v.x)||0)),y:Math.max(-1,Math.min(1,Number(v.y)||0)),ax:Math.max(0,Math.min(MAPW,Number(v.ax)||0)),ay:Math.max(0,Math.min(MAPH,Number(v.ay)||0)),fire:!!v.fire,sprint:!!v.sprint,use:!!v.use,mint:!!v.mint||!!previous.mint,door:!!v.door||!!previous.door,board:!!v.board||!!previous.board,repair:!!v.repair||!!previous.repair,swap:v.swap===1||v.swap===2?v.swap:previous.swap||0});}
if(d.t==='dz-swap'&&(d.hand==='primary'||d.hand==='secondary')){const p=world.players.find(p=>p.id===from);if(p)swapWeapon(p,d.hand);}
if(d.t==='dz-equip'&&Number.isInteger(d.slot)){const p=world.players.find(p=>p.id===from);if(p)equip(p,d.slot,d.hand);}if(d.t==='dz-drop'){const p=world.players.find(p=>p.id===from);if(p)dropInventoryItem(p,d.request);}if(d.t==='dz-merge'){const p=world.players.find(p=>p.id===from);if(p)mergeWeapon(p,d.request);}if(d.t==='dz-evolve'){const p=world.players.find(p=>p.id===from);if(p)evolveWeapon(p,d.request);}if(d.t==='dz-verity'){const p=world.players.find(p=>p.id===from);if(p)verityAction(p,d.request);}
if(d.t==='dz-leave'){peers().delete(from);hostStreams.delete(from);metadataSent.delete(from);world.players=world.players.filter(p=>p.id!==from);inputs.delete(from);if(session.phase==='lobby'){group({t:'dz-lobby',id:session.id,players:world.players});lobby();}}
}else if(from===session.host){
if(d.t==='dz-lobby'&&session.phase==='lobby'&&Array.isArray(d.players)){if(lobbyJoinTimer){clearInterval(lobbyJoinTimer);lobbyJoinTimer=null;}world={...newWorld(d.players.map(p=>p.id)),players:d.players};screen('Waiting for host to start · '+d.players.map(p=>name(p.id)).join(', '));button('Leave',returnToMenu);}
if(d.t==='dz-start'){if(!d.world||!Array.isArray(d.world.players)||d.world.players.length>MAX)return;resetNetwork();inputEpoch=d.epoch||'';world=d.world;prediction.seed(world.players.find(p=>p.id===who())||world.players[0]);session.phase='play';gameOverShown=false;pauseOpen=false;menu.style.display='none';emit(session.host,{t:'dz-ready',epoch:inputEpoch,id:session.id});networkTimer=setInterval(()=>advanceGame(performance.now()),8);}
if(d.t==='dz-state'&&session.phase==='play')receiveSnapshot(d,performance.now());
if(d.t==='dz-meta'&&session.phase==='play')receiveMetadata(d);
if(d.t==='dz-end')returnToMenu();
}};
// Last Signal is simulated only by the host; its state travels with normal snapshots.
const missionSites=[{x:1680,y:1170,label:'EMERGENCY CACHE'},{x:2050,y:1370,label:'DISTRICT RADIO'},{x:1800,y:1530,label:'EVACUATION'}];
function storyTick(dt){
 if(world.mode!=='story'||world.ended)return;
 const m=world.story,site=missionSites[Math.min(2,m.stage)];
 const team=world.players.filter(p=>p.hp>0);
 if(!team.length){world.ended=true;return;}
 const nearby=team.filter(p=>Math.hypot(p.x-site.x,p.y-site.y)<70);
 if(m.stage<2){const using=nearby.some(p=>(p.id===who()?localInput:inputs.get(p.id))?.use);
 m.hold=using?m.hold+dt:Math.max(0,m.hold-dt*.5);
 if(m.hold>=(m.stage===0?2:4)){m.hold=0;m.stage++;burst(site.x,site.y,'#a8dcb4',24);for(const p of team){p.ammo+=30;p.medkits++;if(!p.inventory.includes('pistol')){p.inventory.push('pistol');p.secondary='pistol';normalizeCopies(p);p.itemLevels[p.inventory.length-1]=1;p.equippedIndices.secondary=p.inventory.length-1;}}world.notice=m.stage===1?'Supplies secured. Restore the radio east of the square.':'Signal received. Reach evacuation and hold for 45 seconds!';}
 }else{if(nearby.length)m.defense+=dt;if(m.defense>=45){world.won=true;world.ended=true;world.notice='Last Signal received. Your team escaped the quarantine.';}}
}
function clearShot(ax,ay,bx,by){const n=Math.ceil(Math.hypot(bx-ax,by-ay)/6);for(let i=1;i<n;i++)if(solid(ax+(bx-ax)*i/n,ay+(by-ay)*i/n,2))return false;return true;}
// Zombie bodies cannot overlap living survivors. Resolve against the authoritative
// positions after movement, without altering player prediction or blocking doorways.
function separateZombieFromSurvivors(z){
 if(z.hp<=0)return;
 const allies=world.players.filter(p=>p.hp>0);
 if(world.verity?.state==='active'&&world.verity.hp>0)allies.push(world.verity);
 for(const p of allies){
  const dx=z.x-p.x,dy=z.y-p.y,d=Math.hypot(dx,dy),radius=27;
  if(d>=radius)continue;
  const a=d>.01?Math.atan2(dy,dx):((z.netId||1)*2.399963229728653);
  const x=p.x+Math.cos(a)*(radius+.5),y=p.y+Math.sin(a)*(radius+.5);
  if(!solid(x,y,11)){z.x=x;z.y=y;continue;}
  // At walls or narrow house entrances, find an unblocked point on the
  // survivor's perimeter instead of pushing either actor through walls.
  let closest=null,best=Infinity;
  for(let i=0;i<16;i++){
   const angle=a+(i%2?1:-1)*Math.ceil(i/2)*Math.PI/16,px=p.x+Math.cos(angle)*(radius+1),py=p.y+Math.sin(angle)*(radius+1);
   if(solid(px,py,11))continue;
   const dist=Math.hypot(px-z.x,py-z.y);
   if(dist<best){best=dist;closest={x:px,y:py};}
  }
  if(closest){z.x=closest.x;z.y=closest.y;}
 }
}
function separateZombies(dt){const zs=world.zombies;for(let i=0;i<zs.length;i++)for(let j=i+1;j<zs.length;j++){const a=zs[i],b=zs[j];if(a.hp<=0||b.hp<=0)continue;let dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);if(d<23){if(d<.01){dx=1;dy=0;d=1;}const push=Math.min((23-d)*.5,40*dt);move(a,dx/d*push,dy/d*push,11);move(b,-dx/d*push,-dy/d*push,11);}}}
function weaponParticles(id,x,y,angle=0){
 const colors={chainsaw:['#ffe7a1','#f6a33c','#ffffff'],sunbreaker:['#ffef98','#ffac2c','#fff6c2'],reaper:['#d54f80','#7837a9','#f4aad0'],voidblade:['#ad67ff','#5de0ee','#e3baff'],railgun:['#72e6ff','#aefcff','#587eff'],hellfire:['#ff693b','#ffbf4c','#ffea89'],thunderbolt:['#80bdff','#e8f9ff','#ad8aff'],eclipse:['#ff52da','#85f7ff','#fff7b0']};
 const palette=colors[id];if(!palette||!world)return;
 const n=id==='chainsaw'?10:id==='eclipse'?21:12;
 for(let i=0;i<n;i++){
  const a=angle+(Math.random()-.5)*2.6,d=25+Math.random()*110,vx=Math.cos(a)*d,vy=Math.sin(a)*d;
  const life=.14+Math.random()*.32;
  world.effects.push({id:++world.eventSerial,x:x+Math.cos(angle)*27,y:y+Math.sin(angle)*27,vx,vy,color:palette[i%palette.length],life,max:life,size:1.3+Math.random()*3.2});
 }
 if(world.effects.length>180)world.effects.splice(0,world.effects.length-180);
}
function burst(x,y,color,count){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=30+Math.random()*130;world.effects.push({id:++world.eventSerial,x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,color,life:.25+Math.random()*.4,max:.65,size:1+Math.random()*3});}if(world.effects.length>180)world.effects.splice(0,world.effects.length-180);}
function impact(z,source,damage){
 const fatal=z.hp<=0,force=Math.min(1.7,.7+damage/65),angle=Math.atan2(z.y-source.y,z.x-source.x);
 // Directional blood spray with varied droplets rather than square confetti.
 for(let i=0,n=fatal?21:11;i<n;i++){
  const spread=(Math.random()-.5)*1.65,a=angle+spread,speed=(45+Math.random()*160)*force;
  world.effects.push({id:++world.eventSerial,x:z.x+(Math.random()-.5)*12,y:z.y+(Math.random()-.5)*12,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,color:i%4===0?'#d44742':i%3===0?'#8e1e26':'#ac2833',life:.28+Math.random()*.32,max:.6,size:1.6+Math.random()*3.8,blood:true});
 }
 if(world.effects.length>180)world.effects.splice(0,world.effects.length-180);
 world.blood.push({x:z.x,y:z.y,r:(fatal?18:7)+Math.random()*(fatal?9:4),a:Math.random()*6.28,dead:fatal,seed:Math.random()*1000});
 if(world.blood.length>160)world.blood.shift();const a=Math.atan2(z.y-source.y,z.x-source.x);z.kvx=(z.kvx||0)+Math.cos(a)*Math.min(270,90+damage*3);z.kvy=(z.kvy||0)+Math.sin(a)*Math.min(270,90+damage*3);}
function glow(x,y,r,color){if(x+r<camera.x||x-r>camera.x+W||y+r<camera.y||y-r>camera.y+H)return;ctx.save();ctx.globalCompositeOperation='screen';const g=ctx.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,color+'88');g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();}
function drawBlood(){for(const b of world.blood||[]){
 if(b.x+b.r*2<camera.x||b.x-b.r*2>camera.x+W||b.y+b.r*2<camera.y||b.y-b.r*2>camera.y+H)continue;
 ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.a||0);
 const r=b.r||8,seed=b.seed||0;
 // Layered irregular stains, with dark centers, satellite drops and subtle highlights.
 ctx.fillStyle='#361319';ctx.beginPath();
 for(let i=0;i<=12;i++){const a=i*Math.PI/6,variation=.78+.22*Math.sin(i*4.31+seed),x=Math.cos(a)*r*variation,y=Math.sin(a)*r*.61*variation;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
 ctx.closePath();ctx.fill();
 ctx.fillStyle='#711e27';ctx.beginPath();ctx.ellipse(-r*.08,-r*.06,r*.72,r*.39,-.2,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='rgba(174,49,53,.36)';ctx.beginPath();ctx.ellipse(-r*.25,-r*.18,r*.35,r*.12,-.2,0,Math.PI*2);ctx.fill();
 for(let i=0;i<8;i++){const a=i*2.399+seed,d=r*(.85+(.5+.5*Math.sin(seed+i*3.7))*.9),size=1.2+(i%4)*.8;
 ctx.fillStyle=i%3?'#642029':'#8e2930';ctx.beginPath();ctx.ellipse(Math.cos(a)*d,Math.sin(a)*d*.8,size,size*.7,a,0,Math.PI*2);ctx.fill();}
 ctx.restore();
}}
function drawEffects(){for(const e of world.effects||[]){ctx.globalAlpha=Math.max(0,e.life/e.max);ctx.fillStyle=e.color;if(e.blood){ctx.beginPath();ctx.ellipse(e.x,e.y,Math.max(1,e.size*.7),Math.max(1,e.size*.43),Math.atan2(e.vy,e.vx),0,Math.PI*2);ctx.fill();}else ctx.fillRect(e.x,e.y,e.size,e.size);}ctx.globalAlpha=1;}
function drawSurvivor(q,zombie){ctx.save();ctx.translate(q.x,q.y);if(zombie&&q.boss)ctx.scale(bossSize(q),bossSize(q));const a=zombie?Math.atan2((world.players.find(p=>p.hp>0)?.y||q.y)-q.y,(world.players.find(p=>p.hp>0)?.x||q.x)-q.x):q.face||0;ctx.rotate(a);const stride=Math.sin((world.time||0)*12+q.x*.02)*(zombie?3:Math.min(3,Math.hypot(q.vx||0,q.vy||0)/70));ctx.fillStyle='#080d10aa';ctx.beginPath();ctx.ellipse(3,7,18,12,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#111b1d';ctx.lineWidth=4;ctx.fillStyle=zombie?((ZOMBIE_TYPES[q.kind]?.color||'#3e554b')):'#3e5963';ctx.fillRect(-12,-11,23,zombie&&q.kind==='brute'?27:23);ctx.strokeRect(-12,-11,23,23);ctx.fillStyle='#1d282b';ctx.fillRect(-12,-12+stride,10,5);ctx.fillRect(-12,8-stride,10,5);ctx.fillStyle=zombie?'#88916c':'#c1a58a';ctx.fillRect(5,-16,9,zombie?5:7);ctx.fillRect(5,10,9,zombie?5:7);ctx.fillStyle=zombie?(q.hit>0?'#f3d2bc':'#9eaa80'):'#c5ad8a';ctx.beginPath();ctx.ellipse(4,0,9,8,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=zombie?'#ac4c42':'#27383a';ctx.fillRect(9,-5,3,3);ctx.fillRect(9,3,3,3);if(!zombie){ctx.fillStyle=q.color;ctx.fillRect(-10,-9,5,18);ctx.fillStyle='#354443';ctx.fillRect(-16,-7,8,14);}ctx.restore();}
function drawInterior(h){ctx.save();ctx.beginPath();ctx.rect(h.x+12,h.y+12,h.w-24,h.h-24);ctx.clip();const clinic=h.type===2;ctx.strokeStyle=clinic?'#80898355':'#272a2655';ctx.lineWidth=1;const tile=clinic?24:17;for(let x=h.x;x<h.x+h.w;x+=tile){ctx.beginPath();ctx.moveTo(x,h.y);ctx.lineTo(x,h.y+h.h);ctx.stroke();}for(let y=h.y;y<h.y+h.h;y+=clinic?24:55){ctx.beginPath();ctx.moveTo(h.x,y);ctx.lineTo(h.x+h.w,y);ctx.stroke();}ctx.fillStyle='#19282c';ctx.fillRect(h.x+22,h.y+23,70,33);ctx.fillStyle=clinic?'#b9b8a3':'#6e8277';ctx.fillRect(h.x+25,h.y+25,64,26);ctx.fillStyle='#c7bda5';ctx.fillRect(h.x+29,h.y+29,14,18);ctx.fillStyle='#654b3a';ctx.fillRect(h.x+h.w-65,h.y+30,40,65);ctx.fillStyle='#26342e';ctx.fillRect(h.x+h.w-62,h.y+33,34,57);ctx.fillStyle='#49483e';ctx.fillRect(h.x+30,h.y+h.h-58,58,28);ctx.fillStyle='#ae9c73';ctx.fillRect(h.x+34,h.y+h.h-56,50,4);ctx.fillStyle='#282e2d';ctx.fillRect(h.x+h.w/2-12,h.y+38,25,22);ctx.fillStyle='#678577';ctx.fillRect(h.x+h.w/2-9,h.y+40,19,14);ctx.fillStyle='#201f1d';ctx.fillRect(h.x+35,h.y+90,44,25);ctx.fillStyle='#8b564444';ctx.fillRect(h.x+39,h.y+94,36,17);ctx.restore();ctx.fillStyle='#e5d9b5';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText(['RESIDENCE','SAFEHOUSE','CLINIC','WORKSHOP','MARKET'][h.type],h.x+h.w/2,h.y-12);}
function drawDistrict(){
 const x0=1550,y0=1070;ctx.fillStyle='#52564f';ctx.fillRect(x0,y0,630,540);ctx.strokeStyle='#313c3b';ctx.lineWidth=1;for(let x=x0;x<x0+630;x+=32){ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x,y0+540);ctx.stroke();}for(let y=y0;y<y0+540;y+=32){ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+630,y);ctx.stroke();}
 ctx.strokeStyle='#c4b78266';ctx.strokeRect(x0+10,y0+10,610,520);ctx.fillStyle='#d6c9a677';ctx.font='bold 26px monospace';ctx.textAlign='center';ctx.fillText('QUARANTINE · SECTOR 07',1865,1110);
 // Seeded street dressing: visible props remain outside house entrances.
 for(let i=0;i<70;i++){const x=90+(i%7)*500,y=155+Math.floor(i/7)*245;if(x<camera.x-80||x>camera.x+W+80||y<camera.y-90||y>camera.y+H+90)continue;ctx.save();ctx.translate(x,y);ctx.rotate(i%2?.07:-.05);ctx.fillStyle='#111b1c';ctx.fillRect(-23,-41,51,87);ctx.fillStyle=['#4c655c','#725c4c','#596875'][i%3];ctx.fillRect(-21,-40,42,78);ctx.strokeStyle='#171e20';ctx.lineWidth=3;ctx.strokeRect(-21,-40,42,78);ctx.fillStyle='#22383e';ctx.fillRect(-16,-20,32,17);ctx.fillRect(-16,16,32,12);ctx.fillStyle='#aab8aa';ctx.fillRect(-16,-38,9,3);ctx.fillRect(7,-38,9,3);ctx.fillStyle='#522a2c';ctx.fillRect(-16,35,8,3);ctx.restore();}
 for(let i=0;i<75;i++){const x=(i*617+33)%MAPW,y=(i*367+91)%MAPH;if(x<camera.x||x>camera.x+W||y<camera.y||y>camera.y+H||houseAt(x,y))continue;ctx.fillStyle=i%4?'#7f80625a':'#bac0a080';ctx.fillRect(x,y,3+i%5,2+i%3);}
 // Cracks, tire scuffs, leaf litter and paint give the square a worn surface.
 for(let i=0;i<60;i++){const x=1560+(i*137)%610,y=1080+(i*193)%510;ctx.fillStyle=i%3?'#29352f25':'#c1b99820';ctx.fillRect(x,y,7+i%15,2+i%3);if(i%7===0){ctx.strokeStyle='#1d2a2d66';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+11,y+13);ctx.lineTo(x+6,y+21);ctx.lineTo(x+17,y+34);ctx.stroke();}}
 ctx.save();ctx.strokeStyle='#bcb68a55';ctx.lineWidth=4;ctx.setLineDash([9,6]);ctx.strokeRect(1730,1475,140,110);ctx.setLineDash([]);ctx.font='bold 50px monospace';ctx.fillStyle='#d0c79b66';ctx.textAlign='center';ctx.fillText('H',1800,1550);ctx.restore();
 for(let i=0;i<12;i++){const x=1558+(i%2)*612,y=1150+Math.floor(i/2)*78;ctx.fillStyle='#222e2e';ctx.fillRect(x-5,y-6,10,12);ctx.strokeStyle='#768777';ctx.lineWidth=2;ctx.strokeRect(x-5,y-6,10,12);glow(x,y,65,i%4?'#a5b18d':'#e3a76b');}
 for(const site of missionSites){ctx.fillStyle='#253a37';ctx.fillRect(site.x-18,site.y-17,36,34);ctx.strokeStyle='#9b9d7d';ctx.lineWidth=2;ctx.strokeRect(site.x-18,site.y-17,36,34);}
 ctx.fillStyle='#c5c5a0';ctx.fillRect(2040,1357,20,18);ctx.strokeStyle='#a8afa3';ctx.beginPath();ctx.moveTo(2050,1357);ctx.lineTo(2050,1320);ctx.lineTo(2035,1330);ctx.stroke();
}
function drawObjectives(){if(world.mode!=='story')return;const site=missionSites[Math.min(2,world.story.stage)],pulse=1+Math.sin((world.time||0)*3)*.08;ctx.save();ctx.strokeStyle='#d8c387';ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.beginPath();ctx.ellipse(site.x,site.y,65*pulse,65*pulse,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#f3dc9f';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillText(site.label,site.x,site.y-80);glow(site.x,site.y,90,'#a8bf85');ctx.restore();}
function drawAtmosphere(p){if(!world||!p)return;ctx.save();const x=p.x-camera.x,y=p.y-camera.y;const g=ctx.createRadialGradient(x,y,75,x,y,540);g.addColorStop(0,'#06101b00');g.addColorStop(.55,'#06101b25');g.addColorStop(1,'#020811ba');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.globalCompositeOperation='screen';ctx.translate(x,y);ctx.rotate(p.face||0);const beam=ctx.createRadialGradient(0,0,10,0,0,260);beam.addColorStop(0,'#e0d5a32a');beam.addColorStop(1,'#e0d5a300');ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,260,-.43,.43);ctx.closePath();ctx.fill();ctx.restore();if(p.invuln>.15){ctx.fillStyle='#cd33331c';ctx.fillRect(0,0,W,H);}}
function drawMiniMap(){if(!world||!miniCanvas)return;const mc=miniCanvas.getContext('2d');const size=260,x=0,y=0,scaleX=(size-20)/MAPW,scaleY=(size-42)/MAPH;mc.clearRect(0,0,size,size);mc.save();mc.fillStyle='#071a18ec';mc.fillRect(x,y,size,size);mc.strokeStyle='#87bba4';mc.lineWidth=2;mc.strokeRect(x+.5,y+.5,size-1,size-1);mc.fillStyle='#d5ead8';mc.textAlign='left';mc.font='bold 10px system-ui';mc.fillText('SECTOR RADAR',x+10,y+13);mc.save();mc.beginPath();mc.rect(x+9,y+20,size-18,size-29);mc.clip();const px=wx=>x+10+wx*scaleX,py=wy=>y+20+wy*scaleY;mc.strokeStyle='#52676277';mc.lineWidth=.6;for(const h of world.houses||[]){mc.strokeRect(px(h.x),py(h.y),h.w*scaleX,h.h*scaleY);}if(world.wave>=5){mc.fillStyle='#ffc86a';mc.fillRect(px(ROULETTE_X)-3,py(ROULETTE_Y)-3,6,6);}for(const b of world.barriers||[]){if(b.hp<=0)continue;mc.save();mc.translate(px(b.x),py(b.y));mc.rotate(b.angle);mc.fillStyle='#d1dad9';mc.fillRect(-3.5,-1.3,7,2.6);mc.restore();}for(const z of world.zombies||[]){if(z.hp<=0)continue;mc.fillStyle=z.boss?'#ffb13b':ZOMBIE_TYPES[z.kind]?.color||'#ff6158';mc.beginPath();mc.arc(px(z.x),py(z.y),4,0,Math.PI*2);mc.fill();}if(world.verity){const v=world.verity;mc.fillStyle=v.state==='down'?'#ff503e':'#ffe05a';mc.beginPath();mc.arc(px(v.x),py(v.y),v.state==='down'?6:4,0,Math.PI*2);mc.fill();if(v.state==='down'){mc.strokeStyle='#fff1aa';mc.lineWidth=1.5;mc.beginPath();mc.arc(px(v.x),py(v.y),9,0,Math.PI*2);mc.stroke();mc.fillStyle='#fff1aa';mc.font='bold 9px system-ui';mc.fillText('VERITY',px(v.x)+8,py(v.y)-7);}}for(const teammate of world.players||[]){mc.fillStyle=teammate.hp<=0?'#858585':teammate.id===who()?'#ffffff':'#5fbeff';mc.beginPath();mc.arc(px(teammate.x),py(teammate.y),teammate.id===who()?4:3,0,Math.PI*2);mc.fill();}mc.restore();mc.font='9px system-ui';mc.fillStyle='#d6e8dd';mc.fillText('● YOU   ● TEAM   ● INFECTED (TYPE COLOR)',x+9,y+size-5);mc.restore();}
function drawMissionHUD(p){if(!world||!p)return;ctx.save();ctx.fillStyle='#101a20e8';ctx.fillRect(18,18,340,74);ctx.fillStyle='#d4b67b';ctx.font='bold 10px monospace';ctx.textAlign='left';ctx.fillText(world.mode==='story'?'LAST SIGNAL / STORY':'SECTOR 07 / ENDLESS',30,36);ctx.font='bold 13px monospace';ctx.fillStyle='#eee5cf';const m=world.story;ctx.fillText(world.mode==='story'?['Recover the emergency cache','Restore the district radio','Hold the evacuation zone'][Math.min(2,m.stage)]:'Survive. Scavenge. Fortify.',30,56);ctx.font='11px monospace';ctx.fillStyle='#b1c5bc';if(world.mode==='story'){const site=missionSites[Math.min(2,m.stage)],d=Math.hypot(p.x-site.x,p.y-site.y);ctx.fillText((d<70?(m.stage<2?binds.interact.replace('Key','')+': Hold to interact':'Stay inside the marked zone'):Math.round(d)+'m to objective')+' · '+(m.stage<2?Math.floor(m.hold/(m.stage?4:2)*100)+'%':Math.floor(m.defense)+'/45s'),30,77);if(d>90){const a=Math.atan2(site.y-p.y,site.x-p.x);ctx.translate(W/2+Math.cos(a)*210,H/2+Math.sin(a)*150);ctx.rotate(a);ctx.fillStyle='#efce85';ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-7,-7);ctx.lineTo(-7,7);ctx.fill();}}else ctx.fillText(world.wave>=10&&world.verity?.state==='sleeping'?'GO TO THE MIDDLE · WAKE VERITY (E)':world.verity?.state==='down'?'VERITY DOWN · HOLD E TO REVIVE':'Wave '+world.wave+' · '+(world.between>0?'Resupply in '+Math.ceil(world.between)+'s':'Horde approaching'),30,77);ctx.restore();}

if(window.__DEAD_ZONE_WORKER__)window.deadZoneWorker={
 initialize(data){session={mode:'host',phase:'play',id:data.session.id,host:data.host,gameMode:data.session.gameMode,difficulty:data.session.difficulty,peers:new Map(data.peers.map(id=>[id,{}]))};world=data.world;startNetworkMatch();inputEpoch=data.hostEpoch||'';},
 getWorld:()=>world,
 input(commands,epoch){if(epoch!==inputEpoch)return;let stream=hostStreams.get(who());if(!stream){stream=new Net.HostInputs();hostStreams.set(who(),stream);}stream.receive(commands,performance.now());},
 equip(id,slot,hand){const p=world.players.find(p=>p.id===id);if(p)equip(p,slot,hand);},
 swap(id,hand){const p=world.players.find(p=>p.id===id);if(p)swapWeapon(p,hand);},
 drop(id,request){const p=world.players.find(p=>p.id===id);if(p)dropInventoryItem(p,request);},verity(id,request){const p=world.players.find(p=>p.id===id);if(p)verityAction(p,request);},verityChat(id,message){verityReplyToPlayer(id,message);},merge(id,request){const p=world.players.find(p=>p.id===id);if(p)mergeWeapon(p,request);},evolve(id,request){const p=world.players.find(p=>p.id===id);if(p)evolveWeapon(p,request);},
 setPaused(value){pauseOpen=!!value;}
};
function releaseControls(){keys.clear();mouse.down=false;localInput={};fireTap=previousFireSample=false;}
if(typeof document!=='undefined')document.addEventListener?.('visibilitychange',()=>{if(document.hidden)releaseControls();});
window.addEventListener?.('blur',releaseControls);
window.openDeadZone=open;window.closeDeadZone=close;
})();
