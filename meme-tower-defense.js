(function MemeTowerDefense(){
"use strict";
const MAPS={
 city:{name:"Brainrot City",emoji:"🌆",path:[[0,270],[125,270],[125,90],[315,90],[315,430],[515,430],[515,180],[705,180],[705,350],[900,350]],theme:["#294d63","#315b53","#25485a"]},
 subway:{name:"Subway 67",emoji:"🚇",path:[[0,270],[170,270],[170,95],[450,95],[450,460],[715,460],[715,180],[900,180]],theme:["#38374d","#474257","#253b55"]},
 desert:{name:"Sahur Desert",emoji:"🏜️",path:[[0,160],[220,160],[220,410],[425,410],[425,150],[630,150],[630,380],[900,380]],theme:["#76543f","#9b7753","#4e5145"]},
 mall:{name:"Rizz Mall",emoji:"🛍️",path:[[0,360],[160,360],[160,170],[365,170],[365,370],[585,370],[585,125],[785,125],[785,360],[900,360]],theme:["#444272","#435e79","#2d486a"]},
 void:{name:"Aura Void",emoji:"🌌",path:[[0,270],[145,270],[145,445],[340,445],[340,135],[575,135],[575,405],[760,405],[760,230],[900,230]],theme:["#25264c","#43336e","#1c3a56"]},
arcade:{name:"Retro Arcade",emoji:"🕹️",path:[[0,320],[140,320],[140,110],[340,110],[340,410],[550,410],[550,145],[740,145],[740,375],[900,375]],theme:["#312b54","#45315a","#1d4a5b"]},
factory:{name:"Brainrot Factory",emoji:"🏭",path:[[0,235],[195,235],[195,440],[410,440],[410,120],[620,120],[620,330],[790,330],[790,185],[900,185]],theme:["#454f52","#374953","#2a3e4d"]}
};
let PATH=MAPS.city.path;
function applyMap(map){const key=Object.hasOwn(MAPS,map)?map:"city";PATH=MAPS[key].path;mapCache=null;return key}
const STARTERS=["67","tung","shark"];
const RARITY={67:"starter",tung:"starter",shark:"starter",coffee:"common",croc:"rare",pat:"rare",banana:"epic",sigma:"epic",verity:"mythic",capy:"common",bomb:"rare",cheese:"common",chill:"rare",frog:"epic",noob:"common",doge:"rare",skibidi:"epic",cat:"common",galaxy:"legendary",ghost:"epic",tral:"legendary",laser:"legendary",npc:"common",sigma2:"mythic",duck:"rare",matcha:"rare",chicken:"common",pigeon:"common",plush:"rare",drum:"epic",mango:"epic",rocket:"epic",orbit:"legendary",diamond:"legendary",king:"mythic",echo:"legendary",zero:"mythic"};
const RARITY_COLOR={starter:"#9bacbb",common:"#91e8b6",rare:"#7aaaff",epic:"#c999ff",legendary:"#ffca72",mythic:"#ff8fc2"};
const PROFILE_KEY="discard-mtd-profile-v2";
const TOWER_LIMITS={starter:10,common:8,rare:5,epic:3,legendary:2,mythic:1};
function towerLimit(type){return TOWER_LIMITS[RARITY[type]||"common"]||5}
function deployed(type){return game?.towers?.filter(t=>t.type===type).length||0}
function crateEligibility(crate,p=profileData()){const level=levelFor(p.xp),best=Number(records().highestWave)||0;
 if(level<(crate.minLevel||1))return "Reach level "+crate.minLevel;
 if(best<(crate.minWave||0))return "Reach wave "+crate.minWave;
 if(p.coins<crate.cost)return "Need "+(crate.cost-p.coins).toLocaleString()+" more coins";
 return "";
}

let profile=null,menuTab="play",selectedCrate="standard",lastMenuSignature="",lastSelectionId=null;
function profileData(){if(profile)return profile;try{profile=JSON.parse(localStorage.getItem(PROFILE_KEY)||"null")}catch{};if(!profile||!Array.isArray(profile.unlocked))profile={coins:200,unlocked:[...STARTERS],crates:0,duplicates:0};profile.coins=Math.max(0,Number(profile.coins)||0);profile.unlocked=[...new Set([...STARTERS,...profile.unlocked.filter(x=>typeof x==="string")])];profile.xp=Math.max(0,Number(profile.xp)||0);profile.equipped=Array.isArray(profile.equipped)?[...new Set(profile.equipped.filter(x=>profile.unlocked.includes(x)))].slice(0,slotsFor(levelFor(profile.xp))):[...STARTERS];return profile}
function levelFor(xp){return Math.max(1,Math.floor(Math.sqrt(Math.max(0,xp)/110))+1)}
function slotsFor(level){return 3+(level>=5?1:0)+(level>=10?1:0)+(level>=20?1:0)+(level>=35?1:0)}
function saveProfile(){try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profileData()))}catch{}}
function owned(unit){return profileData().unlocked.includes(unit)}
function toggleEquip(unit){if(game&&!game.ended){notify("Change your loadout before starting a new match.");return}const p=profileData();if(!p.unlocked.includes(unit))return;const i=p.equipped.indexOf(unit);if(i>=0){p.equipped.splice(i,1);if(selected===unit)selected=null}else if(p.equipped.length<slotsFor(levelFor(p.xp)))p.equipped.push(unit);else{notify("Level "+levelFor(p.xp)+" allows "+slotsFor(levelFor(p.xp))+" towers. Unequip one first.");return}saveProfile();renderMenu(true);renderUnits();ui()}
function grantCoins(amount){const p=profileData();p.coins+=Math.max(0,Math.floor(amount));saveProfile()}
function allCrates(){return [
{id:"standard",name:"Starter Crate",icon:"🎁",cost:300,minWave:0,minLevel:1,weights:{common:100},desc:"Affordable early-game towers."},
{id:"viral",name:"Viral Crate",icon:"📱",cost:850,minWave:5,minLevel:2,weights:{common:75,rare:24,epic:1},desc:"Unlock wave 5 for a chance at rare."},
{id:"rare",name:"Rare Crate",icon:"💠",cost:1750,minWave:10,minLevel:4,weights:{common:20,rare:70,epic:10},desc:"Reach wave 10 to unlock."},
{id:"epic",name:"Epic Crate",icon:"🔮",cost:3700,minWave:15,minLevel:7,weights:{rare:57,epic:41,legendary:2},desc:"Serious mid-game investment."},
{id:"premium",name:"Legend Crate",icon:"🏆",cost:7800,minWave:25,minLevel:11,weights:{epic:77,legendary:22,mythic:1},desc:"Wave 25 required; legendary odds 22%."},
{id:"omega",name:"Omega Crate",icon:"🌌",cost:13500,minWave:35,minLevel:17,weights:{epic:33,legendary:64,mythic:3},desc:"Late-game legend hunters."},
{id:"mythic",name:"Mythic Crate",icon:"👑",cost:24000,minWave:40,minLevel:22,weights:{legendary:90,mythic:10},desc:"Victory-tier crate. Mythics stay rare."}
]}
function openCrate(id){const p=profileData(),crate=allCrates().find(x=>x.id===id);if(!crate)return;const blocked=crateEligibility(crate,p);if(blocked){notify(blocked+" to open "+crate.name);return}p.coins-=crate.cost;p.crates++;const rarityRoll=Math.random()*100;let rarity="common",cumulative=0;for(const [tier,chance] of Object.entries(crate.weights)){cumulative+=chance;if(rarityRoll<cumulative){rarity=tier;break}}
let pool=UNITS.filter(u=>RARITY[u[0]]===rarity),unit=pool[Math.floor(Math.random()*pool.length)];if(!unit){unit=UNITS.find(u=>!owned(u[0]));rarity=RARITY[unit?.[0]]||"common"}if(!unit){p.coins+=Math.round(crate.cost*.5);saveProfile();renderMenu(true);return}
const duplicate=owned(unit[0]);if(duplicate){const refund=Math.floor(crate.cost*.15);p.coins+=refund;p.duplicates++;notify("Duplicate "+unit[1]+" · +"+refund+" coins")}else{p.unlocked.push(unit[0]);notify("UNLOCKED "+unit[1]+"!")}
saveProfile();$("#mtdCrateResult").textContent=(duplicate?"DUPLICATE · ":"NEW UNIT · ")+unit[2]+" "+unit[1]+" ["+rarity.toUpperCase()+"]";renderMenu(true);renderUnits()}
function waveReward(w){if(!game)return;const rate={easy:.8,normal:1,hard:1.2,impossible:1.45}[game.difficulty]||1;const amount=Math.round((18+w*4+(w%10===0?120+w*8:0))*rate);const key="discard-mtd-reward-"+(game.runId||game.code)+"-"+w;try{if(localStorage.getItem(key))return;localStorage.setItem(key,"1")}catch{}grantCoins(amount);const p=profileData(),oldLevel=levelFor(p.xp);p.xp+=15+w*5;saveProfile();if(levelFor(p.xp)>oldLevel)notify("LEVEL UP! "+levelFor(p.xp)+" · "+slotsFor(levelFor(p.xp))+" slots");else notify("Wave "+w+" · +"+amount+" coins · +"+(15+w*5)+" XP");renderMenu(true)}
function setRoomMap(map){if(game&&host())return;applyMap(map)}
const UNITS=[
["67","67 Kid","🙌",160,16,125,.48,"#ffd47b"],
["tung","Tung Tung Sahur","🪵",270,50,95,1.1,"#d8ad87"],
["shark","Tralalero Tralala","🦈",380,36,160,.44,"#8ce1ff"],
["coffee","Ballerina Cappuccina","☕",490,25,145,.28,"#f9abdd"],
["croc","Bombardiro Crocodilo","🐊",760,125,195,1.7,"#a1e698"],
["pat","Brr Brr Patapim","🌳",920,82,157,.78,"#b8ef83"],
["banana","Chimpanzini Bananini","🍌",1100,132,170,1.05,"#fae48d"],
["sigma","Sigma Rizz","🗿",1430,85,205,.29,"#7bdce9"],
["verity","VARITY","🤖",1750,180,260,.6,"#b3a4ff"],
["capy","Chill Capybara","🦫",220,21,135,.62,"#addeb2"],
["bomb","Bomboclat Bomber","💣",810,110,180,1.45,"#f2a3a3"],
["cheese","Cheese Tax","🧀",340,27,120,.5,"#f3da79"],
["chill","Just a Chill Guy","😎",690,55,180,.72,"#71cba9"],
["frog","Frog of Wisdom","🐸",1250,92,205,.58,"#8bec95"],
["noob","Noob Army","🟨",270,25,150,.49,"#f4ec83"],
["doge","Doge Coin","🐕",780,58,168,.51,"#eeb96c"],
["skibidi","Skibidi Speaker","🚽",1320,117,205,.95,"#b2dfff"],
["cat","Oiiaio Cat","🐈",430,24,165,.36,"#ffb8a0"],
["galaxy","Galaxy Brain","🧠",1950,208,235,.83,"#c9b5ff"],
["ghost","Hawk Tuah Ghost","👻",1120,87,185,.48,"#b6deff"],
["tral","Tralalero King","👑",2200,238,245,1.1,"#f5d279"],
["laser","Aura Laser","🔮",2400,157,285,.39,"#a8a6ff"],
["npc","NPC Stream","📱",490,40,130,.55,"#b9e0ff"],
["sigma2","Final Sigma","🗿",2950,310,260,.82,"#ff9ec6"],
["duck","Giga Duck","🦆",800,75,184,.75,"#fee08d"],
["matcha","Matcha Assassin","🍵",660,46,183,.3,"#9ee9ad"],
["chicken","Chicken Jockey","🐔",450,36,140,.46,"#f0d186"],
["pigeon","Pigeon Spy","🕊️",340,17,220,.22,"#bddff5"],
["plush","Plushie Commander","🧸",570,42,175,.68,"#e3acbd"],
["drum","Sahur Drummer","🥁",1030,84,190,.72,"#dfab79"],
["mango","Mango Mango","🥭",1150,110,205,.88,"#ffce71"],
["rocket","Rocket Rizz","🚀",1550,152,230,1.1,"#ee9dc4"],
["orbit","Orbit Brain","🪐",2100,185,260,.63,"#a7b9f8"],
["diamond","Diamond Aura","💎",2550,250,275,.9,"#a3e8ff"],
["king","Meme Monarch","👑",3100,345,265,1.02,"#ffdd8e"],
["echo","Echo of 67","🔊",1800,140,245,.49,"#c7b3ff"],
["zero","Zero Braincell","🫥",3450,390,295,1.05,"#efb4ff"]];
const BADS=[["😐",65,54,14],["💈",135,72,20],["🙌",200,97,28],["🌀",370,65,43],["👴",720,50,65],["🍗",1060,70,95],["🗿",1680,42,135],["💀",2400,60,200],["🚽",2950,72,205],["🦆",3250,87,245],["🐸",3850,53,300],["🦫",4200,47,335],["🧀",4850,63,390],["😎",5600,100,430],["🐈",6600,93,485],["📱",7250,75,520],["🪨",8600,42,650],["👑",9500,48,690],["🎭",11200,79,820],["🤖",16000,45,980],["🍵",19000,105,1060],["🐔",23000,135,1120],["🧸",27000,38,1200],["🦋",31000,120,1320],["🦍",36000,42,1420],["🪐",41000,58,1560],["👽",49000,72,1640],["🥭",55000,82,1800],["💎",63000,46,2000],["🐲",74000,53,2200]];
let root,canvas,ctx,game=null,offers=new Map(),selected=null,picked=null,raf=0,last=0,networkAt=0,joinTime=0,alertText="",lastUI=0,joinRetryAt=0,hostOfferAt=0,gameClock=0,selectedTarget="first",chatLog=[],chatRate=new Map(),chatUnread=0,lastChatAt=0,hover=null,particles=[],screenShake=0,joinRetry=0,localStart=0,playClock=0,backgroundCanvas=null;
const PLAYTIME_KEY="discard-meme-td-seconds";
function secondsPlayed(){let stored=0;try{stored=Number(localStorage.getItem(PLAYTIME_KEY))||0}catch{}return stored+(localStart?(Date.now()-localStart)/1000:0)}
function updatePlaytime(){const el=document.querySelector("#hubMemeTDPlaytime");if(el){const m=Math.floor(secondsPlayed()/60);el.textContent=Math.floor(m/60)+"h "+m%60+"m played"}const live=root?.querySelector("#mtdPlaytime");if(live){const m=Math.floor(secondsPlayed()/60);live.textContent="Played "+Math.floor(m/60)+"h "+m%60+"m"}}
function stopPlaytime(){if(!localStart)return;try{localStorage.setItem(PLAYTIME_KEY,String(secondsPlayed()))}catch{}localStart=0;updatePlaytime()}
window.updateMemeTDPlaytime=updatePlaytime;
window.addEventListener("pagehide",stopPlaytime);
window.addEventListener("beforeunload",stopPlaytime);
const $=q=>root.querySelector(q),id=()=>window.mtdNetwork?.id||"local",friends=()=>window.mtdNetwork?.friends||[],send=(to,d)=>window.mtdNetwork?.send(to,d),host=()=>game&&game.host===id();
function css(){
const style=document.createElement("style");style.textContent=`
#mtdRoot{position:fixed;inset:0;z-index:1250;background:#0a1327;color:#ebf1ff;font:14px system-ui}#mtdRoot.hidden{display:none}#mtdRoot *{box-sizing:border-box}#mtdRoot button{color:inherit;background:#213656;border:1px solid #49668f;padding:9px;border-radius:8px;cursor:pointer;font:inherit}#mtdRoot button:hover{background:#3b5780}#mtdRoot button.active{background:#6754a0;border-color:#c8aaff}#mtdRoot .app{height:100%;display:flex;flex-direction:column}#mtdRoot header{background:#162542;padding:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}#mtdRoot header strong{font-size:20px}#mtdRoot header button:first-of-type{margin-left:auto}#mtdRoot .body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 235px}#mtdRoot .stage{background:radial-gradient(#25455b,#0b1729);display:grid;place-items:center;min-width:0;min-height:0}#mtdRoot canvas{width:min(100%,calc((100dvh - 130px)*1.6));max-height:100%;aspect-ratio:900/560;border:2px solid #61738c;touch-action:none}#mtdRoot aside{background:#162641;overflow:auto;padding:11px}#mtdRoot h3{font-size:12px;letter-spacing:.1em;color:#acbfe2;margin:13px 0 7px}#mtdRoot .units{display:grid;gap:6px}#mtdRoot .unit{width:100%;display:flex;align-items:center;gap:7px;text-align:left}#mtdRoot .unit span{font-size:25px}#mtdRoot .unit small{font-size:11px;color:#b9c5e1}#mtdRoot .actions{display:flex;gap:6px;flex-wrap:wrap}#mtdRoot .actions button{flex:1}#mtdRoot .lobby{position:absolute;inset:48px 0 0;background:#0a1228ec;display:grid;place-items:center;padding:16px}#mtdRoot .lobby.hidden{display:none}#mtdRoot .panel{background:#1d2e4d;border:1px solid #6e80a6;border-radius:16px;padding:22px;width:min(550px,95vw);max-height:90%;overflow:auto}#mtdRoot .panel input{background:#0d1d37;color:white;border:1px solid #647aa4;padding:10px;border-radius:9px;width:145px;letter-spacing:.12em;text-transform:uppercase}#mtdRoot .panel p{color:#bfcee7;line-height:1.5}@media(max-width:760px){#mtdRoot .body{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) 190px}#mtdRoot .units{display:flex;overflow-x:auto}#mtdRoot .unit{min-width:145px}#mtdRoot header strong{font-size:15px}#mtdRoot aside{padding:7px}#mtdRoot h3{margin:3px 0}}`;
style.textContent+=`
#mtdRoot .body{grid-template-columns:270px minmax(0,1fr)}
#mtdRoot aside{grid-column:1;grid-row:1;display:flex;flex-direction:column;gap:5px;scrollbar-width:thin;padding:12px}
#mtdRoot .stage{grid-column:2;grid-row:1;position:relative;overflow:hidden}
#mtdRoot .tower-panel{background:linear-gradient(150deg,#293f65,#1c2948);border:1px solid #627bb1;border-radius:13px;padding:11px;margin-bottom:8px;flex-shrink:0}
#mtdRoot .tower-panel h3{margin:0 0 8px;color:#e4ebff;font-size:14px}
#mtdRoot .tower-panel .actions{margin:6px 0}
#mtdRoot .tower-panel button{font-size:12px;min-height:37px}
#mtdRoot .tower-panel button:disabled,#mtdRoot .game-controls button:disabled{opacity:.43;cursor:not-allowed}
#mtdRoot .units{display:grid;grid-template-columns:1fr;gap:5px}
#mtdRoot .unit{padding:6px 8px;min-height:49px}
#mtdRoot .unit.locked{opacity:.6;filter:grayscale(.8)}
#mtdRoot .unit .rarity{font-size:9px;font-weight:700;letter-spacing:.09em}
#mtdRoot .game-controls{position:absolute;right:12px;bottom:12px;z-index:6;background:#0a1636e8;padding:10px;border:1px solid #7187bb;border-radius:15px;box-shadow:0 8px 35px #0008;display:flex;flex-direction:column;gap:6px;min-width:205px}
#mtdRoot .game-controls .actions{display:flex;gap:6px}
#mtdRoot .game-controls button{font-weight:700;min-height:40px}
#mtdRoot #mtdWave{background:#267c70;border-color:#57cfb8}
#mtdRoot .lobby{background:radial-gradient(circle at 45% 10%,#263965f8,#071325f8 75%);overflow:auto;align-items:start}
#mtdRoot .panel{width:min(950px,95vw);max-height:unset;overflow:visible;background:linear-gradient(145deg,#1c2b4e,#131c36);border-color:#5775ac;box-shadow:0 15px 70px #0009}
#mtdRoot .menu-hero{background:linear-gradient(110deg,#5548a4,#1d5374);border-radius:14px;padding:18px;margin-bottom:12px}
#mtdRoot .menu-hero h2{font-size:29px;margin:0}
#mtdRoot .menu-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}
#mtdRoot .menu-stats div{background:#0c1a35;border:1px solid #40577c;border-radius:12px;padding:12px}
#mtdRoot .menu-stats strong{font-size:21px;display:block;color:#fff}
#mtdRoot .menu-stats small{color:#a6bada;font-size:11px}
#mtdRoot .menu-tabs{display:flex;gap:7px;margin:12px 0}
#mtdRoot .menu-tabs button{flex:1}
#mtdRoot .menu-tabs button.active{background:#554bae}
#mtdRoot .menu-page[hidden]{display:none}
#mtdRoot .map-picker{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:9px 0 14px}
#mtdRoot .map-picker button{min-height:66px;text-align:center}
#mtdRoot .map-picker button.active{border-color:#e1ceff;background:#424275}
#mtdRoot .crate-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
#mtdRoot .crate-card{padding:14px;border:1px solid #67739b;border-radius:14px;background:#17284a}
#mtdRoot .crate-card strong{display:block;font-size:16px}
#mtdRoot .crate-card p{font-size:12px}
#mtdRoot .collection{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;max-height:300px;overflow:auto}
#mtdRoot .collection div{background:#14233d;border:1px solid #455e87;padding:9px;border-radius:10px}
#mtdRoot .collection div.locked{opacity:.55}
#mtdRoot .collection small{font-size:11px;display:block}
#mtdRoot #mtdCrateResult{font-size:18px;color:#ffe29a;font-weight:800}
#mtdRoot select{background:#11213d;color:white;border:1px solid #57729b;border-radius:8px;padding:9px}
@media(max-width:760px){#mtdRoot .body{grid-template-columns:130px minmax(0,1fr);grid-template-rows:1fr}#mtdRoot aside{grid-column:1;grid-row:1;overflow:auto}#mtdRoot .stage{grid-column:2;grid-row:1}#mtdRoot .units{display:grid;grid-template-columns:1fr}#mtdRoot .unit{min-width:0}#mtdRoot .unit span{font-size:18px}#mtdRoot .unit small{font-size:9px}#mtdRoot .game-controls{right:4px;bottom:4px;min-width:0;width:min(210px,95%);padding:5px}#mtdRoot .game-controls button{min-height:31px;font-size:11px;padding:4px}#mtdRoot .map-picker{grid-template-columns:repeat(3,1fr)}#mtdRoot .menu-stats{grid-template-columns:repeat(2,1fr)}#mtdRoot .crate-grid{grid-template-columns:1fr}#mtdRoot .panel{padding:12px}}
`;style.textContent+="\n#mtdRoot .menu-hero{position:relative;overflow:hidden;background:linear-gradient(115deg,#5339aa,#25528c 66%,#197581);min-height:135px;border:1px solid #839bd4}\n#mtdRoot .menu-hero:after{content:\"🗿 🙌 🧠\";position:absolute;right:12px;top:12px;font-size:42px;opacity:.65}\n#mtdRoot .menu-hero h2{font-size:clamp(23px,4vw,35px);position:relative;z-index:1}\n#mtdRoot .menu-hero p{position:relative;z-index:1;max-width:70%}\n#mtdRoot .menu-stats div{background:linear-gradient(145deg,#13264a,#29436c);border-color:#6884b0}\n#mtdRoot .menu-tabs button{min-height:44px;font-weight:800}\n#mtdRoot .map-picker button{min-height:83px;font-weight:700;background:linear-gradient(145deg,#2b4371,#182748)}\n#mtdRoot .menu-note{border:1px solid #627cab;background:#152d4d;padding:12px;border-radius:12px;margin:10px 0}\n#mtdRoot .unit-none{border-style:dashed;min-height:47px;justify-content:center;font-weight:800}\n#mtdRoot .unit-none.active{background:#3e6969;border-color:#6ef0c3}\n#mtdRoot .unit.active{background:#5a50a0;border-color:#bfaaff}\n#mtdRoot .chat-panel{position:absolute;left:10px;bottom:10px;width:min(335px,47%);height:224px;max-height:48%;z-index:7;border-radius:12px;border:1px solid #768ab8;background:#0b192fe8;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 28px #0008}\n#mtdRoot .chat-panel.collapsed{height:42px}\n#mtdRoot .chat-header{display:flex;align-items:center;justify-content:space-between;background:#263d64;padding:7px 10px;font-weight:800}\n#mtdRoot .chat-header button{padding:3px 9px}\n#mtdRoot .chat-panel.collapsed .chat-body,#mtdRoot .chat-panel.collapsed .chat-form{display:none}\n#mtdRoot .chat-body{flex:1;overflow-y:auto;padding:8px;font-size:12px;line-height:1.5}\n#mtdRoot .chat-line{overflow-wrap:anywhere;margin:0 0 5px}\n#mtdRoot .chat-line strong{color:#8eebd1}\n#mtdRoot .chat-form{display:flex;gap:4px;padding:6px;background:#152745}\n#mtdRoot .chat-form input{min-width:0;flex:1;background:#09152a;color:white;border:1px solid #577098;border-radius:7px;padding:6px;font:inherit}\n#mtdRoot .chat-form button{background:#327b82;padding:6px 10px}\n#mtdRoot .equip-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;max-height:310px;overflow:auto}\n#mtdRoot .equip-card{border-radius:10px;padding:10px;border:1px solid #556b91;background:#142440}\n#mtdRoot .equip-card.equipped{border-color:#7aecba;background:#1b3a40}\n#mtdRoot .equip-card strong,#mtdRoot .equip-card small{display:block;margin-bottom:5px}\n#mtdRoot .equip-card small{color:#b1c7df}\n#mtdRoot .equip-card button{width:100%}\n#mtdRoot .mtd-subtle{color:#abbdd7;font-size:12px}\n@media(max-width:760px){#mtdRoot .menu-hero:after{font-size:25px;right:6px}#mtdRoot .chat-panel{left:4px;bottom:75px;width:min(215px,58%);height:178px}#mtdRoot .chat-body{font-size:10px}#mtdRoot .chat-header{font-size:11px;padding:4px}}\n";style.textContent+="\n#mtdRoot .app{height:100dvh;overflow:hidden}\n#mtdRoot header{min-height:55px;gap:12px;padding:8px 15px;background:linear-gradient(90deg,#172742,#20385e);border-bottom:1px solid #415a80}\n#mtdRoot header strong{font-size:17px;white-space:nowrap}\n#mtdRoot #mtdStats{flex:1;min-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}\n#mtdRoot #mtdPlaytime{font-size:12px;white-space:nowrap;color:#b6c7e3}\n#mtdRoot #mtdLobbyOpen{margin-left:auto}\n#mtdRoot .body{display:grid;grid-template-columns:250px minmax(0,1fr) 240px;grid-template-rows:minmax(0,1fr);min-height:0}\n#mtdRoot .body>aside{grid-column:1;grid-row:1;min-width:0;min-height:0;padding:12px;overflow-y:auto;border-right:1px solid #4d6082;background:linear-gradient(#1a2a46,#112039);gap:7px}\n#mtdRoot .body>.stage{grid-column:2;grid-row:1;min-width:0;min-height:0;padding:10px;display:flex;align-items:center;justify-content:center;background:radial-gradient(#23485a,#101b31)}\n#mtdRoot .stage canvas{display:block;width:100%;height:auto;max-width:100%;max-height:100%;aspect-ratio:900/560;border:2px solid #7893b4;border-radius:8px;box-shadow:0 12px 30px #0008}\n#mtdRoot .mtd-dock{grid-column:3;grid-row:1;min-width:0;min-height:0;padding:10px;background:linear-gradient(#1b2c4a,#112039);border-left:1px solid #4b6183;display:flex;flex-direction:column;gap:9px}\n#mtdRoot .dock-title{font-weight:900;letter-spacing:.12em;color:#bcd0ed;font-size:11px;padding:3px}\n#mtdRoot .mtd-dock .game-controls{position:static;right:auto;bottom:auto;min-width:0;width:100%;padding:9px;gap:8px;border-radius:11px;box-shadow:none;background:#0e1c36;flex:0 0 auto}\n#mtdRoot .game-controls .actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}\n#mtdRoot .game-controls .actions button{min-width:0;min-height:40px;padding:7px 3px;font-size:12px;white-space:normal;line-height:1.2}\n#mtdRoot .mtd-dock .chat-panel{position:relative;left:auto;bottom:auto;width:100%;height:auto;max-height:none;min-height:145px;flex:1 1 auto;box-shadow:none;border-radius:11px}\n#mtdRoot .mtd-dock .chat-panel.collapsed{min-height:40px;flex:0 0 40px;height:40px}\n#mtdRoot .chat-body{min-height:0;overscroll-behavior:contain}\n#mtdRoot .tower-panel{position:relative;top:auto;box-shadow:none;margin-bottom:5px}\n#mtdRoot #mtdDetails{min-height:56px;line-height:1.45;font-size:12px;overflow-wrap:anywhere}\n#mtdRoot .body>aside h3{margin:10px 0 4px}\n#mtdRoot #mtdRunStats,#mtdRoot #mtdMessage{font-size:12px;line-height:1.45;overflow-wrap:anywhere}\n#mtdRoot .lobby{inset:0;z-index:20;display:flex;justify-content:center;align-items:flex-start;padding:22px 18px;overflow-y:auto;overscroll-behavior:contain}\n#mtdRoot .panel{width:min(960px,100%);min-width:0;padding:20px;max-height:none}\n#mtdRoot .menu-hero{margin-bottom:14px}\n#mtdRoot .menu-stats{gap:10px;margin:0 0 14px}\n#mtdRoot .menu-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}\n#mtdRoot .menu-tabs button{min-width:0;padding:10px 5px}\n#mtdRoot .map-picker{grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}\n#mtdRoot .map-picker button{min-width:0;white-space:normal}\n#mtdRoot .menu-page>.actions button{min-width:125px}\n#mtdRoot .equip-grid{max-height:50vh}\n#mtdRoot button:focus-visible,#mtdRoot input:focus-visible{outline:3px solid #a8daff;outline-offset:2px}\n@media(max-width:1100px){\n#mtdRoot .body{grid-template-columns:200px minmax(0,1fr) 205px}\n#mtdRoot .body>aside,#mtdRoot .mtd-dock{padding:7px}\n#mtdRoot .mtd-dock .game-controls{padding:6px}\n#mtdRoot .game-controls .actions button{font-size:11px;min-height:37px}\n#mtdRoot .stage{padding:5px}\n}\n@media(max-width:780px){\n#mtdRoot header{min-height:46px;padding:5px 8px;gap:6px}\n#mtdRoot header strong{font-size:13px}\n#mtdRoot #mtdPlaytime{display:none}\n#mtdRoot #mtdStats{font-size:11px;min-width:40px}\n#mtdRoot header button{font-size:11px;padding:5px 6px}\n#mtdRoot .body{grid-template-columns:128px minmax(0,1fr);grid-template-rows:minmax(0,1fr) 165px}\n#mtdRoot .body>aside{grid-column:1;grid-row:1;padding:5px}\n#mtdRoot .body>.stage{grid-column:2;grid-row:1;padding:3px}\n#mtdRoot .mtd-dock{grid-column:1/-1;grid-row:2;display:grid;grid-template-columns:1fr minmax(165px,1fr);grid-template-rows:1fr;padding:5px;gap:5px;border-left:0;border-top:1px solid #536689}\n#mtdRoot .dock-title{display:none}\n#mtdRoot .mtd-dock .game-controls{grid-column:1;grid-row:1;overflow-y:auto;gap:3px;padding:4px}\n#mtdRoot .game-controls .actions button{font-size:10px;min-height:33px;padding:4px}\n#mtdRoot .mtd-dock .chat-panel{grid-column:2;grid-row:1;min-height:0;max-height:100%;height:100%}\n#mtdRoot .mtd-dock .chat-panel.collapsed{height:40px;align-self:start}\n#mtdRoot .tower-panel{padding:6px}\n#mtdRoot .tower-panel h3{font-size:11px}\n#mtdRoot .tower-panel button{font-size:10px;padding:4px;min-height:30px}\n#mtdRoot #mtdDetails{font-size:10px;min-height:38px}\n#mtdRoot .body>aside .unit{min-height:38px;padding:4px}\n#mtdRoot .body>aside .unit span{font-size:16px}\n#mtdRoot .menu-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}\n#mtdRoot .map-picker{grid-template-columns:repeat(2,minmax(0,1fr))}\n#mtdRoot .crate-grid{grid-template-columns:1fr}\n#mtdRoot .lobby{padding:8px}\n#mtdRoot .panel{padding:12px}\n#mtdRoot .menu-hero:after{font-size:25px}\n}\n";style.textContent+="\n#mtdRoot .mtd-dock>.chat-panel{order:0;flex:1 1 auto;min-height:180px}\n#mtdRoot .mtd-dock>.dock-title{order:1;margin-top:auto;border-top:1px solid #49607e;padding-top:9px}\n#mtdRoot .mtd-dock>.game-controls{order:2;flex:0 0 auto}\n#mtdRoot .mtd-dock>.chat-panel.collapsed{flex:0 0 40px;min-height:40px}\n@media(max-width:780px){\n#mtdRoot .mtd-dock{display:flex;flex-direction:row;align-items:stretch;gap:6px}\n#mtdRoot .mtd-dock>.dock-title{display:none}\n#mtdRoot .mtd-dock>.chat-panel{order:0;flex:1 1 47%;min-width:0;max-height:100%;height:100%;grid-column:auto;grid-row:auto}\n#mtdRoot .mtd-dock>.game-controls{order:1;flex:1 1 53%;min-width:0;grid-column:auto;grid-row:auto}\n#mtdRoot .mtd-dock>.chat-panel.collapsed{flex:1 1 47%;height:40px;align-self:start}\n}\n";style.textContent+="\n#mtdRoot .crate-grid{grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch}\n#mtdRoot .crate-card{display:flex;flex-direction:column;gap:5px;border:1px solid #536b95;background:linear-gradient(145deg,#1d3457,#16233c)}\n#mtdRoot .crate-card strong{font-size:17px}\n#mtdRoot .crate-card button{margin-top:auto;min-height:43px;font-size:12px;font-weight:800}\n#mtdRoot .crate-card button:disabled{opacity:.68;background:#222d45;cursor:not-allowed}\n#mtdRoot .mtd-crate-gate{display:block;color:#aabfdd;font-weight:700}\n#mtdRoot .mtd-crate-odds{font-size:11px!important;color:#f0d9a8!important}\n#mtdRoot .unit.mtd-full{border-color:#9c6179;opacity:.65}\n#mtdRoot .game-controls #mtdWave{font-size:13px}\n@media(max-width:780px){#mtdRoot .crate-grid{grid-template-columns:1fr}}\n";style.textContent+="\n#mtdRoot .map-picker{grid-template-columns:repeat(auto-fit,minmax(122px,1fr));}\n#mtdRoot .map-picker button{min-height:74px;}\n#mtdRoot .crate-card:nth-child(5){border-color:#b8a36d}\n#mtdRoot .crate-card:nth-child(6){border-color:#9d89cb}\n#mtdRoot .crate-card:nth-child(7){border-color:#e1a1c3}\n@media(max-width:780px){#mtdRoot .map-picker{grid-template-columns:repeat(2,minmax(0,1fr))}}\n";style.textContent+="\n#mtdRoot .mtd-endless-choice{position:absolute;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;padding:15px;background:#050f25d6;backdrop-filter:blur(5px)}\n#mtdRoot .mtd-endless-choice.hidden{display:none}\n#mtdRoot .endless-content{max-width:430px;text-align:center;background:linear-gradient(145deg,#2a336d,#111e41);border:2px solid #f4cf82;padding:23px;border-radius:18px;box-shadow:0 10px 55px #000a}\n#mtdRoot .endless-crown{font-size:46px;filter:drop-shadow(0 3px 12px #ffc875)}\n#mtdRoot .endless-content h2{font-size:23px;color:#ffe6a8;margin:4px 0 10px}\n#mtdRoot .endless-content p{font-size:14px;line-height:1.5;color:#dde9ff}\n#mtdRoot .endless-content small{display:block;color:#a9bce1;margin-top:11px;line-height:1.4}\n#mtdRoot .endless-actions{display:flex;gap:9px;margin-top:18px}\n#mtdRoot .endless-actions button{flex:1;font-weight:800;min-height:46px;white-space:normal}\n#mtdRoot #mtdGoEndless{background:linear-gradient(100deg,#285b82,#6845ae);border-color:#bbb1ff}\n#mtdRoot #mtdFinishRun{background:#3c485f;border-color:#8290a9}\n@media(max-width:780px){#mtdRoot .endless-content{padding:12px}#mtdRoot .endless-content h2{font-size:17px}#mtdRoot .endless-content p{font-size:12px}#mtdRoot .endless-actions button{min-height:40px;padding:6px;font-size:11px}}\n";style.textContent+="\n#mtdRoot .mtd-portrait{width:47px;height:47px;object-fit:contain;flex:0 0 auto;image-rendering:auto}\n#mtdRoot .equip-card .mtd-portrait,#mtdRoot .collection .mtd-portrait{float:left;width:51px;height:51px;margin-right:8px}\n#mtdRoot .equip-card:after,#mtdRoot .collection>div:after{content:\"\";display:block;clear:both}\n#mtdRoot .unit .mtd-portrait{width:43px;height:43px}\n";document.head.append(style)}
function init(){if(root)return;css();root=document.createElement("div");root.id="mtdRoot";root.className="hidden";
root.innerHTML=`<div class="app"><header><strong>🧠 MEME TOWER DEFENSE</strong><span id="mtdStats">2025–26 Brainrot Defense</span><span id="mtdPlaytime">Played 0h 0m</span><button id="mtdLobbyOpen">Lobby</button><button id="mtdExit">← Back to Games Menu</button></header><div class="body"><div class="stage"><canvas width="900" height="560" id="mtdCanvas"></canvas><div class="game-controls" id="mtdControls"></div><div id="mtdEndlessChoice" class="mtd-endless-choice hidden" role="dialog" aria-label="Victory! Continue into endless mode"><div class="endless-content"><div class="endless-crown">👑</div><h2>ALL 40 WAVES CLEARED!</h2><p>You've beaten the main challenge. Want to keep defending your last brain cell?</p><div class="endless-actions"><button id="mtdGoEndless" type="button">♾️ Continue Endless</button><button id="mtdFinishRun" type="button">🏆 Finish Run</button></div><small>Endless enemies become tougher with each new wave. Your towers and money carry over.</small></div></div><section class="chat-panel" id="mtdChatPanel" aria-label="Multiplayer game chat"><div class="chat-header"><span id="mtdChatTitle">💬 TEAM CHAT</span><button type="button" id="mtdChatToggle" title="Collapse chat">−</button></div><div class="chat-body" id="mtdChatLines" role="log" aria-live="polite"></div><form class="chat-form" id="mtdChatForm"><input id="mtdChatInput" maxlength="180" placeholder="Chat with teammates · Enter" autocomplete="off" aria-label="Game chat message"><button type="submit">Send</button></form></section></div><aside><div class="tower-panel" id="mtdSelection"><h3>🎯 SELECTED TOWER</h3><p id="mtdDetails">Click a tower to inspect it.</p><div class="actions"><button id="mtdUpgrade">⬆ Upgrade</button><button id="mtdSell">Sell</button></div><div class="actions"><button id="mtdTarget">Target: First</button></div></div><h3>🧩 EQUIPPED TOWERS</h3><div class="units" id="mtdUnits"></div><h3>RUN STATS</h3><p id="mtdRunStats"></p><p id="mtdMessage"></p><div id="mtdHiddenControls" hidden><button id="mtdSaveRound">💾 Save Round</button><button id="mtdWave">▶ Start Wave</button><button id="mtdSpeed">Speed 1×</button><button id="mtdAuto">Auto-wave: Off</button><button id="mtdAbility">⚡ 67 Surge</button><button id="mtdRestart">↻ Restart</button></div></aside></div></div><div class="lobby" id="mtdLobby"><div class="panel"><div class="menu-hero"><small>DISCARD · MEME DEFENSE 2026</small><h2>🧠 MEME TOWER DEFENSE</h2><p>Collect memes, build a team, upgrade your units, and defend the last brain cell.</p></div><div class="menu-stats"><div><small>💰 CRATE MONEY</small><strong id="mtdMenuMoney">$0</strong></div><div><small>🏆 HIGHEST WAVE</small><strong id="mtdMenuBest">0</strong></div><div><small>🎁 CRATES OPENED</small><strong id="mtdMenuCrates">0</strong></div><div><small>🎯 TOWERS OWNED</small><strong id="mtdMenuOwned">0</strong></div></div><div class="menu-tabs"><button data-menu="play" class="active">▶ PLAY</button><button data-menu="loadout">🎒 EQUIP</button><button data-menu="crates">🎁 CRATES</button><button data-menu="collection">📚 COLLECTION</button></div><div id="mtdLevelSummary" class="menu-note"></div><div class="equip-progress" aria-label="Level progress"><div id="mtdLevelBar"></div></div><div class="menu-page" data-page="play"><h3>SELECT MAP</h3><div class="map-picker" id="mtdMaps"></div><div class="actions"><button id="mtdSolo">New Solo Game</button><button id="mtdContinue">Continue Saved</button><button id="mtdHost">Host Multiplayer</button></div><div style="margin:12px 0"><label for="mtdDifficulty">Difficulty: </label><select id="mtdDifficulty" style="background:#0d1d37;color:#fff;padding:9px;border:1px solid #647aa4;border-radius:8px"><option value="easy">Easy</option><option selected value="normal">Normal</option><option value="hard">Hard</option><option value="impossible">Impossible</option></select></div><div class="actions" style="margin-top:10px"><input id="mtdCode" maxlength="5" placeholder="JOIN CODE"><button id="mtdJoin">Join Friend</button></div><p id="mtdRoom">Create a lobby or join with a code.</p><p id="mtdPlayers"></p><div class="actions"><button id="mtdStart">Start / Continue</button><button id="mtdLeave">← Back to Games Menu</button></div><p id="mtdLobbyMessage"></p></div><div class="menu-page" data-page="loadout" hidden><h3>🎒 TOWER LOADOUT</h3><p id="mtdEquipStatus"></p><div class="equip-grid" id="mtdEquipGrid"></div><p class="mtd-subtle">Level up from wave XP to unlock more equip slots.</p></div><div class="menu-page" data-page="crates" hidden><h3>UNLOCK NEW MEME TOWERS</h3><p>Play waves to earn coins and XP. Higher-tier crates require both a high player level and a proven highest wave. Duplicate drops refund 15% of their cost. All odds are displayed below.</p><div class="crate-grid" id="mtdCrates"></div><p id="mtdCrateResult" aria-live="polite"></p></div><div class="menu-page" data-page="collection" hidden><h3>YOUR TOWER COLLECTION</h3><p>Unlocked units are available to place in solo and multiplayer matches.</p><div class="collection" id="mtdCollection"></div></div></div></div>`;
document.body.append(root);canvas=$("#mtdCanvas");ctx=canvas.getContext("2d");
const controls=$("#mtdControls");
$("#mtdChatToggle").onclick=()=>{const box=$("#mtdChatPanel");box.classList.toggle("collapsed");$("#mtdChatToggle").textContent=box.classList.contains("collapsed")?"+":"−";if(!box.classList.contains("collapsed")){chatUnread=0;renderChat()}};
$("#mtdChatForm").addEventListener("submit",e=>{e.preventDefault();sendChat()});
document.addEventListener("keydown",e=>{if(!root||root.classList.contains("hidden")||!$("#mtdLobby").classList.contains("hidden"))return;const active=document.activeElement,typing=active&&["INPUT","TEXTAREA","SELECT"].includes(active.tagName);if(e.key==="Enter"&&!typing){e.preventDefault();$("#mtdChatPanel").classList.remove("collapsed");$("#mtdChatToggle").textContent="−";$("#mtdChatInput").focus()}else if(e.key==="Escape"){if(typing)active.blur();else{selected=null;picked=null;hover=null;ui();e.preventDefault()}}});
renderChat();$("#mtdEquipGrid").addEventListener("click",e=>{const b=e.target.closest("[data-equip]");if(b)toggleEquip(b.dataset.equip)});const row=document.createElement("div");row.className="actions";row.append($("#mtdWave"),$("#mtdSpeed"));const row2=document.createElement("div");row2.className="actions";row2.append($("#mtdAuto"),$("#mtdAbility"));const row3=document.createElement("div");row3.className="actions";row3.append($("#mtdSaveRound"),$("#mtdRestart"));controls.append(row,row2,row3);const dock=document.createElement("section");dock.className="mtd-dock";dock.id="mtdDock";dock.setAttribute("aria-label","Match controls and team chat");const head=document.createElement("div");head.className="dock-title";head.textContent="⚡ MATCH CONTROLS";dock.append($("#mtdChatPanel"),head,controls);root.querySelector(".body").append(dock);
$("#mtdLobby").addEventListener("click",e=>{const tab=e.target.closest("[data-menu]");if(tab){menuTab=tab.dataset.menu;renderMenu(true)}});
$("#mtdMaps").addEventListener("click",e=>{const button=e.target.closest("[data-map]");if(button&&!game){applyMap(button.dataset.map);renderMenu(true)}else if(button)notify("Leave the current match to select another map.")});
$("#mtdCrates").addEventListener("click",e=>{const b=e.target.closest("[data-crate]");if(b)openCrate(b.dataset.crate)});
renderMenu(true);
renderUnits();
$("#mtdExit").onclick=close;$("#mtdLobbyOpen").onclick=()=>lobby(true);
$("#mtdSolo").onclick=()=>{if(game&&!confirm("Replace your current game?"))return;create(false);saveSolo();lobby(false)};
$("#mtdContinue").onclick=()=>{const saved=loadSolo();if(!saved){$("#mtdLobbyMessage").textContent="No saved solo game. Start a new solo run.";return}game=saved;game.host=id();game.players=[id()];applyMap(game.map||"city");game.unlocks={[id()]:[...profileData().equipped]};game.cash= {[id()]:Math.max(0,Number(Object.values(saved.cash||{})[0])||0)};game.coop=false;game.ended=false;game.victoryChoice=!!saved.victoryChoice;game.endless=!!saved.endless;game.active=!!saved.active;game.spawn=Math.max(0,Number(saved.spawn)||0);game.enemies=Array.isArray(saved.enemies)?saved.enemies.slice(0,210):[];game.effects=[];game.towers=(game.towers||[]).filter(t=>UNITS.some(u=>u[0]===t.type)).map(t=>({...t,owner:id(),cool:0}));game.surges={};game.waveClearTime=game.time||0;picked=null;notify("Loaded solo save from wave "+game.wave);lobby(false)};$("#mtdHost").onclick=()=>{create(true);lobby(true)};
$("#mtdJoin").onclick=join;$("#mtdStart").onclick=()=>{if(game)lobby(false);else $("#mtdLobbyMessage").textContent="Create or join a match first"};
$("#mtdLeave").onclick=close;
$("#mtdUpgrade").onclick=()=>command("upgrade",{id:picked});$("#mtdSell").onclick=()=>command("sell",{id:picked});
$("#mtdGoEndless").onclick=()=>{if(!game||!game.victoryChoice)return;if(!host()){notify("Only the host can choose endless mode.");return}game.endless=true;game.victoryChoice=false;game.ended=false;notify("♾️ ENDLESS MODE UNLOCKED! Wave 41 awaits.");saveSolo();ui();if(game.auto&&$("#mtdLobby").classList.contains("hidden"))apply(id(),"wave",{})};
$("#mtdFinishRun").onclick=()=>{if(!game||!game.victoryChoice)return;if(!host()){notify("The host is choosing how to continue.");return}game.victoryChoice=false;game.ended=true;game.auto=false;if(!game.coop)try{localStorage.removeItem(SOLO_KEY)}catch{}notify("🏆 VICTORY! You've completed all 40 waves.");ui()};
$("#mtdWave").onclick=()=>command("wave");$("#mtdSaveRound").onclick=()=>{if(!game||game.coop){notify("Round saving is available in solo games.");return}saveSolo();notify("Round "+game.wave+" saved with enemies and towers.")};
$("#mtdTarget").onclick=()=>{if(picked!==null)command("target",{id:picked})};
$("#mtdAuto").onclick=()=>{if(host()&&game){game.auto=!game.auto;if(game.auto&&!game.active&&!game.ended&&!game.victoryChoice&&(game.wave<40||game.endless)&&$("#mtdLobby").classList.contains("hidden"))apply(id(),"wave",{});ui()}else notify("Only the host can change auto-wave.")};
$("#mtdAbility").onclick=()=>command("surge");
$("#mtdRestart").onclick=()=>{if(!host()){notify("Only the host can restart.");return}if(confirm("Restart this match from wave 1?")){const old=game;create(old.coop,old.coop?old.code:null);if(old.coop){game.code=old.code;game.players=[...old.players];game.cash=Object.fromEntries(game.players.map(p=>[p,700]));game.unlocks=Object.fromEntries(game.players.map(p=>[p,p===id()?[...profileData().equipped]:old.unlocks?.[p]||[...STARTERS]]));sendAll({t:"mtd-state",code:game.code,state:game})}lobby(false)}};

$("#mtdSpeed").onclick=()=>{if(host()){game.speed=game.speed===1?2:1;ui()}};
canvas.addEventListener("pointermove",e=>{const r=canvas.getBoundingClientRect();hover={x:(e.clientX-r.left)*900/r.width,y:(e.clientY-r.top)*560/r.height};});
canvas.addEventListener("pointerleave",()=>hover=null);
canvas.addEventListener("pointerdown",e=>{if(!game||!$("#mtdLobby").classList.contains("hidden"))return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*900/r.width,y=(e.clientY-r.top)*560/r.height;const found=[...game.towers].reverse().find(v=>Math.hypot(v.x-x,v.y-y)<27);if(found){picked=found.id;selected=null;ui();$("#mtdSelection").scrollIntoView({block:"nearest"})}else{picked=null;if(selected!==null)command("place",{type:selected,x:Math.round(x),y:Math.round(y)});ui()}});
}
function lobby(show){if(!root)return;$("#mtdLobby").classList.toggle("hidden",!show);if(show){menuTab="play";renderMenu(true)}ui()}
function renderUnits(){if(!root)return;const holder=$("#mtdUnits");holder.replaceChildren();const none=document.createElement("button");none.className="unit unit-none"+(selected===null?" active":"");none.dataset.unit="none";none.textContent="✋ NO TOWER · SAFE";none.onclick=()=>{selected=null;picked=null;ui()};holder.append(none);for(const u of UNITS){if(!profileData().equipped.includes(u[0]))continue;const btn=document.createElement("button");btn.className="unit";btn.dataset.unit=u[0];const icon=mtdPortrait(u[0]);const div=document.createElement("div");const title=document.createElement("b");title.textContent=u[1];const small=document.createElement("small");small.textContent="$"+u[3]+" · "+(RARITY[u[0]]||"common").toUpperCase()+" · max "+towerLimit(u[0]);small.style.color=RARITY_COLOR[RARITY[u[0]]]||"#fff";div.append(title,document.createElement("br"),small);btn.append(icon,div);btn.onclick=()=>{selected=selected===u[0]?null:u[0];picked=null;ui()};holder.append(btn)}}
function renderMenu(force=false){if(!root)return;const p=profileData(),r=records();const signature=JSON.stringify([p.coins,p.unlocked.length,p.crates,menuTab,game?.map||null,PATH,game?.players?.length||0,game?.wave||0,r.highestWave]);if(!force&&signature===lastMenuSignature)return;lastMenuSignature=signature;
$("#mtdMenuMoney").textContent="$"+p.coins.toLocaleString();$("#mtdMenuBest").textContent=String(r.highestWave||0);$("#mtdMenuCrates").textContent=String(p.crates);$("#mtdMenuOwned").textContent=p.unlocked.length+"/"+UNITS.length;
const lvl=levelFor(p.xp),slots=slotsFor(lvl),nextXP=110*lvl*lvl,previousXP=110*(lvl-1)*(lvl-1);
$("#mtdLevelBar").style.width=Math.min(100,Math.max(0,100*(p.xp-previousXP)/Math.max(1,nextXP-previousXP)))+"%";$("#mtdLevelSummary").textContent="⭐ LEVEL "+lvl+" · "+p.equipped.length+"/"+slots+" equipped · "+Math.floor(p.xp-previousXP)+"/"+Math.max(1,nextXP-previousXP)+" XP to next level · Next slots at levels 5, 10, 20 and 35";
$("#mtdEquipStatus").textContent="Level "+lvl+" · Equip up to "+slots+" towers ("+p.equipped.length+" equipped).";
const equipGrid=$("#mtdEquipGrid");equipGrid.replaceChildren();
for(const u of UNITS){const unlocked=p.unlocked.includes(u[0]),equipped=p.equipped.includes(u[0]);const card=document.createElement("div");card.className="equip-card"+(equipped?" equipped":"");const title=document.createElement("strong");title.textContent=u[1];const desc=document.createElement("small");desc.textContent=(RARITY[u[0]]||"common").toUpperCase()+" · "+(unlocked?"Owned":"Locked — crate required");card.append(mtdPortrait(u[0]),title,desc);if(unlocked){const button=document.createElement("button");button.dataset.equip=u[0];button.textContent=equipped?"✓ Equipped · Remove":p.equipped.length>=slots?"Slots full":"Equip";button.disabled=!equipped&&p.equipped.length>=slots;card.append(button)}equipGrid.append(card)}

root.querySelectorAll("[data-menu]").forEach(b=>b.classList.toggle("active",b.dataset.menu===menuTab));root.querySelectorAll("[data-page]").forEach(el=>el.hidden=el.dataset.page!==menuTab);
const maps=$("#mtdMaps");maps.replaceChildren();for(const [key,m] of Object.entries(MAPS)){const b=document.createElement("button");b.dataset.map=key;b.textContent=m.emoji+" "+m.name;b.className=(game?.map||Object.keys(MAPS).find(k=>MAPS[k].path===PATH))===key?"active":"";maps.append(b)}
const crates=$("#mtdCrates");crates.replaceChildren();for(const c of allCrates()){const card=document.createElement("div");card.className="crate-card";const name=document.createElement("strong");name.textContent=c.icon+" "+c.name;const summary=document.createElement("p");summary.textContent=c.desc;const odds=document.createElement("p");odds.className="mtd-crate-odds";odds.textContent=Object.entries(c.weights).map(([k,v])=>k.toUpperCase()+" "+v+"%").join(" · ");const gate=document.createElement("small");gate.className="mtd-crate-gate";gate.textContent="Requires level "+c.minLevel+" · best wave "+c.minWave;const b=document.createElement("button");b.dataset.crate=c.id;const blocked=crateEligibility(c,p);b.textContent=blocked?"🔒 "+blocked:"Open · "+c.cost.toLocaleString()+" coins";b.disabled=!!blocked;card.append(name,summary,odds,gate,b);crates.append(card)}
const list=$("#mtdCollection");list.replaceChildren();for(const u of UNITS){const locked=!owned(u[0]);const d=document.createElement("div");if(locked)d.className="locked";const label=document.createElement("strong");label.textContent=(locked?"🔒 ":"")+u[1];const sub=document.createElement("small");sub.textContent=(RARITY[u[0]]||"common").toUpperCase()+" · "+(locked?"LOCKED":p.equipped.includes(u[0])?"EQUIPPED":"OWNED · NOT EQUIPPED");sub.style.color=RARITY_COLOR[RARITY[u[0]]];d.append(mtdPortrait(u[0]),label,sub);list.append(d)}
}
function notify(m){alertText=m;ui()}
function randomCode(){return Array.from({length:5},()=>String.fromCharCode(65+Math.floor(Math.random()*26))).join("")}
function renderChat(){if(!root)return;const box=$("#mtdChatLines");if(!box)return;const follow=box.scrollHeight-box.scrollTop-box.clientHeight<45;box.replaceChildren();for(const line of chatLog.slice(-60)){const row=document.createElement("div");row.className="chat-line";const speaker=document.createElement("strong");speaker.textContent=line.from===id()?"You":String(line.from).slice(0,12);const message=document.createElement("span");message.textContent=": "+line.text;row.append(speaker,message);box.append(row)}if(follow)box.scrollTop=box.scrollHeight;$("#mtdChatTitle").textContent="💬 TEAM CHAT"+(chatUnread?" ("+chatUnread+")":"")}
function addChatLine(from,message,seq){if(!game||typeof message!=="string"||message.length>180||!game.players.includes(from))return;if(seq&&chatLog.some(m=>m.seq===seq))return;chatLog.push({from,text:message,seq:seq||""});if(chatLog.length>60)chatLog.splice(0,chatLog.length-60);if($("#mtdChatPanel").classList.contains("collapsed")&&from!==id())chatUnread=Math.min(99,chatUnread+1);renderChat()}
function acceptChat(from,message){if(!game||!host()||!game.players.includes(from)||typeof message!=="string")return;const text=message.trim().replace(/[\u0000-\u001f\u007f]/g," ");if(!text||text.length>180)return;const now=Date.now();if(now-(chatRate.get(from)||0)<700)return;chatRate.set(from,now);const seq=game.runId+":"+from+":"+now;addChatLine(from,text,seq);sendAll({t:"mtd-chat-line",code:game.code,runId:game.runId,from,text,seq})}
function sendChat(){if(!game){notify("Join a game to chat.");return}const input=$("#mtdChatInput"),text=input.value.trim();if(!text)return;if(Date.now()-lastChatAt<700){notify("Sending too fast.");return}lastChatAt=Date.now();if(host())acceptChat(id(),text);else if(!send(game.host,{t:"mtd-chat",code:game.code,text})){notify("Message failed — reconnect to host.");return}input.value="";chatUnread=0;renderChat()}
function create(coop,reuseCode=null){chatLog=[];chatUnread=0;renderChat();selected=null;const map=Object.keys(MAPS).find(k=>MAPS[k].path===PATH)||"city";game={code:reuseCode||(coop?randomCode():"SOLO"),coop,host:id(),players:[id()],unlocks:{[id()]:[...profileData().equipped]},runId:Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8),map,cash:{[id()]:700},wave:0,endless:false,victoryChoice:false,victoryRecorded:false,base:100,towers:[],enemies:[],effects:[],serial:0,spawn:0,spawnCooldown:0,active:false,ended:false,auto:false,difficulty:$("#mtdDifficulty")?.value||"normal",speed:1,kills:0,damage:0,surges:{},time:0,leaks:0,waveClearTime:0};picked=null;
if(coop){offers.set(game.code,id());for(const friend of friends())send(friend,{t:"mtd-offer",code:game.code})}joinTime=0;ui()}
function requestJoin(){if(!root||game||!joinTime||Date.now()-joinTime>40000)return;const code=$("#mtdCode").value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,5),known=offers.get(code);if(code.length!==5)return;for(const friend of friends())if(!known||known===friend)send(friend,{t:"mtd-join",code,equipped:[...profileData().equipped]});}
function join(){const code=$("#mtdCode").value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,5);if(code.length!==5){$("#mtdLobbyMessage").textContent="Enter a five-letter code";return}if(game){$("#mtdLobbyMessage").textContent="Leave your existing match before joining another.";return}joinTime=Date.now();joinRetryAt=0;requestJoin();$("#mtdLobbyMessage").textContent="Joining "+code+"… Trying connected friends for up to 40 seconds."}
function sendAll(data){if(!host()||!game.coop)return;for(const player of game.players)if(player!==id())send(player,data)}
function command(action,arg={}){if(!game||game.ended)return;if(host())apply(id(),action,arg);else {if(!send(game.host,{t:"mtd-command",code:game.code,action,arg}))notify("Reconnecting to host. Try that action again.");}}
function distance(a,b,x,y){const dx=b[0]-a[0],dy=b[1]-a[1],n=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-n*dx,y-a[1]-n*dy)}
function canPlace(x,y){return x>30&&x<870&&y>32&&y<528&&!PATH.some((p,i)=>i&&distance(PATH[i-1],p,x,y)<43)&&!game.towers.some(t=>Math.hypot(t.x-x,t.y-y)<48)}
function feedback(who,message){if(who===id())notify(message);else if(game?.coop&&game.players.includes(who))send(who,{t:"mtd-feedback",code:game.code,text:String(message).slice(0,160)})}
function apply(who,action,arg){if(!game||!host()||!game.players.includes(who))return;
if(action==="place"){const u=UNITS.find(u=>u[0]===arg.type),x=Number(arg.x),y=Number(arg.y);
if(!u||!Number.isFinite(x)||!Number.isFinite(y))return;
if(deployed(u[0])>=towerLimit(u[0])){feedback(who,u[1]+" is at its "+towerLimit(u[0])+"-tower team limit.");return}
if(game.towers.length>=65){feedback(who,"Tower limit reached (65).");return}
if(!canPlace(x,y)){feedback(who,"Can't build on paths or too close to another tower.");return}
if((game.cash[who]||0)<u[3]){feedback(who,"Not enough cash for "+u[1]);return}
if(!(game.unlocks?.[who]||STARTERS).includes(u[0])){feedback(who,"Equip this tower in your loadout before starting the game.");return}if(u[0]==="verity"&&game.towers.some(t=>t.type==="verity")){if(who===id())notify("Verity is a special unit: only one per team.");return}game.cash[who]-=u[3];game.towers.push({id:++game.serial,type:u[0],x,y,owner:who,level:1,cool:0,target:"first"});notify(u[1]+" placed!")}
if(action==="upgrade"){const t=game.towers.find(t=>t.id===arg.id&&t.owner===who);if(!t||t.level>=5)return;const u=UNITS.find(u=>u[0]===t.type),cost=Math.round(u[3]*(.65+t.level*.6));if(game.cash[who]<cost){feedback(who,"Need $"+cost+" to upgrade "+u[1]);return}game.cash[who]-=cost;t.level++}
if(action==="target"){const t=game.towers.find(t=>t.id===arg.id&&t.owner===who);if(t){const opts=["first","strongest","last"];t.target=opts[(opts.indexOf(t.target||"first")+1)%opts.length]||"first"}}
if(action==="sell"){const i=game.towers.findIndex(t=>t.id===arg.id&&t.owner===who);if(i<0)return;const t=game.towers[i],u=UNITS.find(u=>u[0]===t.type);game.cash[who]+=Math.round(u[3]*(.55+.22*(t.level-1)));game.towers.splice(i,1);picked=null}
if(action==="surge"){game.surges=game.surges||{};const available=game.surges[who]||0;if(game.time<available)return;game.surges[who]=game.time+55;for(const e of game.enemies){if(e.hp>0){e.slow=Math.max(e.slow||0,5);hit(e,Math.max(80,Math.round(e.maxHp*.11)),who)}}game.effects.push({x:450,y:280,tx:450,ty:280,c:"#ffdd7a",life:.7,laser:false,burst:true});notify("⚡ 67 SURGE! Meme enemies slowed.");}
if(action==="wave"&&!game.active&&!game.ended&&!game.victoryChoice&&(game.wave<40||game.endless)){game.wave++;game.spawn=Math.min(155,9+game.wave*2);game.active=true;game.spawnCooldown=0;notify((game.endless?"♾️ Endless ":"")+"Wave "+game.wave+" started!")}
ui()}
function spawn(){const wave=game.wave,boss=wave%10===0&&game.spawn===1,kind=boss?Math.min(BADS.length-1,Math.floor(wave*.7)):Math.floor(Math.pow(Math.random(),1.6)*Math.min(BADS.length,1+Math.floor(wave*.75))),b=BADS[kind],hp=Math.round(b[1]*(1+wave*.09)*Math.pow(1.07,Math.max(0,wave-40))*(boss?3:1)*({easy:.65,normal:1,hard:1.55,impossible:2.3}[game.difficulty]||1));game.enemies.push({id:++game.serial,x:PATH[0][0],y:PATH[0][1],step:0,progress:0,hp,maxHp:hp,speed:b[2]*(1+Math.min(.7,wave*.008)+Math.min(.5,Math.max(0,wave-40)*.008))*(boss?.7:1),earn:b[3]*(boss?10:1),emoji:boss?"👑":b[0],skin:MTD_ENEMY_SKINS[kind]||"noob",boss,slow:0,flash:0})}
function walk(e,dt){let advance=e.speed*dt;while(advance>0&&e.step<PATH.length-1){const a=PATH[e.step],b=PATH[e.step+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(advance<len-e.progress){e.progress+=advance;advance=0}else{advance-=len-e.progress;e.step++;e.progress=0}}if(e.step>=PATH.length-1){e.passed=true;return}const a=PATH[e.step],b=PATH[e.step+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);e.x=a[0]+(b[0]-a[0])*e.progress/l;e.y=a[1]+(b[1]-a[1])*e.progress/l}
function hit(e,damage,owner){if(e.hp<=0)return;e.hp-=damage;e.flash=.18;game.damage=(game.damage||0)+Math.min(damage,e.hp+damage);if(e.hp<=0){game.kills=(game.kills||0)+1;for(const p of game.players)game.cash[p]=(game.cash[p]||0)+Math.ceil(e.earn/game.players.length);game.cash[owner]+=Math.floor(e.earn*.3)}}
function tick(dt){if(!host()||game.ended||game.victoryChoice||!$("#mtdLobby").classList.contains("hidden"))return;dt=Math.min(.08,dt)*game.speed;game.time=(game.time||0)+dt;if(game.active&&game.spawn){game.spawnCooldown-=dt;if(game.spawnCooldown<=0&&game.enemies.length<210){spawn();game.spawn--;game.spawnCooldown=Math.max(.22,.82-game.wave*.008)}}
for(const e of game.enemies)if(e.hp>0){e.flash=Math.max(0,(e.flash||0)-dt);e.slow=Math.max(0,(e.slow||0)-dt);walk(e,e.slow>0?dt*.5:dt)}
for(const t of game.towers){t.cool-=dt;if(t.cool>0)continue;const u=UNITS.find(u=>u[0]===t.type),targets=game.enemies.filter(e=>e.hp>0&&!e.passed&&Math.hypot(e.x-t.x,e.y-t.y)<u[5]*(1+.08*(t.level-1))).sort((a,b)=>b.step-a.step||b.progress-a.progress);if(!targets.length)continue;const target=(t.target==="strongest"?targets.sort((a,b)=>b.hp-a.hp):t.target==="last"?targets.reverse():targets)[0],damage=Math.round(u[4]*Math.pow(1.6,t.level-1));t.cool=u[6]/(1+.1*(t.level-1));const aoe=["tung","croc","pat","bomb","skibidi","galaxy","sigma2","drum","mango","rocket","orbit","diamond","king","echo","zero"].includes(t.type);
const splash=["croc","bomb","sigma2","diamond","king","zero"].includes(t.type)?78:aoe?54:0;
const affected=["verity","laser","tral","pigeon","echo"].includes(t.type)?targets.slice(0,t.type==="verity"||t.type==="echo"?4:3):aoe?game.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-target.x,e.y-target.y)<splash):[target];
for(const e of affected){let dealt=damage;if(["sigma","sigma2","galaxy","laser","orbit","diamond","king","zero"].includes(t.type)&&Math.random()<.22)dealt=Math.round(damage*2.1);hit(e,dealt,t.owner);if(["capy","chill","frog","ghost","skibidi","matcha","plush","drum"].includes(t.type))e.slow=Math.max(e.slow||0,t.type==="skibidi"?2.8:1.3)}
if(["doge","cheese","npc"].includes(t.type)){const income=Math.max(1,Math.floor((t.level+1)*(t.type==="doge"?8:4)));game.cash[t.owner]=(game.cash[t.owner]||0)+income}
game.effects.push({x:t.x,y:t.y,tx:target.x,ty:target.y,c:u[7],life:MTD_BEAMS.has(t.type)?.27:MTD_BLASTS.has(t.type)?.38:.29,duration:MTD_BEAMS.has(t.type)?.27:MTD_BLASTS.has(t.type)?.38:.29,laser:MTD_BEAMS.has(t.type),style:mtdAttackStyle(t.type),type:t.type,level:t.level,splash:MTD_BLASTS.has(t.type)?Math.min(65,28+t.level*5):0,seed:Math.random()*6.28})}
game.enemies=game.enemies.filter(e=>{if(e.passed){game.base-=e.boss?25:Math.max(1,Math.min(8,Math.ceil(e.maxHp/950)));game.leaks=(game.leaks||0)+1;return false}return e.hp>0});game.effects=game.effects.filter(e=>(e.life-=dt)>0).slice(-90);
if(game.base<=0){game.base=0;game.ended=true;if(!game.coop)try{localStorage.removeItem(SOLO_KEY)}catch{}recordResult();notify("Game Over: the final brain cell fell!")}

