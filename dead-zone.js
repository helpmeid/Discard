/* Dead Zone: host-authoritative top-down co-op zombie survival. */
(()=>{
'use strict';
const DEAD_ZONE_VERSION='6.7.7';
const workerScriptURL=typeof document!=='undefined'&&document.currentScript?.src?new URL('dead-zone-host-worker.js?v=2.2.22',document.currentScript.src).href:'dead-zone-host-worker.js?v=2.2.22';
const Net=window.DeadZoneNet;if(!Net)throw Error('Dead Zone networking module did not load');
const DIFFICULTIES={easy:{speed:.9,hp:.75,damage:.65,count:.8},normal:{speed:1,hp:1,damage:1,count:1},hard:{speed:1.26,hp:1.3,damage:1.45,count:1.3},nightmare:{speed:1.6,hp:1.8,damage:2,count:1.6}};
const MAX=4,W=960,H=600,MAPW=3600,MAPH=2600,keys=new Set(),mouse={x:480,y:300,down:false};
let shopOpen=false,shopPanel=null,shopStamp='',shopPending=0,shopPendingAt=0;
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
function continueGame(){const saved=readSave();if(!saved||!session||session.mode!=='host')return;world=saved.world;ensureVenues(world);world.effects=[];world.blood=[];world.shots=[];world.players[0].vx=0;world.players[0].vy=0;session.gameMode=world.mode||saved.mode||'story';session.difficulty=world.difficulty||saved.difficulty||'normal';session.phase='play';saveClock=0;gameOverShown=false;pauseOpen=false;menu.style.display='none';startNetworkMatch();canvas.focus();}
const peers=()=>session?.peers||new Map();
const group=(p)=>{for(const id of peers().keys())emit(id,p);};
const itemDefs={concrete:{name:'Concrete Barrier',type:'material'},boards:{name:'Wooden Boards',type:'material'},bat:{name:'Rusty Spiked Bat',type:'weapon',damage:20,range:49,cool:.48},crowbar:{name:'Crowbar',type:'weapon',damage:30,range:55,cool:.4},axe:{name:'Fire Axe',type:'weapon',damage:44,range:62,cool:.56},pistol:{name:'Old Pistol',type:'weapon',damage:25,range:650,cool:.29},shotgun:{name:'Shotgun',type:'weapon',damage:48,range:480,cool:.68},jacket:{name:'Leather Jacket',type:'armor',defense:.14},vest:{name:'Kevlar Vest',type:'armor',defense:.32},heavy:{name:'Riot Armor',type:'armor',defense:.49},medkit:{name:'Medkit',type:'consumable'},mints:{name:'Care Mints',type:'consumable'},pipe:{name:'Steel Pipe',type:'weapon',damage:26,range:56,cool:.4},machete:{name:'Machete',type:'weapon',damage:40,range:68,cool:.4},sledge:{name:'Sledgehammer',type:'weapon',damage:72,range:70,cool:.95},katana:{name:'Katana',type:'weapon',damage:52,range:77,cool:.42},hammer:{name:'Hammer',type:'weapon',damage:33,range:49,cool:.42},revolver:{name:'Revolver',type:'weapon',damage:52,range:720,cool:.52},smg:{name:'SMG',type:'weapon',damage:18,range:530,cool:.12},rifle:{name:'Assault Rifle',type:'weapon',damage:33,range:760,cool:.2},sniper:{name:'Marksman Rifle',type:'weapon',damage:86,range:1100,cool:1.05},doublebarrel:{name:'Double Barrel Shotgun',type:'weapon',damage:70,range:440,cool:.96},tactical:{name:'Tactical Vest',type:'armor',defense:.40},military:{name:'Military Armor',type:'armor',defense:.55},hazmat:{name:'Hazmat Suit',type:'armor',defense:.25},scrapvest:{name:'Scrap Vest',type:'armor',defense:.20},ammoBox:{name:'Ammo Box',type:'consumable'},bandage:{name:'Bandages',type:'consumable'},energy:{name:'Energy Drink',type:'consumable'},chainsaw:{name:'Chainsaw',type:'weapon',damage:22,range:69,cool:.12},
sunbreaker:{name:'Sunbreaker Greatsword',type:'weapon',damage:210,range:85,cool:.6},
reaper:{name:'Reaper Scythe',type:'weapon',damage:165,range:91,cool:.39},
voidblade:{name:'Voidblade',type:'weapon',damage:135,range:79,cool:.23},
railgun:{name:'Railgun',type:'weapon',damage:410,range:1150,cool:1.1},
hellfire:{name:'Hellfire Shotgun',type:'weapon',damage:115,range:490,cool:.54},
thunderbolt:{name:'Thunderbolt LMG',type:'weapon',damage:78,range:800,cool:.14},eclipse:{name:'Eclipse Annihilator',type:'weapon',damage:550,range:1120,cool:.16}};

Object.assign(itemDefs,{"wrench":{"name":"Pipe Wrench","type":"weapon","damage":27,"range":57,"cool":0.52},"hatchet":{"name":"Hatchet","type":"weapon","damage":23,"range":55,"cool":0.44},"knife":{"name":"Survival Knife","type":"weapon","damage":13,"range":42,"cool":0.25},"shovel":{"name":"Trench Shovel","type":"weapon","damage":34,"range":72,"cool":0.65},"club":{"name":"Wooden Club","type":"weapon","damage":30,"range":60,"cool":0.58},"combatknife":{"name":"Combat Knife","type":"weapon","damage":28,"range":48,"cool":0.24},"spear":{"name":"Scrap Spear","type":"weapon","damage":65,"range":94,"cool":0.55},"nailbat":{"name":"Nail Bat","type":"weapon","damage":64,"range":65,"cool":0.54},"huntingrifle":{"name":"Hunting Rifle","type":"weapon","damage":97,"range":900,"cool":0.82,"muzzle":83},"sawnoff":{"name":"Sawed-Off Shotgun","type":"weapon","damage":85,"range":360,"cool":0.72,"muzzle":51},"kukri":{"name":"Kukri","type":"weapon","damage":83,"range":65,"cool":0.32},"warhammer":{"name":"War Hammer","type":"weapon","damage":203,"range":74,"cool":0.78},"carbine":{"name":"Carbine","type":"weapon","damage":60,"range":710,"cool":0.23,"muzzle":65},"crossbow":{"name":"Crossbow","type":"weapon","damage":216,"range":820,"cool":0.83,"muzzle":76},"battleaxe":{"name":"Battle Axe","type":"weapon","damage":414,"range":80,"cool":0.72},"halberd":{"name":"Halberd","type":"weapon","damage":357,"range":98,"cool":0.62},"bullpup":{"name":"Bullpup Rifle","type":"weapon","damage":98,"range":810,"cool":0.17,"muzzle":62},"autoshotgun":{"name":"Auto Shotgun","type":"weapon","damage":178,"range":460,"cool":0.31,"muzzle":66},"solstice":{"name":"Sunforge Maul","type":"weapon","damage":3936,"range":89,"cool":0.82,"effectColors":["#ffe3a0","#ff9048","#fff2c9"],"flashColor":"#ffe3a0"},"oblivion":{"name":"Oblivion Scythe","type":"weapon","damage":2064,"range":99,"cool":0.43,"effectColors":["#956cff","#341f64","#d9b4ff"],"flashColor":"#956cff"},"starfall":{"name":"Starfall Cleaver","type":"weapon","damage":1632,"range":84,"cool":0.34,"effectColors":["#9effd8","#53a5ff","#efffff"],"flashColor":"#9effd8"},"tempest":{"name":"Tempest Rail Rifle","type":"weapon","damage":3744,"range":1200,"cool":0.78,"muzzle":91,"effectColors":["#79e5ff","#d4faff","#5783f4"],"flashColor":"#79e5ff"},"hydra":{"name":"Hydra Scattergun","type":"weapon","damage":2016,"range":560,"cool":0.42,"muzzle":75,"effectColors":["#ff827a","#ffc1a0","#ffecb6"],"flashColor":"#ff827a"},"nebula":{"name":"Nebula Repeater","type":"weapon","damage":480,"range":920,"cool":0.1,"muzzle":72,"effectColors":["#bc8cff","#ff83d5","#d1faff"],"flashColor":"#bc8cff"},"sovereign":{"name":"Sovereign Spear","type":"weapon","damage":2304,"range":99,"cool":0.48,"effectColors":["#ffe182","#91ffe8","#fff9dc"],"flashColor":"#ffe182"}});
const WEAPON_TIERS=[["bat","pipe","hammer","wrench","hatchet","knife","shovel","club"],["crowbar","axe","pistol","combatknife","spear","nailbat","huntingrifle","sawnoff"],["machete","shotgun","smg","revolver","kukri","warhammer","carbine","crossbow"],["katana","rifle","sledge","doublebarrel","battleaxe","halberd","bullpup","autoshotgun"],["chainsaw","sniper","sunbreaker","reaper","voidblade","railgun","hellfire","thunderbolt"],["eclipse","solstice","oblivion","starfall","tempest","hydra","nebula","sovereign"]];
const WEAPON_TIER_NAMES=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY','MYTHIC'],WEAPON_TIER_COLORS=['#839289','#65c884','#579ef5','#b880ed','#ffbd55','#ff4df2'];
const weaponTier=id=>WEAPON_TIERS.findIndex(t=>t.includes(id));
const nextWeapons=id=>WEAPON_TIERS[weaponTier(id)+1]||[];
const ROULETTE_X=1900,ROULETTE_Y=1260,ROULETTE_ODDS=[.50,.25,.15,.05,.005];
const rouletteNearby=p=>{const h=venue('casino'),point=roulettePoint();return !!p&&!!h&&world.wave>=5&&houseAt(p.x,p.y)===h&&Math.hypot(p.x-point.x,p.y-point.y)<=95;};
// Effective DPS bands intentionally do not overlap across adjacent rarities.
// Fast weapons do less per strike; slower weapons are much heavier hitters.
const TIER_DPS=[52,118,260,575,1280,4800];
const shotgunPellets=id=>['shotgun','doublebarrel','hellfire','sawnoff','autoshotgun','hydra'].includes(id)?3:1;
function weaponSwingWeight(id){const def=itemDefs[id];return def?.range<100?Math.max(0,Math.min(1.5,(def.cool-.32)/.42)):0;}
function swingEasing(progress,weight){
 const windup=.16+weight*.12,strikeEnd=.66+weight*.04;
 if(progress<windup)return -.25*progress/windup;
 if(progress<strikeEnd)return -.25+1.5*(1-Math.pow(1-(progress-windup)/(strikeEnd-windup),3));
 return 1.25+.1*Math.sin((progress-strikeEnd)/(1-strikeEnd)*Math.PI/2);
}
function resolveMelee(p,id,damage,angle){
 const weapon=itemDefs[id];if(!weapon||p.hp<=0)return;
 for(const z of world.zombies){
  const handX=p.x+Math.cos(angle)*9-Math.sin(angle)*10,handY=p.y+Math.sin(angle)*9+Math.cos(angle)*10;
  const forward=(z.x-handX)*Math.cos(angle)+(z.y-handY)*Math.sin(angle),side=Math.abs(-(z.x-handX)*Math.sin(angle)+(z.y-handY)*Math.cos(angle));
  if(z.hp<=0||!clearShot(p.x,p.y,z.x,z.y)||forward<=-14||forward>=weapon.range+24+(z.boss?bossSize(z)*7:0)||side>=Math.min(z.boss?65:43,23+forward*.44+(z.boss?bossSize(z)*5:0)))continue;
  z.hp-=damage;impact(z,{...p,weapon:id},damage);z.hit=.12;
  if(z.hp<=0){world.score+=z.boss?500:10;p.kills++;zombieLoot(z);if(z.boss){for(let reward=0;reward<3;reward++)world.drops.push({id:++world.dropSerial,item:randomLoot(Math.max(10,world.wave)),x:z.x+(reward%2?25:-25),y:z.y+(reward>1?20:-20)});world.notice='☠ '+(BOSS_NAMES[z.kind]||'BOSS')+' DEFEATED · BONUS LOOT!';}}
 }
}
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
 if(weaponTier(r.choice)===5&&world.mythicCreated)return false;
 const chance=ROULETTE_ODDS[tier],success=Math.random()<chance,oldName=itemDefs[id].name;
 if(success){p.inventory[i]=r.choice;p.itemLevels[i]=1;if(weaponTier(r.choice)===5)world.mythicCreated=true;}
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

const player=(id,i)=>({id,credits:0,shopSerial:0,rouletteSerial:0,rouletteResult:null,x:MAPW/2+(i%2)*34-17,y:MAPH/2+Math.floor(i/2)*34-17,vx:0,vy:0,hp:100,kills:0,cool:0,invuln:0,color:['#93d1ff','#f7c576','#cda5ff','#99e3ab'][i],inventory:['bat'],itemLevels:[1],equippedIndices:{primary:0,secondary:-1},weaponLevels:{bat:1},primary:'bat',secondary:null,activeSlot:'primary',weapon:'bat',armor:null,ammo:0,face:0,swing:0,medkits:0,mints:0,boards:0,concrete:3,stamina:100,energy:0,reviveHold:0,reviveTarget:null,chestHold:0,chestTarget:null,chestComplete:false});
function makeMap(){const houses=[],chests=[];for(let y=180;y<MAPH-190;y+=430)for(let x=180;x<MAPW-190;x+=500){if(Math.hypot(x-MAPW/2,y-MAPH/2)<340)continue;const n=houses.length,type=n%5,w=[230,195,260,215,245][type],h=[185,215,175,195,225][type],px=x+(n%3)*17,py=Math.min(y+(n%2)*19-(y>MAPH-550&&x===180?85:0),MAPH-h-90);houses.push({x:px,y:py,w,h,type,doorX:px+w/2,doorY:py+h,doorOpen:false,doorHp:100,doorMaxHp:100,boards:0});chests.push({id:chests.length,x:px+45+n%3*45,y:py+68+n%2*40,opened:false});if(n%3===0)chests.push({id:chests.length,x:px+w-48,y:py+50,opened:false});}const map={houses,chests};ensureVenues(map);return map;}
function venue(kind,w=world){return w?.houses?.find(h=>h.venue===kind)||null;}
function ensureVenues(w){
 if(!w?.houses?.length)return;
 const ordered=[...w.houses].sort((a,b)=>Math.hypot(a.x+a.w/2-MAPW/2,a.y+a.h/2-MAPH/2)-Math.hypot(b.x+b.w/2-MAPW/2,b.y+b.h/2-MAPH/2));
 for(const [i,kind] of ['shop','casino'].entries()){
  const h=w.houses.find(h=>h.venue===kind)||ordered.find(h=>!h.venue);
  if(h&&!h.venue){h.venue=kind;h.doorOpen=kind==='shop'||(w.wave||0)>=5;h.doorHp=h.doorMaxHp||100;h.boards=0;if(kind==='casino'&&(w.wave||0)<5)for(const p of w.players||[])if(p.x>h.x&&p.x<h.x+h.w&&p.y>h.y&&p.y<h.doorY){p.x=h.doorX;p.y=h.doorY+42;}}
 }
 w.chests=(w.chests||[]).filter(c=>!w.houses.some(h=>h.venue&&c.x>h.x&&c.x<h.x+h.w&&c.y>h.y&&c.y<h.y+h.h));
 if(w.casinoUnlocked===undefined)w.casinoUnlocked=(w.wave||0)>=5;
}
function casinoLocked(h){return h?.venue==='casino'&&(world?.wave||0)<5;}
function doorPassable(h){return !casinoLocked(h)&&(h.doorOpen||h.doorHp<=0);}
function roulettePoint(){const h=venue('casino');return h?{x:h.x+h.w/2,y:h.y+h.h/2}:{x:ROULETTE_X,y:ROULETTE_Y};}
function shopPoint(){const h=venue('shop');return h?{x:h.x+h.w/2,y:h.y+65}:null;}
function shopNearby(p){const h=venue('shop'),point=shopPoint();return !!p&&p.hp>0&&!!point&&houseAt(p.x,p.y)===h&&Math.hypot(p.x-point.x,p.y-point.y)<110;}
function updateCasino(){
 const h=venue('casino');if(h&&world.wave>=5&&!world.casinoUnlocked){world.casinoUnlocked=true;h.doorOpen=true;h.doorHp=h.doorMaxHp||100;h.boards=0;world.notice='CASINO OPEN · The wave 5 lock has released!';}
}
const SELL_BASE=[12,30,75,180,450,1400];
function weaponSaleValue(id,level=1){const t=weaponTier(id);return t<0?0:Math.round(SELL_BASE[t]*(1+.3*(Math.max(1,Math.min(5,level))-1)));}
function shopOffers(){
 const offers=[{id:'ammoBox',price:35},{id:'medkit',price:45},{id:'mints',price:18},{id:'boards',price:20},{id:'concrete',price:70},{id:'energy',price:30}];
 for(let tier=0;tier<5;tier++){
  if((world.wave||1)<[1,1,3,5,10][tier])continue;
  const choices=WEAPON_TIERS[tier].filter(id=>(LOOT_UNLOCK[id]||1)<=Math.max(1,world.wave));
  if(choices.length){const id=choices[Math.floor(world.wave||1)%choices.length];offers.push({id,price:weaponSaleValue(id)*3});}
 }
 return offers;
}
function shopAction(p,req){
 if(!world||!p||!world.players.includes(p)||!shopNearby(p)||!req||!Number.isSafeInteger(req.serial)||req.serial!==(p.shopSerial||0)+1)return false;
 p.shopSerial=req.serial;normalizeCopies(p);p.credits=Math.max(0,Math.floor(Number(p.credits)||0));
 if(req.type==='sell'){
  const i=req.slot;if(!Number.isSafeInteger(i)||i<0||i>=p.inventory.length||itemDefs[p.inventory[i]]?.type!=='weapon'||p.inventory[i]!==req.item||levelOf(p,i)!==req.level){world.notice='Your inventory changed. Select the weapon again.';return false;}
  if(p.inventory.filter(id=>itemDefs[id]?.type==='weapon').length<=1){world.notice='Keep at least one weapon to defend yourself.';return false;}
  const id=p.inventory[i],value=weaponSaleValue(id,levelOf(p,i));p.inventory.splice(i,1);p.itemLevels.splice(i,1);
  for(const hand of ['primary','secondary']){const n=p.equippedIndices[hand];if(n===i){p.equippedIndices[hand]=-1;p[hand]=null;}else if(n>i)p.equippedIndices[hand]--;}
  if(p.equippedIndices.primary<0)p.equippedIndices.primary=p.inventory.findIndex(id=>itemDefs[id]?.type==='weapon');
  normalizeCopies(p);p.credits+=value;world.notice=name(p.id)+' sold '+itemDefs[id].name+' for '+value+' credits';return true;
 }
 if(req.type==='buy'){
  const offer=shopOffers().find(o=>o.id===req.item);if(!offer){world.notice='That item is not in the current shop stock.';return false;}
  if(p.credits<offer.price){world.notice='Not enough credits.';return false;}
  p.credits-=offer.price;grantLoot(p,offer.id);world.notice=name(p.id)+' bought '+itemDefs[offer.id].name+' for '+offer.price+' credits';return true;
 }
 world.notice='Choose a weapon to sell or an item to buy.';return false;
}
function requestShop(req){
 const p=world?.players.find(p=>p.id===who());if(!shopNearby(p)||shopPending)return;
 const request={...req,serial:(p.shopSerial||0)+1};shopPending=request.serial;shopPendingAt=performance.now();
 if(session.mode==='host'){if(hostWorker)hostWorker.postMessage({type:'shop',id:p.id,request});else shopAction(p,request);}
 else emit(session.host,{t:'dz-shop',id:session.id,request});
 shopStamp='';showShop();
}
const lootPool=['concrete','concrete','jacket','vest','heavy','medkit','medkit','mints','mints','boards','boards','tactical','military','hazmat','scrapvest','ammoBox','ammoBox','bandage','energy',...WEAPON_TIERS.slice(0,5).flat()];
const ZOMBIE_TYPES={walker:{hp:1,speed:1,color:'#4d6852'},runner:{hp:.7,speed:1.55,color:'#a56c4c'},brute:{hp:2.2,speed:.72,color:'#746b50'},crawler:{hp:.55,speed:1.25,color:'#738e61'},armored:{hp:3,speed:.68,color:'#5a6978'},stalker:{hp:1.15,speed:1.38,color:'#675977'},sprinter:{hp:.75,speed:1.95,color:'#b05a60'},toxic:{hp:1.35,speed:.9,color:'#82a54e'},berserker:{hp:2.0,speed:1.26,color:'#a34848'},juggernaut:{hp:4,speed:.55,color:'#816956'},boss:{hp:17,speed:.78,color:'#bd4c44'},colossus:{hp:35,speed:.63,color:'#7f5660'},plague:{hp:28,speed:1.02,color:'#67aa62'},dreadnought:{hp:52,speed:.48,color:'#496b83'},apocalypse:{hp:95,speed:.72,color:'#a34584'}};
const BOSS_NAMES={boss:'TITAN',colossus:'COLOSSUS',plague:'PLAGUE BEHEMOTH',dreadnought:'DREADNOUGHT',apocalypse:'APOCALYPSE'};
const bossSize=z=>z.kind==='apocalypse'?3.4:z.kind==='dreadnought'?3:z.kind==='colossus'?2.55:z.kind==='plague'?2.3:z.boss?2:1;
function chooseZombieType(wave){const choices=['walker','walker','walker','runner','crawler'];if(wave>=3)choices.push('stalker','toxic');if(wave>=5)choices.push('armored','brute','sprinter');if(wave>=7)choices.push('berserker');if(wave>=9)choices.push('juggernaut');return choices[Math.floor(Math.random()*choices.length)];}
const BELL_X=MAPW/2,BELL_Y=MAPH/2;
function makeNoise(x,y,radius=650,duration=4){if(!world)return;world.noise={x,y,radius,until:world.time+duration,serial:(world.noise?.serial||0)+1};}
function zombieSpawn(boss=false){world.zombieSerial=world.zombieSerial||0;const living=world.players.filter(p=>p.hp>0);const target=living[Math.floor(Math.random()*living.length)]||world.players[0];let x=target.x+600,y=target.y;for(let attempt=0;attempt<28;attempt++){const angle=Math.random()*Math.PI*2,dist=520+Math.random()*180;const nx=Math.max(15,Math.min(MAPW-15,target.x+Math.cos(angle)*dist)),ny=Math.max(15,Math.min(MAPH-15,target.y+Math.sin(angle)*dist));if(!solid(nx,ny,14)&&!casinoLocked(houseAt(nx,ny))){x=nx;y=ny;break;}}const bossKinds=['boss','colossus','plague','dreadnought','apocalypse'];const kind=boss?bossKinds[Math.min(bossKinds.length-1,Math.floor(world.wave/10)-1)]:chooseZombieType(world.wave),cfg=ZOMBIE_TYPES[kind];const hp=Math.round(cfg.hp*(38+world.wave*12)*(DIFFICULTIES[world.difficulty||'normal']||DIFFICULTIES.normal).hp);return{netId:++world.zombieSerial,kind,maxHp:hp,hp,x,y,speed:cfg.speed*(90+Math.min(110,world.wave*6))*(DIFFICULTIES[world.difficulty||'normal']||DIFFICULTIES.normal).speed,attack:0,wanderX:x,wanderY:y,wanderUntil:0,alertUntil:0,boss,attackPower:boss?(1.4+Math.min(1.8,world.wave/30)):1};}

const VERITY_X=MAPW/2,VERITY_Y=MAPH/2;
function makeVerity(){return{x:VERITY_X,y:VERITY_Y,hp:100,maxHp:100,state:'sleeping',weapon:null,weaponLevel:1,armor:null,ammo:0,face:0,cool:0,roll:0,rollCooldown:0,invuln:0,healCooldown:0,reviveHold:0,following:null,stuck:0,step:0,chatCooldown:0,chatTimer:7,chatMemory:{}};}
function verityInteract(p,dt){
 const v=world.verity;if(!v||p.hp<=0||Math.hypot(v.x-p.x,v.y-p.y)>72)return false;
 if(v.state==='sleeping'){v.deliveryBox={x:v.x,y:v.y,opened:true};v.state='active';v.following=p.id;world.notice='☀ VERITY AWAKENED! Press G nearby to open his inventory.';burst(v.x,v.y,'#ffe762',24);veritySay('Wow, {player} woke me up. Now I have to carry this whole circus.',p.id,true);return true;}
 if(v.hp<=0||v.state==='down'){if(v.reviver&&v.reviver!==p.id)return true;v.reviver=p.id;v.reviveHold=(v.reviveHold||0)+dt;if(v.reviveHold>=3){healActor(v,45);v.state='active';v.reviveHold=0;v.reviver=null;v.invuln=2;world.notice=name(p.id)+' revived Verity!';burst(v.x,v.y,'#ffec77',18);veritySay('Thanks, {player}. Try not to make me regret it.',p.id,true);}return true;}
 return false;
}
function verityAction(p,req){
 const v=world?.verity;if(!v||v.state!=='active'||v.hp<=0||!p||p.hp<=0||Math.hypot(v.x-p.x,v.y-p.y)>85||!req)return false;
 if(req.type==='heal'){
  if(v.hp>=100||!p.mints){world.notice=v.hp>=100?'Verity is already fully healed':'You need Care Mints to heal Verity';return false;}
  p.mints--;healActor(v,25);world.notice=name(p.id)+' healed Verity using 1 Care Mint';burst(v.x,v.y,'#86e0a1',12);return true;
 }
 if(req.type==='give'){
  normalizeCopies(p);const i=req.slot,id=p.inventory[i],def=itemDefs[id];
  if(!Number.isSafeInteger(i)||i<0||i>=p.inventory.length||!def||!['weapon','armor'].includes(def.type))return false;
  if(def.type==='weapon'&&p.inventory.filter(x=>itemDefs[x]?.type==='weapon').length<=1){world.notice='You must keep one weapon';return false;}
  const old=def.type==='weapon'?v.weapon:v.armor,oldLevel=v.weaponLevel||1,level=def.type==='weapon'?levelOf(p,i):0;
  p.inventory.splice(i,1);p.itemLevels.splice(i,1);
  for(const hand of ['primary','secondary']){const k=p.equippedIndices[hand];if(k===i)p.equippedIndices[hand]=-1;else if(k>i)p.equippedIndices[hand]=k-1;}
  if(old){p.inventory.push(old);p.itemLevels.push(def.type==='weapon'?oldLevel:0);}
  if(def.type==='weapon'){v.weapon=id;v.weaponLevel=level;if(def.range>=100)v.ammo=0;}
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
 add('p','♥ '+Math.ceil(v.hp)+'/100 HP  ·  Ammo: ∞  ·  Care Mints: '+(p.mints||0));
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
// Shared, clearance-aware navigation. Fields are reused by the horde instead of
// asking every infected to guess a direction around the same wall.
const AI_STEP=20,AI_COLS=Math.ceil(MAPW/AI_STEP),AI_ROWS=Math.ceil(MAPH/AI_STEP);
let aiLayout=null;
function aiLineClear(ax,ay,bx,by,r=14){
 const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/6));
 for(let i=0;i<=n;i++)if(solid(ax+(bx-ax)*i/n,ay+(by-ay)*i/n,r))return false;
 return true;
}
function aiGrid(){
 const signature=world.houses.map(h=>[h.x,h.y,h.w,h.h,doorPassable(h)].join(',')).join(';')+'|'+(world.barrierRevision||0);
 if(aiLayout?.world===world&&aiLayout.signature===signature)return aiLayout;
 const free=new Uint8Array(AI_COLS*AI_ROWS).fill(1),radius=14;
 const visit=(ax,ay,bx,by,blocked)=>{
  const left=Math.max(0,Math.floor((ax-radius)/AI_STEP)),right=Math.min(AI_COLS-1,Math.floor((bx+radius)/AI_STEP));
  const top=Math.max(0,Math.floor((ay-radius)/AI_STEP)),bottom=Math.min(AI_ROWS-1,Math.floor((by+radius)/AI_STEP));
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(blocked((x+.5)*AI_STEP,(y+.5)*AI_STEP))free[y*AI_COLS+x]=0;
 };
 const rectangle=(ax,ay,bx,by)=>visit(ax,ay,bx,by,(x,y)=>{
  const dx=x-Math.max(ax,Math.min(x,bx)),dy=y-Math.max(ay,Math.min(y,by));return dx*dx+dy*dy<radius*radius;
 });
 for(let y=0;y<AI_ROWS;y++)for(let x=0;x<AI_COLS;x++)if((x+.5)*AI_STEP<radius||(y+.5)*AI_STEP<radius||(x+.5)*AI_STEP>MAPW-radius||(y+.5)*AI_STEP>MAPH-radius)free[y*AI_COLS+x]=0;
 for(let i=0;i<70;i++){const x=90+(i%7)*500,y=155+Math.floor(i/7)*245;rectangle(x-24,y-43,x+29,y+47);}
 for(const h of world.houses){
  rectangle(h.x-6,h.y-6,h.x+6,h.doorY+6);rectangle(h.x+h.w-6,h.y-6,h.x+h.w+6,h.doorY+6);
  rectangle(h.x-6,h.y-6,h.x+h.w+6,h.y+6);rectangle(h.x-6,h.doorY-6,h.doorX-34,h.doorY+6);
  rectangle(h.doorX+34,h.doorY-6,h.x+h.w+6,h.doorY+6);
  if(!doorPassable(h))rectangle(h.doorX-34,h.doorY-6,h.doorX+34,h.doorY+6);
 }
 for(const b of world.barriers||[]){
  if(b.hp<=0)continue;const cs=Math.cos(b.angle),sn=Math.sin(b.angle),ex=Math.abs(cs)*42+Math.abs(sn)*14,ey=Math.abs(sn)*42+Math.abs(cs)*14;
  visit(b.x-ex,b.y-ey,b.x+ex,b.y+ey,(x,y)=>{const dx=x-b.x,dy=y-b.y,lx=dx*cs+dy*sn,ly=-dx*sn+dy*cs;return(lx-Math.max(-42,Math.min(42,lx)))**2+(ly-Math.max(-14,Math.min(14,ly)))**2<radius*radius;});
 }
 aiLayout={world,signature,free,fields:new Map()};return aiLayout;
}
function aiCellNear(layout,x,y,field=null,goal=false){
 const cx=Math.floor(x/AI_STEP),cy=Math.floor(y/AI_STEP),candidates=[];
 for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
  const xx=cx+dx,yy=cy+dy;if(xx<0||yy<0||xx>=AI_COLS||yy>=AI_ROWS)continue;
  const i=yy*AI_COLS+xx;if(!layout.free[i]||(field&&field[i]<0))continue;
  const px=(xx+.5)*AI_STEP,py=(yy+.5)*AI_STEP,d=Math.hypot(px-x,py-y);
  candidates.push({i,x:px,y:py,score:d+(field?field[i]*AI_STEP:0)});
 }
 candidates.sort((a,b)=>a.score-b.score);
 for(const n of candidates)if(aiLineClear(x,y,n.x,n.y,goal?3:14))return n.i;
 return -1;
}
function aiField(layout,gx,gy,key){
 let cached=layout.fields.get(key);
 if(cached&&Math.hypot(gx-cached.x,gy-cached.y)<35&&(world.time||0)-cached.at<.8)return cached.dist;
 const start=aiCellNear(layout,gx,gy,null,true);if(start<0)return null;
 const dist=new Int32Array(layout.free.length).fill(-1),queue=new Int32Array(dist.length);let head=0,tail=1;queue[0]=start;dist[start]=0;
 while(head<tail){
  const i=queue[head++],x=i%AI_COLS,y=Math.floor(i/AI_COLS);
  for(const n of [x>0?i-1:-1,x<AI_COLS-1?i+1:-1,y>0?i-AI_COLS:-1,y<AI_ROWS-1?i+AI_COLS:-1]){
   if(n<0||!layout.free[n]||dist[n]>=0)continue;
   dist[n]=dist[i]+1;queue[tail++]=n;
  }
 }
 if(layout.fields.size>16)layout.fields.clear();
 layout.fields.set(key,{x:gx,y:gy,at:world.time||0,dist});return dist;
}
function aiWaypoint(actor,gx,gy,key){
 const signature=world.houses.map(h=>doorPassable(h)?1:0).join('')+':'+(world.barrierRevision||0);
 const cached=actor.aiRoute;
 if(cached&&cached.key===key&&cached.signature===signature&&cached.until>(world.time||0)&&Math.hypot(cached.gx-gx,cached.gy-gy)<20&&Math.hypot(actor.x-cached.point.x,actor.y-cached.point.y)>8)return cached.point;
 const remember=point=>{actor.aiRoute={key,signature,gx,gy,point,until:(world.time||0)+.22};return point;};
 if(aiLineClear(actor.x,actor.y,gx,gy))return remember({x:gx,y:gy});
 const layout=aiGrid(),dist=aiField(layout,gx,gy,key);if(!dist)return null;
 let i=aiCellNear(layout,actor.x,actor.y,dist);if(i<0)return null;
 let point={x:(i%AI_COLS+.5)*AI_STEP,y:(Math.floor(i/AI_COLS)+.5)*AI_STEP};
 for(let hops=0;hops<16&&dist[i]>0;hops++){
  const x=i%AI_COLS,y=Math.floor(i/AI_COLS);
  const next=[x>0?i-1:-1,x<AI_COLS-1?i+1:-1,y>0?i-AI_COLS:-1,y<AI_ROWS-1?i+AI_COLS:-1].filter(n=>n>=0&&dist[n]>=0&&dist[n]<dist[i]);
  if(!next.length)break;
  next.sort((a,b)=>dist[a]-dist[b]||Math.hypot((a%AI_COLS+.5)*AI_STEP-gx,(Math.floor(a/AI_COLS)+.5)*AI_STEP-gy)-Math.hypot((b%AI_COLS+.5)*AI_STEP-gx,(Math.floor(b/AI_COLS)+.5)*AI_STEP-gy));
  const n=next[0],px=(n%AI_COLS+.5)*AI_STEP,py=(Math.floor(n/AI_COLS)+.5)*AI_STEP;
  if(!aiLineClear(actor.x,actor.y,px,py))break;i=n;point={x:px,y:py};
 }
 return remember(point);
}
function aiDoorGoal(actor,gx,gy){
 const from=houseAt(actor.x,actor.y),to=houseAt(gx,gy);
 const h=from!==to?(from||to):null;
 if(h&&!doorPassable(h))return{door:h,x:h.doorX,y:h.doorY+(from===h?-42:42)};
 return{door:null,x:gx,y:gy};
}
function aiRecover(actor,speed,dt){
 if(!solid(actor.x,actor.y,14)){actor.aiEscape=null;return false;}
 let point=actor.aiEscape;
 if(!point||solid(point.x,point.y,14)){
  point=null;
  for(let d=4;d<=100&&!point;d+=4)for(let i=0;i<32;i++){
   const a=i*Math.PI/16,x=actor.x+Math.cos(a)*d,y=actor.y+Math.sin(a)*d;
   if(!solid(x,y,14)){point={x,y};break;}
  }
  actor.aiEscape=point;
 }
 // An old save or a newly placed obstacle can leave an actor embedded.
 // Walk out by bounded simulation steps; never jump to another location.
 if(point){const dx=point.x-actor.x,dy=point.y-actor.y,d=Math.hypot(dx,dy),step=Math.min(d,speed*dt);if(d){actor.x+=dx/d*step;actor.y+=dy/d*step;}}
 return true;
}
function aiMoveToward(actor,point,speed,dt,r=14){
 if(!point)return 0;const dx=point.x-actor.x,dy=point.y-actor.y,d=Math.hypot(dx,dy);if(d<.1)return 0;
 const x=actor.x,y=actor.y,step=Math.min(d,speed*dt);move(actor,dx/d*step,dy/d*step,r);return Math.hypot(actor.x-x,actor.y-y);
}
function verityLineClear(ax,ay,bx,by){return aiLineClear(ax,ay,bx,by);}
function verityFindPath(sx,sy,gx,gy){const point=aiWaypoint({x:sx,y:sy},gx,gy,'verity');return point?[point]:[];}

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
 v.flash=Math.max(0,(v.flash||0)-dt);v.recoil=Math.max(0,(v.recoil||0)-dt*65);v.cool=Math.max(0,(v.cool||0)-dt);v.roll=Math.max(0,(v.roll||0)-dt);v.rollCooldown=Math.max(0,(v.rollCooldown||0)-dt);v.invuln=Math.max(0,(v.invuln||0)-dt);v.healCooldown=Math.max(0,(v.healCooldown||0)-dt);
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
  if(v.cool<=0&&distance<Math.min(def.range+15,760)&&clearShot(v.x,v.y,target.x,target.y)){
   v.cool=def.cool*1.08;weaponParticles(v.weapon,v.x,v.y,ang);
   if(def.range>=100){v.flash=v.weapon==='crossbow'?0:.14;v.flashAngle=ang;v.recoil=shotgunPellets(v.weapon)>1?12:6;for(const spread of shotgunPellets(v.weapon)>1?[-.2,0,.2]:[0])world.shots.push({x:v.x+Math.cos(ang)*16,y:v.y+Math.sin(ang)*16,vx:Math.cos(ang+spread)*730,vy:Math.sin(ang+spread)*730,life:def.range/730,damage:Math.round(weaponDamage(v.weapon,v.weaponLevel||1)*.85),owner:'verity',kind:v.weapon,trail:[]});if(v.weapon!=='crossbow')burst(v.x,v.y,'#ffe29b',4);}
   else if(distance<def.range+20){const dmg=Math.round(weaponDamage(v.weapon,v.weaponLevel||1)*.87);target.hp-=dmg;impact(target,v,dmg);target.hit=.12;if(target.hp<=0){world.score+=target.boss?500:10;zombieLoot(target);}}
  }
 }else if(target){v.face=Math.atan2(target.y-v.y,target.x-v.x);}
 const closeThreat=nearZ.find(z=>Math.hypot(z.x-v.x,z.y-v.y)<72);
 if(closeThreat&&v.rollCooldown<=0){v.roll=.36;v.rollCooldown=2.4;v.invuln=.4;const ang=Math.atan2(v.y-closeThreat.y,v.x-closeThreat.x)+((Math.floor(world.time*5)%2)?.5:-.5);v.dodgeX=Math.cos(ang);v.dodgeY=Math.sin(ang);burst(v.x,v.y,'#f5dc63',7);}
 if(aiRecover(v,190,dt))return;
 // Follow a reachable spot near the leader instead of chasing a point in a wall.
 if(solid(tx,ty,14)){tx=leader.x;ty=leader.y;}
 const goal=aiDoorGoal(v,tx,ty);
 if(goal.door&&!casinoLocked(goal.door)&&Math.hypot(v.x-goal.door.doorX,v.y-goal.door.doorY)<70){goal.door.doorOpen=true;v.routeClock=0;}
 const point=aiWaypoint(v,goal.x,goal.y,'verity');
 const oldX=v.x,oldY=v.y,speed=v.roll>0?355:190;
 if(v.roll>0)move(v,(v.dodgeX||0)*speed*dt,(v.dodgeY||0)*speed*dt,14);
 else if(point&&Math.hypot(tx-v.x,ty-v.y)>18)aiMoveToward(v,point,speed,dt);
 const traveled=Math.hypot(v.x-oldX,v.y-oldY);
 v.stuck=point&&traveled<speed*dt*.15?(v.stuck||0)+dt:0;
 if(v.stuck>.5){aiLayout?.fields.delete('verity');v.stuck=0;}
 v.step=(v.step||0)+dt*speed/23;
 // Automatic bandage-style recovery is deliberately slow; player healing still matters.
 // Verity heals only through player-supplied Care Mints.
}
function weaponMuzzle(p,id,angle){
 const length=itemDefs[id]?.muzzle||{pistol:36,revolver:44,shotgun:70,doublebarrel:68,rifle:72,smg:45,sniper:90,railgun:77,hellfire:70,thunderbolt:79,eclipse:77}[id]||60;
 const reach=9+length*.58-Math.min(13,p.recoil||0);
 return{x:p.x+Math.cos(angle)*reach-Math.sin(angle)*10,y:p.y+Math.sin(angle)*reach+Math.cos(angle)*10};
}
function drawMuzzleFlash(q){if(q.flash>0){const a=q.flashAngle??q.face,m=weaponMuzzle(q,q.weapon,a),x=m.x,y=m.y;const alpha=Math.min(1,q.flash/.14);ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha=alpha;const flashColor={railgun:'#8ff5ff',hellfire:'#ff8b38',thunderbolt:'#a9d8ff',eclipse:'#ff92ee'}[q.weapon]||itemDefs[q.weapon]?.flashColor||'#fff3bc';const wide=shotgunPellets(q.weapon)>1;ctx.scale(wide?1.15:q.weapon==='pistol'?.65:1,wide?1.55:1);ctx.fillStyle=flashColor;ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(17,-4);ctx.lineTo(40,0);ctx.lineTo(17,4);ctx.lineTo(0,8);ctx.closePath();ctx.fill();ctx.fillStyle=flashColor==='#fff3bc'?'#f5a447':flashColor;ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(13,-5);ctx.lineTo(25,0);ctx.lineTo(13,5);ctx.lineTo(0,13);ctx.closePath();ctx.fill();ctx.restore();glow(x,y,wide?105:78,flashColor==='#fff3bc'?'#ffd173':flashColor);}}
function drawExtraWeaponModel(id,rect,line,poly,circle){
 const steel='#a9bbb5',dark='#283b3b',wood='#8c603d',gold='#ffd46c';
 switch(id){
 case 'wrench':
  line([[0,0],[43,0]],'#966b4c',7);poly([[35,-4],[41,-17],[55,-17],[57,-10],[47,-10],[46,-3],[54,0],[58,-7],[62,-4],[56,11],[42,9]],'#a9a599');rect(8,-5,18,10,'#b37748');break;
 case 'hatchet':
  line([[0,0],[35,0]],wood,5);poly([[28,-5],[39,-14],[48,-12],[46,12],[34,9]],steel);line([[46,-10],[44,10]],'#e2e9d4',2);break;
 case 'knife':
  rect(0,-3,17,6,dark);poly([[17,-4],[35,-4],[48,0],[32,4],[17,3]],steel);line([[19,2],[36,2],[46,0]],'#eef1dd',1.5);circle(5,0,1,'#d8c59a');break;
 case 'shovel':
  line([[0,0],[43,0]],wood,5);line([[-4,-8],[-12,-7],[-12,7],[-4,8],[-4,-8]],steel,3);poly([[40,-10],[58,-16],[70,0],[58,16],[40,10]],'#738e84');line([[44,0],[63,0]],'#b7c8b7',2);break;
 case 'club':
  line([[-3,0],[17,0]],wood,7);poly([[14,-5],[27,-11],[51,-14],[61,-8],[63,6],[53,13],[29,10],[14,5]],'#7e593c');line([[24,-5],[47,-8]],'#b78b55',2);break;
 case 'combatknife':
  rect(-2,-4,20,8,'#294c46');for(let x=1;x<17;x+=4)line([[x,-3],[x,3]],'#647f71',1);
  line([[17,-8],[17,8]],steel,2);poly([[20,-5],[40,-6],[53,-1],[39,4],[20,5]],'#c6d7cc');for(let x=22;x<36;x+=5)poly([[x,-5],[x+2,-8],[x+4,-5]],dark);break;
 case 'spear':
  line([[-5,0],[62,0]],wood,5);line([[48,-4],[57,4]],'#d1b88b',4);poly([[58,-5],[82,0],[58,5],[63,0]],steel);break;
 case 'nailbat':
  line([[0,0],[18,0]],wood,6);poly([[17,-6],[53,-9],[60,-4],[60,4],[53,9],[17,6]],'#614d40');for(let x=27;x<56;x+=10){line([[x,-5],[x-3,-15]],steel,2);line([[x+2,5],[x+7,15]],steel,2);}break;
 case 'huntingrifle':
  poly([[-14,-7],[14,-4],[12,7],[-17,13]],wood);rect(11,-4,44,8,wood);rect(43,-2,40,4,steel);rect(27,-9,13,4,dark);line([[12,4],[21,14]],dark,4);break;
 case 'sawnoff':
  poly([[-4,-5],[14,-4],[18,5],[5,16],[-4,12]],wood);rect(9,-7,18,14,'#685b4c');rect(25,-7,26,5,steel);rect(25,3,26,5,steel);rect(47,-8,5,17,dark);break;
 case 'kukri':
  rect(0,-4,17,8,'#624b34');poly([[17,-4],[35,-2],[54,-11],[64,-8],[59,3],[41,17],[28,12],[18,4]],steel);line([[20,4],[30,11],[40,15],[58,2]],'#eef1d7',2);break;
 case 'warhammer':
  line([[0,0],[50,0]],'#5c4c47',7);rect(43,-16,20,32,'#778c91');poly([[43,-16],[26,-13],[22,-9],[43,-6]],steel);rect(60,-18,8,36,'#cbd2bf');break;
 case 'carbine':
  poly([[-12,-7],[5,-4],[5,5],[-12,9]],'#5d624c');rect(6,-6,31,12,'#6b795b');rect(35,-3,30,6,steel);rect(12,5,7,15,dark);rect(24,6,8,17,'#435343');rect(17,-12,10,5,dark);break;
 case 'crossbow':
  rect(-8,-4,59,8,wood);line([[51,0],[64,-23],[58,-33]],steel,4);line([[51,0],[64,23],[58,33]],steel,4);line([[58,-33],[23,0],[58,33]],'#ddd5b5',1.5);line([[20,0],[76,0]],'#d4dbcc',2);poly([[70,-3],[78,0],[70,3]],steel);rect(7,4,8,15,dark);break;
 case 'battleaxe':
  line([[-4,0],[57,0]],wood,7);poly([[43,-3],[35,-20],[47,-28],[66,-19],[60,-3]],steel);poly([[43,3],[35,20],[47,28],[66,19],[60,3]],steel);rect(48,-5,8,10,'#d7b66e');break;
 case 'halberd':
  line([[-8,0],[76,0]],wood,5);poly([[66,-4],[90,0],[66,4]],steel);poly([[61,-3],[44,-23],[62,-20],[74,-9]],steel);poly([[62,3],[50,15],[69,11]],'#8daba5');line([[57,-5],[57,5]],'#c0a06b',4);break;
 case 'bullpup':
  poly([[-13,-8],[28,-8],[43,-4],[43,7],[-13,10]],'#8b956b');rect(37,-3,25,6,steel);rect(15,6,7,17,dark);rect(-6,9,10,19,dark);rect(0,-14,26,5,dark);rect(5,-18,10,6,'#5e7979');break;
 case 'autoshotgun':
  rect(-12,-8,17,18,dark);rect(4,-8,35,16,'#675b53');rect(31,-4,35,8,steel);circle(22,16,12,dark);circle(22,16,7,'#9a8d6c');rect(7,6,7,16,dark);rect(31,-10,19,3,'#b3b6a0');break;
 case 'solstice':
  line([[-3,0],[50,0]],'#91683f',8);rect(39,-23,28,46,'#ba7c35');rect(34,-26,8,52,gold);rect(64,-26,8,52,gold);circle(53,0,11,'#fff2ba');line([[40,-16],[64,-16]],'#ffed9b',3);break;
 case 'oblivion':
  line([[-8,0],[70,0]],'#3f3455',6);poly([[58,0],[69,-25],[58,-40],[36,-45],[12,-36],[39,-39],[51,-26],[48,-10]],'#9667c9');poly([[56,-30],[46,-37],[22,-38],[37,-45],[58,-40],[69,-25]],'#c2a4f8');circle(59,-6,5,'#7bf5e5');break;
 case 'starfall':
  rect(-4,-5,22,10,'#304f62');poly([[18,-9],[54,-18],[77,-10],[75,13],[59,19],[18,10]],'#80cbbf');poly([[22,-7],[52,-14],[65,-10],[38,-4]],'#d6ffec');line([[22,7],[59,16],[72,10]],'#dcfff2',3);poly([[47,-6],[50,-1],[56,0],[50,3],[47,9],[44,3],[38,0],[44,-1]],'#e8f9ff');break;
 case 'tempest':
  poly([[-13,-9],[21,-14],[45,-8],[45,9],[-9,13]],'#285476');rect(40,-13,51,5,'#a3d9e7');rect(40,9,51,5,'#a3d9e7');rect(44,-3,47,6,'#81f7ff');for(let x=24;x<72;x+=12){line([[x,-17],[x+8,-10],[x+8,10],[x,17]],'#77b8ff',4);}rect(7,10,9,17,dark);break;
 case 'hydra':
  poly([[-12,-11],[8,-6],[8,8],[-12,16]],'#773b4b');rect(8,-13,35,27,'#9b4c66');for(const y of [-12,-2,8]){rect(39,y,36,6,'#d7c4b2');rect(68,y,7,6,'#553d4b');}poly([[17,-15],[26,-25],[36,-15]],'#ffd090');circle(23,0,7,'#ffc89c');rect(11,12,9,15,dark);break;
 case 'nebula':
  poly([[-11,-10],[22,-16],[47,-7],[47,9],[4,15]],'#5d397a');circle(25,0,12,'#b38be8');circle(25,0,6,'#f7bbf8');rect(43,-5,29,10,'#9eb5d6');rect(54,-9,8,18,'#d9a4f2');rect(6,12,9,16,dark);line([[8,-9],[14,-22],[27,-20]],'#81e5f2',3);break;
 case 'sovereign':
  line([[-8,0],[71,0]],'#4c7072',6);line([[12,-5],[19,5]],gold,4);poly([[65,-8],[95,0],[65,8],[75,0]],'#fff2b4');poly([[61,-5],[50,-20],[69,-13],[77,-5]],gold);poly([[61,5],[50,20],[69,13],[77,5]],gold);circle(66,0,5,'#88f9e5');break;
 default:return false;
 }
 return true;
}
function drawWeaponModel(id){
 const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
 const line=(points,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
 const poly=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
 const circle=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();};
 ctx.lineCap='round';ctx.lineJoin='round';
 if(drawExtraWeaponModel(id,rect,line,poly,circle))return;
 if((itemDefs[id]?.range||0)>100){
  const metal='#8fa7a8',dark='#283538',wood='#9c6741';
  if(id==='pistol'){rect(3,-7,30,13,dark);rect(6,-8,25,4,metal);poly([[5,4],[16,4],[13,22],[2,19]],wood);rect(29,-3,7,5,'#101e22');}
  else if(id==='revolver'){line([[1,2],[37,2]],metal,9);circle(16,1,8,'#c1c9bd');circle(16,1,3,dark);poly([[6,5],[16,7],[12,24],[0,20]],wood);rect(32,-3,12,5,metal);}
  else if(id==='shotgun'){poly([[-9,-8],[10,-5],[8,8],[-12,13]],wood);rect(8,-5,35,11,dark);rect(29,-1,23,10,wood);for(let x=32;x<51;x+=5)rect(x,1,2,6,'#573d2e');rect(43,-5,27,5,metal);rect(66,-7,4,8,dark);}
  else if(id==='doublebarrel'){poly([[-8,-9],[13,-5],[9,7],[-12,14]],wood);rect(10,-7,29,14,wood);rect(29,-8,37,6,metal);rect(29,3,37,6,metal);rect(61,-8,6,17,dark);rect(63,-6,5,3,'#0d1519');rect(63,5,5,3,'#0d1519');}
  else if(id==='rifle'){poly([[-13,-9],[7,-5],[7,6],[-13,12]],dark);rect(6,-7,37,14,'#52675a');rect(37,-5,17,10,dark);rect(51,-2,20,4,metal);poly([[20,6],[31,6],[34,23],[25,29],[20,21]],'#394c40');rect(9,6,8,15,wood);rect(20,-13,12,5,dark);rect(25,-15,3,5,metal);rect(65,-4,7,8,dark);}
  else if(id==='smg'){rect(-5,-6,38,14,dark);rect(29,-3,16,6,metal);rect(11,7,7,24,'#9aa79d');rect(-2,7,8,14,dark);line([[-5,-4],[-16,-6],[-16,10],[-5,5]],metal,3);}
  else if(id==='sniper'){poly([[-15,-8],[12,-5],[8,8],[-16,13]],wood);rect(9,-5,46,10,'#486058');rect(48,-2,38,4,metal);rect(82,-4,8,8,dark);rect(18,-16,28,7,dark);circle(20,-12,5,metal);circle(45,-12,6,dark);line([[55,5],[48,21]],metal,2);line([[56,5],[65,21]],metal,2);}
  else if(id==='railgun'){poly([[-9,-12],[35,-12],[47,-6],[47,9],[0,12]],'#264e67');rect(34,-12,43,5,metal);rect(34,8,43,5,metal);rect(38,-4,37,5,'#73f4ff');for(let x=20;x<58;x+=9){rect(x,-15,5,30,'#4ba9c7');rect(x,-11,3,22,'#b1ffff');}rect(7,10,10,17,dark);}
  else if(id==='hellfire'){poly([[-11,-11],[14,-7],[10,8],[-12,15]],'#6e382b');rect(9,-11,48,23,'#78392b');rect(46,-12,24,8,'#dc9d59');rect(46,5,24,8,'#dc9d59');for(let x=18;x<45;x+=9)poly([[x,-10],[x+5,-21],[x+8,-10]],'#f28738');rect(16,-3,29,6,'#ffbe55');}
  else if(id==='thunderbolt'){rect(-12,-9,16,20,'#435a73');rect(3,-11,42,22,'#526f92');circle(23,14,13,dark);circle(23,14,8,'#8cb7e9');rect(40,-4,39,8,metal);rect(65,-9,13,18,dark);line([[7,-5],[17,-8],[14,0],[29,-4],[23,6],[35,3]],'#d6f8ff',3);}
  else if(id==='eclipse'){poly([[-12,-13],[31,-19],[57,-11],[67,0],[57,13],[6,17]],'#6a2889');rect(12,-4,50,8,'#ff77ed');poly([[43,-16],[77,-17],[68,-8],[48,-6]],'#8af6f3');poly([[43,16],[77,17],[68,8],[48,6]],'#8af6f3');circle(20,0,9,'#fff0ad');circle(20,0,5,'#ff52da');rect(4,14,12,16,dark);}
 }else if(id==='chainsaw'){rect(1,-13,35,26,'#e58b35');rect(36,-7,36,14,'#bacbc2');for(let x=38;x<73;x+=6){rect(x,-10,3,5,'#e9efdc');rect(x,5,3,5,'#e9efdc');}line([[9,-14],[27,-18],[30,15]],'#23352f',4);}
 else if(id==='reaper'){line([[0,0],[68,0]],'#73516e',6);poly([[55,0],[65,-26],[54,-44],[31,-49],[13,-41],[35,-41],[48,-31],[48,-10]],'#de71ad');line([[20,-43],[39,-44],[55,-30]],'#ffd2eb',2);}
 else if(id==='sunbreaker'){rect(0,-4,20,8,'#715135');rect(17,-16,6,32,'#e3a337');poly([[23,-10],[62,-13],[84,0],[62,13],[23,10]],'#ffd56a');line([[26,0],[71,0]],'#fff5bd',3);}
 else if(id==='voidblade'){rect(0,-4,19,8,'#47334f');poly([[17,-12],[24,-5],[19,11],[14,6]],'#66eced');poly([[23,-6],[48,-14],[70,-4],[54,0],[63,7],[22,5]],'#ae7bea');line([[27,0],[53,-5]],'#c0ffff',2);}
 else if(id==='axe'){line([[0,0],[48,0]],'#9a714d',6);poly([[37,-6],[51,-21],[63,-13],[61,18],[46,12]],'#c5d2c8');}
 else if(id==='sledge'){line([[0,0],[48,0]],'#92714f',7);rect(40,-19,25,38,'#839793');rect(40,-19,25,5,'#ccdad0');}
 else if(id==='hammer'){line([[0,0],[35,0]],'#ae7951',6);rect(30,-12,14,25,'#b7c9be');poly([[32,-12],[24,-19],[39,-18],[44,-10]],'#94aaa4');}
 else if(id==='katana'){line([[0,0],[20,0]],'#333f41',7);for(let x=1;x<17;x+=5)line([[x,-3],[x+3,3]],'#bfa68a',1.8);line([[18,-10],[18,10]],'#d5b276',3);ctx.strokeStyle='#dce9df';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(21,0);ctx.quadraticCurveTo(54,0,78,-12);ctx.stroke();}
 else if(id==='machete'){
 poly([[-3,-4],[15,-5],[20,-2],[17,5],[3,6],[-4,2]],'#3d3930');
 line([[-2,1],[3,5],[14,4]],'#73513a',2);circle(3,0,1.5,'#d7ba80');circle(12,0,1.5,'#d7ba80');
 poly([[18,-4],[65,-5],[74,-2],[68,7],[59,12],[44,10],[18,5]],'#a8b7a7');
 poly([[19,-4],[65,-5],[71,-2],[27,-1]],'#697e74');
 line([[19,4],[44,9],[59,11],[67,6],[72,-1]],'#f2efdb',2);
 line([[29,-1],[53,-2]],'#cad2bd',1);
 }
 else if(id==='crowbar'){line([[0,0],[42,0],[52,-5],[55,-14],[49,-21],[41,-19]],'#b25d48',6);line([[0,0],[-6,8],[-5,14]],'#b25d48',5);line([[41,-19],[38,-16]],'#d7b4a0',2);}
 else if(id==='pipe'){line([[0,0],[46,0]],'#91a6a0',8);rect(41,-7,12,14,'#bccbc4');for(let x=42;x<53;x+=3)line([[x,-6],[x,6]],'#687f7a',1);rect(50,-4,5,8,'#233d38');line([[6,-3],[34,-3]],'#c0d2c7',1.5);}
 else {line([[0,0],[17,0]],'#765539',6);poly([[15,-4],[27,-7],[51,-9],[57,-5],[57,5],[51,9],[27,7],[15,4]],'#ad794b');line([[-2,-5],[-2,5]],'#60432f',4);for(const x of [25,36,46])line([[x,-12],[x+3,12]],'#c3c8b9',2);line([[20,-2],[50,-4]],'#d39d61',1.5);}
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
 ctx.save();const bodyTurn=v.state==='down'?0:v.roll>0?v.step*1.8:Math.sin(v.step||0)*.11;
 ctx.rotate(-bodyTurn+(v.face||0));ctx.translate(17,5);ctx.translate(-Math.min(13,v.recoil||0),0);ctx.scale(.58,.58);drawWeaponModel(v.weapon);ctx.restore();
}
function drawVenueHouse(h){
 const shop=h.venue==='shop',locked=casinoLocked(h),accent=shop?'#8fd6a4':'#d79bf2';
 ctx.save();ctx.fillStyle='#081210aa';ctx.fillRect(h.x+8,h.y+11,h.w,h.h);
 ctx.fillStyle=shop?'#465e4e':'#3f294b';ctx.fillRect(h.x,h.y,h.w,h.h);
 ctx.fillStyle=shop?'#34443b':'#412c45';ctx.fillRect(h.x+11,h.y+11,h.w-22,h.h-22);
 if(shop){
  for(let shelf=0;shelf<3;shelf++){const x=h.x+20+shelf*55;ctx.fillStyle='#69513d';ctx.fillRect(x,h.y+18,45,20);ctx.fillStyle='#9ab39c';for(let j=0;j<4;j++)ctx.fillRect(x+4+j*9,h.y+22,6,10);}
  ctx.fillStyle='#876848';ctx.fillRect(h.x+25,h.y+46,h.w-50,25);ctx.fillStyle='#be9a61';ctx.fillRect(h.x+25,h.y+46,h.w-50,5);
  ctx.fillStyle='#2c3b36';ctx.fillRect(h.x+h.w-63,h.y+42,21,14);ctx.fillStyle='#92d9ac';ctx.fillRect(h.x+h.w-60,h.y+44,15,8);
  ctx.fillStyle=accent;ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText('BUY / SELL',h.x+h.w/2,h.y+92);
 }else{
  ctx.fillStyle='#b087a122';for(let x=h.x+20;x<h.x+h.w-12;x+=26)for(let y=h.y+20;y<h.y+h.h-15;y+=26){ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);ctx.closePath();ctx.fill();}
  for(const x of [h.x+22,h.x+h.w-38]){ctx.fillStyle='#b78754';ctx.fillRect(x,h.y+24,17,35);ctx.fillStyle='#392b43';ctx.fillRect(x+3,h.y+28,11,18);ctx.fillStyle='#edbe81';ctx.fillRect(x+5,h.y+31,3,12);ctx.fillRect(x+10,h.y+31,2,12);}
 }
 ctx.strokeStyle=shop?'#bcc8ad':'#b6a4c5';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(h.x,h.doorY);ctx.lineTo(h.x,h.y);ctx.lineTo(h.x+h.w,h.y);ctx.lineTo(h.x+h.w,h.doorY);ctx.lineTo(h.doorX+34,h.doorY);ctx.moveTo(h.doorX-34,h.doorY);ctx.lineTo(h.x,h.doorY);ctx.stroke();
 ctx.fillStyle=locked?'#6d334c':'#8f7451';if(doorPassable(h))ctx.fillRect(h.doorX-37,h.doorY-28,8,35);else ctx.fillRect(h.doorX-33,h.doorY-8,66,16);
 if(locked){ctx.fillStyle='#f0c76a';ctx.fillRect(h.doorX-7,h.doorY-8,14,13);ctx.strokeStyle='#f0c76a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(h.doorX,h.doorY-9,5,Math.PI,Math.PI*2);ctx.stroke();}
 ctx.textAlign='center';ctx.font='bold 13px monospace';ctx.fillStyle=accent;ctx.fillText(shop?'SECTOR SUPPLY / WEAPON SHOP':locked?'CASINO / LOCKED UNTIL WAVE 5':'CASINO / RARITY ROULETTE',h.x+h.w/2,h.y-15);
 if(locked){ctx.font='bold 10px monospace';ctx.fillText('OPENS AT WAVE 5',h.doorX,h.doorY+31);}
 glow(h.x+h.w/2,h.y-8,60,shop?'#76c894':'#b771d4');ctx.restore();
}
function drawDeliveryBox(box,opened){
 const x=box.x,y=box.y;ctx.save();ctx.translate(x,y);
 ctx.fillStyle='#08120f90';ctx.beginPath();ctx.ellipse(4,17,35,13,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#9b6b3e';ctx.fillRect(-29,-15,58,37);ctx.fillStyle='#c29359';ctx.fillRect(-29,-15,58,12);
 ctx.strokeStyle='#68492f';ctx.lineWidth=2;ctx.strokeRect(-29,-15,58,37);
 if(opened){
  ctx.fillStyle='#493726';ctx.fillRect(-24,-12,48,20);
  ctx.fillStyle='#bd8d55';for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*24,-12);ctx.lineTo(side*43,-27);ctx.lineTo(side*46,0);ctx.lineTo(side*25,8);ctx.closePath();ctx.fill();ctx.stroke();}
 }else{
  ctx.fillStyle='#dfc08a';ctx.fillRect(-4,-15,8,37);ctx.fillRect(-29,-2,58,6);
  ctx.strokeStyle='#ac8a55';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(0,22);ctx.stroke();
 }
 ctx.fillStyle='#e4d9b5';ctx.fillRect(-22,7,18,10);ctx.fillStyle='#494a3e';ctx.font='bold 5px monospace';ctx.textAlign='left';ctx.fillText('VERITY',-20,13);ctx.fillStyle='#d7c6a1';ctx.fillRect(17,7,7,8);
 if(!opened){
  const time=world?.time||0;for(let i=0;i<3;i++){const phase=(time*.55+i*.32)%1;ctx.globalAlpha=1-phase;ctx.fillStyle='#fff0ac';ctx.font='bold '+(12+i*3)+'px monospace';ctx.fillText('Z',12+i*10+Math.sin(time*2+i)*4,-24-phase*40);}
  ctx.globalAlpha=1;ctx.textAlign='center';ctx.font='bold 10px monospace';ctx.fillStyle='#f8deb0';ctx.fillText('SPECIAL DELIVERY / VERITY',0,38);
 }
 ctx.restore();
}
function drawVerity(v){
 if(v.state==='sleeping'){drawDeliveryBox(v,false);return;}if(v.deliveryBox)drawDeliveryBox(v.deliveryBox,true);
 ctx.save();ctx.translate(v.x,v.y);
 ctx.fillStyle='#06110e80';ctx.beginPath();ctx.ellipse(3,13,22,9,0,0,Math.PI*2);ctx.fill();
 ctx.rotate(v.state==='sleeping'?-0.25:v.roll>0?v.step*1.8:Math.sin(v.step||0)*.11);
 ctx.fillStyle=v.state==='down'?'#b28c2a':'#ffdf00';ctx.strokeStyle='#e9ba00';ctx.lineWidth=2;
 ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.fillStyle='#111';if(v.state==='sleeping'){ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(-10,-4);ctx.lineTo(-4,-4);ctx.moveTo(4,-4);ctx.lineTo(10,-4);ctx.stroke();}else{ctx.beginPath();ctx.ellipse(-7,-5,2.2,3.5,0,0,7);ctx.ellipse(7,-5,2.2,3.5,0,0,7);ctx.fill();}
 ctx.strokeStyle='#111';ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(0,-1,12,.18,Math.PI-.18);ctx.stroke();drawVerityEquipment(v);ctx.restore();drawMuzzleFlash(v);
 ctx.textAlign='center';ctx.font='bold 11px system-ui';ctx.fillStyle='#ffef97';ctx.fillText('VERITY'+(v.state==='sleeping'?' · Zzz':v.state==='down'?' · DOWN':''),v.x,v.y-33);
 if(v.state!=='sleeping'){ctx.fillStyle='#1a211d';ctx.fillRect(v.x-25,v.y-28,50,5);ctx.fillStyle='#8be28b';ctx.fillRect(v.x-25,v.y-28,50*Math.max(0,v.hp)/100,5);}
}

