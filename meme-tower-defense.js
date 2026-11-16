(function MemeTowerDefense(){
"use strict";
const MAPS={
 city:{name:"Brainrot City",emoji:"🌆",path:[[0,270],[125,270],[125,90],[315,90],[315,430],[515,430],[515,180],[705,180],[705,350],[900,350]],theme:["#294d63","#315b53","#25485a"]},
 subway:{name:"Subway 67",emoji:"🚇",path:[[0,270],[170,270],[170,95],[450,95],[450,460],[715,460],[715,180],[900,180]],theme:["#38374d","#474257","#253b55"]},
 desert:{name:"Sahur Desert",emoji:"🏜️",path:[[0,160],[220,160],[220,410],[425,410],[425,150],[630,150],[630,380],[900,380]],theme:["#76543f","#9b7753","#4e5145"]},
 mall:{name:"Rizz Mall",emoji:"🛍️",path:[[0,360],[160,360],[160,170],[365,170],[365,370],[585,370],[585,125],[785,125],[785,360],[900,360]],theme:["#444272","#435e79","#2d486a"]},
 void:{name:"Aura Void",emoji:"🌌",path:[[0,270],[145,270],[145,445],[340,445],[340,135],[575,135],[575,405],[760,405],[760,230],[900,230]],theme:["#25264c","#43336e","#1c3a56"]}
};
let PATH=MAPS.city.path;
function applyMap(map){const key=Object.hasOwn(MAPS,map)?map:"city";PATH=MAPS[key].path;mapCache=null;return key}
const STARTERS=["67","tung","shark"];
const RARITY={67:"starter",tung:"starter",shark:"starter",coffee:"common",croc:"rare",pat:"rare",banana:"epic",sigma:"epic",verity:"mythic",capy:"common",bomb:"rare",cheese:"common",chill:"rare",frog:"epic",noob:"common",doge:"rare",skibidi:"epic",cat:"common",galaxy:"legendary",ghost:"epic",tral:"legendary",laser:"legendary",npc:"common",sigma2:"mythic",duck:"rare"};
const RARITY_COLOR={starter:"#9bacbb",common:"#91e8b6",rare:"#7aaaff",epic:"#c999ff",legendary:"#ffca72",mythic:"#ff8fc2"};
const PROFILE_KEY="discard-mtd-profile-v2";
let profile=null,menuTab="play",selectedCrate="standard",lastMenuSignature="",lastSelectionId=null;
function profileData(){if(profile)return profile;try{profile=JSON.parse(localStorage.getItem(PROFILE_KEY)||"null")}catch{};if(!profile||!Array.isArray(profile.unlocked))profile={coins:900,unlocked:[...STARTERS],crates:0,duplicates:0};profile.coins=Math.max(0,Number(profile.coins)||0);profile.unlocked=[...new Set([...STARTERS,...profile.unlocked.filter(x=>typeof x==="string")])];return profile}
function saveProfile(){try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profileData()))}catch{}}
function owned(unit){return profileData().unlocked.includes(unit)}
function grantCoins(amount){const p=profileData();p.coins+=Math.max(0,Math.floor(amount));saveProfile()}
function allCrates(){return [{id:"standard",name:"Meme Crate",cost:250,weights:{common:64,rare:28,epic:7,legendary:1}},{id:"premium",name:"Legend Crate",cost:950,weights:{rare:45,epic:38,legendary:15,mythic:2}},{id:"mythic",name:"Aura Crate",cost:2500,weights:{epic:52,legendary:37,mythic:11}}]}
function openCrate(id){const p=profileData(),crate=allCrates().find(x=>x.id===id);if(!crate)return;if(p.coins<crate.cost){notify("Need "+(crate.cost-p.coins)+" more coins!");return}p.coins-=crate.cost;p.crates++;const rarityRoll=Math.random()*100;let rarity="common",cumulative=0;for(const [tier,chance] of Object.entries(crate.weights)){cumulative+=chance;if(rarityRoll<cumulative){rarity=tier;break}}
let pool=UNITS.filter(u=>RARITY[u[0]]===rarity),unit=pool[Math.floor(Math.random()*pool.length)];if(!unit){unit=UNITS.find(u=>!owned(u[0]));rarity=RARITY[unit?.[0]]||"common"}if(!unit){p.coins+=Math.round(crate.cost*.5);saveProfile();renderMenu(true);return}
const duplicate=owned(unit[0]);if(duplicate){const refund=Math.floor(crate.cost*.4);p.coins+=refund;p.duplicates++;notify("Duplicate "+unit[1]+" · +"+refund+" coins")}else{p.unlocked.push(unit[0]);notify("UNLOCKED "+unit[1]+"!")}
saveProfile();$("#mtdCrateResult").textContent=(duplicate?"DUPLICATE · ":"NEW UNIT · ")+unit[2]+" "+unit[1]+" ["+rarity.toUpperCase()+"]";renderMenu(true);renderUnits()}
function waveReward(w){if(!game)return;const rate={easy:.75,normal:1,hard:1.5,impossible:2}[game.difficulty]||1;const amount=Math.round((42+w*8)*rate);const key="discard-mtd-reward-"+(game.runId||game.code)+"-"+w;try{if(localStorage.getItem(key))return;localStorage.setItem(key,"1")}catch{}grantCoins(amount);notify("WAVE "+w+" CLEARED! +"+amount+" crate coins");renderMenu(true)}
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
["duck","Giga Duck","🦆",800,75,184,.75,"#fee08d"]];
const BADS=[["😐",65,54,14],["💈",135,72,20],["🙌",200,97,28],["🌀",370,65,43],["👴",720,50,65],["🍗",1060,70,95],["🗿",1680,42,135],["💀",2400,60,200],["🚽",2950,72,205],["🦆",3250,87,245],["🐸",3850,53,300],["🦫",4200,47,335],["🧀",4850,63,390],["😎",5600,100,430],["🐈",6600,93,485],["📱",7250,75,520],["🪨",8600,42,650],["👑",9500,48,690],["🎭",11200,79,820],["🤖",16000,45,980]];
let root,canvas,ctx,game=null,offers=new Map(),selected="67",picked=null,raf=0,last=0,networkAt=0,joinTime=0,alertText="",lastUI=0,joinRetryAt=0,hostOfferAt=0,gameClock=0,selectedTarget="first",hover=null,particles=[],screenShake=0,joinRetry=0,localStart=0,playClock=0,backgroundCanvas=null;
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
document.head.append(style)}
function init(){if(root)return;css();root=document.createElement("div");root.id="mtdRoot";root.className="hidden";
root.innerHTML=`<div class="app"><header><strong>🧠 MEME TOWER DEFENSE</strong><span id="mtdStats">2025–26 Brainrot Defense</span><span id="mtdPlaytime">Played 0h 0m</span><button id="mtdLobbyOpen">Lobby</button><button id="mtdExit">✕ Exit</button></header><div class="body"><div class="stage"><canvas width="900" height="560" id="mtdCanvas"></canvas></div><aside><h3>PLACE MEME UNITS</h3><div class="units" id="mtdUnits"></div><h3>SELECTED TOWER</h3><p id="mtdDetails"></p><div class="actions"><button id="mtdUpgrade">Upgrade</button><button id="mtdSell">Sell</button></div><div class="actions" style="margin-top:7px"><button id="mtdTarget">Target: First</button><button id="mtdAuto">Auto-wave: Off</button></div><h3>WAVES</h3><div class="actions"><button id="mtdWave">▶ Start Wave</button><button id="mtdSpeed">Speed 1×</button></div><div class="actions" style="margin-top:7px"><button id="mtdAbility">⚡ 67 Surge</button><button id="mtdRestart">↻ Restart</button></div><h3>RUN STATS</h3><p id="mtdRunStats"></p><p id="mtdMessage"></p></aside></div></div><div class="lobby" id="mtdLobby"><div class="panel"><h2>🧠 Meme Tower Defense</h2><p>Protect the last brain cell against 40 waves of 2025–26 meme enemies. Place and upgrade meme towers. Fight a giant boss every 10 waves. Play solo or co-op with up to 4 Discard friends.</p><div class="actions"><button id="mtdSolo">New Solo Game</button><button id="mtdContinue">Continue Saved</button><button id="mtdHost">Host Multiplayer</button></div><div style="margin:12px 0"><label for="mtdDifficulty">Difficulty: </label><select id="mtdDifficulty" style="background:#0d1d37;color:#fff;padding:9px;border:1px solid #647aa4;border-radius:8px"><option value="easy">Easy</option><option selected value="normal">Normal</option><option value="hard">Hard</option><option value="impossible">Impossible</option></select></div><div class="actions" style="margin-top:10px"><input id="mtdCode" maxlength="5" placeholder="JOIN CODE"><button id="mtdJoin">Join Friend</button></div><p id="mtdRoom">Create a lobby or join with a code.</p><p id="mtdPlayers"></p><div class="actions"><button id="mtdStart">Start / Continue</button><button id="mtdLeave">Leave</button></div><p id="mtdLobbyMessage"></p></div></div>`;
document.body.append(root);canvas=$("#mtdCanvas");ctx=canvas.getContext("2d");
for(const u of UNITS){const btn=document.createElement("button");btn.className="unit";btn.dataset.unit=u[0];btn.innerHTML=`<span>${u[2]}</span><div><b>${u[1]}</b><br><small>$${u[3]} · ${u[0]==="verity"?"SPECIAL · one per team":u[4]+" dmg"}</small></div>`;btn.onclick=()=>{selected=u[0];picked=null;ui()};$("#mtdUnits").append(btn)}
$("#mtdExit").onclick=close;$("#mtdLobbyOpen").onclick=()=>lobby(true);
$("#mtdSolo").onclick=()=>{if(game&&!confirm("Replace your current game?"))return;create(false);saveSolo();lobby(false)};
$("#mtdContinue").onclick=()=>{const saved=loadSolo();if(!saved){$("#mtdLobbyMessage").textContent="No saved solo game. Start a new solo run.";return}game=saved;game.host=id();game.players=[id()];game.cash= {[id()]:Math.max(0,Number(Object.values(saved.cash||{})[0])||0)};game.coop=false;game.ended=false;game.active=false;game.spawn=0;game.enemies=[];game.effects=[];game.towers=(game.towers||[]).map(t=>({...t,owner:id(),cool:0}));game.surges={};picked=null;notify("Loaded solo save from wave "+game.wave);lobby(false)};$("#mtdHost").onclick=()=>{create(true);lobby(true)};
$("#mtdJoin").onclick=join;$("#mtdStart").onclick=()=>{if(game)lobby(false);else $("#mtdLobbyMessage").textContent="Create or join a match first"};
$("#mtdLeave").onclick=()=>{if(game&&!host())send(game.host,{t:"mtd-leave",code:game.code});game=null;lobby(true)};
$("#mtdUpgrade").onclick=()=>command("upgrade",{id:picked});$("#mtdSell").onclick=()=>command("sell",{id:picked});
$("#mtdWave").onclick=()=>command("wave");
$("#mtdTarget").onclick=()=>{if(picked!==null)command("target",{id:picked})};
$("#mtdAuto").onclick=()=>{if(host()&&game){game.auto=!game.auto;ui()}else notify("Only the host can change auto-wave.")};
$("#mtdAbility").onclick=()=>command("surge");
$("#mtdRestart").onclick=()=>{if(!host()){notify("Only the host can restart.");return}if(confirm("Restart this match from wave 1?")){const old=game;create(old.coop,old.coop?old.code:null);if(old.coop){game.code=old.code;game.players=[...old.players];game.cash=Object.fromEntries(game.players.map(p=>[p,700]));sendAll({t:"mtd-state",code:game.code,state:game})}lobby(false)}};

$("#mtdSpeed").onclick=()=>{if(host()){game.speed=game.speed===1?2:1;ui()}};
canvas.addEventListener("pointermove",e=>{const r=canvas.getBoundingClientRect();hover={x:(e.clientX-r.left)*900/r.width,y:(e.clientY-r.top)*560/r.height};});
canvas.addEventListener("pointerleave",()=>hover=null);
canvas.addEventListener("pointerdown",e=>{if(!game||!$("#mtdLobby").classList.contains("hidden"))return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*900/r.width,y=(e.clientY-r.top)*560/r.height;const found=[...game.towers].reverse().find(v=>Math.hypot(v.x-x,v.y-y)<27);if(found){picked=found.id;ui()}else{picked=null;command("place",{type:selected,x:Math.round(x),y:Math.round(y)})}});
}
function lobby(show){if(!root)return;$("#mtdLobby").classList.toggle("hidden",!show);ui()}
function notify(m){alertText=m;ui()}
function randomCode(){return Array.from({length:5},()=>String.fromCharCode(65+Math.floor(Math.random()*26))).join("")}
function create(coop,reuseCode=null){game={code:reuseCode||(coop?randomCode():"SOLO"),coop,host:id(),players:[id()],cash:{[id()]:700},wave:0,base:100,towers:[],enemies:[],effects:[],serial:0,spawn:0,spawnCooldown:0,active:false,ended:false,auto:false,difficulty:$("#mtdDifficulty")?.value||"normal",speed:1,kills:0,damage:0,surges:{},time:0,leaks:0,waveClearTime:0};picked=null;
if(coop){offers.set(game.code,id());for(const friend of friends())send(friend,{t:"mtd-offer",code:game.code})}joinTime=0;ui()}
function requestJoin(){if(!root||game||!joinTime||Date.now()-joinTime>40000)return;const code=$("#mtdCode").value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,5),known=offers.get(code);if(code.length!==5)return;for(const friend of friends())if(!known||known===friend)send(friend,{t:"mtd-join",code});}
function join(){const code=$("#mtdCode").value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,5);if(code.length!==5){$("#mtdLobbyMessage").textContent="Enter a five-letter code";return}if(game){$("#mtdLobbyMessage").textContent="Leave your existing match before joining another.";return}joinTime=Date.now();joinRetryAt=0;requestJoin();$("#mtdLobbyMessage").textContent="Joining "+code+"… Trying connected friends for up to 40 seconds."}
function sendAll(data){if(!host()||!game.coop)return;for(const player of game.players)if(player!==id())send(player,data)}
function command(action,arg={}){if(!game||game.ended)return;if(host())apply(id(),action,arg);else {if(!send(game.host,{t:"mtd-command",code:game.code,action,arg}))notify("Reconnecting to host. Try that action again.");}}
function distance(a,b,x,y){const dx=b[0]-a[0],dy=b[1]-a[1],n=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-n*dx,y-a[1]-n*dy)}
function canPlace(x,y){return x>30&&x<870&&y>32&&y<528&&!PATH.some((p,i)=>i&&distance(PATH[i-1],p,x,y)<43)&&!game.towers.some(t=>Math.hypot(t.x-x,t.y-y)<48)}
function apply(who,action,arg){if(!game||!host()||!game.players.includes(who))return;
if(action==="place"){const u=UNITS.find(u=>u[0]===arg.type),x=Number(arg.x),y=Number(arg.y);
if(!u||!Number.isFinite(x)||!Number.isFinite(y))return;
if(game.towers.length>=65){if(who===id())notify("Tower limit reached (65).");return}
if(!canPlace(x,y)){if(who===id())notify("Can't build on paths or too close to another tower.");return}
if((game.cash[who]||0)<u[3]){if(who===id())notify("Not enough cash for "+u[1]);return}
if(u[0]==="verity"&&game.towers.some(t=>t.type==="verity")){if(who===id())notify("Verity is a special unit: only one per team.");return}game.cash[who]-=u[3];game.towers.push({id:++game.serial,type:u[0],x,y,owner:who,level:1,cool:0,target:"first"});notify(u[1]+" placed!")}
if(action==="upgrade"){const t=game.towers.find(t=>t.id===arg.id&&t.owner===who);if(!t||t.level>=5)return;const u=UNITS.find(u=>u[0]===t.type),cost=Math.round(u[3]*(.65+t.level*.6));if(game.cash[who]<cost){if(who===id())notify("Need $"+cost+" to upgrade "+u[1]);return}game.cash[who]-=cost;t.level++}
if(action==="target"){const t=game.towers.find(t=>t.id===arg.id&&t.owner===who);if(t){const opts=["first","strongest","last"];t.target=opts[(opts.indexOf(t.target||"first")+1)%opts.length]||"first"}}
if(action==="sell"){const i=game.towers.findIndex(t=>t.id===arg.id&&t.owner===who);if(i<0)return;const t=game.towers[i],u=UNITS.find(u=>u[0]===t.type);game.cash[who]+=Math.round(u[3]*(.55+.22*(t.level-1)));game.towers.splice(i,1);picked=null}
if(action==="surge"){game.surges=game.surges||{};const available=game.surges[who]||0;if(game.time<available)return;game.surges[who]=game.time+55;for(const e of game.enemies){if(e.hp>0){e.slow=Math.max(e.slow||0,5);hit(e,Math.max(80,Math.round(e.maxHp*.11)),who)}}game.effects.push({x:450,y:280,tx:450,ty:280,c:"#ffdd7a",life:.7,laser:false,burst:true});notify("⚡ 67 SURGE! Meme enemies slowed.");}
if(action==="wave"&&!game.active&&game.wave<40){game.wave++;game.spawn=9+game.wave*2;game.active=true;game.spawnCooldown=0;notify("Wave "+game.wave+" started!")}
ui()}
function spawn(){const wave=game.wave,boss=wave%10===0&&game.spawn===1,kind=boss?4:Math.floor(Math.random()*Math.min(BADS.length,1+Math.floor(wave/4))),b=BADS[kind],hp=Math.round(b[1]*(1+wave*.18)*(boss?10:1)*({easy:.65,normal:1,hard:1.55,impossible:2.3}[game.difficulty]||1));game.enemies.push({id:++game.serial,x:0,y:270,step:0,progress:0,hp,maxHp:hp,speed:b[2]*(1+Math.min(.6,wave*.01))*(boss?.7:1),earn:b[3]*(boss?10:1),emoji:boss?"👑":b[0],boss,slow:0,flash:0})}
function walk(e,dt){let advance=e.speed*dt;while(advance>0&&e.step<PATH.length-1){const a=PATH[e.step],b=PATH[e.step+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(advance<len-e.progress){e.progress+=advance;advance=0}else{advance-=len-e.progress;e.step++;e.progress=0}}if(e.step>=PATH.length-1){e.passed=true;return}const a=PATH[e.step],b=PATH[e.step+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);e.x=a[0]+(b[0]-a[0])*e.progress/l;e.y=a[1]+(b[1]-a[1])*e.progress/l}
function hit(e,damage,owner){if(e.hp<=0)return;e.hp-=damage;e.flash=.18;game.damage=(game.damage||0)+Math.min(damage,e.hp+damage);if(e.hp<=0){game.kills=(game.kills||0)+1;for(const p of game.players)game.cash[p]=(game.cash[p]||0)+Math.ceil(e.earn/game.players.length);game.cash[owner]+=Math.floor(e.earn*.3)}}
function tick(dt){if(!host()||game.ended||!$("#mtdLobby").classList.contains("hidden"))return;dt=Math.min(.08,dt)*game.speed;game.time=(game.time||0)+dt;if(game.active&&game.spawn){game.spawnCooldown-=dt;if(game.spawnCooldown<=0&&game.enemies.length<210){spawn();game.spawn--;game.spawnCooldown=Math.max(.22,.82-game.wave*.008)}}
for(const e of game.enemies)if(e.hp>0){e.flash=Math.max(0,(e.flash||0)-dt);e.slow=Math.max(0,(e.slow||0)-dt);walk(e,e.slow>0?dt*.5:dt)}
for(const t of game.towers){t.cool-=dt;if(t.cool>0)continue;const u=UNITS.find(u=>u[0]===t.type),targets=game.enemies.filter(e=>e.hp>0&&!e.passed&&Math.hypot(e.x-t.x,e.y-t.y)<u[5]*(1+.08*(t.level-1))).sort((a,b)=>b.step-a.step||b.progress-a.progress);if(!targets.length)continue;const target=(t.target==="strongest"?targets.sort((a,b)=>b.hp-a.hp):t.target==="last"?targets.reverse():targets)[0],damage=Math.round(u[4]*Math.pow(1.6,t.level-1));t.cool=u[6]/(1+.1*(t.level-1));const affected=t.type==="verity"?targets.slice(0,4):["tung","croc","pat"].includes(t.type)?game.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-target.x,e.y-target.y)<(t.type==="croc"?75:50)):[target];for(const e of affected)hit(e,damage,t.owner);game.effects.push({x:t.x,y:t.y,tx:target.x,ty:target.y,c:u[7],life:.2,laser:t.type==="verity"})}
game.enemies=game.enemies.filter(e=>{if(e.passed){game.base-=e.boss?25:Math.max(1,Math.ceil(e.maxHp/250));game.leaks=(game.leaks||0)+1;return false}return e.hp>0});game.effects=game.effects.filter(e=>(e.life-=dt)>0).slice(-80);
if(game.base<=0){game.base=0;game.ended=true;try{localStorage.removeItem(SOLO_KEY)}catch{}recordResult();notify("Game Over: the final brain cell fell!")}
if(!game.active&&game.auto&&game.wave>0&&game.wave<40&&!game.ended&&game.time-(game.waveClearTime||0)>=8)apply(id(),"wave",{});
if(game.active&&!game.spawn&&!game.enemies.length&&!game.ended){game.active=false;for(const p of game.players)game.cash[p]+=100+game.wave*15;game.waveClearTime=game.time;saveSolo();if(game.wave===40){game.ended=true;try{localStorage.removeItem(SOLO_KEY)}catch{}recordResult();notify("VICTORY! All 40 waves cleared!")}else notify("Wave "+game.wave+" cleared!")}}
let mapCache=null;
function mapBackground(){
 if(mapCache)return mapCache;
 mapCache=document.createElement("canvas");mapCache.width=900;mapCache.height=560;const c=mapCache.getContext("2d");
 const grd=c.createLinearGradient(0,0,900,560);grd.addColorStop(0,"#294d63");grd.addColorStop(.46,"#315b53");grd.addColorStop(1,"#25485a");c.fillStyle=grd;c.fillRect(0,0,900,560);
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
function draw(){
 if(!ctx)return;
 ctx.clearRect(0,0,900,560);ctx.drawImage(mapBackground(),0,0);
 if(game&&game.wave>=10){ctx.fillStyle=game.wave>=30?"#54183a1c":game.wave>=20?"#394c9a18":"#66a4a811";ctx.fillRect(0,0,900,560)}
 const now=performance.now()/1000;ctx.save();
 if(screenShake>0){ctx.translate(Math.sin(now*78)*screenShake,Math.cos(now*62)*screenShake);screenShake=Math.max(0,screenShake-.25)}
 if(game){
  const selectedType=UNITS.find(u=>u[0]===selected);
  if(hover&&selectedType&&picked===null&&!game.ended){
   const ok=canPlace(hover.x,hover.y)&&(game.cash[id()]||0)>=selectedType[3]&&!(selected==="verity"&&game.towers.some(t=>t.type==="verity"));
   ctx.save();ctx.globalAlpha=.35;ctx.fillStyle=ok?"#77ffcf":"#fa7994";ctx.beginPath();ctx.arc(hover.x,hover.y,selectedType[5],0,Math.PI*2);ctx.fill();ctx.globalAlpha=.95;ctx.strokeStyle=ok?"#94ffe6":"#ff879b";ctx.lineWidth=3;ctx.beginPath();ctx.arc(hover.x,hover.y,24,0,Math.PI*2);ctx.stroke();ctx.font="29px system-ui";ctx.textAlign="center";ctx.fillText(selectedType[2],hover.x,hover.y+10);ctx.restore();
  }
  for(const t of game.towers){
   const u=UNITS.find(u=>u[0]===t.type);if(!u)continue;
   const range=u[5]*(1+.08*(t.level-1));
   if(picked===t.id){ctx.beginPath();ctx.arc(t.x,t.y,range,0,Math.PI*2);ctx.fillStyle="#ccbef31d";ctx.fill();ctx.strokeStyle="#e2ccffaa";ctx.lineWidth=2;ctx.stroke()}
   ctx.fillStyle="#07172966";ctx.beginPath();ctx.ellipse(t.x+4,t.y+12,29,14,0,0,Math.PI*2);ctx.fill();
   const pulse=1+Math.sin(now*3+t.id)*.045;
   ctx.save();ctx.translate(t.x,t.y);ctx.scale(pulse,pulse);
   ctx.shadowColor=u[7];ctx.shadowBlur=11;ctx.fillStyle="#162841";ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
   ctx.strokeStyle=u[7];ctx.lineWidth=4;ctx.stroke();ctx.font="27px system-ui";ctx.textAlign="center";ctx.fillText(u[2],0,9);
   if(t.level>=3){ctx.strokeStyle=u[7];ctx.globalAlpha=.4;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,30+Math.sin(now*3+t.id)*3,0,Math.PI*2);ctx.stroke()}
   if(t.level===5){ctx.fillStyle="#ffef8f";ctx.font="bold 13px system-ui";ctx.fillText("MAX",0,-35)}
   if(t.type==="verity"){ctx.strokeStyle="#d5aaff";ctx.lineWidth=2;for(let i=0;i<3;i++){const angle=now*1.7+i*Math.PI*2/3;ctx.beginPath();ctx.arc(Math.cos(angle)*37,Math.sin(angle)*37,3.5,0,Math.PI*2);ctx.stroke()}}
   ctx.restore();
   ctx.font="bold 11px system-ui";ctx.fillStyle="#17223bdd";ctx.fillRect(t.x-25,t.y-43,50,14);
   ctx.textAlign="center";ctx.fillStyle="#ffe28f";ctx.fillText("★".repeat(t.level),t.x,t.y-32);
  }
  for(const e of game.enemies){
   const r=e.boss?31:22;ctx.fillStyle="#1116289e";ctx.beginPath();ctx.ellipse(e.x+3,e.y+10,r,12,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle=e.flash>0?"#f6f2e9":e.boss?"#7d264a":e.slow>0?"#246f8e":"#273b57";
   ctx.beginPath();ctx.arc(e.x,e.y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=e.boss?"#ffc772":e.slow>0?"#94eaff":"#b4cfff88";ctx.lineWidth=e.boss?5:2;ctx.stroke();
   ctx.font=e.boss?"31px system-ui":"23px system-ui";ctx.textAlign="center";ctx.fillText(e.emoji,e.x,e.y+8);
   ctx.fillStyle="#091425";ctx.fillRect(e.x-25,e.y-r-15,50,7);
   ctx.fillStyle=e.hp/e.maxHp<.3?"#f57989":e.boss?"#ffc86f":"#86efbd";ctx.fillRect(e.x-25,e.y-r-15,50*Math.max(0,e.hp/e.maxHp),7);
   if(e.boss){ctx.font="bold 10px system-ui";ctx.fillStyle="white";ctx.fillText("BOSS",e.x,e.y-r-20)}
  }
  for(const v of game.effects){
   ctx.save();ctx.globalAlpha=Math.min(1,v.life*6);
   if(v.burst){const rad=(1-v.life/.7)*510;ctx.strokeStyle="#f8d176";ctx.lineWidth=10;ctx.shadowColor="#ffc96c";ctx.shadowBlur=18;ctx.beginPath();ctx.arc(450,280,rad,0,Math.PI*2);ctx.stroke()}
   else{ctx.strokeStyle=v.c;ctx.shadowColor=v.c;ctx.shadowBlur=13;ctx.lineWidth=v.laser?9:4;ctx.beginPath();ctx.moveTo(v.x,v.y);ctx.lineTo(v.tx,v.ty);ctx.stroke();ctx.fillStyle=v.c;ctx.beginPath();ctx.arc(v.tx,v.ty,v.laser?15:9,0,Math.PI*2);ctx.fill()}ctx.restore();
  }
  ctx.fillStyle="#09182dcc";ctx.fillRect(12,9,510,44);ctx.strokeStyle="#c5c4fe44";ctx.strokeRect(12,9,510,44);
  ctx.textAlign="left";ctx.fillStyle="#f3f6ff";ctx.font="bold 18px system-ui";
  ctx.fillText("⚔ "+game.wave+"/40",24,38);ctx.fillText("🧠 "+game.base,150,38);ctx.fillText("💰 "+(game.cash[id()]||0),262,38);ctx.fillText("👥 "+game.players.length,425,38);
  if(!game.active&&!game.ended){ctx.textAlign="center";ctx.font="bold 18px system-ui";ctx.fillStyle="#e8f4ff";ctx.fillText("BUILD PHASE · START NEXT WAVE",450,92)}
  if(game.ended){ctx.fillStyle="#071127d9";ctx.fillRect(0,0,900,560);ctx.textAlign="center";ctx.fillStyle=game.base>0?"#a4ffd1":"#ffadbd";ctx.font="bold 55px system-ui";ctx.fillText(game.base>0?"🏆 VICTORY":"GAME OVER",450,270);ctx.font="20px system-ui";ctx.fillStyle="white";ctx.fillText(game.wave+" waves · "+(game.kills||0)+" enemies defeated",450,311);ctx.fillText("Select Restart for another run",450,344)}
 }
 ctx.restore();
}
const SOLO_KEY="discard-meme-td-solo-v1";
function saveSolo(){if(!game||game.coop||game.ended)return;try{const saved={...game,host:null,cash:{solo:game.cash[id()]||0},players:[],towers:game.towers.map(t=>({...t,owner:"solo"})),enemies:[],effects:[],active:false,spawn:0};localStorage.setItem(SOLO_KEY,JSON.stringify(saved))}catch{}}
function loadSolo(){try{const saved=JSON.parse(localStorage.getItem(SOLO_KEY)||"null");if(!saved||saved.coop||!Array.isArray(saved.towers)||!Number.isFinite(saved.wave)||saved.wave<0||saved.wave>=40)return null;return saved}catch{return null}}
const RECORD_KEY="discard-meme-td-records-v1";
function recordResult(){try{const old=JSON.parse(localStorage.getItem(RECORD_KEY)||"{}");const wave=game?.wave||0;old.highestWave=Math.max(Number(old.highestWave)||0,wave);old.wins=(Number(old.wins)||0)+(game?.base>0&&wave>=40?1:0);old.runs=(Number(old.runs)||0)+1;localStorage.setItem(RECORD_KEY,JSON.stringify(old))}catch{}}
function records(){try{return JSON.parse(localStorage.getItem(RECORD_KEY)||"{}")}catch{return {}}}
function ui(){if(!root)return;$("#mtdStats").textContent=game?"Wave "+game.wave+" · 🧠 "+game.base+" · $"+(game.cash[id()]||0):"2025–26 Brainrot Defense";$("#mtdRoom").textContent=game?(game.coop?"Join code: "+game.code+" · Host "+game.host.slice(0,12):"Solo Match"):"Create a lobby or join with a code." ;$("#mtdPlayers").textContent=game?"Players "+game.players.length+"/4: "+game.players.map(x=>x===id()?"You":x.slice(0,12)).join(", "):"";$("#mtdSpeed").textContent="Speed "+(game?.speed||1)+"×";
$("#mtdAuto").textContent=game?.auto?"Auto-wave: On":"Auto-wave: Off";
$("#mtdContinue").disabled=!loadSolo();
$("#mtdAuto").disabled=!host()||game?.ended;
const targeting=game?.towers.find(t=>t.id===picked);
$("#mtdTarget").textContent="Target: "+(targeting?.target||"first").replace(/^./,x=>x.toUpperCase());
$("#mtdTarget").disabled=!targeting||targeting.owner!==id();
const timer=game?.surges?.[id()]||0,cd=game?Math.ceil(Math.max(0,timer-(game.time||0))):0;
$("#mtdAbility").textContent=cd?"⚡ Surge "+cd+"s":"⚡ 67 Surge";
$("#mtdAbility").disabled=!game||!!game.ended||cd>0;
$("#mtdWave").disabled=!game||!!game.active||!!game.ended||game.wave>=40||!$("#mtdLobby").classList.contains("hidden");
const record=records();$("#mtdRunStats").textContent=game?`${game.kills||0} defeats · ${game.leaks||0} leaks · ${game.towers.length}/65 towers · ${game.difficulty||"normal"} difficulty · Best wave ${Math.max(record.highestWave||0,game.wave)}`:`Best wave ${record.highestWave||0} · ${record.wins||0} wins`;
for(const b of root.querySelectorAll("[data-unit]"))b.classList.toggle("active",b.dataset.unit===selected&&picked===null);const t=game?.towers.find(t=>t.id===picked);$("#mtdDetails").textContent=t?(()=>{const u=UNITS.find(u=>u[0]===t.type),cost=Math.round(u[3]*(.65+t.level*.6));return u[1]+" · Level "+t.level+"/5 · "+(t.owner===id()?"Yours":"Teammate's")+" · Damage "+Math.round(u[4]*Math.pow(1.6,t.level-1))+" · Upgrade "+(t.level===5?"MAX":"$"+cost)})():UNITS.find(u=>u[0]===selected)[1]+" · $"+UNITS.find(u=>u[0]===selected)[3]+" · Click map to place";$("#mtdUpgrade").disabled=!t||t.owner!==id()||t.level>=5;$("#mtdSell").disabled=!t||t.owner!==id();$("#mtdMessage").textContent=alertText}
function loop(now){const dt=Math.min(.07,(now-last)/1000||0);last=now;if(game){tick(dt);networkAt+=dt;if(host()&&game.coop&&networkAt>.33){networkAt=0;for(const p of game.players)if(p!==id())send(p,{t:"mtd-state",code:game.code,state:{...game,effects:game.effects.slice(-22),enemies:game.enemies.slice(0,210)}})}if(now-lastUI>250){lastUI=now;ui()}}gameClock+=dt;if(gameClock>1){gameClock=0;updatePlaytime();if(game&&host()&&game.coop&&performance.now()-hostOfferAt>12000){hostOfferAt=performance.now();for(const p of friends())if(!game.players.includes(p))send(p,{t:"mtd-offer",code:game.code})}}if(joinTime&&!game&&Date.now()-joinTime<40000&&Date.now()-joinRetryAt>3000){joinRetryAt=Date.now();requestJoin()}if(joinTime&&!game&&Date.now()-joinTime>=40000){joinTime=0;if(root)$("#mtdLobbyMessage").textContent="Couldn't connect. Confirm the host is online and try again."}draw();raf=requestAnimationFrame(loop)}
function close(){if(game&&!game.active)saveSolo();stopPlaytime();if(game&&host())sendAll({t:"mtd-ended",code:game.code});if(game&&!host())send(game.host,{t:"mtd-leave",code:game.code});game=null;root.classList.add("hidden");cancelAnimationFrame(raf);raf=0;window.setDiscardGameActivity?.("")}
window.openMemeTowerDefense=()=>{init();root.classList.remove("hidden");if(!localStart)localStart=Date.now();updatePlaytime();window.setDiscardGameActivity?.("Meme Tower Defense");lobby(!game);if(!raf){last=performance.now();raf=requestAnimationFrame(loop)}ui()};
window.mtdHandle=(from,d)=>{if(!d?.t?.startsWith("mtd-"))return false;
if(d.t==="mtd-offer"){if(/^[A-Z]{5}$/.test(d.code))offers.set(d.code,from);return true}
if(d.t==="mtd-join"){if(!host()||!game.coop||d.code!==game.code)return true;if(!game.players.includes(from)&&game.players.length<4){game.players.push(from);game.cash[from]=700}send(from,{t:"mtd-accepted",code:game.code,state:game});ui();return true}
if(d.t==="mtd-accepted"){if(!game&&root&&Date.now()-joinTime<40000&&d.code===$("#mtdCode")?.value.toUpperCase()){game=d.state;game.host=from;game.coop=true;joinTime=0;lobby(false);notify("Joined multiplayer!")}return true}
if(d.t==="mtd-ended"){if(game&&!host()&&game.host===from&&game.code===d.code){game=null;lobby(true);$("#mtdLobbyMessage").textContent="The host left this match."}return true}
if(d.t==="mtd-command"){if(host()&&game&&d.code===game.code&&game.players.includes(from))apply(from,d.action,d.arg||{});return true}
if(d.t==="mtd-state"){if(game&&!host()&&game.host===from&&d.code===game.code){game=d.state;game.host=from;ui()}return true}
if(d.t==="mtd-leave"){if(host()&&game&&d.code===game.code){game.players=game.players.filter(p=>p!==from);delete game.cash[from];ui()}return true}
return true};
})();