if(game.active&&!game.spawn&&!game.enemies.length&&!game.ended){game.active=false;for(const p of game.players)game.cash[p]+=100+game.wave*15;game.waveClearTime=game.time;saveSolo();try{const r=records();if(game.wave>(r.highestWave||0)){r.highestWave=game.wave;localStorage.setItem(RECORD_KEY,JSON.stringify(r))}}catch{}waveReward(game.wave);if(game.coop)sendAll({t:"mtd-reward",code:game.code,runId:game.runId,wave:game.wave,difficulty:game.difficulty});if(game.wave===40&&!game.endless){game.victoryChoice=true;game.auto=false;if(!game.victoryRecorded){recordResult();game.victoryRecorded=true}saveSolo();notify("🏆 All 40 waves cleared! Choose Endless or Finish Run.");ui()}else{notify((game.endless?"♾️ Endless ":"")+"Wave "+game.wave+" cleared!");if(game.auto)apply(id(),"wave",{})}}}
let mapCache=null;
function mapBackground(){
 if(mapCache)return mapCache;
 mapCache=document.createElement("canvas");mapCache.width=900;mapCache.height=560;const c=mapCache.getContext("2d");
 const grd=c.createLinearGradient(0,0,900,560);const theme=(MAPS[game?.map]||MAPS[Object.keys(MAPS).find(k=>MAPS[k].path===PATH)]||MAPS.city).theme;grd.addColorStop(0,theme[0]);grd.addColorStop(.46,theme[1]);grd.addColorStop(1,theme[2]);c.fillStyle=grd;c.fillRect(0,0,900,560);
 for(let i=0;i<750;i++){const x=(Math.sin(i*63.872)*15245)%900,y=(Math.cos(i*37.17)*35367)%560;
 c.fillStyle=i%4===0?"#6eb49b22":"#8ecaae15";c.fillRect(Math.abs(x),Math.abs(y),i%5+1,i%4+1)}
 for(let x=0;x<900;x+=54)for(let y=0;y<560;y+=54){c.strokeStyle="#a3d8cb0c";c.lineWidth=1;c.strokeRect(x,y,54,54)}
 const roads=[["#152c3a",83],["#7c718b",70],["#514e68",60]];
 c.lineCap="round";c.lineJoin="round";for(const [color,width] of roads){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(...PATH[0]);for(let i=1;i<PATH.length;i++)c.lineTo(...PATH[i]);c.stroke()}
 c.setLineDash([10,15]);c.lineWidth=2;c.strokeStyle="#e9d8ed55";c.beginPath();c.moveTo(...PATH[0]);for(let i=1;i<PATH.length;i++)c.lineTo(...PATH[i]);c.stroke();c.setLineDash([]);
 function rect(x,y,w,h,color){c.fillStyle="#092b3c99";c.fillRect(x+6,y+8,w,h);c.fillStyle=color;c.fillRect(x,y,w,h);c.strokeStyle="#b3dbe266";c.lineWidth=2;c.strokeRect(x,y,w,h)}
 // Neon city corners and decorative map areas; no collision with the actual tower path.
 rect(32,24,118,45,"#294967");rect(348,18,145,44,"#263d5c");rect(755,35,120,57,"#324b64");
 rect(26,425,124,70,"#2d4758");rect(565,472,115,55,"#293e5b");rect(765,460,95,56,"#263d5b");
 c.textAlign="center";c.font="bold 15px system-ui";c.fillStyle="#bfeaff";c.fillText("BRAINROT CITY",92,51);c.fillText("MEME PLAZA",420,46);c.fillText("AURA BANK",815,68);c.fillText("NO CAP",87,468);c.fillText("THE BACKROOMS",624,505);c.fillText("RIZZ HQ",812,494);
 for(let i=0;i<34;i++){const x=16+(i*179)%870,y=16+(i*83)%525;if(PATH.some((p,j)=>j&&distance(PATH[j-1],p,x,y)<56))continue;c.fillStyle="#194f4d";c.beginPath();c.arc(x,y,13,0,Math.PI*2);c.fill();c.fillStyle="#378b75";c.beginPath();c.arc(x-3,y-4,10,0,Math.PI*2);c.fill();c.fillStyle="#70c39c";c.beginPath();c.arc(x-5,y-7,4,0,Math.PI*2);c.fill()}
 c.font="bold 17px system-ui";c.fillStyle="#f6e8ff";c.textAlign="left";c.fillText("⬅ SPAWN",8,221);c.fillText("🧠 LAST BRAIN CELL",711,302);
 c.fillStyle="#ffe29a";c.beginPath();c.arc(882,350,14,0,Math.PI*2);c.fill();
 return mapCache;
}