function newWorld(ids){const m=makeMap();return{noise:null,bellLast:-100,mode:session?.gameMode||'endless',story:{stage:0,hold:0,defense:0},effects:[],blood:[],eventSerial:0,time:0,won:false,wave:0,difficulty:session?.difficulty||'normal',score:0,players:ids.map((id,i)=>player(id,i)),zombies:[],zombieSerial:0,shots:[],spawned:0,remaining:0,between:2,ended:false,houses:m.houses,chests:m.chests,barriers:[],barrierSerial:0,barrierRevision:0,drops:[],dropSerial:0,mythicCreated:false,verity:null,verityChat:[],verityChatSerial:0,notice:''};}
function houseAt(x,y){return(world?.houses||[]).find(h=>x>h.x+10&&x<h.x+h.w-10&&y>h.y+10&&y<h.y+h.h-10);}
function nearDoor(p){let best=null,d=85;for(const h of world?.houses||[]){let dist=Math.hypot(p.x-h.doorX,p.y-h.doorY);if(dist<d){best=h;d=dist;}}return best;}
function carCollision(x,y,r=12){for(let i=0;i<70;i++){const cx=90+(i%7)*500,cy=155+Math.floor(i/7)*245;const nearX=Math.max(cx-24,Math.min(x,cx+29)),nearY=Math.max(cy-43,Math.min(y,cy+47));if((x-nearX)**2+(y-nearY)**2<r*r)return true;}return false;}
function solid(x,y,r=12){if(barrierCollision(x,y,r))return true;if(x<r||y<r||x>MAPW-r||y>MAPH-r||carCollision(x,y,r))return true;for(const h of world?.houses||[]){const t=6,half=34;const overlaps=(ax,ay,bx,by)=>{const closestX=Math.max(ax,Math.min(x,bx)),closestY=Math.max(ay,Math.min(y,by));return (x-closestX)**2+(y-closestY)**2<r*r;};if(overlaps(h.x-t,h.y-t,h.x+t,h.y+h.h+t)||overlaps(h.x+h.w-t,h.y-t,h.x+h.w+t,h.y+h.h+t)||overlaps(h.x-t,h.y-t,h.x+h.w+t,h.y+t))return true;if(overlaps(h.x-t,h.y+h.h-t,h.doorX-half,h.y+h.h+t)||overlaps(h.doorX+half,h.y+h.h-t,h.x+h.w+t,h.y+h.h+t))return true;if(!doorPassable(h)&&overlaps(h.doorX-half,h.doorY-t,h.doorX+half,h.doorY+t))return true;}return false;}

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
function barrierPlacement(p,target){
 if(!Number.isFinite(target?.x)||!Number.isFinite(target?.y))return{x:p.x,y:p.y,angle:0,valid:false,reason:'Aim at a placement spot'};
 const face=Math.atan2(target.y-p.y,target.x-p.x),angle=Math.abs(Math.cos(face))>.707?Math.PI/2:0;
 const x=Math.round(target.x),y=Math.round(target.y);
 let reason='';
 if((p.concrete||0)<1)reason='No concrete barriers left';
 else if((world.barriers||[]).length>=90)reason='Maximum 90 concrete barriers reached';
 else{
  if(!aiLineClear(p.x,p.y,x,y,3))reason='A wall or obstacle blocks this spot';
  const cs=Math.cos(angle),sn=Math.sin(angle);
  for(let u=-42;u<=42;u+=14)for(let v=-14;v<=14;v+=14)if(solid(x+u*cs-v*sn,y+u*sn+v*cs,19))reason='Not enough clear space for concrete';
  if(world.players.some(q=>q.hp>0&&Math.hypot(q.x-x,q.y-y)<76)||(world.verity&&Math.hypot(world.verity.x-x,world.verity.y-y)<76))reason='Move farther away from survivors to place concrete';
 }
 return{x,y,angle,valid:!reason,reason};
}
function placeConcreteBarrier(p,target){
 const placement=barrierPlacement(p,target);if(!placement.valid){world.notice=placement.reason;return false;}
 const {x,y,angle}=placement;p.concrete--;world.barrierSerial=(world.barrierSerial||0)+1;
 (world.barriers||(world.barriers=[])).push({id:world.barrierSerial,x,y,angle,hp:1800,maxHp:1800});
 world.barrierRevision=(world.barrierRevision||0)+1;
 world.notice=name(p.id)+' placed reinforced concrete (1800 HP)';return true;
}
function drawBarrierPreview(){
 if(!pressed('barrier')||pauseOpen||inventoryOpen||verityOpen||rouletteOpen||shopOpen||session?.phase!=='play'||world.ended)return;
 const p=world.players.find(q=>q.id===who());if(!p||p.hp<=0)return;
 const placement=barrierPlacement(p,{x:mouse.x+camera.x,y:mouse.y+camera.y});
 ctx.save();ctx.translate(placement.x,placement.y);ctx.rotate(placement.angle);
 ctx.fillStyle=placement.valid?'#57e39755':'#ed596355';ctx.strokeStyle=placement.valid?'#8affb6':'#ff7a81';
 ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.fillRect(-42,-14,84,28);ctx.strokeRect(-42,-14,84,28);ctx.setLineDash([]);
 ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(6,0);ctx.moveTo(0,-6);ctx.lineTo(0,6);ctx.stroke();ctx.restore();
 ctx.save();ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillStyle=placement.valid?'#b2ffcf':'#ffaaaa';
 ctx.shadowColor='#06110e';ctx.shadowBlur=5;
 ctx.fillText(placement.valid?'LEFT CLICK TO PLACE · RELEASE '+binds.barrier.replace('Key','')+' TO CANCEL':placement.reason,placement.x,placement.y-58);ctx.restore();
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
function toggleDoor(p,board=false){const h=nearDoor(p);if(!h)return false;if(casinoLocked(h)){world.notice='Casino locked until wave 5';return false;}if(board){if(h.doorHp<=0){world.notice='This door is destroyed';return false;}if(h.boards>=4){world.notice='Door fully reinforced (4/4)';return false;}if(!(p.boards>0)){world.notice='You need wooden boards! Loot them from chests.';return false;}p.boards--;h.boards=Math.min(4,(h.boards||0)+1);h.doorMaxHp=100+h.boards*55;h.doorHp=Math.min(h.doorMaxHp,h.doorHp+55);h.doorOpen=false;world.notice=name(p.id)+' boarded a door ('+h.boards+'/4)';}else{if(h.doorHp<=0){world.notice='This door is broken';return true;}h.doorOpen=!h.doorOpen;world.notice=name(p.id)+(h.doorOpen?' opened':' closed')+' a door';}return true;}
function move(entity,dx,dy,r=12){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/Math.max(4,r*.75)));for(let i=0;i<steps;i++){if(!solid(entity.x+dx/steps,entity.y,r))entity.x+=dx/steps;else if(entity.vx)entity.vx=0;if(!solid(entity.x,entity.y+dy/steps,r))entity.y+=dy/steps;else if(entity.vy)entity.vy=0;}}
function healActor(p,amount){const restored=Math.max(0,Math.min(amount,100-p.hp));if(!restored)return 0;p.hp+=restored;p.healSerial=(p.healSerial||0)+1;p.healTotal=(p.healTotal||0)+restored;p.healAt=world.time||0;return restored;}
function grantLoot(p,id){if(itemDefs[id]?.type==='weapon'&&itemDefs[id].range>100)p.ammo+=24;if(id==='ammoBox'){p.ammo+=48;return;}if(id==='bandage'){healActor(p,28);return;}if(id==='energy'){p.energy=(p.energy||0)+1;world.notice=name(p.id)+' picked up an energy drink';return;}if(id==='concrete')p.concrete=(p.concrete||0)+2;else if(id==='medkit')p.medkits++;else if(id==='mints')p.mints=(p.mints||0)+2;else if(id==='boards')p.boards=(p.boards||0)+2;else {normalizeCopies(p);p.inventory.push(id);p.itemLevels.push(itemDefs[id]?.type==='weapon'?1:0);if(itemDefs[id]?.type==='armor'&&!p.armor)p.armor=id;if(itemDefs[id]?.type==='weapon')autoMergeCopies(p,id);}world.notice=name(p.id)+' collected '+(itemDefs[id]?.name||id)+'!';}
const LOOT_WEIGHTS={concrete:7,boards:18,mints:22,bandage:18,medkit:13,ammoBox:12,energy:10,pipe:12,hammer:11,crowbar:10,jacket:9,scrapvest:8,axe:7,pistol:6,machete:6,vest:6,hazmat:5,revolver:4,shotgun:4,smg:3,tactical:3,sledge:2.5,rifle:2,katana:1.7,doublebarrel:1.5,heavy:1.3,military:.6,sniper:.5,chainsaw:.35,sunbreaker:.16,reaper:.2,voidblade:.16,railgun:.12,hellfire:.17,thunderbolt:.14};
Object.assign(LOOT_WEIGHTS,{"wrench":10,"hatchet":10,"knife":10,"shovel":10,"club":10,"combatknife":7,"spear":7,"nailbat":7,"huntingrifle":7,"sawnoff":7,"kukri":4,"warhammer":4,"carbine":4,"crossbow":4,"battleaxe":2,"halberd":2,"bullpup":2,"autoshotgun":2});
const LOOT_UNLOCK={smg:3,sledge:4,rifle:5,katana:5,doublebarrel:5,heavy:5,military:7,sniper:7,chainsaw:6,sunbreaker:10,reaper:9,voidblade:10,railgun:12,hellfire:10,thunderbolt:11};
Object.assign(LOOT_UNLOCK,{"wrench":1,"hatchet":1,"knife":1,"shovel":1,"club":1,"combatknife":1,"spear":1,"nailbat":1,"huntingrifle":1,"sawnoff":1,"kukri":3,"warhammer":3,"carbine":3,"crossbow":3,"battleaxe":5,"halberd":5,"bullpup":5,"autoshotgun":5});
function randomLoot(wave=1,options){if(wave>=15&&!world?.mythicCreated&&Math.random()<.0005){world.mythicCreated=true;world.notice='✦ A MYTHIC WEAPON HAS APPEARED THIS MATCH!';return WEAPON_TIERS[5][Math.floor(Math.random()*WEAPON_TIERS[5].length)];}const available=(options||lootPool).filter(id=>(LOOT_UNLOCK[id]||1)<=wave);const pool=available.filter(id=>weaponTier(id)!==5);if(!pool.length)return 'boards';const tierBudget=[23,23,17,7.7,1.8],sums=[0,0,0,0,0];for(const id of pool){const tier=weaponTier(id);if(tier>=0&&tier<5)sums[tier]+=LOOT_WEIGHTS[id]||1;}const weight=id=>{const tier=weaponTier(id),base=LOOT_WEIGHTS[id]||1;return tier>=0?2.7*tierBudget[tier]*base/sums[tier]:base;};let total=0;for(const id of pool)total+=weight(id);let roll=Math.random()*total;for(const id of pool){roll-=weight(id);if(roll<0)return id;}return pool[pool.length-1];}
function spawnDrop(){const living=world.players.filter(p=>p.hp>0);if(!living.length)return;const p=living[Math.floor(Math.random()*living.length)],pool=lootPool;const id=randomLoot(world.wave,pool);for(let i=0;i<20;i++){const angle=Math.random()*Math.PI*2,dist=105+Math.random()*170,x=Math.max(20,Math.min(MAPW-20,p.x+Math.cos(angle)*dist)),y=Math.max(20,Math.min(MAPH-20,p.y+Math.sin(angle)*dist));if(!solid(x,y,23)){world.drops.push({id:++world.dropSerial,item:id,x,y});world.notice='A supply drop landed nearby!';return;}}}
function zombieLoot(z){if(Math.random()>.36)return;const pool=['mints','boards','medkit','bandage','ammoBox','energy','vest','tactical',...WEAPON_TIERS.slice(0,5).flat()];const id=randomLoot(world.wave,pool);world.drops.push({id:++world.dropSerial,item:id,x:z.x,y:z.y});}
function action(p,a){if(p.hp<=0)return;if(a.barrier){const aim=a._steps?.find(c=>c.input.barrier)?.input||a;placeConcreteBarrier(p,{x:aim.ax,y:aim.ay});return;}if(a.repair){repairDoor(p);return;}if(a.board){toggleDoor(p,true);return;}if(a.door){toggleDoor(p);return;}if(!a.use)return;let drop=null,dropDist=65;for(const d of world.drops||[]){const k=Math.hypot(d.x-p.x,d.y-p.y);if(k<dropDist){drop=d;dropDist=k;}}if(drop){if(drop.kind&&!pickupPlayerDrop(p,drop))return;world.drops=world.drops.filter(d=>d.id!==drop.id);if(!drop.kind)grantLoot(p,drop.item);return;}const nearest=nearbyChest(p);if(nearest){p.chestHold=Math.min(1.25,(p.chestHold||0)+.05);return;}if(p.medkits&&p.hp<100){p.medkits--;healActor(p,55);world.notice=name(p.id)+' used a medkit';}}

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
function build(){if(root)return;root=document.createElement('section');root.id='deadZoneRoot';const versionBadge=document.createElement('div');versionBadge.textContent='DEAD ZONE v'+DEAD_ZONE_VERSION;versionBadge.style.cssText='position:absolute;bottom:7px;right:10px;z-index:25001;padding:4px 8px;border:1px solid #52685c;border-radius:4px;background:#0b171ce8;color:#d0ddce;font:11px monospace;pointer-events:none';root.append(versionBadge);root.style.cssText='position:fixed;inset:0;z-index:20000;background:#071411;display:none;align-items:stretch;justify-content:stretch;color:#e4f0de;font:15px system-ui';const style=document.createElement('style');style.textContent='@keyframes dz-roulette-spin{from{transform:rotate(-12deg)}to{transform:rotate(348deg)}}'+"#deadZoneRoot .dz-merge-button{background:#254d43;border:1px solid #69ab8d;color:#d9ffe5;border-radius:7px;padding:7px;font-weight:800;cursor:pointer}#deadZoneRoot .dz-merge-button:disabled{opacity:.35;cursor:default}#deadZoneRoot .dz-evolve-label{color:#ffe5a4;font-size:10px;font-weight:800}#deadZoneRoot .dz-evolve-options{display:flex;flex-wrap:wrap;gap:5px}#deadZoneRoot .dz-evolve-button{background:#493253;border:1px solid #b887d1;border-radius:6px;color:#fff0ff;padding:6px;font-size:10px;cursor:pointer}"+"#deadZoneRoot .dz-drop-supply{display:flex;flex-wrap:wrap;gap:6px;align-items:center}#deadZoneRoot .dz-drop-supply span{flex:1 1 95px}#deadZoneRoot .dz-drop-button{background:#4c2c2f;color:#ffe0d4;border:1px solid #b78575;border-radius:6px;padding:6px 8px;font-size:10px;cursor:pointer}#deadZoneRoot .dz-drop-button:disabled{opacity:.4;cursor:default}#deadZoneRoot .dz-drop-item{display:flex;flex-direction:column;gap:5px;min-width:0}#deadZoneRoot .dz-drop-item>.dz-inv-item{width:100%;flex:1}"+'\n'+`#deadZoneRoot .dz-lobby-screen{background:radial-gradient(ellipse at top,#17392d 0,#071411 68%);padding:18px 24px!important;color:#e4f0de}#deadZoneRoot .dz-lobby-shell{max-width:1020px;margin:0 auto;text-align:left}#deadZoneRoot .dz-lobby-kicker{color:#90c8aa;font-size:11px;font-weight:900;letter-spacing:3px}#deadZoneRoot .dz-lobby-heading{font-size:clamp(32px,5vw,58px);line-height:1;margin:6px 0;color:#e5f5df;font-weight:1000;letter-spacing:4px;text-shadow:0 0 30px #7fac7555}#deadZoneRoot .dz-lobby-subtitle{color:#a9bcb3;margin:8px 0 20px}#deadZoneRoot .dz-lobby-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:16px}#deadZoneRoot .dz-lobby-card,#deadZoneRoot .dz-lobby-bottom{padding:20px;border:1px solid #3b6755;background:linear-gradient(155deg,#1b3329,#0c1b18);border-radius:16px;box-shadow:0 15px 35px #0007}#deadZoneRoot .dz-lobby-label{display:block;font-size:11px;color:#a9c7aa;letter-spacing:2px;font-weight:800;margin:10px 0}#deadZoneRoot .dz-lobby-code{font:900 clamp(35px,5vw,62px) monospace;letter-spacing:.22em;color:#f4df94;text-align:center;background:#071411;border:1px solid #617f52;border-radius:12px;padding:14px 8px;user-select:all}#deadZoneRoot .dz-lobby-action,#deadZoneRoot .dz-lobby-secondary,#deadZoneRoot .dz-lobby-start{border-radius:9px;border:1px solid #6c9874;color:#e5f7e5;background:#254c38;padding:11px 17px;cursor:pointer;font-weight:800}#deadZoneRoot .dz-lobby-action:hover,#deadZoneRoot .dz-lobby-start:hover{filter:brightness(1.2)}#deadZoneRoot .dz-lobby-action{margin:10px 0}#deadZoneRoot .dz-lobby-help{font-size:12px;line-height:1.5;color:#a4bdad}#deadZoneRoot .dz-lobby-slots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#deadZoneRoot .dz-lobby-seat{padding:12px;border-radius:9px;border:1px dashed #54665c;color:#869d91;display:grid;gap:5px;background:#0b1d18}#deadZoneRoot .dz-lobby-seat.filled{border:1px solid #72bd88;background:#1c3b2d;color:#e5f6df}#deadZoneRoot .dz-lobby-seat small{font-size:10px;opacity:.7}#deadZoneRoot .dz-lobby-select,#deadZoneRoot .dz-lobby-input{box-sizing:border-box;width:100%;background:#091a16;border:1px solid #567a62;padding:13px;color:#f2faea;border-radius:10px;font:inherit}#deadZoneRoot .dz-lobby-start{width:100%;font-size:17px;margin-top:20px;background:linear-gradient(90deg,#457c4a,#659c61);padding:16px}#deadZoneRoot .dz-lobby-bottom{margin-top:14px}#deadZoneRoot .dz-lobby-bottom-title{font-size:13px;letter-spacing:2px;font-weight:900}#deadZoneRoot .dz-lobby-join{display:flex;gap:12px;align-items:center}#deadZoneRoot .dz-lobby-input{max-width:240px;text-align:center;font-size:26px;letter-spacing:6px;text-transform:uppercase}#deadZoneRoot .dz-lobby-footer{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:16px 0;color:#bcd4b9}#deadZoneRoot .dz-lobby-secondary{background:#14291f;font-size:12px}#deadZoneRoot .dz-lobby-footer span{margin-right:auto;font-size:12px}@media(max-width:680px){#deadZoneRoot .dz-lobby-grid{grid-template-columns:1fr}#deadZoneRoot .dz-lobby-join{flex-wrap:wrap}#deadZoneRoot .dz-lobby-card{padding:14px}}#deadZoneRoot{font-family:Inter,system-ui,sans-serif!important}#deadZoneRoot .dz-hud-top,#deadZoneRoot .dz-hud-bottom{display:flex;align-items:center;gap:9px;flex-wrap:wrap;max-width:max-content;box-shadow:0 6px 30px #0008;backdrop-filter:blur(12px);pointer-events:auto}#deadZoneRoot .dz-hud-top{align-self:center}#deadZoneRoot .dz-hud-bottom{align-self:flex-start}#deadZoneRoot .dz-inventory-toggle{pointer-events:auto}#deadZoneRoot .dz-health-track{width:130px!important}#deadZoneRoot .dz-stamina-track{width:125px;height:10px;border-radius:9px;background:#25364b;overflow:hidden}#deadZoneRoot .dz-stamina-track i{display:block;height:100%;background:linear-gradient(90deg,#579ec8,#91dfd2)}#deadZoneRoot .dz-hud-top{background:#0c1817;padding:10px 14px;border:1px solid #34564c;border-radius:12px 12px 0 0}#deadZoneRoot .dz-hud-bottom{background:#0c1817;padding:9px 13px;border:1px solid #34564c;border-radius:0 0 12px 12px}#deadZoneRoot .dz-badge{color:#bbdf91;font-weight:900;letter-spacing:2px}#deadZoneRoot .dz-wave{padding:5px 12px;background:#263d30;border-radius:7px}#deadZoneRoot .dz-wave b{color:#e4c37e;font-size:19px}#deadZoneRoot .dz-score{color:#dec48a;font-weight:700}#deadZoneRoot .dz-inventory-toggle{margin-left:auto;background:#243d37;border:1px solid #769886;color:#d9f0de;padding:7px 14px;border-radius:7px;cursor:pointer}#deadZoneRoot .dz-health{display:flex;gap:8px;align-items:center}#deadZoneRoot .dz-health-track{width:110px;height:11px;border-radius:9px;background:#4c2020;overflow:hidden}#deadZoneRoot .dz-health-track i{display:block;height:100%;background:linear-gradient(90deg,#b44743,#69d38f)}#deadZoneRoot small{font-size:10px;letter-spacing:1px;color:#a2b2a8}#deadZoneRoot .dz-equipped{display:flex;flex-direction:column}#deadZoneRoot .dz-resource{padding:6px 9px;background:#20332e;border-radius:7px}#deadZoneRoot .dz-inventory{position:absolute;top:8%;right:2%;width:min(420px,90%);max-height:84%;overflow:auto;padding:20px;background:linear-gradient(145deg,#12231f,#0b1415);border:1px solid #779780;box-shadow:0 22px 80px #000b;border-radius:16px;z-index:20;color:#e8f0e4}#deadZoneRoot .dz-inv-header{position:relative;border-bottom:1px solid #3d5548;padding-bottom:9px}#deadZoneRoot .dz-inv-header h2{font-size:25px;letter-spacing:3px;margin:2px 0}#deadZoneRoot .dz-inv-eyebrow{color:#9fb884;letter-spacing:2px;font-size:11px}#deadZoneRoot .dz-inv-close{position:absolute;right:0;top:0;background:#442d30;border:0;border-radius:6px;padding:7px 12px;color:white;cursor:pointer}#deadZoneRoot .dz-inv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:14px 0}#deadZoneRoot .dz-inv-stat{background:#24372f;padding:9px;border-radius:8px;display:flex;flex-direction:column}#deadZoneRoot .dz-inv-stat strong{font-size:17px}#deadZoneRoot .dz-inv-equipped{background:#1c302a;border-left:3px solid #b5d78c;padding:11px;display:grid;gap:6px;margin-bottom:15px}#deadZoneRoot .dz-inv-title{font-weight:800;color:#d9cc96;letter-spacing:2px;font-size:11px;margin:8px 0}#deadZoneRoot .dz-inv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}#deadZoneRoot .dz-inv-item{text-align:left;display:grid;gap:4px;padding:10px;border-radius:9px;background:#22342e;border:1px solid #4b6453;color:#eef4e9;cursor:pointer}#deadZoneRoot .dz-inv-item.selected{border-color:#dfc788;box-shadow:inset 0 0 0 1px #dfc788}#deadZoneRoot .dz-inv-icon{font-size:26px}#deadZoneRoot .dz-inv-item small{color:#a9bcb1}#deadZoneRoot .dz-item-stats{display:block;color:#d4e8a8!important;font-size:12px;line-height:1.55;white-space:normal}#deadZoneRoot .dz-inv-supplies{border-top:1px solid #43564a;margin-top:14px}#deadZoneRoot .dz-inv-supplies p{font-size:13px;margin:8px 0}#deadZoneRoot .dz-inv-foot{display:block;margin-top:14px}`;style.textContent+=`#deadZoneRoot .dz-screen{background:radial-gradient(ellipse at 50% 27%,#27483adf,#07120ff8 70%)!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;overflow:auto}#deadZoneRoot .dz-screen-icon{font-size:72px;color:#c1da81;text-shadow:0 0 40px #80ba60}#deadZoneRoot .dz-screen h1{font-size:clamp(44px,8vw,86px);margin:0;letter-spacing:9px;color:#e2eddb;text-shadow:0 5px 20px #000}#deadZoneRoot .dz-screen p{max-width:570px;color:#b9cabe;font-size:16px;line-height:1.6;margin:0 0 14px}#deadZoneRoot .dz-screen button{min-width:230px;background:linear-gradient(120deg,#315b46,#517a50)!important;box-shadow:0 8px 23px #0008;font-weight:750;text-transform:uppercase;letter-spacing:1px}#deadZoneRoot .dz-screen button:hover{filter:brightness(1.2)}#deadZoneRoot .dz-screen select{min-width:230px;padding:12px!important;border:1px solid #7a997d!important}#deadZoneRoot .dz-inventory{position:fixed!important;inset:0!important;width:100vw!important;max-height:100vh!important;overflow:auto!important;z-index:20002!important;border:0!important;border-radius:0!important;display:flex;flex-direction:column;background:radial-gradient(circle at 80% 0%,#223a32 0,#07120f 68%)!important;padding:clamp(16px,3vw,45px)!important}#deadZoneRoot .dz-full-header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #4b6d59;padding-bottom:18px;gap:15px}#deadZoneRoot .dz-full-brand{font-size:clamp(15px,2vw,27px);font-weight:900;letter-spacing:3px;color:#bce0a2}#deadZoneRoot .dz-full-layout{display:grid;grid-template-columns:minmax(240px,360px) 1fr;gap:30px;padding-top:25px;flex:1;min-height:0}#deadZoneRoot .dz-full-side{background:#14251f;border:1px solid #496552;border-radius:14px;padding:22px;overflow:auto}#deadZoneRoot .dz-full-backpack{background:#111f1a;border:1px solid #385549;border-radius:14px;padding:24px;overflow:auto}#deadZoneRoot .dz-full-backpack h2,#deadZoneRoot .dz-full-side h2{font-size:clamp(24px,3vw,41px);letter-spacing:3px;margin:8px 0}#deadZoneRoot .dz-muted{color:#9aaa9f;font-size:13px}#deadZoneRoot .dz-full-slots{display:grid;gap:12px;margin:24px 0}#deadZoneRoot .dz-slot{display:grid;text-align:left;gap:8px;padding:18px;background:#24392f;border:1px solid #496454;border-radius:10px;color:#e7f2e5;cursor:pointer}#deadZoneRoot .dz-slot.active{border:2px solid #c2cf8b;background:#334c38}#deadZoneRoot .dz-slot strong{font-size:17px}#deadZoneRoot .dz-full-armor{display:grid;gap:9px;margin-bottom:24px;padding:14px;border-radius:9px;background:#26372f}#deadZoneRoot .dz-supply{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #34473d;color:#d6e8db}#deadZoneRoot .dz-inv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:13px;margin-top:24px}#deadZoneRoot .dz-inv-item{min-height:145px;padding:17px}#deadZoneRoot .dz-inv-icon{font-size:37px}#deadZoneRoot .dz-inv-foot{margin-top:25px;color:#acb9ac}@media(max-width:700px){#deadZoneRoot .dz-full-layout{grid-template-columns:1fr}#deadZoneRoot .dz-full-side{overflow:visible}#deadZoneRoot .dz-inventory{padding:13px!important}}`;style.textContent+=`#deadZoneRoot .dz-hud-top{align-self:flex-end;font-size:11px;background:#111a1ee8;border-radius:3px;border-color:#566166;gap:7px}#deadZoneRoot .dz-badge{color:#d4b47a}#deadZoneRoot .dz-hud-bottom{border-radius:3px;background:#111a1eee;max-width:94%;font-size:12px;gap:12px}#deadZoneRoot .dz-health-track{width:170px!important;height:16px;border:2px solid #c4c1ad;border-radius:2px;background:#401d24}#deadZoneRoot .dz-health-track i{background:linear-gradient(#f06555,#a92f36)}#deadZoneRoot .dz-stamina-track{height:8px;border-radius:1px}#deadZoneRoot .dz-screen{background:radial-gradient(ellipse at 65% 30%,#35453bdf,#090f15fa 75%)!important}#deadZoneRoot .dz-screen h1{color:#e7ddc8;letter-spacing:12px}#deadZoneRoot .dz-screen button{border-radius:3px!important;background:#394d48!important} @media(max-width:850px){#deadZoneRoot .dz-badge,#deadZoneRoot .dz-score{display:none}#deadZoneRoot .dz-health-track{width:85px!important}#deadZoneRoot .dz-hud-bottom{gap:5px;padding:6px}#deadZoneRoot .dz-resource{padding:4px}}`;root.append(style);const wrap=document.createElement('div');wrap.style.cssText='width:100%;height:100%;position:relative;display:flex;flex-direction:column;padding:10px;box-sizing:border-box;min-height:0';root.append(wrap);const title=document.createElement('h2');title.textContent='☣ DEAD ZONE · SURVIVAL';title.style.cssText='display:none';wrap.append(title);labels=document.createElement('div');labels.style.cssText='position:absolute;inset:0;z-index:6;pointer-events:none;display:flex;flex-direction:column;justify-content:space-between;padding:20px;box-sizing:border-box';wrap.append(labels);canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;canvas.style.cssText='position:absolute;display:block;background:#152722;border:1px solid #4c7260;box-sizing:border-box;cursor:crosshair';canvas.tabIndex=0;const stage=document.createElement('div');stage.style.cssText='position:relative;flex:1;min-height:0;width:100%;overflow:hidden;display:flex;align-items:center;justify-content:flex-start;background:#071411';const playArea=document.createElement('div');playArea.style.cssText='display:flex;flex:1;min-height:0;min-width:0;gap:12px';wrap.append(playArea);playArea.append(stage);stage.append(canvas);const sidebar=document.createElement('aside');sidebar.style.cssText='width:clamp(210px,23vw,300px);flex-shrink:0;display:flex;flex-direction:column;gap:12px;min-height:0;box-sizing:border-box;align-items:stretch';playArea.append(sidebar);miniCanvas=document.createElement('canvas');miniCanvas.width=260;miniCanvas.height=260;miniCanvas.style.cssText='width:100%;aspect-ratio:1;max-height:45vh;object-fit:contain;background:#071a18;border:2px solid #87bba4;border-radius:10px;box-sizing:border-box';sidebar.append(miniCanvas);const chat=document.createElement('section');chat.style.cssText='position:relative;z-index:8;flex:1;min-height:180px;width:100%;display:flex;flex-direction:column;background:#091c18d9;border:1px solid #658a7290;border-radius:8px;pointer-events:auto;font:12px system-ui';const heading=document.createElement('div');heading.textContent='💬 TEAM CHAT · Enter to type';heading.style.cssText='padding:5px 8px;background:#294633;color:#e2f1de;font-weight:bold';gameChatLog=document.createElement('div');gameChatLog.style.cssText='flex:1;overflow-y:auto;padding:5px;color:white';const form=document.createElement('form');form.style.cssText='display:flex';gameChatInput=document.createElement('input');gameChatInput.placeholder='Message teammates';gameChatInput.maxLength=220;gameChatInput.style.cssText='min-width:0;flex:1;background:#13281e;border:0;color:white;padding:7px';const send=document.createElement('button');send.textContent='SEND';send.style.cssText='background:#3f674c;color:white;border:0';form.append(gameChatInput,send);form.onsubmit=e=>{e.preventDefault();sendGameMessage();gameChatInput.blur();canvas.focus()};chat.append(heading,gameChatLog,form);sidebar.append(chat);const fitCanvas=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;const scale=Math.min(w/W,h/H);canvas.style.width=Math.floor(W*scale)+'px';canvas.style.height=Math.floor(H*scale)+'px';labels.style.inset='auto';labels.style.width=Math.floor(W*scale)+'px';labels.style.height=Math.floor(H*scale)+'px';labels.style.left=(stage.offsetLeft)+'px';labels.style.top=(stage.offsetTop+(h-H*scale)/2)+'px';};new ResizeObserver(fitCanvas).observe(stage);requestAnimationFrame(fitCanvas);ctx=canvas.getContext('2d');menu=document.createElement('div');menu.style.cssText='position:absolute;inset:0;background:#071411e8;overflow:auto;text-align:center;padding:45px 12px';wrap.append(menu);document.body.append(root);
canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect();mouse.x=(e.clientX-r.left)*W/r.width;mouse.y=(e.clientY-r.top)*H/r.height;});canvas.addEventListener('mousedown',()=>{mouse.down=true;canvas.focus();});window.addEventListener('mouseup',()=>mouse.down=false);window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.code==='KeyR')return;if(root.style.display==='none')return;const editing=e.target?.matches?.('input, textarea, select, [contenteditable="true"]')||document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]');if(editing){if(e.code==='Escape'&&document.activeElement===gameChatInput){e.preventDefault();gameChatInput.blur();canvas.focus()}return;}if(e.code==='Enter'&&session?.phase==='play'&&!inventoryOpen&&!rouletteOpen&&!shopOpen&&!pauseOpen){e.preventDefault();gameChatInput.focus();return;}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab',...Object.values(binds)].includes(e.code))e.preventDefault();if(e.repeat&&e.code==='Escape')return;keys.add(e.code);if(e.code===binds.interact&&!e.repeat&&session?.phase==='play'&&!pauseOpen&&!inventoryOpen&&!verityOpen){const p=world?.players.find(p=>p.id===who());if(shopOpen){shopOpen=false;showShop();keys.delete(e.code);}else if(shopNearby(p)&&!world.players.some(q=>q.id!==p.id&&q.hp<=0&&Math.hypot(q.x-p.x,q.y-p.y)<64)&&!(world.drops||[]).some(d=>Math.hypot(d.x-p.x,d.y-p.y)<65)){shopOpen=true;shopStamp='';shopPending=0;keys.delete(e.code);showShop();}else if(rouletteOpen){rouletteOpen=false;showRoulette();keys.delete(e.code);}else if(world?.wave>=5&&p?.hp>0&&rouletteNearby(p)){const down=world.players.some(q=>q.id!==p.id&&q.hp<=0&&Math.hypot(q.x-p.x,q.y-p.y)<64);const verityDown=['down','sleeping'].includes(world.verity?.state)&&Math.hypot(world.verity.x-p.x,world.verity.y-p.y)<72;const pickup=(world.drops||[]).some(d=>Math.hypot(d.x-p.x,d.y-p.y)<65);const chest=world.chests?.some(c=>!c.opened&&Math.hypot(c.x-p.x,c.y-p.y)<80);if(!down&&!verityDown&&!pickup&&!chest){rouletteOpen=true;rouletteLastSerial=p.rouletteSerial||0;roulettePending=false;keys.delete(e.code);showRoulette();}}}if(e.code==='KeyG'&&!e.repeat&&session?.phase==='play'&&!pauseOpen&&!rouletteOpen&&!shopOpen){const p=world?.players.find(p=>p.id===who()),v=world?.verity;if(verityOpen){verityOpen=false;showVerityInventory();}else if(p?.hp>0&&v?.state==='active'&&Math.hypot(p.x-v.x,p.y-v.y)<85){inventoryOpen=false;showInventory();verityOpen=true;verityUIStamp='';showVerityInventory();}}if(e.code===binds.inventory&&!e.repeat&&session?.phase==='play'&&!pauseOpen){shopOpen=false;showShop();rouletteOpen=false;showRoulette();verityOpen=false;showVerityInventory();inventoryOpen=!inventoryOpen;showInventory();}if(e.code==='Escape'){e.preventDefault();if(shopOpen){shopOpen=false;showShop();}else if(rouletteOpen){rouletteOpen=false;showRoulette();}else if(verityOpen){verityOpen=false;showVerityInventory();}else if(inventoryOpen){inventoryOpen=false;showInventory();}else if(session?.phase==='play'){pauseOpen=!pauseOpen;showPause();}else if(pauseOpen){pauseOpen=false;showPause();}}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();mouse.down=false;});}
function screen(text){menu.replaceChildren();menu.style.display='block';menu.style.pointerEvents='auto';menu.style.zIndex='10';menu.classList.add('dz-screen');const insignia=document.createElement('div');insignia.className='dz-screen-icon';insignia.textContent='☣';menu.append(insignia);const title=document.createElement('h1');title.textContent='DEAD ZONE';menu.append(title);const p=document.createElement('p');p.textContent=text;menu.append(p);}
function showPause(){if(!session)return;if(!pauseOpen){menu.style.display='none';canvas.focus();return;}screen('SURVIVAL MENU · Game continues online while this menu is open');button('▶ Resume survival',()=>{pauseOpen=false;showPause();});button('🎒 Inventory',()=>{pauseOpen=false;menu.style.display='none';inventoryOpen=true;showInventory();});button('💾 Save progress',()=>{const ok=saveGame();screen(ok?'Progress saved on this device.':'Saving is available in an active host game.');button('← Back to pause menu',showPause);});button('⚙ Settings / Keybinds',showSettings);button('✕ Leave game',returnToMenu);}
function showSettings(){screen('Customize controls · click a key binding, then press the new key. Escape cancels.');const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(175px,1fr));gap:7px;max-width:600px;margin:auto';menu.append(grid);const names={barrier:'Hold to preview barrier, click to place',up:'Move up',down:'Move down',left:'Move left',right:'Move right',sprint:'Sprint',attack:'Attack',interact:'Open chest / Pick up',inventory:'Inventory',heal:'Use mints',door:'Door',board:'Board door',repair:'Repair door',primary:'Primary weapon',secondary:'Secondary weapon'};for(const action of Object.keys(BIND_DEFAULTS)){const b=button(names[action]+': '+binds[action],()=>{b.textContent='Press a key…';const listen=e=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.code==='KeyR'){window.removeEventListener('keydown',listen,true);return;}e.stopPropagation();e.preventDefault();if(e.code!=='Escape'){for(const k of Object.keys(binds))if(k!==action&&binds[k]===e.code)binds[k]=BIND_DEFAULTS[k]===e.code?'Unassigned':binds[action];binds[action]=e.code;localStorage.setItem('deadzone-keybinds',JSON.stringify(binds));}keys.clear();showSettings();};window.addEventListener('keydown',listen,{capture:true,once:true});},grid);b.style.cssText+='font-size:12px;min-width:0;margin:0';}button('Restore defaults',()=>{binds={...BIND_DEFAULTS};localStorage.setItem('deadzone-keybinds',JSON.stringify(binds));showSettings();});button('← Back',()=>{if(pauseOpen)showPause();else if(session?.mode==='host'&&session.phase==='lobby')lobby();else if(session?.phase==='play'){menu.style.display='none';canvas.focus();}else screen('Waiting for host to start');});}
function open(){if(!who())return;shopOpen=false;shopPending=0;if(shopPanel)shopPanel.style.display='none';resetNetwork();totalPlaytime=getTotalTime();totalPlaytimeFlush=0;pauseOpen=false;gameOverShown=false;inventoryOpen=false;verityOpen=false;rouletteOpen=false;roulettePending=false;rouletteSelectedSlot=-1;verityUIStamp='';build();root.style.display='flex';screen('Host a survival party or join with a lobby code.');session={mode:'host',gameMode:'story',difficulty:'normal',id:crypto.randomUUID(),secret:crypto.randomUUID()+crypto.randomUUID(),code:(tabLobbyOwner===who()&&tabLobbyCode?tabLobbyCode:(tabLobbyOwner=who(),tabLobbyCode=createJoinCode())),peers:new Map(),phase:'lobby',host:who(),seat:0};world=newWorld([who()]);if(invite){const b=button('Join '+name(invite.from),()=>join(invite));button('Decline invitation',()=>{invite=null;open();});}else lobby();if(LOBBY_API){publishDeadZoneLobby();if(lobbyLeaseTimer)clearInterval(lobbyLeaseTimer);lobbyLeaseTimer=setInterval(publishDeadZoneLobby,35000);}if(!raf){last=0;raf=requestAnimationFrame(frame);}if(!networkTimer)networkTimer=setInterval(()=>advanceGame(performance.now()),8);}
function lobby(){if(!session||session.mode!=='host')return;screen('');menu.classList.add('dz-lobby-screen');const add=(parent,tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;parent.append(e);return e;};const shell=add(menu,'div','dz-lobby-shell');add(shell,'div','dz-lobby-kicker','☣ OUTBREAK OPERATIONS / MULTIPLAYER · v'+DEAD_ZONE_VERSION);add(shell,'h1','dz-lobby-heading','DEAD ZONE');add(shell,'p','dz-lobby-subtitle','Build your squad. Prepare your loadout. Survive together.');const grid=add(shell,'div','dz-lobby-grid');const left=add(grid,'section','dz-lobby-card');add(left,'small','dz-lobby-label','YOUR LOBBY CODE');const codeBox=add(left,'div','dz-lobby-code',session.code);const copy=add(left,'button','dz-lobby-action','▣ COPY CODE');copy.onclick=async()=>{try{await navigator.clipboard.writeText(session.code);copy.textContent='✓ COPIED';}catch{copy.textContent='SELECT THE CODE';const range=document.createRange();range.selectNodeContents(codeBox);getSelection()?.removeAllRanges();getSelection()?.addRange(range);}setTimeout(()=>{if(copy.isConnected)copy.textContent='▣ COPY CODE';},1800);};add(left,'p','dz-lobby-help','Share your code with up to three other survivors.');add(left,'small','dz-lobby-label','SQUAD · '+(1+peers().size)+'/4');const slots=add(left,'div','dz-lobby-slots');for(let i=0;i<4;i++){const id=[who(),...peers().keys()][i];const slot=add(slots,'div','dz-lobby-seat'+(id?' filled':''));add(slot,'b','',id?(i===0?'★ ':'● ')+name(id):'＋ OPEN SLOT');add(slot,'small','',id?(i===0?'HOST':'CONNECTED'):'Waiting for survivor');}const right=add(grid,'section','dz-lobby-card');add(right,'small','dz-lobby-label','MISSION SETTINGS');const field=(title,choices,value,change)=>{add(right,'label','dz-lobby-label',title);const select=add(right,'select','dz-lobby-select');for(const [v,label]of choices){const o=add(select,'option','',label);o.value=v;}select.value=value;select.onchange=()=>change(select.value);return select;};field('GAME MODE',[['story','STORY · Last Signal'],['endless','ENDLESS · Hold the district']],session.gameMode||'story',v=>{session.gameMode=v;world.mode=v;});field('DIFFICULTY',[['easy','EASY · Survivor'],['normal','NORMAL · Infected'],['hard','HARD · Outbreak'],['nightmare','NIGHTMARE · Extinction']],session.difficulty||'normal',v=>{session.difficulty=v;world.difficulty=v;});add(right,'p','dz-lobby-help','STORY: recover supplies and restore the radio. ENDLESS: survive escalating waves and boss fights.');const start=add(right,'button','dz-lobby-start','▶ DEPLOY INTO DEAD ZONE');start.onclick=()=>{world.mode=session.gameMode||'story';world.difficulty=session.difficulty;session.phase='play';stopDeadZoneLobby();menu.style.display='none';startNetworkMatch();canvas.focus();};const bottom=add(shell,'section','dz-lobby-bottom');add(bottom,'div','dz-lobby-bottom-title','JOIN ANOTHER SQUAD');const row=add(bottom,'div','dz-lobby-join');const enter=add(row,'input','dz-lobby-input');enter.placeholder='ABCDE';enter.maxLength=5;enter.autocomplete='off';enter.autocapitalize='characters';enter.spellcheck=false;enter.inputMode='text';enter.setAttribute('aria-label','Enter five-letter lobby code');enter.oninput=()=>enter.value=enter.value.replace(/[^a-z]/gi,'').toUpperCase();const go=add(row,'button','dz-lobby-action','JOIN LOBBY');const status=add(bottom,'small','dz-lobby-help',LOBBY_API?'Enter a five-letter code to join a lobby.':'Public joins require the lobby registry to be deployed. Friend-code lookup is available.');go.onclick=async()=>{const code=enter.value.trim().toUpperCase();if(!/^[A-Z]{5}$/.test(code)){status.textContent='Enter exactly five letters.';return;}status.textContent='Searching for lobby…';go.disabled=true;const ok=await lookupDeadZoneLobby(code);if(!ok){status.textContent='Couldn’t find lobby';go.disabled=false;return;}if(!LOBBY_API){setTimeout(()=>{if(pendingJoinCode===code&&session?.mode==='host'&&session.phase==='lobby'){pendingJoinCode='';if(status.isConnected){status.textContent='Couldn’t find lobby';go.disabled=false;}}},6000);}};const foot=add(shell,'div','dz-lobby-footer');const total=add(foot,'span','','⏱ ALL-TIME PLAYTIME · '+formatPlaytime(totalPlaytime));const saved=readSave();if(saved){const resume=add(foot,'button','dz-lobby-secondary','▶ CONTINUE SAVED GAME · WAVE '+saved.world.wave);resume.onclick=continueGame;const del=add(foot,'button','dz-lobby-secondary','DELETE SAVE');del.onclick=()=>{if(confirm('Delete your saved Dead Zone progress?')){localStorage.removeItem(saveKey());lobby();}};}const settings=add(foot,'button','dz-lobby-secondary','⚙ SETTINGS');settings.onclick=showSettings;const exit=add(foot,'button','dz-lobby-secondary','← BACK TO GAMES');exit.onclick=close;}
function join(i){resetNetwork();if(lobbyLeaseTimer){clearInterval(lobbyLeaseTimer);lobbyLeaseTimer=null;}if(session?.mode==='host'&&LOBBY_API)stopDeadZoneLobby();window.deadZoneConnectPublic?.(i.from);session={mode:'guest',id:i.id,host:i.from,seat:1,peers:new Map(),phase:'lobby'};world=null;invite=null;screen('Joining '+name(i.from)+'…');emit(i.from,{t:'dz-join',id:i.id});if(lobbyJoinTimer)clearInterval(lobbyJoinTimer);lobbyJoinTimer=setInterval(()=>{if(session?.mode!=='guest'||session.host!==i.from||session.phase!=='lobby'){clearInterval(lobbyJoinTimer);lobbyJoinTimer=null;return;}window.deadZoneConnectPublic?.(i.from);emit(i.from,{t:'dz-join',id:i.id});},1500);button('← Back to Games',close);}
function close(){shopOpen=false;shopPending=0;if(shopPanel)shopPanel.style.display='none';stopDeadZoneLobby();flushTotalPlaytime();saveGame();
// Preserve the final authoritative checkpoint before terminating the worker.
if(hostWorker){const leaving=hostWorker,key=saveKey(),owner=who();hostWorker=null;const timer=setTimeout(()=>leaving.terminate(),750);leaving.onmessage=({data})=>{if(data.type==='checkpoint'&&data.save){persistSave(data.world,key,owner);clearTimeout(timer);leaving.terminate();}};leaving.postMessage({type:'save'});}
pauseOpen=false;gameOverShown=false;inventoryOpen=false;verityOpen=false;rouletteOpen=false;if(roulettePanel)roulettePanel.style.display='none';if(verityPanel)verityPanel.style.display='none';if(inventoryPanel)inventoryPanel.style.display='none';if(session){if(session.mode==='host')group({t:'dz-end',id:session.id});else emit(session.host,{t:'dz-leave',id:session.id});}if(session?.mode==='guest')window.deadZoneRevokePublicPeer?.(session.host);if(session?.mode==='host')for(const id of peers().keys())window.deadZoneRevokePublicPeer?.(id);resetNetwork();session=null;world=null;if(gameChatLog)gameChatLog.replaceChildren();announcedDeaths.clear();guestVisuals.clear();if(root)root.style.display='none';document.querySelector('#gamesHub')?.classList.remove('hidden');keys.clear();mouse.down=false;}
function returnToMenu(){close();invite=null;open();}
function input(){const watch=keys.has('Tab');if(watch&&!previousSpectate)spectatorIndex++;previousSpectate=watch;const use=pressed('interact'),toggle=pressed('inventory'),mint=pressed('heal'),door=pressed('door'),board=pressed('board'),repair=pressed('repair'),barrier=pressed('barrier');const barrierOnce=barrier&&mouse.down&&!previousBarrier;previousBarrier=mouse.down;previousToggle=toggle;previousUse=use;const mintOnce=mint&&!previousMint;previousMint=mint;const doorOnce=door&&!previousDoor,boardOnce=board&&!previousBoard,repairOnce=repair&&!previousRepair;previousDoor=door;previousBoard=board;previousRepair=repair;return {barrier:barrierOnce,repair:repairOnce,use,mint:mintOnce,door:doorOnce,board:boardOnce,swap:pressed('primary')?1:pressed('secondary')?2:0,x:Number(pressed('right')||keys.has('ArrowRight'))-Number(pressed('left')||keys.has('ArrowLeft')),y:Number(pressed('down')||keys.has('ArrowDown'))-Number(pressed('up')||keys.has('ArrowUp')),ax:mouse.x+camera.x,ay:mouse.y+camera.y,sprint:pressed('sprint'),fire:!barrier&&(mouse.down||pressed('attack'))};}
function tick(dt){if(!world||world.ended)return;const w=world;w.time=(w.time||0)+dt;w.effects=(w.effects||[]).filter(e=>(e.life-=dt)>0);for(const e of w.effects){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vx*=Math.max(0,1-dt*4);e.vy*=Math.max(0,1-dt*4);}updateCasino();storyTick(dt);if(w.players.every(p=>p.hp<=0)){w.ended=true;return;}if(w.ended)return;
for(const p of w.players){const a={...(p.id===who()&&!window.__DEAD_ZONE_WORKER__?localInput:hostInput(p.id,dt))};if(p.id!==who()){const pending=inputs.get(p.id);if(pending)for(const k of ['mint','door','board','repair','barrier','swap'])pending[k]=false;}if(p.hp<=0){p.pendingMelee=null;p.reviveHold=0;p.reviveTarget=null;continue;}const down=w.players.find(q=>q.id!==p.id&&q.hp<=0&&Math.hypot(q.x-p.x,q.y-p.y)<64);const verityNear=w.verity&&Math.hypot(w.verity.x-p.x,w.verity.y-p.y)<=72;if(a.use&&down){if(p.reviveTarget!==down.id){p.reviveTarget=down.id;p.reviveHold=0;}p.reviveHold=(p.reviveHold||0)+dt;if(p.reviveHold>=3){healActor(down,45);down.invuln=2;down.stamina=60;p.reviveHold=0;p.reviveTarget=null;w.notice=name(p.id)+' revived '+name(down.id)+'!';burst(down.x,down.y,'#9ee5ad',20);}}else{p.reviveHold=0;p.reviveTarget=null;}advancePlayerMovement(p,a,dt);p.cool=Math.max(0,p.cool-dt);p.invuln=Math.max(0,p.invuln-dt);p.flash=Math.max(0,(p.flash||0)-dt);p.recoil=Math.max(0,(p.recoil||0)-dt*65);p.swing=Math.max(0,(p.swing||0)-dt);if(Number.isFinite(a.ax)&&Number.isFinite(a.ay))p.face=Math.atan2(a.ay-p.y,a.ax-p.x);
if(p.pendingMelee&&p.weapon!==p.pendingMelee.weapon)p.pendingMelee=null;
if(p.pendingMelee){p.pendingMelee.remaining-=dt;if(p.pendingMelee.remaining<=0){const strike=p.pendingMelee;p.pendingMelee=null;resolveMelee(p,strike.weapon,strike.damage,strike.angle);}}
if(a.swap===1||a.swap===2)swapWeapon(p,a.swap===1?'primary':'secondary');if(a.mint&&p.mints>0&&p.hp<100){p.mints--;healActor(p,22);w.notice=name(p.id)+' used Care Mints';}
const chest=nearbyChest(p);if(down||!a.use||!chest||Math.hypot(p.x-chest.x,p.y-chest.y)>80){p.chestHold=0;p.chestTarget=null;p.chestComplete=false;}else if(p.chestTarget!==chest.id){p.chestTarget=chest.id;p.chestHold=0;p.chestComplete=false;}else if(!p.chestComplete){p.chestHold=Math.min(1.25,(p.chestHold||0)+dt);if(p.chestHold>=1.25){chest.opened=true;p.chestComplete=true;p.useLatch=true;const item=randomLoot(w.wave);const offsets=[[-25,-18],[25,-18],[-25,22],[25,22],[0,0]];let pos={x:chest.x,y:chest.y};for(const [ox,oy] of offsets){if(!solid(chest.x+ox,chest.y+oy,10)){pos={x:chest.x+ox,y:chest.y+oy};break;}}w.drops.push({id:++w.dropSerial,item,x:pos.x,y:pos.y});w.notice='Chest opened! Press E to pick up '+itemDefs[item].name;}}if(a.use&&!down&&!p.useLatch&&Math.hypot(p.x-BELL_X,p.y-BELL_Y)<75){if(w.time-(w.bellLast??-100)>=12){w.bellLast=w.time;makeNoise(BELL_X,BELL_Y,2200,10);w.notice='THE CENTER BELL RANG! Zombies are heading to the sound!';}else w.notice='The bell needs a moment before it can ring again';p.useLatch=true;}
if(a.use&&!down&&!p.useLatch&&(!verityNear||w.verity.state==='active')&&(!chest||w.drops.some(d=>Math.hypot(d.x-p.x,d.y-p.y)<65))&&!(w.mode==='story'&&w.story.stage<2&&Math.hypot(p.x-missionSites[w.story.stage].x,p.y-missionSites[w.story.stage].y)<70)){action(p,{use:true});p.useLatch=true;}if(a.use&&!down&&verityNear){if(w.verity.state==='down'){verityInteract(p,dt);}else if(w.verity.state==='sleeping'&&!p.useLatch){verityInteract(p,dt);p.useLatch=true;}}if(!a.use){p.useLatch=false;if(w.verity?.reviver===p.id){w.verity.reviveHold=0;w.verity.reviver=null;}}if(a.door||a.board||a.repair||a.barrier)action(p,a);
const heldFire=Boolean(a.fire)||!!a._firePressed;const firePressed=!!a._firePressed||(heldFire&&!p.fireHeld);p.fireHeld=heldFire;
if(heldFire&&itemDefs[p.weapon]?.type==='weapon'&&p.cool<=0){p.attackSerial=(p.attackSerial||0)+1;const weapon=itemDefs[p.weapon],vx=(Number(a.ax)||p.x+1)-p.x,vy=(Number(a.ay)||p.y)-p.y,angle=Math.atan2(vy,vx);p.face=angle;p.cool=weapon.cool;weaponParticles(p.weapon,p.x,p.y,angle);
if(weapon.range<100){
 p.swing=Math.min(.62,weapon.cool+.1);p.swingTotal=p.swing;p.swingWeapon=weapon.name;p.swingDir=(p.swingDir||1)*-1;p.swingImpact=0;
 p.pendingMelee={weapon:p.weapon,angle,damage:weaponDamage(p.weapon,activeWeaponLevel(p)),remaining:p.swingTotal*(.22+weaponSwingWeight(p.weapon)*.12)};
}
else if(p.ammo>0){p.ammo--;makeNoise(p.x,p.y,1250,6);p.flash=p.weapon==='crossbow'?0:.14;const muzzle=weaponMuzzle(p,p.weapon,angle),muzzleX=muzzle.x,muzzleY=muzzle.y;if(p.weapon!=='crossbow'){burst(muzzleX,muzzleY,'#ffe0a0',shotgunPellets(p.weapon)>1?22:12);burst(muzzleX,muzzleY,'#f28d48',shotgunPellets(p.weapon)>1?11:5);}p.recoil=(shotgunPellets(p.weapon)>1?12:['sniper','railgun'].includes(p.weapon)?10:['smg','rifle','thunderbolt','eclipse'].includes(p.weapon)?4:6);p.flashX=muzzleX;p.flashY=muzzleY;p.flashAngle=angle;const side=angle+Math.PI/2;if(p.weapon!=='crossbow')burst(p.x+Math.cos(angle)*10+Math.cos(side)*13,p.y+Math.sin(angle)*10+Math.sin(side)*13,'#b8a26c',4);const spread=shotgunPellets(p.weapon)===3?[-.2,0,.2]:[0];for(const diff of spread)w.shots.push({x:p.x+Math.cos(angle)*18-Math.sin(angle)*10,y:p.y+Math.sin(angle)*18+Math.cos(angle)*10,vx:Math.cos(angle+diff)*730,vy:Math.sin(angle+diff)*730,life:weapon.range/730,damage:weaponDamage(p.weapon,activeWeaponLevel(p)),owner:p.id,kind:p.weapon,trail:[]});}else w.notice='Out of ammo — use your melee weapon';}}
if(w.between>0){w.between-=dt;if(w.between<=0){w.wave++;updateCasino();if(w.mode==='endless'&&w.wave===10&&!w.verity){w.verity=makeVerity();w.notice='☀ WAVE 10 OBJECTIVE: GO TO THE MIDDLE! Verity has arrived in a cardboard box. Open it with your Interact key!';}w.remaining=Math.ceil((5+w.wave*4)*(DIFFICULTIES[w.difficulty||'normal']||DIFFICULTIES.normal).count);w.spawned=0;if(w.wave%10===0){const boss=zombieSpawn(true);w.zombies.push(boss);w.notice='☠ BOSS HORDE · THE '+BOSS_NAMES[boss.kind]+' HAS ARRIVED!';}if(w.wave>=2)spawnDrop();}}
if(w.remaining>0&&w.between<=0){w.spawned+=dt*(1.3+w.wave*.25)*(DIFFICULTIES[w.difficulty||'normal']||DIFFICULTIES.normal).count;while(w.spawned>=1&&w.remaining>0&&w.zombies.length<65){w.zombies.push(zombieSpawn());w.spawned--;w.remaining--;if(w.wave>=4&&w.remaining===Math.floor((5+w.wave*4)*(DIFFICULTIES[w.difficulty||'normal']||DIFFICULTIES.normal).count/2))spawnDrop();}}
tickVerity(dt);verityBanter(dt);
for(const z of w.zombies){if(z.hp<=0)continue;if(z.kvx||z.kvy){move(z,(z.kvx||0)*dt,(z.kvy||0)*dt,11);z.kvx*=Math.max(0,1-dt*12);z.kvy*=Math.max(0,1-dt*12);}
const living=w.players.filter(p=>p.hp>0);if(w.verity?.state==='active'&&w.verity.hp>0)living.push({...w.verity,id:'verity'});if(!living.length){w.ended=true;break;}
// Infected roam until sight or sound draws their attention.
let best=null,bestScore=Infinity;
for(const candidate of living){
 const dist=Math.hypot(candidate.x-z.x,candidate.y-z.y);
 const visible=dist<(z.boss?560:370)&&clearShot(z.x,z.y,candidate.x,candidate.y);
 if(!visible&&!(candidate.id===z.targetId&&z.alertUntil>w.time&&dist<750))continue;
 const score=dist*(candidate.id===z.targetId?.72:1);
 if(score<bestScore){best=candidate;bestScore=score;}
}
if(best){z.targetId=best.id;z.alertUntil=w.time+3.5;}
else if(z.alertUntil<=w.time)z.targetId=null;
const heard=w.noise&&w.noise.until>w.time&&Math.hypot(z.x-w.noise.x,z.y-w.noise.y)<w.noise.radius;
if(!best&&heard&&z.heardSerial!==w.noise.serial){z.heardSerial=w.noise.serial;z.investigateX=w.noise.x;z.investigateY=w.noise.y;z.investigateUntil=w.time+12;z.wanderUntil=0;}
if(!best&&(!z.wanderUntil||z.wanderUntil<w.time||Math.hypot(z.x-z.wanderX,z.y-z.wanderY)<22)){
 const searching=z.investigateUntil>w.time&&Math.hypot(z.x-z.investigateX,z.y-z.investigateY)>45;
 if(searching){z.wanderX=z.investigateX;z.wanderY=z.investigateY;z.wanderUntil=w.time+3;}
 else {const angle=Math.random()*Math.PI*2,dist=100+Math.random()*220;
  z.wanderX=Math.max(20,Math.min(MAPW-20,z.x+Math.cos(angle)*dist));
  z.wanderY=Math.max(20,Math.min(MAPH-20,z.y+Math.sin(angle)*dist));z.wanderUntil=w.time+2+Math.random()*3;}
}
const p=best,goalX=p?p.x:z.wanderX,goalY=p?p.y:z.wanderY;
if(aiRecover(z,z.speed,dt))continue;
z.hit=Math.max(0,(z.hit||0)-dt);z.attack=Math.max(0,z.attack-dt);
const goal=aiDoorGoal(z,goalX,goalY),door=goal.door;
if(door&&!casinoLocked(door)&&Math.hypot(z.x-door.doorX,z.y-door.doorY)<58&&z.attack<=0){
 door.doorHp=Math.max(0,door.doorHp-(12+w.wave*2));z.attack=.8;
 if(door.doorHp<=0){door.doorOpen=true;door.boards=0;w.notice='Zombies broke down a door!';}
}
const point=aiWaypoint(z,goal.x,goal.y,'z:'+(p?p.id:'roam')+':'+(door?door.x+','+door.y:'target'));
const oldZX=z.x,oldZY=z.y;
const investigating=!p&&z.investigateUntil>w.time&&Math.hypot(z.x-z.investigateX,z.y-z.investigateY)>45;
const traveled=aiMoveToward(z,point,p?z.speed:investigating?z.speed*1.05:z.speed*.38,dt,11);
if(traveled>.2)z.face=Math.atan2(z.y-oldZY,z.x-oldZX);
z.stuck=point&&traveled<z.speed*dt*.15?(z.stuck||0)+dt:0;
if(z.stuck>.65){z.aiRoute=null;z.stuck=0;}
if(!point&&!door){
 const b=(w.barriers||[]).filter(b=>b.hp>0).sort((a,b)=>Math.hypot(a.x-z.x,a.y-z.y)-Math.hypot(b.x-z.x,b.y-z.y))[0];
 if(b){
  const a=Math.atan2(z.y-b.y,z.x-b.x),bx=b.x+Math.cos(a)*66,by=b.y+Math.sin(a)*66;
  aiMoveToward(z,aiWaypoint(z,bx,by,'barrier:'+b.id+':'+Math.round(a*2)),z.speed,dt,11);
  z.concreteStuck=(z.concreteStuck||0)+dt;
  if(z.concreteStuck>1.6&&Math.hypot(z.x-b.x,z.y-b.y)<85&&z.attack<=0){b.hp=Math.max(0,b.hp-(8+Math.min(12,w.wave)));z.attack=1.1;if(!b.hp){w.barrierRevision=(w.barrierRevision||0)+1;w.barriers=w.barriers.filter(q=>q.hp>0);w.notice='A concrete barrier was destroyed!';}}
 }
}else z.concreteStuck=0;
separateZombieFromSurvivors(z);

if(p&&p.hp>0&&Math.hypot(p.x-z.x,p.y-z.y)<(z.boss?31+bossSize(z)*9:34)&&z.attack<=0&&(p.id==='verity'?w.verity.invuln:p.invuln)<=0){const victim=p.id==='verity'?w.verity:p;victim.hp=Math.max(0,victim.hp-Math.ceil(16*(z.attackPower||1)*(DIFFICULTIES[w.difficulty||'normal']||DIFFICULTIES.normal).damage*(1-(itemDefs[victim.armor]?.defense||0))));burst(victim.x,victim.y,'#d15a48',12);victim.invuln=.4;z.attack=.65;if(victim===w.verity&&victim.hp===0){victim.state='down';w.notice='Verity is down! Hold E nearby to revive him';}}
}
separateZombies(dt);for(const z of w.zombies)separateZombieFromSurvivors(z);for(const shot of w.shots){const steps=Math.max(1,Math.ceil(Math.hypot(shot.vx,shot.vy)*dt/7));for(let step=0;step<steps&&shot.life>0;step++){shot.trail=shot.trail||[];if(step===0)shot.trail.push({x:shot.x,y:shot.y});shot.x+=shot.vx*dt/steps;shot.y+=shot.vy*dt/steps;shot.life-=dt/steps;if(solid(shot.x,shot.y,3)){burst(shot.x,shot.y,'#e9c68a',12);burst(shot.x,shot.y,'#faf1ce',6);shot.life=0;continue;}for(const z of w.zombies)if(z.hp>0&&Math.hypot(z.x-shot.x,z.y-shot.y)<(z.boss?14+bossSize(z)*9:16)){burst(shot.x,shot.y,'#e6b7a0',7);z.hp-=shot.damage;impact(z,shot,shot.damage);z.hit=.12;shot.life=0;if(z.hp<=0){w.score+=z.boss?500:10;zombieLoot(z);if(z.boss){for(let reward=0;reward<3;reward++)w.drops.push({id:++w.dropSerial,item:randomLoot(Math.max(10,w.wave)),x:z.x+(reward%2?25:-25),y:z.y+(reward>1?20:-20)});w.notice='☠ '+(BOSS_NAMES[z.kind]||'BOSS')+' DEFEATED · BONUS LOOT!';}const p=w.players.find(p=>p.id===shot.owner);if(p)p.kills++;}break;}}}
w.shots=w.shots.filter(b=>b.life>0);w.zombies=w.zombies.filter(z=>z.hp>0);if(w.between<=0&&!w.remaining&&!w.zombies.length){w.between=45;for(const p of w.players)if(p.hp>0)healActor(p,15);}}
function showShop(){
 if(!root)return;
 if(shopOpen&&!shopNearby(world?.players.find(p=>p.id===who())))shopOpen=false;
 if(!shopPanel){shopPanel=document.createElement('section');shopPanel.style.cssText='position:absolute;z-index:30;inset:6% 12%;max-height:88%;overflow:auto;padding:22px;background:#0c211e;border:2px solid #83cea6;border-radius:12px;box-shadow:0 20px 70px #000b;color:#e9f7e8';root.append(shopPanel);}
 shopPanel.style.display=shopOpen?'block':'none';if(!shopOpen){shopStamp='';shopPending=0;return;}
 const p=world.players.find(p=>p.id===who());normalizeCopies(p);
 if(shopPending&&((p.shopSerial||0)>=shopPending||performance.now()-shopPendingAt>2500))shopPending=0;
 const signature=JSON.stringify([p.credits,p.shopSerial,p.inventory,p.itemLevels,world.wave,shopPending]);if(signature===shopStamp)return;shopStamp=signature;
 const scroll=shopPanel.scrollTop;shopPanel.replaceChildren();
 const make=(tag,text,parent=shopPanel)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;parent.append(n);return n;};
 const head=make('div');head.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px';
 make('h2','SECTOR SUPPLY / WEAPON SHOP',head).style.cssText='font-size:23px;margin:0;color:#b6efc5';
 const close=make('button','CLOSE',head);close.onclick=()=>{shopOpen=false;showShop();canvas?.focus();};close.style.cssText='padding:9px;background:#29423c;color:white;border:1px solid #7aab92;border-radius:6px;cursor:pointer';
 make('p','CREDITS: '+(p.credits||0)+' · Sell spare weapons to buy gear and supplies. Stock changes each wave.').style.cssText='color:#dbd6a5;line-height:1.5';
 if(shopPending)make('p','Completing your trade…').style.color='#e6d69f';
 const columns=make('div');columns.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:20px';
 const selling=make('section',undefined,columns),buying=make('section',undefined,columns);
 make('h3','SELL YOUR WEAPONS',selling);
 const weapons=p.inventory.map((id,i)=>({id,i})).filter(x=>itemDefs[x.id]?.type==='weapon');
 for(const {id,i} of weapons){
  const row=make('div',undefined,selling);row.style.cssText='padding:10px;margin:7px 0;background:#1c342b;border:1px solid #426451;border-radius:7px';
  make('div',itemDefs[id].name+' · LV '+levelOf(p,i),row);make('small',WEAPON_TIER_NAMES[weaponTier(id)],row).style.color=WEAPON_TIER_COLORS[weaponTier(id)];
  const sell=make('button','SELL · '+weaponSaleValue(id,levelOf(p,i))+' CREDITS',row);sell.disabled=weapons.length<=1||!!shopPending;sell.style.cssText='display:block;width:100%;padding:8px;margin-top:7px;background:#426d49;color:white;border:1px solid #8dbb83;border-radius:5px;cursor:pointer';
  sell.onclick=()=>requestShop({type:'sell',slot:i,item:id,level:levelOf(p,i)});
 }
 make('small','Keep at least one weapon for protection.',selling).style.color='#b4c7b4';
 make('h3','BUY / WAVE '+world.wave+' STOCK',buying);
 for(const offer of shopOffers()){
  const row=make('div',undefined,buying);row.style.cssText='padding:10px;margin:7px 0;background:#21332f;border:1px solid #4b6b61;border-radius:7px';
  const extra={ammoBox:'48 rounds',medkit:'1 medkit',mints:'2 Care Mints',boards:'2 boards',concrete:'2 barriers',energy:'1 energy drink'}[offer.id]||'Level 1 · '+WEAPON_TIER_NAMES[weaponTier(offer.id)];
  make('div',itemDefs[offer.id].name+' · '+extra,row);
  const buy=make('button','BUY · '+offer.price+' CREDITS',row);buy.disabled=(p.credits||0)<offer.price||!!shopPending;buy.style.cssText='display:block;width:100%;padding:8px;margin-top:7px;background:#385e66;color:white;border:1px solid #8bb4b8;border-radius:5px;cursor:pointer';buy.onclick=()=>requestShop({type:'buy',item:offer.id});
 }
 shopPanel.scrollTop=scroll;
}
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
 const title=make('h2','🎰 CASINO / RARITY ROULETTE',heading);title.style.cssText='margin:0;color:#ffe3a1;font-size:25px';
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
const right=el('main','dz-full-backpack','',layout);el('div','dz-inv-eyebrow','SCAVENGED EQUIPMENT',right);el('h2','','BACKPACK',right);el('p','dz-muted','All weapons start at level 1. Duplicate pickups automatically merge into your highest available copy to raise its level (maximum 5). From wave 5, enter the casino and take a weapon to the roulette table to gamble for the next rarity. Failure destroys the weapon permanently.',right);const grid=el('div','dz-inv-grid','',right);const icons={bat:'🏏',crowbar:'🔧',axe:'🪓',pistol:'🔫',shotgun:'💥',jacket:'🧥',vest:'🦺',heavy:'🛡️'};p.inventory.forEach((id,i)=>{const def=itemDefs[id];if(!def)return;const active=id===p.weapon||id===p.armor;const wrapper=el('div','dz-drop-item','',grid);const tile=el('button','dz-inv-item'+(active?' selected':''),'',wrapper);const tier=rarity(id);tile.style.borderColor=tier.color;tile.style.boxShadow='inset 0 0 0 1px '+tier.color+'55,0 0 14px '+tier.color+'22';el('div','dz-inv-icon',icons[id]||(def.type==='weapon'?(def.range>100?'🔫':'⚔'):'📦'),tile);el('strong','',def.name,tile);el('small','',tier.label+' · '+def.type.toUpperCase()+(active?' · ACTIVE':''),tile);el('small','dz-item-stats',statText(id,i),tile);tile.onclick=()=>{const hand=selectedInventoryHand;if(session.mode==='host')equip(p,i,hand);else emit(session.host,{t:'dz-equip',id:session.id,slot:i,hand});showInventory();};const drop=el('button','dz-drop-button','DROP ITEM',wrapper);drop.disabled=def.type==='weapon'&&p.inventory.filter(v=>itemDefs[v]?.type==='weapon').length<=1;drop.onclick=()=>requestInventoryDrop('gear',i);if(def.type==='weapon'){const level=levelOf(p,i),duplicate=p.inventory.findIndex((v,j)=>j!==i&&v===id);const merge=el('button','dz-merge-button','MERGE DUPLICATE · '+level+'/5',wrapper);merge.disabled=level>=5||duplicate<0;merge.onclick=()=>weaponProgress('merge',i,duplicate);if(nextWeapons(id).length)el('small','dz-evolve-label','🎰 Roulette upgrade available at the wave 5 table',wrapper);else el('small','dz-evolve-label','MAXED MYTHIC',wrapper)}});
el('p','dz-inv-foot','1 / 2: change weapons  ·  Hold Shift: sprint  ·  I: close inventory  ·  B: reinforce doors with boards',right);
function selectHand(hand){selectedInventoryHand=hand;for(const b of slots.children)b.classList.toggle('active',b.dataset.hand===hand);}
for(let i=0;i<slots.children.length;i++){const b=slots.children[i],key=i===0?'primary':'secondary';b.dataset.hand=key;b.onclick=()=>{selectHand(key);if(p[key]){if(session.mode==='host')swapWeapon(p,key);else emit(session.host,{t:'dz-swap',id:session.id,hand:key});}};}
selectHand(selectedInventoryHand);inventoryPanel.scrollTop=scrollPositions.panel;right.scrollTop=scrollPositions.backpack;left.scrollTop=scrollPositions.side;}
function visualHouse(h){if(h.venue){drawVenueHouse(h);return;}const c=['#54615a','#62584d','#555e67','#685849','#4a6158'][h.type||0],floor=['#675f52','#6f6659','#555d5b','#776b5c','#59685f'][h.type||0];ctx.fillStyle='#0c1818';ctx.fillRect(h.x+9,h.y+11,h.w,h.h);ctx.fillStyle=c;ctx.fillRect(h.x,h.y,h.w,h.h);ctx.fillStyle=floor;ctx.fillRect(h.x+11,h.y+11,h.w-22,h.h-22);drawInterior(h);ctx.fillStyle='#393b33';ctx.fillRect(h.x+24,h.y+24,64,25);ctx.fillRect(h.x+h.w-90,h.y+35,65,33);ctx.fillStyle='#90806c';ctx.fillRect(h.x+27,h.y+29,58,9);ctx.fillStyle='#8f9b92';ctx.fillRect(h.x+h.w-70,h.y+h.h-55,48,24);ctx.strokeStyle='#d0c8b5';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(h.x,h.y+h.h);ctx.lineTo(h.x,h.y);ctx.lineTo(h.x+h.w,h.y);ctx.lineTo(h.x+h.w,h.y+h.h);ctx.lineTo(h.doorX+31,h.y+h.h);ctx.moveTo(h.doorX-31,h.y+h.h);ctx.lineTo(h.x,h.y+h.h);ctx.stroke();ctx.strokeStyle='#354e51';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(h.x+25,h.y);ctx.lineTo(h.x+70,h.y);ctx.moveTo(h.x+h.w,h.y+45);ctx.lineTo(h.x+h.w,h.y+85);ctx.stroke();if(h.type===2){ctx.fillStyle='#8b826f';ctx.fillRect(h.x+95,h.y+28,75,45);}if(h.type===3){ctx.fillStyle='#35352f';ctx.fillRect(h.x+14,h.y+82,90,18);}ctx.fillStyle=h.doorHp<=0?'#24211c':h.doorOpen?'#887354':h.boards>=3?'#9c372e':h.boards>=1?'#cd8e36':'#79502d';if(h.doorOpen){ctx.fillRect(h.doorX-34,h.doorY-30,9,35);}else{ctx.fillRect(h.doorX-30,h.doorY-11,60,14);ctx.fillStyle='#c6b16c';for(let b=0;b<(h.boards||0);b++)ctx.fillRect(h.doorX-28,h.doorY-10+b*3,56,2);ctx.fillStyle='#181915';ctx.fillRect(h.doorX-30,h.doorY-19,60,3);ctx.fillStyle=h.doorHp/(h.doorMaxHp||100)>.5?'#6fdb85':'#e9b05e';ctx.fillRect(h.doorX-30,h.doorY-19,60*Math.max(0,Math.min(1,h.doorHp/(h.doorMaxHp||100))),3);}}
function nearbyChest(p){if(!p||!world)return null;let nearest=null,best=80;for(const c of world.chests){if(c.opened)continue;const d=Math.hypot(c.x-p.x,c.y-p.y);if(d<best){best=d;nearest=c;}}return nearest;}
function formatPlaytime(seconds){const n=Math.max(0,Math.floor(Number(seconds)||0)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),sec=n%60;return h>0?[h,m,sec].map(v=>String(v).padStart(2,'0')).join(':'):[m,sec].map(v=>String(v).padStart(2,'0')).join(':');}
let lastDamagePlayer='',lastDamageHp=null,lastDamageWorld=null,hitOverlayAt=-Infinity,hitOverlaySeed=0;
const healingVisuals=new Map();let healingSession=null,healScreenAt=-Infinity;
function drawHealingFeedback(){
 if(healingSession!==session?.id){healingSession=session?.id;healingVisuals.clear();healScreenAt=-Infinity;}
 const now=performance.now(),actors=[...world.players,...(world.verity?[{...world.verity,id:'verity'}]:[])];
 for(const q of actors){
  let v=healingVisuals.get(q.id);
  if(!v){v={serial:q.healSerial||0,total:q.healTotal||0,at:-Infinity,amount:0,x:q.x,y:q.y};healingVisuals.set(q.id,v);}
  if((q.healSerial||0)!==v.serial){v.amount=Math.max(0,(q.healTotal||0)-v.total);v.serial=q.healSerial||0;v.total=q.healTotal||0;v.at=now;v.x=q.x;v.y=q.y;if(q.id===who())healScreenAt=now;}
  const age=(now-v.at)/1000;if(age>=0&&age<.85&&v.amount>0){
   ctx.save();ctx.globalAlpha=1-age/.85;ctx.fillStyle='#82ffad';
   for(let i=0;i<14;i++){const a=i*2.39996,d=7+age*(26+i%4*12);ctx.fillRect(v.x+Math.cos(a)*d-camera.x-1.5,v.y+Math.sin(a)*d-age*16-camera.y-1.5,3,3);}
   ctx.font='bold 15px system-ui';ctx.textAlign='center';ctx.shadowColor='#063b1c';ctx.shadowBlur=4;ctx.fillText('+'+Math.round(v.amount)+' HP',v.x-camera.x,v.y-camera.y-38-age*24);ctx.restore();
  }
 }
 const own=world.players.find(q=>q.id===who());if(!own||own.hp<=0)return;
 function edge(color,alpha){ctx.save();ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(W/2,H/2,130,W/2,H/2,W*.68);g.addColorStop(0,color+'00');g.addColorStop(1,color+'bb');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.restore();}
 if(own.hp<25)edge('#b51922',(.18+.16*(.5+.5*Math.sin(now/240)))*(1-own.hp/30));
 const age=now-healScreenAt;if(age<700)edge('#37df80',.5*Math.pow(1-age/700,1.5));
}
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
function drawCasinoRoof(){
 const h=venue('casino');if(!h||!casinoLocked(h))return;
 // Draw after world actors, loot and particles so nothing inside leaks through.
 ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 ctx.fillStyle='#292332';ctx.fillRect(h.x-6,h.y-6,h.w+12,h.h+12);
 ctx.strokeStyle='#48364f';ctx.lineWidth=2;
 for(let y=h.y+22;y<h.doorY-9;y+=24){ctx.beginPath();ctx.moveTo(h.x+10,y);ctx.lineTo(h.x+h.w-10,y);ctx.stroke();}
 ctx.strokeStyle='#725779';ctx.lineWidth=3;ctx.strokeRect(h.x+9,h.y+9,h.w-18,h.h-18);
 ctx.textAlign='center';ctx.font='bold 18px monospace';ctx.fillStyle='#cfacd9';ctx.fillText('CASINO',h.x+h.w/2,h.y+h.h/2-5);
 ctx.font='bold 11px monospace';ctx.fillStyle='#ddbbd9';ctx.fillText('OPENS AT WAVE 5',h.x+h.w/2,h.y+h.h/2+16);
 ctx.fillStyle='#6d334c';ctx.fillRect(h.doorX-33,h.doorY-8,66,16);
 ctx.fillStyle='#f0c76a';ctx.fillRect(h.doorX-7,h.doorY-8,14,13);ctx.strokeStyle='#f0c76a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(h.doorX,h.doorY-9,5,Math.PI,Math.PI*2);ctx.stroke();
 ctx.restore();
}
function drawRouletteTable(){const h=venue('casino');if(!h||casinoLocked(h))return;const point=roulettePoint();ctx.save();ctx.translate(point.x,point.y);ctx.fillStyle='#080f11ac';ctx.beginPath();ctx.ellipse(5,18,72,33,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#372820';ctx.fillRect(-63,-19,126,44);ctx.fillStyle='#b88d52';ctx.fillRect(-62,-23,124,37);ctx.strokeStyle='#e7bb72';ctx.lineWidth=4;ctx.strokeRect(-62,-23,124,37);const colors=['#839289','#65c884','#579ef5','#b880ed','#ffbd55'];for(let i=0;i<10;i++){const a=i*Math.PI/5;ctx.fillStyle=colors[i%5];ctx.beginPath();ctx.moveTo(0,-5);ctx.arc(0,-5,23,a,a+Math.PI/5);ctx.fill();}ctx.fillStyle='#10171b';ctx.beginPath();ctx.arc(0,-5,6,0,Math.PI*2);ctx.fill();ctx.font='bold 13px monospace';ctx.textAlign='center';ctx.fillStyle='#ffe09c';ctx.fillText('ROULETTE',0,-40);ctx.font='11px monospace';ctx.fillText(world.wave<5?'LOCKED UNTIL WAVE 5':'PRESS '+binds.interact.replace('Key','')+' TO GAMBLE',0,42);ctx.restore();}
function drawScene(){if(!ctx)return;const own=world?.players.find(q=>q.id===who());
 if(session?.id!==lastDamageWorld||own?.id!==lastDamagePlayer){lastDamageWorld=session?.id;lastDamagePlayer=own?.id||'';lastDamageHp=own?.hp??null;hitOverlayAt=-Infinity;}
 else if(own&&lastDamageHp!==null&&own.hp<lastDamageHp&&session?.phase==='play'){hitOverlayAt=performance.now();hitOverlaySeed++;lastDamageHp=own.hp;}
 else if(own)lastDamageHp=own.hp;const living=world?.players.filter(q=>q.hp>0)||[];const p=own?.hp<=0&&living.length?living[spectatorIndex%living.length]:own||world?.players[0];camera.x=Math.max(0,Math.min(MAPW-W,(p?.x??MAPW/2)-W/2));camera.y=Math.max(0,Math.min(MAPH-H,(p?.y??MAPH/2)-H/2));ctx.fillStyle='#25342b';ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(-camera.x,-camera.y);for(let x=Math.floor(camera.x/70)*70;x<camera.x+W+70;x+=70)for(let y=Math.floor(camera.y/70)*70;y<camera.y+H+70;y+=70){const n=Math.abs(Math.sin(x*12.9898+y*78.233));ctx.fillStyle=n>.55?'#3e4937':'#2d3d30';ctx.fillRect(x+n*18,y+n*24,3+n*5,4+n*5);}ctx.fillStyle='#414743';for(let x=90;x<MAPW;x+=500){ctx.fillRect(x-55,0,115,MAPH);ctx.fillStyle='#85837b';ctx.fillRect(x-57,0,3,MAPH);ctx.fillRect(x+58,0,3,MAPH);ctx.fillStyle='#414743';}ctx.fillStyle='#4a4a45';for(let y=65;y<MAPH;y+=430)ctx.fillRect(0,y-43,MAPW,93);ctx.setLineDash([24,22]);ctx.strokeStyle='#c6bfa1';ctx.lineWidth=2;for(let x=90;x<MAPW;x+=500){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,MAPH);ctx.stroke();}for(let y=65;y<MAPH;y+=430){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(MAPW,y);ctx.stroke();}ctx.setLineDash([]);
if(world){drawDistrict();drawBlood();drawParkedCars();for(const h of world.houses){if(h.x>camera.x+W||h.x+h.w<camera.x||h.y>camera.y+H||h.y+h.h<camera.y)continue;visualHouse(h);}
drawConcreteBarriers();drawBarrierPreview();drawRouletteTable();drawCenterBell();drawObjectives();for(const c of world.chests)if(!c.opened){ctx.fillStyle='#a67a3a';ctx.fillRect(c.x-11,c.y-9,22,18);ctx.strokeStyle='#f2d088';ctx.lineWidth=2;ctx.strokeRect(c.x-11,c.y-9,22,18);}
for(const d of world.drops||[]){ctx.fillStyle=d.owner?'#252349d9':'#0a201ac9';ctx.fillRect(d.x-17,d.y-16,34,32);ctx.strokeStyle='#f0d174';ctx.lineWidth=3;ctx.strokeRect(d.x-17,d.y-16,34,32);ctx.fillStyle='#ffda74';ctx.font='bold 17px system-ui';ctx.textAlign='center';ctx.fillText('✦',d.x,d.y+6);ctx.font='11px system-ui';ctx.fillText((d.quantity?d.quantity+' × ':'')+(d.resource==='ammo'?'Ammo':itemDefs[d.item]?.name||'Loot'),d.x,d.y-24);}for(const z of world.zombies){if(z.x<camera.x-65||z.x>camera.x+W+65||z.y<camera.y-65||z.y>camera.y+H+65)continue;drawSurvivor(z,true);if(z.boss){ctx.strokeStyle='#ff5d4d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(z.x,z.y,18+bossSize(z)*14,0,Math.PI*2);ctx.stroke();ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffe9bd';ctx.fillText('☠ '+(BOSS_NAMES[z.kind]||'TITAN'),z.x,z.y-32-bossSize(z)*13);}if(z.hit>0||z.boss){ctx.fillStyle='#cf7763';ctx.fillRect(z.x-(z.boss?48:17),z.y-(z.boss?43+bossSize(z)*12:29),(z.boss?96:34)*Math.max(0,z.hp)/(z.maxHp||z.hp),z.boss?7:3);}}
if(world.verity){drawVerity(world.verity);if(world.verity.state==='down'){const v=world.verity;ctx.save();ctx.strokeStyle='#ffe05a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(v.x,v.y,29+Math.sin(performance.now()/250)*3,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffe05a';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText('✚ REVIVE VERITY',v.x,v.y-56);ctx.restore();}}
for(const q of world.players){if(q.x<camera.x-75||q.x>camera.x+W+75||q.y<camera.y-75||q.y>camera.y+H+75)continue;if(q.hp<=0){ctx.fillStyle='#9e4a47';ctx.beginPath();ctx.arc(q.x,q.y,14,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f7d2d0';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText('DOWN',q.x,q.y-20);continue;}ctx.fillStyle='#091816';ctx.beginPath();ctx.ellipse(q.x+4,q.y+8,16,10,0,0,Math.PI*2);ctx.fill();drawSurvivor(q,false);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.face||0);ctx.translate(9,10);ctx.lineCap='round';const weapon=q.weapon||'bat';if(itemDefs[weapon]?.range<100&&q.swing>0){const progress=1-q.swing/(q.swingTotal||.2);const weight=weaponSwingWeight(weapon),eased=swingEasing(progress,weight);const dir=q.swingDir||1;ctx.rotate(dir*(-1.4+eased*2.8));const alpha=Math.max(0,Math.sin(Math.PI*progress));ctx.strokeStyle='rgba(225,239,200,'+(.12+alpha*.48)+')';ctx.lineWidth=2+alpha*(6+weight*4);ctx.beginPath();ctx.arc(0,0,49,dir<0?-1.2:-.4,dir<0?.4:1.2);ctx.stroke();ctx.strokeStyle='rgba(255,243,188,'+(alpha*.36)+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,57,-.5,.5);ctx.stroke();}const isGun=(itemDefs[weapon]?.range||0)>100;
// Keep weapon artwork proportional to the survivor sprite without changing combat range.
ctx.translate(-Math.min(13,q.recoil||0),0);ctx.rotate(-(q.recoil||0)*.012);ctx.scale(.58,.58);
ctx.lineJoin='round';ctx.lineCap='round';ctx.shadowColor='#060e0c';ctx.shadowBlur=3;ctx.shadowOffsetY=2;
drawWeaponModel(weapon);
ctx.restore();drawMuzzleFlash(q);ctx.fillStyle='#f1f1e5';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText(name(q.id),q.x,q.y-30);ctx.fillStyle='#d65855';ctx.fillRect(q.x-19,q.y-25,38*q.hp/100,4);}
for(const b of world.shots){if(b.kind==='crossbow'){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));ctx.strokeStyle='#d3c9a8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-20,0);ctx.lineTo(0,0);ctx.stroke();ctx.strokeStyle='#a9c8b9';ctx.beginPath();ctx.moveTo(-4,-3);ctx.lineTo(0,0);ctx.lineTo(-4,3);ctx.moveTo(-18,-3);ctx.lineTo(-14,0);ctx.lineTo(-18,3);ctx.stroke();ctx.restore();continue;}const speed=Math.hypot(b.vx,b.vy)||1,ux=b.vx/speed,uy=b.vy/speed;ctx.save();ctx.lineCap='round';ctx.strokeStyle=b.kind==='shotgun'?'#f5bb77aa':'#ffe5a8b3';ctx.lineWidth=b.kind==='shotgun'?3:2.5;ctx.beginPath();ctx.moveTo(b.x-ux*26,b.y-uy*26);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle='#fff6d7';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(b.x-ux*12,b.y-uy*12);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.fillStyle='#fff5c7';ctx.beginPath();ctx.arc(b.x,b.y,2.6,0,Math.PI*2);ctx.fill();ctx.restore();}drawEffects();drawCasinoRoof();updateHUD(p);if(world.ended&&!gameOverShown){gameOverShown=true;shopOpen=false;if(shopPanel)shopPanel.style.display='none';verityOpen=false;if(verityPanel)verityPanel.style.display='none';inventoryOpen=false;if(inventoryPanel)inventoryPanel.style.display='none';localStorage.removeItem(saveKey());screen((world.won?'EXTRACTION COMPLETE · ':'GAME OVER · ')+'Wave '+world.wave+' · Score '+world.score);button('⌂ Return to Start Menu',returnToMenu);}}ctx.restore();drawAtmosphere(p);if(world)drawHealingFeedback();if(own?.hp>0||own?.hp===0)drawHitOverlay(performance.now());drawMissionHUD(p);if(performance.now()-radarClock>=100){radarClock=performance.now();drawMiniMap();}const house=own?.hp>0?nearDoor(own):null,near=own?.hp>0?nearbyChest(own):null,drop=(world?.drops||[]).find(d=>p&&Math.hypot(d.x-p.x,d.y-p.y)<65);
if(session?.phase==='play'&&!world.ended){
const hints=[];const down=world?.players.find(q=>own?.hp>0&&q.id!==own.id&&q.hp<=0&&Math.hypot(q.x-own.x,q.y-own.y)<64);if(down)hints.push({text:'REVIVE '+name(down.id)+' · Hold '+binds.interact.replace('Key','')+'  '+Math.round((own.reviveTarget===down.id?own.reviveHold||0:0)/3*100)+'%',progress:Math.min(1,(own.reviveTarget===down.id?own.reviveHold||0:0)/3),color:'#9ce7b3'});if(own?.hp<=0&&living.length)hints.push({text:'SPECTATING '+name(p.id)+' · Press Tab to switch player',color:'#efc48d'});
if(near)hints.push({text:'CHEST · Hold '+binds.interact.replace('Key','')+' to open  '+Math.round((p?.chestTarget===near.id?p?.chestHold||0:0)/1.25*100)+'%',progress:Math.min(1,(p?.chestTarget===near.id?p?.chestHold||0:0)/1.25),color:'#e8c67a'});
if(drop)hints.push({text:'LOOT · Press '+binds.interact.replace('Key','')+' to pick up '+((drop.quantity?drop.quantity+' × ':'')+(drop.resource==='ammo'?'Ammo':itemDefs[drop.item]?.name||'supplies')),color:'#9fe1ac'});
if(own?.hp>0&&world?.verity&&Math.hypot(own.x-world.verity.x,own.y-world.verity.y)<=72){const v=world.verity;if(v.state==='sleeping')hints.push({text:'VERITY DELIVERY · Press '+binds.interact.replace('Key','')+' to open box & wake him',color:'#ffe087'});else if(v.state==='down')hints.push({text:'✚ REVIVE VERITY · Hold '+binds.interact.replace('Key','')+' · '+Math.round((v.reviveHold||0)/3*100)+'%',progress:Math.min(1,(v.reviveHold||0)/3),color:'#ffd368'});else hints.push({text:'☀ VERITY · G: Inventory / Heal · '+Math.round(v.hp)+' HP',color:'#ffe087'});}
if(shopNearby(own)&&!shopOpen)hints.push({text:'WEAPON SHOP · Press '+binds.interact.replace('Key','')+' to buy / sell · '+(own.credits||0)+' credits',color:'#9fe5b2'});if(rouletteNearby(own)&&!rouletteOpen)hints.push({text:'CASINO · Press '+binds.interact.replace('Key','')+' to use roulette',color:'#dbb6f5'});if(house&&casinoLocked(house))hints.push({text:'CASINO LOCKED · Opens at wave 5',color:'#eab1eb'});else if(house)hints.push({text:'DOOR · '+binds.door.replace('Key','')+' '+(house.doorOpen?'Close':'Open')+'   '+binds.board.replace('Key','')+' Board   '+binds.repair.replace('Key','')+' Repair  🪵'+(p?.boards||0),color:'#d3e3d2'});
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
const motionFields=['x','y','vx','vy','hp','stamina','exhausted','energy','face','swing','swingTotal','swingDir','flash','flashX','flashY','flashAngle','recoil','invuln','reviveHold','reviveTarget','chestHold','chestTarget','chestComplete','attackSerial','healSerial','healTotal','healAt'];
const inventoryFields=['credits','shopSerial','rouletteSerial','rouletteResult','inventory','itemLevels','equippedIndices','weaponLevels','primary','secondary','activeSlot','weapon','armor','ammo','medkits','mints','boards','concrete','energy','kills','color'];
function networkSnapshot(){
 const players=world.players.map(p=>{const q={id:p.id};for(const k of motionFields)if(p[k]!==undefined)q[k]=typeof p[k]==='number'?Math.round(p[k]*1000)/1000:p[k];return q;});
 const zombies=world.zombies.map(z=>[z.netId??(z.netId=world.zombieSerial=(world.zombieSerial||0)+1),Math.round(z.x*10)/10,Math.round(z.y*10)/10,z.hp,z.maxHp,z.kind,z.hit||0,!!z.boss,z.attackPower||1,z.face||0]);
 const shots=world.shots.slice(-32).map(b=>[Math.round(b.x),Math.round(b.y),Math.round(b.vx),Math.round(b.vy),b.life,b.kind,b.owner]);
 const effects=world.effects.slice(-12).map(e=>[e.id,Math.round(e.x),Math.round(e.y),Math.round(e.vx),Math.round(e.vy),e.color,e.life,e.max,e.size,e.blood?1:0,e.ring?1:0,e.radius||0]);
 const ack={};for(const [id,stream]of hostStreams)ack[id]=stream.ack;
 return{t:'dz-state',protocol:2,epoch:inputEpoch,id:session.id,seq:++snapshotSerial,ack,world:{players,zombies,shots,effects,bellLast:world.bellLast,time:world.time,wave:world.wave,score:world.score,remaining:world.remaining,between:world.between,ended:world.ended,won:world.won,story:{...world.story},notice:world.notice,verity:world.verity,verityChat:(world.verityChat||[]).slice(-8),verityChatSerial:world.verityChatSerial||0,mythicCreated:!!world.mythicCreated}};
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
 if(shopOpen)showShop();if(rouletteOpen)showRoulette();if(inventoryOpen){const p=world.players.find(p=>p.id===who()),signature=JSON.stringify(p&&inventoryFields.map(k=>p[k]));if(signature!==lastInventorySignature){lastInventorySignature=signature;showInventory();}}if(verityOpen)showVerityInventory();
}
function receiveSnapshot(d,now){
 if(!world||(inputEpoch&&d.epoch!==inputEpoch)||d.protocol!==2||!Number.isSafeInteger(d.seq)||d.seq<=lastSnapshotSerial||!d.world||!Array.isArray(d.world.players)||d.world.players.length>MAX||!Array.isArray(d.world.zombies)||d.world.zombies.length>100)return;
 lastSnapshotSerial=d.seq;const next=d.world,oldPlayers=new Map(world.players.map(p=>[p.id,p])),oldZombies=new Map(world.zombies.map(z=>[z.netId,z]));
 world.players=next.players.map(value=>Object.assign(oldPlayers.get(value.id)||player(value.id,0),value));
 world.zombies=next.zombies.map(z=>Object.assign(oldZombies.get(z[0])||{},{netId:z[0],x:z[1],y:z[2],hp:z[3],maxHp:z[4],kind:z[5],hit:z[6],boss:z[7],attackPower:z[8]||1,face:z[9]||0}));
 world.shots=(next.shots||[]).map(b=>({x:b[0],y:b[1],vx:b[2],vy:b[3],life:b[4],kind:b[5],owner:b[6]}));
 for(const k of ['time','wave','score','remaining','between','bellLast','ended','won','story','notice','verity','verityChat','verityChatSerial','mythicCreated'])if(next[k]!==undefined)world[k]=next[k];
 for(const e of next.effects||[]){if(guestEffectsSeen.has(e[0]))continue;guestEffectsSeen.add(e[0]);world.effects.push({id:e[0],x:e[1],y:e[2],vx:e[3],vy:e[4],color:e[5],life:e[6],max:e[7],size:e[8],blood:e[9]===1,ring:e[10]===1,radius:e[11]||0});}
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
 const fire=!!localInput.fire,weapon=itemDefs[p?.weapon]||itemDefs.bat;
 if(p?.hp>0&&itemDefs[p.weapon]?.type==='weapon'&&v&&fire&&attackPreview.cool<=0&&(weapon.range<100||p.ammo>0)){
  const face=Math.atan2((localInput.ay??v.y)-v.y,(localInput.ax??v.x+1)-v.x);attackPreview.cool=weapon.cool;
  if(weapon.range<100){attackPreview.swing=attackPreview.swingTotal=Math.min(.62,weapon.cool+.1);attackPreview.swingDir=-(attackPreview.swingDir||1);}
  else{attackPreview.flash=p.weapon==='crossbow'?0:.12;attackPreview.flashX=v.x+Math.cos(face)*46-Math.sin(face)*10;attackPreview.flashY=v.y+Math.sin(face)*46+Math.cos(face)*10;attackPreview.flashAngle=face;for(const spread of shotgunPellets(p.weapon)>1?[-.2,0,.2]:[0])previewShots.push({x:v.x+Math.cos(face)*18,y:v.y+Math.sin(face)*18,vx:Math.cos(face+spread)*730,vy:Math.sin(face+spread)*730,life:Math.min(.25,weapon.range/730),kind:p.weapon,owner:who()});}
 }
 previewFireHeld=fire;
 for(const b of previewShots){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(solid(b.x,b.y,3))b.life=0;}previewShots=previewShots.filter(b=>b.life>0).slice(-24);
}
function draw(){
 announceDeaths();renderVerityChat();if(shopOpen)showShop();if(verityOpen)showVerityInventory();if(rouletteOpen)showRoulette();
 if((session?.mode!=='guest'&&!hostWorker)||!world){drawScene();return;}
 const authority=world,now=performance.now();updateGuestVisuals(now);const age=Math.min(.1,Math.max(0,(now-(remoteSnapshots.samples.at(-1)?.at||now))/1000));
 const view=q=>{const v=guestVisuals.get(q.id!==undefined?'p:'+q.id:'z:'+q.netId),result=v?{...q,x:v.x,y:v.y,face:v.face??q.face,vx:v.vx??q.vx,vy:v.vy??q.vy}:q;return q.id===who()&&q.hp>0?{...result,...(attackPreview.swing>0?{swing:attackPreview.swing,swingTotal:attackPreview.swingTotal,swingDir:attackPreview.swingDir}:{}),...(attackPreview.flash>0?{flash:attackPreview.flash,flashX:attackPreview.flashX,flashY:attackPreview.flashY,flashAngle:attackPreview.flashAngle}:{})}:result;};
 world={...authority,players:authority.players.map(view),zombies:authority.zombies.map(view),shots:[...authority.shots.filter(b=>!previewShots.length||b.owner!==who()).map(b=>({...b,x:b.x+b.vx*age,y:b.y+b.vy*age})),...previewShots]};
 try{drawScene();}finally{world=authority;}
}
function advanceGame(now){
 if(!session||session.phase!=='play'||!world){pumpAt=now;return;}
 if(hostWorker){const paused=!!((pauseOpen||inventoryOpen||verityOpen||rouletteOpen||shopOpen)&&!peers().size);if(paused!==workerPaused){workerPaused=paused;hostWorker.postMessage({type:'pause',paused});}}
 if(!pumpAt){pumpAt=now;return;}const elapsed=Math.max(0,Math.min(.25,(now-pumpAt)/1000));pumpAt=now;
 if(!world.ended){totalPlaytime+=elapsed;totalPlaytimeFlush+=elapsed;if(totalPlaytimeFlush>=5){flushTotalPlaytime();totalPlaytimeFlush=0;}}
 accumulator=Math.min(accumulator+elapsed,Net.STEP*8);
 while(accumulator>=Net.STEP-1e-7){
  const heldFire=localInput.fire;localInput.fire=heldFire||fireTap;
  if(session.mode==='host'&&!hostWorker){if(!((pauseOpen||inventoryOpen||verityOpen||rouletteOpen||shopOpen)&&!peers().size))tick(Net.STEP);}
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
 const sample=document.activeElement===gameChatInput||pauseOpen||inventoryOpen||verityOpen||rouletteOpen||shopOpen||document.hidden?{}:input();
 if(sample.fire&&!previousFireSample)fireTap=true;previousFireSample=!!sample.fire;
 for(const k of edgeKeys)sample[k]=sample[k]||localInput[k];localInput=sample;
 advanceGame(now);
 // A high-refresh display must not multiply canvas work or network traffic.
 if(now-lastDrawAt>=1000/60-1){lastDrawAt=now;draw();}
}
function updateHUD(p){
 if(performance.now()-hudClock<100)return;hudClock=performance.now();
 if(!hudNodes||!labels.firstChild){
  labels.innerHTML='<div class="dz-hud-top"><span class="dz-badge">☣ DEAD ZONE</span><span class="dz-wave">WAVE <b data-dz="wave"></b></span><span class="dz-score" data-dz="score"></span><span class="dz-resource" data-dz="credits"></span><span class="dz-resource" data-dz="time"></span><span class="dz-resource" data-dz="enemies"></span><span class="dz-resource" data-dz="countdown"></span><button id="dzInventoryToggle" class="dz-inventory-toggle" type="button">▣ INVENTORY</button></div><div class="dz-hud-bottom"><div class="dz-health"><small>HEALTH</small><div class="dz-health-track" role="meter" aria-label="Health" aria-valuemin="0" aria-valuemax="100"><i data-dz="hpBar"></i></div><b data-dz="hp"></b></div><div class="dz-health"><small>STAMINA</small><div class="dz-stamina-track"><i data-dz="staminaBar"></i></div><b data-dz="stamina"></b></div><div class="dz-equipped"><small>WEAPON</small><b data-dz="weapon"></b></div><div class="dz-resource" data-dz="armor"></div><div class="dz-resource" data-dz="ammo"></div><div class="dz-resource" data-dz="boards"></div><div class="dz-resource" data-dz="medkits"></div><div class="dz-resource" data-dz="mints"></div><div class="dz-resource" data-dz="energy"></div><div class="dz-equipped"><small>PRIMARY · 1</small><b data-dz="primary"></b></div><div class="dz-equipped"><small>SECONDARY · 2</small><b data-dz="secondary"></b></div></div>';
  hudNodes=Object.fromEntries([...labels.querySelectorAll('[data-dz]')].map(e=>[e.dataset.dz,e]));labels.querySelector('#dzInventoryToggle').onclick=()=>{inventoryOpen=!inventoryOpen;showInventory();};
 }
 const values={credits:'◈ '+(p?.credits||0)+' CREDITS',wave:world.wave,score:'★ '+world.score+' PTS',time:'🕒 '+formatPlaytime(world.time),enemies:'☣ '+(world.zombies.length+world.remaining)+' ENEMIES LEFT',countdown:world.between>0?Math.ceil(world.between)+'s UNTIL WAVE '+(world.wave+1):'WAVE ACTIVE',hp:Math.round(p?.hp||0)+'/100',stamina:Math.round(p?.stamina??100),weapon:itemDefs[p?.weapon]?.name||'Bat',armor:'🛡 '+(itemDefs[p?.armor]?.name||'No armor'),ammo:'▣ '+(p?.ammo||0)+' AMMO',boards:'🪵 '+(p?.boards||0)+' BOARDS',medkits:'🩹 '+(p?.medkits||0)+' MEDKITS',mints:'🍬 '+(p?.mints||0)+' MINTS',energy:'⚡ '+(p?.energy||0)+' ENERGY · AUTO',primary:itemDefs[p?.primary]?.name||'Empty',secondary:itemDefs[p?.secondary]?.name||'Empty'};
 for(const [key,value]of Object.entries(values))if(hudNodes[key].textContent!==String(value))hudNodes[key].textContent=value;
 hudNodes.hpBar.style.width=Math.round(Math.max(0,p?.hp||0))+'%';hudNodes.hpBar.parentElement.setAttribute('aria-valuenow',Math.round(p?.hp||0));hudNodes.staminaBar.style.width=Math.round(p?.stamina??100)+'%';
}

window.deadZoneHandle=(from,d)=>{if(!d||d.v!==1||typeof d.id!=='string')return;if(!state?.friends?.[from]&&d.t!=='dz-join'&&!(session?.mode==='host'&&peers().has(from))&&from!==session?.host)return;
if(d.t==='dz-code-lookup'){if(session?.mode==='host'&&session.phase==='lobby'&&session.code===d.id&&peers().size<MAX-1)emit(from,{t:'dz-code-found',id:session.id,code:session.code});return;}
if(d.t==='dz-code-found'){if(session?.mode==='host'&&session.phase==='lobby'&&pendingJoinCode&&pendingJoinCode===d.code){pendingJoinCode='';join({from,id:d.id});}return;}
if(d.t==='dz-invite'){invite={from,id:d.id};if(session)return;build();const status=document.querySelector('#deadZoneInviteStatus');if(status)status.textContent=name(from)+' invited you to Dead Zone. Open Games → Dead Zone to join.';return;}
if(session?.mode==='host'&&session.phase==='lobby'&&d.t==='dz-join'&&d.id===session.id&&!peers().has(from)&&peers().size<MAX-1){peers().set(from,{ready:false,seen:performance.now(),input:{}});window.deadZoneAuthorizePublicPeer?.(from);}
if(!session||d.id!==session.id)return;if(d.t==='dz-chat'&&typeof d.message==='string'){if(session.mode==='host'){if(!peers().has(from))return;addGameMessage(from,d.message);group({t:'dz-chat',id:session.id,from,message:d.message.slice(0,220)});if(hostWorker)hostWorker.postMessage({type:'verityChat',id:from,message:d.message.slice(0,220)});else verityReplyToPlayer(from,d.message);}else if(from===session.host)addGameMessage(d.from||from,d.message);return;}
if(session.mode==='host'&&hostWorker&&['dz-input','dz-ready','dz-resync','dz-swap','dz-equip','dz-drop','dz-shop','dz-merge','dz-evolve','dz-verity','dz-leave'].includes(d.t)){hostWorker.postMessage({type:'packet',from,packet:d});if(d.t==='dz-leave')peers().delete(from);return;}
if(session.mode==='host'){const g=peers().get(from);if(!g)return;g.seen=performance.now();
if(d.t==='dz-join'){g.ready=true;if(!world.players.some(p=>p.id===from))world.players.push(player(from,world.players.length));group({t:'dz-lobby',id:session.id,players:world.players});lobby();}
if(d.t==='dz-input'&&Array.isArray(d.commands)){if(d.epoch!==g.epoch)return;let stream=hostStreams.get(from);if(!stream){stream=new Net.HostInputs();hostStreams.set(from,stream);}stream.receive(d.commands,performance.now());return;}
if(d.t==='dz-ready'){if(d.epoch!==g.epoch)return;g.netReady=true;return;}
if(d.t==='dz-resync'){if(d.epoch!==g.epoch)return;hostStreams.delete(from);g.netReady=false;g.epoch=crypto.randomUUID();g.startSent=performance.now();emit(from,{t:'dz-start',id:session.id,protocol:2,epoch:g.epoch,world});return;}
if(d.t==='dz-input'&&d.input&&typeof d.input==='object'){const v=d.input;const previous=inputs.get(from)||{};inputs.set(from,{x:Math.max(-1,Math.min(1,Number(v.x)||0)),y:Math.max(-1,Math.min(1,Number(v.y)||0)),ax:Math.max(0,Math.min(MAPW,Number(v.ax)||0)),ay:Math.max(0,Math.min(MAPH,Number(v.ay)||0)),fire:!!v.fire,sprint:!!v.sprint,use:!!v.use,mint:!!v.mint||!!previous.mint,door:!!v.door||!!previous.door,board:!!v.board||!!previous.board,repair:!!v.repair||!!previous.repair,swap:v.swap===1||v.swap===2?v.swap:previous.swap||0});}
if(d.t==='dz-swap'&&(d.hand==='primary'||d.hand==='secondary')){const p=world.players.find(p=>p.id===from);if(p)swapWeapon(p,d.hand);}
if(d.t==='dz-shop'){const p=world.players.find(p=>p.id===from);if(p)shopAction(p,d.request);}if(d.t==='dz-equip'&&Number.isInteger(d.slot)){const p=world.players.find(p=>p.id===from);if(p)equip(p,d.slot,d.hand);}if(d.t==='dz-drop'){const p=world.players.find(p=>p.id===from);if(p)dropInventoryItem(p,d.request);}if(d.t==='dz-merge'){const p=world.players.find(p=>p.id===from);if(p)mergeWeapon(p,d.request);}if(d.t==='dz-evolve'){const p=world.players.find(p=>p.id===from);if(p)evolveWeapon(p,d.request);}if(d.t==='dz-verity'){const p=world.players.find(p=>p.id===from);if(p)verityAction(p,d.request);}
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
 const palette=colors[id]||itemDefs[id]?.effectColors;if(!palette||!world)return;
 const n=id==='chainsaw'?10:weaponTier(id)===5?21:12;
 for(let i=0;i<n;i++){
  const a=angle+(Math.random()-.5)*2.6,d=25+Math.random()*110,vx=Math.cos(a)*d,vy=Math.sin(a)*d;
  const life=.14+Math.random()*.32;
  world.effects.push({id:++world.eventSerial,x:x+Math.cos(angle)*27,y:y+Math.sin(angle)*27,vx,vy,color:palette[i%palette.length],life,max:life,size:1.3+Math.random()*3.2});
 }
 if(world.effects.length>180)world.effects.splice(0,world.effects.length-180);
}
function burst(x,y,color,count){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=30+Math.random()*130;world.effects.push({id:++world.eventSerial,x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,color,life:.25+Math.random()*.4,max:.65,size:1+Math.random()*3});}if(world.effects.length>180)world.effects.splice(0,world.effects.length-180);}
function impact(z,source,damage){
 const id=source.weapon||source.kind,weight=weaponSwingWeight(id);
 const fatal=z.hp<=0,force=Math.min(2.5,.7+damage/65+weight*.35),angle=Math.atan2(z.y-source.y,z.x-source.x);
 // Directional blood spray with varied droplets rather than square confetti.
 for(let i=0,n=Math.min(60,Math.round((fatal?21:11)*(1+weight*.75)));i<n;i++){
  const spread=(Math.random()-.5)*1.65,a=angle+spread,speed=(45+Math.random()*160)*force;
  world.effects.push({id:++world.eventSerial,x:z.x+(Math.random()-.5)*12,y:z.y+(Math.random()-.5)*12,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,color:i%4===0?'#d44742':i%3===0?'#8e1e26':'#ac2833',life:.28+Math.random()*.32,max:.6,size:(1.6+Math.random()*3.8)*(1+weight*.35),blood:true});
 }
 if(world.effects.length>180)world.effects.splice(0,world.effects.length-180);
 world.blood.push({x:z.x,y:z.y,r:((fatal?18:7)+Math.random()*(fatal?9:4))*(1+weight*.95),a:Math.random()*6.28,dead:fatal,seed:Math.random()*1000});
 if(world.blood.length>160)world.blood.shift();const a=Math.atan2(z.y-source.y,z.x-source.x);z.kvx=(z.kvx||0)+Math.cos(a)*Math.min(270+weight*85,90+damage*3+weight*70);z.kvy=(z.kvy||0)+Math.sin(a)*Math.min(270+weight*85,90+damage*3+weight*70);
 if(weaponTier(id)>=4&&damage>=300){
  const attacker=source.owner==='verity'?world.verity:source.owner?world.players.find(p=>p.id===source.owner):source.id?world.players.find(p=>p.id===source.id)||source:source;
  if(attacker&&(world.time||0)-(attacker.lastShockAt??-Infinity)>=.35){
   attacker.lastShockAt=world.time||0;const radius=75+Math.min(1.3,Math.sqrt(damage/900))*55,life=.42;
   world.effects.push({id:++world.eventSerial,x:z.x,y:z.y,vx:0,vy:0,color:itemDefs[id]?.flashColor||'#f4d5a1',life,max:life,size:1,ring:true,radius});
   for(const other of world.zombies){if(other===z||other.hp<=0)continue;const dx=other.x-z.x,dy=other.y-z.y,d=Math.hypot(dx,dy);if(d>1&&d<radius){const push=(1-d/radius)*160;other.kvx=(other.kvx||0)+dx/d*push;other.kvy=(other.kvy||0)+dy/d*push;}}
   if(world.effects.length>180)world.effects.splice(0,world.effects.length-180);
  }
 }
}
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
function drawEffects(){for(const e of world.effects||[]){
 const fade=Math.max(0,e.life/e.max);ctx.globalAlpha=fade;ctx.fillStyle=e.color;
 if(e.ring){ctx.strokeStyle=e.color;ctx.lineWidth=1+fade*4;ctx.beginPath();ctx.ellipse(e.x,e.y,Math.max(1,(e.radius||100)*(1-fade)),Math.max(1,(e.radius||100)*(1-fade)*.65),0,0,Math.PI*2);ctx.stroke();}
 else if(e.blood){ctx.beginPath();ctx.ellipse(e.x,e.y,Math.max(1,e.size*.7),Math.max(1,e.size*.43),Math.atan2(e.vy,e.vx),0,Math.PI*2);ctx.fill();}
 else ctx.fillRect(e.x,e.y,e.size,e.size);
}ctx.globalAlpha=1;}
function drawSurvivor(q,zombie){ctx.save();ctx.translate(q.x,q.y);if(zombie&&q.boss)ctx.scale(bossSize(q),bossSize(q));const a=q.face||0;ctx.rotate(a);const stride=Math.sin((world.time||0)*12+q.x*.02)*(zombie?3:Math.min(3,Math.hypot(q.vx||0,q.vy||0)/70));ctx.fillStyle='#080d10aa';ctx.beginPath();ctx.ellipse(3,7,18,12,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#111b1d';ctx.lineWidth=4;ctx.fillStyle=zombie?((ZOMBIE_TYPES[q.kind]?.color||'#3e554b')):'#3e5963';ctx.fillRect(-12,-11,23,zombie&&q.kind==='brute'?27:23);ctx.strokeRect(-12,-11,23,23);ctx.fillStyle='#1d282b';ctx.fillRect(-12,-12+stride,10,5);ctx.fillRect(-12,8-stride,10,5);ctx.fillStyle=zombie?'#88916c':'#c1a58a';ctx.fillRect(5,-16,9,zombie?5:7);ctx.fillRect(5,10,9,zombie?5:7);ctx.fillStyle=zombie?(q.hit>0?'#f3d2bc':'#9eaa80'):'#c5ad8a';ctx.beginPath();ctx.ellipse(4,0,9,8,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=zombie?'#ac4c42':'#27383a';ctx.fillRect(9,-5,3,3);ctx.fillRect(9,3,3,3);if(!zombie){ctx.fillStyle=q.color;ctx.fillRect(-10,-9,5,18);ctx.fillStyle='#354443';ctx.fillRect(-16,-7,8,14);}ctx.restore();}
function drawInterior(h){ctx.save();ctx.beginPath();ctx.rect(h.x+12,h.y+12,h.w-24,h.h-24);ctx.clip();const clinic=h.type===2;ctx.strokeStyle=clinic?'#80898355':'#272a2655';ctx.lineWidth=1;const tile=clinic?24:17;for(let x=h.x;x<h.x+h.w;x+=tile){ctx.beginPath();ctx.moveTo(x,h.y);ctx.lineTo(x,h.y+h.h);ctx.stroke();}for(let y=h.y;y<h.y+h.h;y+=clinic?24:55){ctx.beginPath();ctx.moveTo(h.x,y);ctx.lineTo(h.x+h.w,y);ctx.stroke();}ctx.fillStyle='#19282c';ctx.fillRect(h.x+22,h.y+23,70,33);ctx.fillStyle=clinic?'#b9b8a3':'#6e8277';ctx.fillRect(h.x+25,h.y+25,64,26);ctx.fillStyle='#c7bda5';ctx.fillRect(h.x+29,h.y+29,14,18);ctx.fillStyle='#654b3a';ctx.fillRect(h.x+h.w-65,h.y+30,40,65);ctx.fillStyle='#26342e';ctx.fillRect(h.x+h.w-62,h.y+33,34,57);ctx.fillStyle='#49483e';ctx.fillRect(h.x+30,h.y+h.h-58,58,28);ctx.fillStyle='#ae9c73';ctx.fillRect(h.x+34,h.y+h.h-56,50,4);ctx.fillStyle='#282e2d';ctx.fillRect(h.x+h.w/2-12,h.y+38,25,22);ctx.fillStyle='#678577';ctx.fillRect(h.x+h.w/2-9,h.y+40,19,14);ctx.fillStyle='#201f1d';ctx.fillRect(h.x+35,h.y+90,44,25);ctx.fillStyle='#8b564444';ctx.fillRect(h.x+39,h.y+94,36,17);ctx.restore();ctx.fillStyle='#e5d9b5';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText(['RESIDENCE','SAFEHOUSE','CLINIC','WORKSHOP','MARKET'][h.type],h.x+h.w/2,h.y-12);}
function drawParkedCars(){
 // Match car collisions: 70 parked cars, visible above the ground and blood stains.
 for(let i=0;i<70;i++){const x=90+(i%7)*500,y=155+Math.floor(i/7)*245;if(x<camera.x-80||x>camera.x+W+80||y<camera.y-90||y>camera.y+H+90)continue;ctx.save();ctx.translate(x,y);ctx.rotate(i%2?.07:-.05);ctx.fillStyle='#111b1c';ctx.fillRect(-23,-41,51,87);ctx.fillStyle=['#4c655c','#725c4c','#596875'][i%3];ctx.fillRect(-21,-40,42,78);ctx.fillStyle='#172429';ctx.fillRect(-14,-24,28,16);ctx.fillRect(-14,16,28,15);ctx.fillStyle='#b8c4c1';ctx.fillRect(-14,-36,28,4);ctx.fillRect(-14,35,28,4);ctx.strokeStyle='#171e20';ctx.lineWidth=3;ctx.strokeRect(-21,-40,42,78);ctx.fillStyle='#22383e';ctx.fillRect(-16,-20,32,17);ctx.fillRect(-16,16,32,12);ctx.fillStyle='#aab8aa';ctx.fillRect(-16,-38,9,3);ctx.fillRect(7,-38,9,3);ctx.fillStyle='#522a2c';ctx.fillRect(-16,35,8,3);ctx.restore();}
}
function drawDistrict(){
 const x0=1550,y0=1070;ctx.fillStyle='#52564f';ctx.fillRect(x0,y0,630,540);ctx.strokeStyle='#313c3b';ctx.lineWidth=1;for(let x=x0;x<x0+630;x+=32){ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x,y0+540);ctx.stroke();}for(let y=y0;y<y0+540;y+=32){ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+630,y);ctx.stroke();}
 ctx.strokeStyle='#c4b78266';ctx.strokeRect(x0+10,y0+10,610,520);ctx.fillStyle='#d6c9a677';ctx.font='bold 26px monospace';ctx.textAlign='center';ctx.fillText('QUARANTINE · SECTOR 07',1865,1110);
 // Seeded street dressing: visible props remain outside house entrances.

 for(let i=0;i<75;i++){const x=(i*617+33)%MAPW,y=(i*367+91)%MAPH;if(x<camera.x||x>camera.x+W||y<camera.y||y>camera.y+H||houseAt(x,y))continue;ctx.fillStyle=i%4?'#7f80625a':'#bac0a080';ctx.fillRect(x,y,3+i%5,2+i%3);}
 // Cracks, tire scuffs, leaf litter and paint give the square a worn surface.
 for(let i=0;i<60;i++){const x=1560+(i*137)%610,y=1080+(i*193)%510;ctx.fillStyle=i%3?'#29352f25':'#c1b99820';ctx.fillRect(x,y,7+i%15,2+i%3);if(i%7===0){ctx.strokeStyle='#1d2a2d66';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+11,y+13);ctx.lineTo(x+6,y+21);ctx.lineTo(x+17,y+34);ctx.stroke();}}
 ctx.save();ctx.strokeStyle='#bcb68a55';ctx.lineWidth=4;ctx.setLineDash([9,6]);ctx.strokeRect(1730,1475,140,110);ctx.setLineDash([]);ctx.font='bold 50px monospace';ctx.fillStyle='#d0c79b66';ctx.textAlign='center';ctx.fillText('H',1800,1550);ctx.restore();
 for(let i=0;i<12;i++){const x=1558+(i%2)*612,y=1150+Math.floor(i/2)*78;ctx.fillStyle='#222e2e';ctx.fillRect(x-5,y-6,10,12);ctx.strokeStyle='#768777';ctx.lineWidth=2;ctx.strokeRect(x-5,y-6,10,12);glow(x,y,65,i%4?'#a5b18d':'#e3a76b');}
 for(const site of missionSites){ctx.fillStyle='#253a37';ctx.fillRect(site.x-18,site.y-17,36,34);ctx.strokeStyle='#9b9d7d';ctx.lineWidth=2;ctx.strokeRect(site.x-18,site.y-17,36,34);}
 ctx.fillStyle='#c5c5a0';ctx.fillRect(2040,1357,20,18);ctx.strokeStyle='#a8afa3';ctx.beginPath();ctx.moveTo(2050,1357);ctx.lineTo(2050,1320);ctx.lineTo(2035,1330);ctx.stroke();
}
function drawCenterBell(){
 const last=world.bellLast??-100,age=(world.time||0)-last;
 ctx.save();ctx.translate(BELL_X,BELL_Y);
 ctx.fillStyle='#1b2624';ctx.fillRect(-23,-22,46,50);ctx.strokeStyle='#c89e51';ctx.lineWidth=4;ctx.strokeRect(-23,-22,46,50);
 ctx.fillStyle='#d6b66e';ctx.beginPath();ctx.arc(0,-30,18,Math.PI,0);ctx.lineTo(20,-5);ctx.lineTo(-20,-5);ctx.closePath();ctx.fill();ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();
 if(age>=0&&age<2.2){ctx.save();ctx.strokeStyle='#ffdd79';ctx.lineWidth=5*(1-age/2.2);ctx.globalAlpha=Math.max(0,1-age/2.2);for(let i=0;i<3;i++){const r=35+age*165-i*34;if(r>0){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();}}ctx.restore();}
 const me=world.players.find(q=>q.id===who());
 if(me&&me.hp>0&&Math.hypot(me.x-BELL_X,me.y-BELL_Y)<115){
  const wait=Math.max(0,12-age),ready=wait<=0;
  ctx.fillStyle='#081913e8';ctx.fillRect(-116,-107,232,32);
  ctx.strokeStyle=ready?'#ffd875':'#818a75';ctx.lineWidth=2;ctx.strokeRect(-116,-107,232,32);
  ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff3cf';
  ctx.fillText(ready?'[E] RING BELL · ATTRACT ZOMBIES':'BELL COOLDOWN · '+Math.ceil(wait)+'s',0,-86);
 }
 ctx.restore();
}
function drawObjectives(){if(world.mode!=='story')return;const site=missionSites[Math.min(2,world.story.stage)],pulse=1+Math.sin((world.time||0)*3)*.08;ctx.save();ctx.strokeStyle='#d8c387';ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.beginPath();ctx.ellipse(site.x,site.y,65*pulse,65*pulse,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#f3dc9f';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillText(site.label,site.x,site.y-80);glow(site.x,site.y,90,'#a8bf85');ctx.restore();}
function drawAtmosphere(p){if(!world||!p)return;ctx.save();const x=p.x-camera.x,y=p.y-camera.y;const g=ctx.createRadialGradient(x,y,75,x,y,540);g.addColorStop(0,'#06101b00');g.addColorStop(.55,'#06101b25');g.addColorStop(1,'#020811ba');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.globalCompositeOperation='screen';ctx.translate(x,y);ctx.rotate(p.face||0);const beam=ctx.createRadialGradient(0,0,10,0,0,260);beam.addColorStop(0,'#e0d5a32a');beam.addColorStop(1,'#e0d5a300');ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,260,-.43,.43);ctx.closePath();ctx.fill();ctx.restore();if(p.invuln>.15){ctx.fillStyle='#cd33331c';ctx.fillRect(0,0,W,H);}}
function drawMiniMap(){if(!world||!miniCanvas)return;const mc=miniCanvas.getContext('2d');const size=260,x=0,y=0,scaleX=(size-20)/MAPW,scaleY=(size-42)/MAPH;mc.clearRect(0,0,size,size);mc.save();mc.fillStyle='#071a18ec';mc.fillRect(x,y,size,size);mc.strokeStyle='#87bba4';mc.lineWidth=2;mc.strokeRect(x+.5,y+.5,size-1,size-1);mc.fillStyle='#d5ead8';mc.textAlign='left';mc.font='bold 10px system-ui';mc.fillText('SECTOR RADAR',x+10,y+13);mc.save();mc.beginPath();mc.rect(x+9,y+20,size-18,size-29);mc.clip();const px=wx=>x+10+wx*scaleX,py=wy=>y+20+wy*scaleY;mc.strokeStyle='#52676277';mc.lineWidth=.6;for(const h of world.houses||[]){mc.strokeRect(px(h.x),py(h.y),h.w*scaleX,h.h*scaleY);if(h.venue){mc.fillStyle=h.venue==='shop'?'#98e2ad':casinoLocked(h)?'#9b6f9e':'#e0a6ff';mc.font='bold 10px monospace';mc.fillText(h.venue==='shop'?'S':'C',px(h.x+h.w/2)-3,py(h.y+h.h/2)+3);}}if(world.wave>=5){mc.fillStyle='#ffc86a';const point=roulettePoint();mc.fillRect(px(point.x)-3,py(point.y)-3,6,6);}for(const b of world.barriers||[]){if(b.hp<=0)continue;mc.save();mc.translate(px(b.x),py(b.y));mc.rotate(b.angle);mc.fillStyle='#d1dad9';mc.fillRect(-3.5,-1.3,7,2.6);mc.restore();}for(const z of world.zombies||[]){if(z.hp<=0)continue;mc.fillStyle=z.boss?'#ffb13b':ZOMBIE_TYPES[z.kind]?.color||'#ff6158';mc.beginPath();mc.arc(px(z.x),py(z.y),4,0,Math.PI*2);mc.fill();}if(world.verity){const v=world.verity;mc.fillStyle=v.state==='down'?'#ff503e':'#ffe05a';mc.beginPath();mc.arc(px(v.x),py(v.y),v.state==='down'?6:4,0,Math.PI*2);mc.fill();if(v.state==='down'){mc.strokeStyle='#fff1aa';mc.lineWidth=1.5;mc.beginPath();mc.arc(px(v.x),py(v.y),9,0,Math.PI*2);mc.stroke();mc.fillStyle='#fff1aa';mc.font='bold 9px system-ui';mc.fillText('VERITY',px(v.x)+8,py(v.y)-7);}}for(const teammate of world.players||[]){mc.fillStyle=teammate.hp<=0?'#858585':teammate.id===who()?'#ffffff':'#5fbeff';mc.beginPath();mc.arc(px(teammate.x),py(teammate.y),teammate.id===who()?4:3,0,Math.PI*2);mc.fill();}mc.restore();mc.font='9px system-ui';mc.fillStyle='#d6e8dd';mc.fillText('● YOU / TEAM / INFECTED   S SHOP   C CASINO',x+9,y+size-5);mc.restore();}
function drawMissionHUD(p){if(!world||!p)return;ctx.save();ctx.fillStyle='#101a20e8';ctx.fillRect(18,18,340,74);ctx.fillStyle='#d4b67b';ctx.font='bold 10px monospace';ctx.textAlign='left';ctx.fillText(world.mode==='story'?'LAST SIGNAL / STORY':'SECTOR 07 / ENDLESS',30,36);ctx.font='bold 13px monospace';ctx.fillStyle='#eee5cf';const m=world.story;ctx.fillText(world.mode==='story'?['Recover the emergency cache','Restore the district radio','Hold the evacuation zone'][Math.min(2,m.stage)]:'Survive. Scavenge. Fortify.',30,56);ctx.font='11px monospace';ctx.fillStyle='#b1c5bc';if(world.mode==='story'){const site=missionSites[Math.min(2,m.stage)],d=Math.hypot(p.x-site.x,p.y-site.y);ctx.fillText((d<70?(m.stage<2?binds.interact.replace('Key','')+': Hold to interact':'Stay inside the marked zone'):Math.round(d)+'m to objective')+' · '+(m.stage<2?Math.floor(m.hold/(m.stage?4:2)*100)+'%':Math.floor(m.defense)+'/45s'),30,77);if(d>90){const a=Math.atan2(site.y-p.y,site.x-p.x);ctx.translate(W/2+Math.cos(a)*210,H/2+Math.sin(a)*150);ctx.rotate(a);ctx.fillStyle='#efce85';ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-7,-7);ctx.lineTo(-7,7);ctx.fill();}}else ctx.fillText(world.wave>=10&&world.verity?.state==='sleeping'?'GO TO THE MIDDLE · WAKE VERITY (E)':world.verity?.state==='down'?'VERITY DOWN · HOLD E TO REVIVE':'Wave '+world.wave+' · '+(world.between>0?'Resupply in '+Math.ceil(world.between)+'s':'Horde approaching'),30,77);ctx.restore();}

if(window.__DEAD_ZONE_WORKER__)window.deadZoneWorker={
 initialize(data){session={mode:'host',phase:'play',id:data.session.id,host:data.host,gameMode:data.session.gameMode,difficulty:data.session.difficulty,peers:new Map(data.peers.map(id=>[id,{}]))};world=data.world;ensureVenues(world);startNetworkMatch();inputEpoch=data.hostEpoch||'';},
 getWorld:()=>world,
 input(commands,epoch){if(epoch!==inputEpoch)return;let stream=hostStreams.get(who());if(!stream){stream=new Net.HostInputs();hostStreams.set(who(),stream);}stream.receive(commands,performance.now());},
 equip(id,slot,hand){const p=world.players.find(p=>p.id===id);if(p)equip(p,slot,hand);},
 swap(id,hand){const p=world.players.find(p=>p.id===id);if(p)swapWeapon(p,hand);},
 shop(id,request){const p=world.players.find(p=>p.id===id);if(p)shopAction(p,request);},drop(id,request){const p=world.players.find(p=>p.id===id);if(p)dropInventoryItem(p,request);},verity(id,request){const p=world.players.find(p=>p.id===id);if(p)verityAction(p,request);},verityChat(id,message){verityReplyToPlayer(id,message);},merge(id,request){const p=world.players.find(p=>p.id===id);if(p)mergeWeapon(p,request);},evolve(id,request){const p=world.players.find(p=>p.id===id);if(p)evolveWeapon(p,request);},
 setPaused(value){pauseOpen=!!value;}
};
function releaseControls(){keys.clear();mouse.down=false;localInput={};fireTap=previousFireSample=false;}
if(typeof document!=='undefined')document.addEventListener?.('visibilitychange',()=>{if(document.hidden)releaseControls();});
window.addEventListener?.('blur',releaseControls);
window.openDeadZone=open;window.closeDeadZone=close;
})();