const MTD_BEAMS=new Set(["verity","laser","galaxy","sigma","sigma2","orbit","diamond","king","zero","echo"]);
const MTD_BLASTS=new Set(["tung","bomb","croc","rocket","drum","mango","king","zero","diamond","skibidi"]);
const MTD_FROST=new Set(["capy","chill","frog","ghost","matcha","plush"]);
const MTD_BURSTS=new Set(["shark","tral","pigeon","cat","chicken","duck","doge"]);
const MTD_ENEMY_SKINS=["noob","coffee","67","orbit","tung","chicken","sigma","ghost","skibidi","duck","frog","capy","cheese","chill","cat","npc","sigma2","king","plush","verity","matcha","chicken","plush","pigeon","king","galaxy","zero","mango","diamond","croc"];
function mtdAttackStyle(type){return MTD_BEAMS.has(type)?"beam":MTD_BLASTS.has(type)?"blast":MTD_FROST.has(type)?"frost":MTD_BURSTS.has(type)?"rapid":"bolt"}
function mtdShape(c,x,y,r,fill,stroke="#0a1428",width=2){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke()}}
function mtdPoly(c,points,fill,stroke="#11172b",width=2){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke()}}
function mtdUnitArt(c,type,time,enemy=false,seed=0,boss=false){
 const index=Math.abs(String(type).split("").reduce((sum,ch)=>sum*13+ch.charCodeAt(0),7))%8;
 const coats=["#639cd2","#dc9e59","#79b695","#a47aca","#d56f83","#89b6be","#d5c46b","#9f9db3"];
 const coat=coats[index],ink="#152037",white="#f6e9d8";
 c.save();c.rotate(Math.sin(time*2+seed)*.065);c.lineJoin="round";c.lineCap="round";
 // Stylized, hand-drawn miniature character, with silhouette and accessories instead of font glyphs.
 const isAnimal=["shark","croc","capy","frog","doge","cat","duck","chicken","pigeon","ghost","plush","banana","mango","pat"].includes(type);
 const isMachine=["verity","laser","rocket","skibidi","npc","echo","diamond","orbit","zero","galaxy"].includes(type);
 const kind=enemy?Math.abs(seed)%7:index;
 let body=enemy?["#cf7889","#9cbd8e","#bb9ed3","#e0b36f","#81adca","#d68b8b","#a3b1c2"][kind]:coat;
 if(enemy&&boss)body="#b75d9c";
 if(type==="shark"||type==="tral"||type==="pigeon")body="#76a9c1";
 if(type==="frog"||type==="pat"||type==="croc"||type==="matcha")body="#81b785";
 if(type==="banana"||type==="cheese"||type==="duck"||type==="mango")body="#e3bc6b";
 if(type==="coffee"||type==="plush"||type==="cat")body="#d49fa2";
 if(type==="sigma"||type==="sigma2"||type==="king")body="#b5acba";
 if(type==="ghost")body="#c6dce6";
 if(type==="verity"||type==="laser"||type==="zero"||type==="npc")body="#9aaac4";
 // Little boots and arms, with staggered character poses
 c.strokeStyle=ink;c.lineWidth=4.2;
 c.beginPath();c.moveTo(-8,10);c.lineTo(-10,16+Math.sin(time*5+seed)*1.3);c.moveTo(8,10);c.lineTo(10,16-Math.sin(time*5+seed)*1.3);c.stroke();
 c.beginPath();c.moveTo(-12,-1);c.lineTo(-18,5);c.moveTo(12,-1);c.lineTo(18,3);c.stroke();
 c.fillStyle=body;c.strokeStyle=ink;c.lineWidth=2.5;c.beginPath();c.moveTo(-11,11);c.quadraticCurveTo(-17,-2,-10,-11);c.quadraticCurveTo(0,-18,11,-11);c.quadraticCurveTo(16,-3,11,11);c.quadraticCurveTo(0,16,-11,11);c.fill();c.stroke();
 const faceFill=type==="ghost"?"#e6f4fa":type==="sigma"||type==="sigma2"?"#aeb3b7":isMachine?"#d5e6f0":isAnimal?body:white;
 c.fillStyle=faceFill;c.strokeStyle=ink;c.lineWidth=2.1;
 c.beginPath();c.ellipse(0,-6,12.5,11.5,0,0,Math.PI*2);c.fill();c.stroke();
 // Different species silhouettes: fins, ears, horns, crowns, machines, props.
 if(["shark","tral"].includes(type)){mtdPoly(c,[[-5,-15],[0,-26],[8,-14]],body);mtdPoly(c,[[-12,4],[-23,0],[-12,-4]],body)}
 else if(["cat","doge","frog","pigeon","duck","chicken","capy","plush"].includes(type)){
   const pointed=["cat","doge","pigeon"].includes(type);
   if(pointed){mtdPoly(c,[[-12,-11],[-13,-22],[-4,-16]],body);mtdPoly(c,[[5,-16],[13,-22],[12,-11]],body)}
   else{mtdShape(c,-10,-14,5,body);mtdShape(c,10,-14,5,body)}
 }
 if(type==="croc"){c.fillStyle=body;c.beginPath();c.ellipse(4,2,17,7,0,0,Math.PI*2);c.fill();c.stroke();for(let i=0;i<3;i++)mtdPoly(c,[[8+i*4,7],[10+i*4,11],[12+i*4,7]],white,null)}
 if(type==="banana"){mtdPoly(c,[[-15,-18],[-10,-24],[-1,-13],[12,-2],[8,10],[0,2]],"#f6d35c",ink)}
 if(type==="mango"){mtdShape(c,0,-9,14,"#eda349");mtdPoly(c,[[0,-21],[7,-25],[10,-19]],"#7eb973",ink)}
 if(["king","tral","sigma2"].includes(type)||boss){mtdPoly(c,[[-13,-17],[-13,-26],[-7,-21],[0,-30],[7,-21],[13,-26],[13,-17]],"#f4c969","#81522f",2)}
 if(["coffee","matcha"].includes(type)){c.fillStyle=type==="coffee"?"#f5d4b4":"#a5dd9e";c.fillRect(-8,3,16,10);c.strokeRect(-8,3,16,10);c.beginPath();c.arc(10,6,5,-Math.PI/2,Math.PI/2);c.stroke()}
 if(type==="rocket"){mtdPoly(c,[[11,-14],[19,-25],[20,-4],[13,2]],"#e5abbb");mtdPoly(c,[[15,3],[24,9],[18,-3]],"#ffbd62",null)}
 if(type==="tung"||type==="drum"){c.strokeStyle="#955b37";c.lineWidth=4;c.beginPath();c.moveTo(11,5);c.lineTo(22,-19);c.stroke()}
 if(type==="laser"||type==="verity"||type==="orbit"||type==="galaxy"||type==="zero"){mtdShape(c,0,7,7,"#90d5ff","#4a7ab4",2);mtdShape(c,0,7,3,"#e9faff",null)}
 if(type==="skibidi"||type==="echo"){c.strokeStyle="#415272";c.lineWidth=3;c.strokeRect(-15,1,30,18);mtdShape(c,0,10,7,"#647baf");mtdShape(c,0,10,3,"#102341",null)}
 if(type==="diamond"){mtdPoly(c,[[-11,3],[0,-8],[12,3],[0,16]],"#96e6fa","#4386b0",2)}
 if(type==="ghost"){c.fillStyle="#d7edff";c.beginPath();c.arc(0,3,10,Math.PI,0);c.lineTo(10,17);c.lineTo(4,13);c.lineTo(-2,17);c.lineTo(-8,13);c.closePath();c.fill();c.stroke()}
 if(type==="chill"){c.strokeStyle="#181e30";c.lineWidth=3;c.beginPath();c.moveTo(-11,-10);c.lineTo(-2,-8);c.lineTo(2,-8);c.lineTo(11,-10);c.stroke()}
 if(type==="67"){c.strokeStyle="#f2c48c";c.lineWidth=5;c.beginPath();c.moveTo(-16,-2);c.lineTo(-20,-14);c.moveTo(15,-2);c.lineTo(21,-14);c.stroke()}
 if(type==="noob"){c.fillStyle="#e8d164";c.fillRect(-10,-17,20,18);c.strokeRect(-10,-17,20,18)}
 if(type==="npc"){c.fillStyle="#1a2a49";c.fillRect(10,-19,11,19);c.fillStyle="#87d9ed";c.fillRect(12,-17,7,14)}
 // Expressive face, readable at gameplay size.
 c.fillStyle="#121a2d";
 if(isMachine||type==="sigma"||type==="sigma2"){c.fillRect(-8,-10,6,3);c.fillRect(3,-10,6,3)}
 else{mtdShape(c,-5,-8,2.3,"#1c2330",null);mtdShape(c,5,-8,2.3,"#1c2330",null)}
 c.strokeStyle="#30304a";c.lineWidth=1.5;c.beginPath();c.arc(0,-3,4,.15,Math.PI-.15);c.stroke();
 if(enemy){c.strokeStyle=boss?"#ffcc79":"#e9708b";c.lineWidth=2.5;c.beginPath();c.moveTo(-10,-16);c.lineTo(-2,-13);c.moveTo(10,-16);c.lineTo(2,-13);c.stroke()}
 c.restore();
}
function mtdPortrait(type){const canvas=document.createElement("canvas");canvas.width=56;canvas.height=56;canvas.className="mtd-portrait";canvas.setAttribute("aria-hidden","true");const c=canvas.getContext("2d");c.translate(28,28);c.scale(1.05,1.05);mtdUnitArt(c,type,0,false,0,false);return canvas}
function draw(){
 if(!ctx)return;
 ctx.clearRect(0,0,900,560);ctx.drawImage(mapBackground(),0,0);
 if(game&&game.wave>=10){ctx.fillStyle=game.wave>=30?"#54183a1c":game.wave>=20?"#394c9a18":"#66a4a811";ctx.fillRect(0,0,900,560)}
 const now=performance.now()/1000;ctx.save();
 if(screenShake>0){ctx.translate(Math.sin(now*78)*screenShake,Math.cos(now*62)*screenShake);screenShake=Math.max(0,screenShake-.25)}
 if(game){
  const selectedType=selected===null?null:UNITS.find(u=>u[0]===selected);
  if(hover&&selectedType&&picked===null&&!game.ended){
   const ok=canPlace(hover.x,hover.y)&&(game.cash[id()]||0)>=selectedType[3]&&deployed(selected)<towerLimit(selected);
   ctx.save();ctx.globalAlpha=.35;ctx.fillStyle=ok?"#77ffcf":"#fa7994";ctx.beginPath();ctx.arc(hover.x,hover.y,selectedType[5],0,Math.PI*2);ctx.fill();ctx.globalAlpha=.95;ctx.strokeStyle=ok?"#94ffe6":"#ff879b";ctx.lineWidth=3;ctx.beginPath();ctx.arc(hover.x,hover.y,24,0,Math.PI*2);ctx.stroke();ctx.save();ctx.translate(hover.x,hover.y);ctx.scale(1.1,1.1);mtdUnitArt(ctx,selected,now,false,0,false);ctx.restore();ctx.restore();
  }

  for(const t of game.towers){
    const u=UNITS.find(z=>z[0]===t.type);if(!u)continue;
    const range=u[5]*(1+.08*(t.level-1)),tier=RARITY[t.type]||"common",accent=RARITY_COLOR[tier]||u[7];
    if(picked===t.id){ctx.save();ctx.fillStyle="#76d9ff16";ctx.strokeStyle="#c3e9ffb9";ctx.lineWidth=2;ctx.setLineDash([7,7]);ctx.beginPath();ctx.arc(t.x,t.y,range,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore()}
    ctx.save();ctx.translate(t.x,t.y);
    const wobble=1+Math.sin(now*2.8+t.id)*.032;
    ctx.fillStyle="#050e1dc2";ctx.beginPath();ctx.ellipse(3,18,28,11,0,0,Math.PI*2);ctx.fill();
    ctx.scale(wobble,wobble);
    ctx.shadowColor=accent;ctx.shadowBlur=t.level>=4?18:7;
    ctx.fillStyle="#101a32";ctx.strokeStyle="#080e1a";ctx.lineWidth=3;
    ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/8;ctx.lineTo(Math.cos(a)*29,Math.sin(a)*29)}ctx.closePath();ctx.fill();ctx.stroke();
    ctx.shadowBlur=0;
    const towerFill=ctx.createLinearGradient(-22,-26,21,27);
    towerFill.addColorStop(0,"#3a4a70");towerFill.addColorStop(.5,"#263c62");towerFill.addColorStop(1,"#0b1b38");
    ctx.fillStyle=towerFill;ctx.beginPath();ctx.arc(0,0,24,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=accent;ctx.lineWidth=t.level>=4?4:3;ctx.stroke();
    ctx.strokeStyle="#ecfaff77";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,20,Math.PI*1.18,Math.PI*1.78);ctx.stroke();
    ctx.fillStyle="#111929";ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.fill();
    mtdUnitArt(ctx,t.type,now,false,t.id,false);
    if(t.level>=3){ctx.save();ctx.rotate(now*.38*(t.level>=5?1.4:1));ctx.strokeStyle=accent;ctx.globalAlpha=.7;ctx.lineWidth=2;ctx.setLineDash([11,9]);ctx.beginPath();ctx.arc(0,0,34,0,Math.PI*2);ctx.stroke();ctx.restore()}
    if(t.level>=5){for(let i=0;i<4;i++){const ang=now*1.25+i*Math.PI/2;ctx.fillStyle="#fff3bb";ctx.shadowColor="#ffd569";ctx.shadowBlur=9;ctx.beginPath();ctx.arc(Math.cos(ang)*38,Math.sin(ang)*38,3,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0}
    if(t.type==="verity"||t.type==="sigma2"||t.type==="king"){ctx.strokeStyle=accent;ctx.lineWidth=1.5;for(let i=0;i<3;i++){const a=now*1.6+i*Math.PI*2/3;ctx.beginPath();ctx.arc(Math.cos(a)*32,Math.sin(a)*32,4,0,Math.PI*2);ctx.stroke()}}
    ctx.restore();
    ctx.save();ctx.textAlign="center";ctx.font="bold 10px system-ui";
    ctx.fillStyle="#101b32eb";ctx.strokeStyle=accent;ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(t.x-26,t.y-44,52,14,5);ctx.fill();ctx.stroke();
    ctx.fillStyle="#fff0b2";ctx.fillText("★".repeat(Math.min(5,t.level)),t.x,t.y-33);
    if(picked===t.id){ctx.font="bold 11px system-ui";ctx.fillStyle="#f2f8ff";ctx.fillText(u[1],t.x,t.y+46)}
    ctx.restore();
  }
  for(const e of game.enemies){
    if(e.hp<=0||e.passed)continue;
    const boss=!!e.boss,r=boss?34:23,ratio=Math.max(0,Math.min(1,e.hp/Math.max(1,e.maxHp))),slow=e.slow>0;
    const accent=boss?"#ffbe69":slow?"#83e3fa":ratio<.3?"#ff738b":"#ed829b";
    const bob=Math.sin(now*6+(e.id||0))*(boss?2.3:1.3);
    ctx.save();ctx.translate(e.x,e.y+bob);
    ctx.fillStyle="#061224a3";ctx.beginPath();ctx.ellipse(3,18,r+5,12,0,0,Math.PI*2);ctx.fill();
    if(boss){ctx.save();ctx.rotate(now*.7);ctx.strokeStyle="#ffc86788";ctx.lineWidth=2;ctx.setLineDash([8,9]);ctx.beginPath();ctx.arc(0,0,r+8,0,Math.PI*2);ctx.stroke();ctx.restore()}
    ctx.shadowColor=accent;ctx.shadowBlur=boss?16:slow?11:4;
    const skin=ctx.createLinearGradient(-r,-r,r,r);skin.addColorStop(0,e.flash>0?"#ffffff":boss?"#9a3b73":slow?"#2787a3":"#40587d");skin.addColorStop(1,e.flash>0?"#ecfaff":boss?"#3b174b":slow?"#16425b":"#17263f");
    ctx.fillStyle=skin;ctx.strokeStyle=accent;ctx.lineWidth=boss?4:2.5;
    ctx.beginPath();for(let k=0;k<8;k++){const a=k*Math.PI/4;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle="#0c1730bd";ctx.beginPath();ctx.arc(0,0,r-5,0,Math.PI*2);ctx.fill();
    mtdUnitArt(ctx,e.skin||MTD_ENEMY_SKINS[Math.abs(e.id||0)%MTD_ENEMY_SKINS.length],now,true,e.id||0,boss);
    if(slow){ctx.strokeStyle="#b2f8ff";ctx.lineWidth=2;for(let k=0;k<3;k++){const a=now*1.2+k*Math.PI*2/3;ctx.beginPath();ctx.arc(Math.cos(a)*(r+4),Math.sin(a)*(r+4),2.5,0,Math.PI*2);ctx.stroke()}}
    ctx.restore();
    const barW=boss?78:54,x=e.x-barW/2,y=e.y+bob-r-20;
    ctx.fillStyle="#071326dd";ctx.beginPath();ctx.roundRect(x-2,y-2,barW+4,10,4);ctx.fill();
    ctx.fillStyle=ratio<.3?"#f06581":boss?"#f6bd6c":"#75e7b5";ctx.beginPath();ctx.roundRect(x,y,Math.max(0,barW*ratio),6,2);ctx.fill();
    ctx.fillStyle="#ffffff77";ctx.fillRect(x+1,y+1,Math.max(0,barW*ratio-2),1);
    if(boss){ctx.fillStyle="#ffe1a0";ctx.font="900 11px system-ui";ctx.textAlign="center";ctx.fillText("⚠ BOSS",e.x,y-7)}
  }

  for(const v of game.effects){
    ctx.save();
    if(v.burst){const progress=1-v.life/.7;ctx.globalAlpha=Math.max(0,1-progress);ctx.strokeStyle="#f8d176";ctx.lineWidth=12*(1-progress);ctx.shadowColor="#ffc96c";ctx.shadowBlur=22;ctx.beginPath();ctx.arc(450,280,progress*510,0,Math.PI*2);ctx.stroke();ctx.restore();continue}
    const style=v.style||((v.laser)?"beam":"bolt"),duration=v.duration||.2;
    const p=Math.max(0,Math.min(1,1-v.life/duration));
    const dx=v.tx-v.x,dy=v.ty-v.y,angle=Math.atan2(dy,dx),distance=Math.hypot(dx,dy);
    const alpha=Math.max(0,Math.min(1,v.life/.12)),color=v.c||"#8fe8ff";
    ctx.globalAlpha=alpha;
    const impactX=v.tx,impactY=v.ty;
    if(style==="beam"){
      const width=(v.level||1)*1.2+3.5;
      ctx.shadowColor=color;ctx.shadowBlur=15;
      ctx.lineCap="round";ctx.lineWidth=width*3.1;ctx.strokeStyle=color+"45";
      ctx.beginPath();ctx.moveTo(v.x,v.y);ctx.lineTo(v.tx,v.ty);ctx.stroke();
      ctx.lineWidth=width*1.35;ctx.strokeStyle=color;
      ctx.beginPath();ctx.moveTo(v.x,v.y);ctx.lineTo(v.tx,v.ty);ctx.stroke();
      ctx.shadowBlur=0;ctx.lineWidth=Math.max(1.5,width*.45);ctx.strokeStyle="#f5fcff";
      ctx.beginPath();ctx.moveTo(v.x,v.y);ctx.lineTo(v.tx,v.ty);ctx.stroke();
      const zig=3+((v.level||1)>3?2:0);ctx.strokeStyle=color;ctx.lineWidth=1.4;
      ctx.beginPath();ctx.moveTo(v.x,v.y);
      for(let z=1;z<zig;z++){const q=z/zig,displace=Math.sin(z*18+v.seed*4+p*12)*(5+(v.level||1));ctx.lineTo(v.x+dx*q-Math.sin(angle)*displace,v.y+dy*q+Math.cos(angle)*displace)}
      ctx.lineTo(v.tx,v.ty);ctx.stroke();
    }else{
      const travel=Math.min(1,p*(style==="rapid"?3.1:style==="frost"?1.55:2.15));
      const x=v.x+dx*travel,y=v.y+dy*travel;
      ctx.lineCap="round";ctx.shadowColor=color;ctx.shadowBlur=14;
      const trail=style==="rapid"?18:style==="blast"?35:style==="frost"?32:28;
      const tail=Math.min(1,trail/Math.max(1,distance));
      const gradient=ctx.createLinearGradient(x-dx*tail,y-dy*tail,x,y);
      gradient.addColorStop(0,color+"00");gradient.addColorStop(1,color);
      ctx.strokeStyle=gradient;ctx.lineWidth=style==="blast"?10:style==="frost"?7:style==="rapid"?3:5;
      ctx.beginPath();ctx.moveTo(x-dx*tail,y-dy*tail);ctx.lineTo(x,y);ctx.stroke();
      ctx.fillStyle=style==="frost"?"#d7fcff":style==="blast"?"#fff4c7":"#ffffff";
      ctx.beginPath();ctx.arc(x,y,style==="blast"?6:style==="frost"?4.5:style==="rapid"?2.7:4,0,Math.PI*2);ctx.fill();
      if(style==="frost"){ctx.strokeStyle="#a9efff";ctx.lineWidth=1.3;for(let k=0;k<4;k++){let a=k*Math.PI/2+p*3;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*5,y+Math.sin(a)*5);ctx.lineTo(x+Math.cos(a)*11,y+Math.sin(a)*11);ctx.stroke()}}
      if(travel<1){ctx.restore();continue}
    }
    ctx.shadowColor=color;ctx.shadowBlur=style==="blast"?21:11;
    const impactProgress=style==="beam"?p:Math.min(1,Math.max(0,(p-.48)*2));
    const ring=style==="blast"?13+impactProgress*(v.splash||35):8+impactProgress*13;
    ctx.globalAlpha=alpha*(1-impactProgress*.65);ctx.strokeStyle=color;ctx.lineWidth=style==="blast"?5:2.5;
    ctx.beginPath();ctx.arc(impactX,impactY,ring,0,Math.PI*2);ctx.stroke();
    ctx.shadowBlur=0;
    for(let i=0;i<(style==="blast"?10:style==="rapid"?3:6);i++){
      const a=i*Math.PI*2/(style==="blast"?10:style==="rapid"?3:6)+(v.seed||0);
      const d=8+impactProgress*(style==="blast"?40:19);
      ctx.fillStyle=i%2?"#f5fcff":color;
      ctx.beginPath();ctx.arc(impactX+Math.cos(a)*d,impactY+Math.sin(a)*d,Math.max(1,(style==="blast"?3.8:2)*(1-impactProgress*.65)),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  ctx.fillStyle="#09182dcc";ctx.fillRect(12,9,510,44);ctx.strokeStyle="#c5c4fe44";ctx.strokeRect(12,9,510,44);
  ctx.textAlign="left";ctx.fillStyle="#f3f6ff";ctx.font="bold 18px system-ui";
  ctx.fillText(game.endless?"♾ "+game.wave:"⚔ "+game.wave+"/40",24,38);ctx.fillText("🧠 "+game.base,150,38);ctx.fillText("💰 "+(game.cash[id()]||0),262,38);ctx.fillText("👥 "+game.players.length,425,38);
  if(!game.active&&!game.ended&&!game.victoryChoice){ctx.textAlign="center";ctx.font="bold 18px system-ui";ctx.fillStyle="#e8f4ff";ctx.fillText(game.endless?"♾ ENDLESS MODE · PREPARE NEXT WAVE":"BUILD PHASE · START NEXT WAVE",450,92)}
  if(game.ended){ctx.fillStyle="#071127d9";ctx.fillRect(0,0,900,560);ctx.textAlign="center";ctx.fillStyle=game.base>0?"#a4ffd1":"#ffadbd";ctx.font="bold 55px system-ui";ctx.fillText(game.base>0?"🏆 VICTORY":"GAME OVER",450,270);ctx.font="20px system-ui";ctx.fillStyle="white";ctx.fillText(game.wave+" waves · "+(game.kills||0)+" enemies defeated",450,311);ctx.fillText("Select Restart for another run",450,344)}
 }
 ctx.restore();
}
const SOLO_KEY="discard-meme-td-solo-v1";
function saveSolo(){if(!game||game.coop||game.ended)return;try{const saved={...game,host:null,cash:{solo:game.cash[id()]||0},players:[],towers:game.towers.map(t=>({...t,owner:"solo"})),enemies:game.enemies.slice(0,210),effects:[],active:!!game.active,spawn:game.spawn||0,spawnCooldown:game.spawnCooldown||0};localStorage.setItem(SOLO_KEY,JSON.stringify(saved))}catch{}}
function loadSolo(){try{const saved=JSON.parse(localStorage.getItem(SOLO_KEY)||"null");if(!saved||saved.coop||!Array.isArray(saved.towers)||!Number.isFinite(saved.wave)||saved.wave<0||saved.wave>100000||saved.ended||saved.wave>=40&&!saved.endless&&!saved.victoryChoice)return null;return saved}catch{return null}}
const RECORD_KEY="discard-meme-td-records-v1";
function recordResult(){try{const old=JSON.parse(localStorage.getItem(RECORD_KEY)||"{}");const wave=game?.wave||0;old.highestWave=Math.max(Number(old.highestWave)||0,wave);old.wins=(Number(old.wins)||0)+(game?.base>0&&wave>=40&&!game.victoryRecorded?1:0);old.runs=(Number(old.runs)||0)+(!game.resultRecorded?1:0);if(game)game.resultRecorded=true;localStorage.setItem(RECORD_KEY,JSON.stringify(old))}catch{}}
function records(){try{return JSON.parse(localStorage.getItem(RECORD_KEY)||"{}")}catch{return {}}}
function ui(){if(!root)return;$("#mtdStats").textContent=game?(game.endless?"♾️ Endless ":"Wave ")+game.wave+" · 🧠 "+game.base+" · $"+(game.cash[id()]||0):"2025–26 Brainrot Defense";$("#mtdRoom").textContent=game?(game.coop?"Join code: "+game.code+" · Host "+game.host.slice(0,12):"Solo Match"):"Create a lobby or join with a code." ;$("#mtdPlayers").textContent=game?"Players "+game.players.length+"/4: "+game.players.map(x=>x===id()?"You":x.slice(0,12)).join(", "):"";$("#mtdSpeed").textContent="Speed "+(game?.speed||1)+"×";
$("#mtdAuto").textContent=game?.auto?"Auto-wave: On":"Auto-wave: Off";
$("#mtdContinue").disabled=!loadSolo();
$("#mtdAuto").disabled=!host()||game?.ended;
const targeting=game?.towers.find(t=>t.id===picked);
$("#mtdTarget").textContent="Target: "+(targeting?.target||"first").replace(/^./,x=>x.toUpperCase());
$("#mtdTarget").disabled=!targeting||targeting.owner!==id();
const timer=game?.surges?.[id()]||0,cd=game?Math.ceil(Math.max(0,timer-(game.time||0))):0;
$("#mtdAbility").textContent=cd?"⚡ Surge "+cd+"s":"⚡ 67 Surge";
$("#mtdAbility").disabled=!game||!!game.ended||cd>0;
$("#mtdWave").disabled=!game||!!game.active||!!game.ended||!!game.victoryChoice||game.wave>=40&&!game.endless||!$("#mtdLobby").classList.contains("hidden");$("#mtdWave").textContent=game?.endless?"♾️ Start Wave "+(game.wave+1):"▶ Start Wave";$("#mtdEndlessChoice").classList.toggle("hidden",!game?.victoryChoice);$("#mtdGoEndless").disabled=!host();$("#mtdFinishRun").disabled=!host();$("#mtdSaveRound").disabled=!game||!!game.coop||!!game.ended;
const record=records();$("#mtdRunStats").textContent=game?`${game.kills||0} defeats · ${game.leaks||0} leaks · ${game.towers.length}/65 towers · ${game.difficulty||"normal"} difficulty · Best wave ${Math.max(record.highestWave||0,game.wave)}`:`Best wave ${record.highestWave||0} · ${record.wins||0} wins`;
for(const b of root.querySelectorAll("[data-unit]")){b.classList.toggle("active",(selected===null?b.dataset.unit==="none":b.dataset.unit===selected)&&picked===null);if(b.dataset.unit!=="none"){const u=UNITS.find(u=>u[0]===b.dataset.unit),sub=b.querySelector("small");if(u&&sub)sub.textContent="$"+u[3]+" · "+RARITY[u[0]].toUpperCase()+" · "+deployed(u[0])+"/"+towerLimit(u[0])+" placed";b.classList.toggle("mtd-full",!!game&&deployed(b.dataset.unit)>=towerLimit(b.dataset.unit))}}const t=game?.towers.find(t=>t.id===picked);$("#mtdDetails").textContent=t?(()=>{const u=UNITS.find(u=>u[0]===t.type),cost=Math.round(u[3]*(.65+t.level*.6));return u[2]+" "+u[1]+" · Level "+t.level+"/5 · "+(t.owner===id()?"Your tower":"Teammate's tower")+" · DMG "+Math.round(u[4]*Math.pow(1.6,t.level-1))+" · Range "+Math.round(u[5]*(1+.08*(t.level-1)))+" · "+(t.level>=5?"MAX LEVEL":"Next upgrade $"+cost);})():selected===null?"✋ Nothing selected. Click a tower to inspect it, or select an equipped unit to place.":UNITS.find(u=>u[0]===selected)[1]+" · $"+UNITS.find(u=>u[0]===selected)[3]+" · Click map to place";$("#mtdUpgrade").disabled=!t||t.owner!==id()||t.level>=5;$("#mtdUpgrade").textContent=t&&t.level<5?"⬆ Upgrade $"+Math.round(UNITS.find(u=>u[0]===t.type)[3]*(.65+t.level*.6)):"⬆ Upgrade";$("#mtdSell").disabled=!t||t.owner!==id();$("#mtdSell").textContent=t?"Sell +$"+Math.round(UNITS.find(u=>u[0]===t.type)[3]*(.55+.22*(t.level-1))):"Sell";$("#mtdMessage").textContent=alertText}
function loop(now){const dt=Math.min(.07,(now-last)/1000||0);last=now;if(game){tick(dt);networkAt+=dt;if(host()&&game.coop&&networkAt>.33){networkAt=0;for(const p of game.players)if(p!==id())send(p,{t:"mtd-state",code:game.code,state:{...game,effects:game.effects.slice(-22),enemies:game.enemies.slice(0,210)}})}if(now-lastUI>250){lastUI=now;ui()}}gameClock+=dt;if(gameClock>1){gameClock=0;updatePlaytime();if(game&&host()&&!game.coop&&!game.ended&&Math.floor((game.time||0)/12)!==Math.floor(((game.time||0)-1)/12))saveSolo();if(game&&host()&&game.coop&&performance.now()-hostOfferAt>12000){hostOfferAt=performance.now();for(const p of friends())if(!game.players.includes(p))send(p,{t:"mtd-offer",code:game.code})}}if(joinTime&&!game&&Date.now()-joinTime<40000&&Date.now()-joinRetryAt>3000){joinRetryAt=Date.now();requestJoin()}if(joinTime&&!game&&Date.now()-joinTime>=40000){joinTime=0;if(root)$("#mtdLobbyMessage").textContent="Couldn't connect. Confirm the host is online and try again."}draw();raf=requestAnimationFrame(loop)}
function close(){if(game&&!game.coop&&!game.ended)saveSolo();chatLog=[];chatUnread=0;stopPlaytime();if(game&&host())sendAll({t:"mtd-ended",code:game.code});if(game&&!host())send(game.host,{t:"mtd-leave",code:game.code});game=null;root.classList.add("hidden");cancelAnimationFrame(raf);raf=0;window.setDiscardGameActivity?.("")}
window.openMemeTowerDefense=()=>{init();root.classList.remove("hidden");if(!localStart)localStart=Date.now();updatePlaytime();window.setDiscardGameActivity?.("Meme Tower Defense");lobby(!game);if(!raf){last=performance.now();raf=requestAnimationFrame(loop)}ui()};
window.mtdHandle=(from,d)=>{if(!d?.t?.startsWith("mtd-"))return false;
if(d.t==="mtd-feedback"){if(game&&!host()&&d.code===game.code&&from===game.host&&typeof d.text==="string")notify(d.text);return true}

if(d.t==="mtd-chat"){if(game&&host()&&game.coop&&d.code===game.code&&game.players.includes(from))acceptChat(from,d.text);return true}
if(d.t==="mtd-chat-line"){if(game&&!host()&&d.code===game.code&&d.runId===game.runId&&from===game.host&&game.players.includes(d.from))addChatLine(d.from,d.text,d.seq);return true}

if(d.t==="mtd-offer"){if(/^[A-Z]{5}$/.test(d.code))offers.set(d.code,from);return true}
if(d.t==="mtd-join"){if(!host()||!game.coop||d.code!==game.code)return true;if(!game.players.includes(from)&&game.players.length<4){game.players.push(from);game.cash[from]=700;game.unlocks=game.unlocks||{};game.unlocks[from]=Array.isArray(d.equipped)?[...new Set(d.equipped.filter(x=>UNITS.some(u=>u[0]===x)))].slice(0,7):[...STARTERS]}if(game.players.includes(from))send(from,{t:"mtd-accepted",code:game.code,state:game,chat:chatLog.slice(-45)});ui();return true}
if(d.t==="mtd-accepted"){if(!game&&root&&Date.now()-joinTime<40000&&d.code===$("#mtdCode")?.value.toUpperCase()){game=d.state;game.host=from;game.coop=true;applyMap(game.map||"city");chatLog=Array.isArray(d.chat)?d.chat.filter(x=>x&&typeof x.text==="string").slice(-45):[];renderChat();joinTime=0;lobby(false);notify("Joined multiplayer!")}return true}
if(d.t==="mtd-reward"){if(game&&!host()&&from===game.host&&d.code===game.code&&d.runId===game.runId&&Number.isInteger(d.wave)&&d.wave>0&&d.wave<=40)waveReward(d.wave);return true}if(d.t==="mtd-ended"){if(game&&!host()&&game.host===from&&game.code===d.code){game=null;chatLog=[];renderChat();lobby(true);$("#mtdLobbyMessage").textContent="The host left this match."}return true}
if(d.t==="mtd-command"){if(host()&&game&&d.code===game.code&&game.players.includes(from))apply(from,d.action,d.arg||{});return true}
if(d.t==="mtd-state"){if(game&&!host()&&game.host===from&&d.code===game.code){const oldMap=game.map;game=d.state;game.host=from;if(game.map!==oldMap)applyMap(game.map||"city");ui()}return true}
if(d.t==="mtd-leave"){if(host()&&game&&d.code===game.code){game.players=game.players.filter(p=>p!==from);delete game.cash[from];if(game.unlocks)delete game.unlocks[from];ui()}return true}
return true};
})();