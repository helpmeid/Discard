const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function game(){const code=fs.readFileSync(require('node:path').join(__dirname,'../dead-zone.js'),'utf8').replace('window.openDeadZone=open;',`window.test={startNetworkMatch,getWorker:()=>hostWorker,setUI:u=>{root=u.root;canvas=u.canvas;ctx=u.ctx;labels=u.labels;menu=u.menu;},stopHostUI:()=>{clearInterval(networkTimer);networkTimer=0;localInput={};},prediction,hostStreams,receiveSnapshot,receiveMetadata,sendMetadata,advanceGame,resetNetwork,setMenu:m=>menu=m,networkSnapshot,updateGuestVisuals,guestVisuals,saveGame,readSave,newWorld,tick,solid,move,action,equip,swapWeapon,storyTick,zombieSpawn,draw,build,open,lobby,missionSites,binds,burst,setSession:s=>session=s,getSession:()=>session,setWorld:w=>world=w,getWorld:()=>world,setInput:a=>localInput=a,inputs};window.openDeadZone=open;`);const c={console,Math,Set,Map,Number,JSON,crypto:require('node:crypto').webcrypto,performance,localStorage:{getItem:()=>null},currentUser:{id:'host'},viewPerson:()=>({displayName:'Tester'}),state:{friends:{guest:{}}},connectTo(){},sendTo(){},window:{},document:{},requestAnimationFrame(){},setInterval(){return 1},clearInterval(){}};vm.createContext(c);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../dead-zone-net.js'),'utf8'),c);vm.runInContext(code,c);const api=c.window.test;api.setSession({mode:'host',gameMode:'story',difficulty:'normal',phase:'play',id:'test',host:'host',peers:new Map([['guest',{}]])});api.setWorld(api.newWorld(['host','guest']));return {api,c,w:api.getWorld()};}
test('story supplies, radio, timed extraction, victory and dead-player exclusion',()=>{const {api,w}=game();const p=w.players[0];p.x=1680;p.y=1170;api.setInput({use:true});for(let i=0;i<42;i++)api.storyTick(.05);assert.equal(w.story.stage,1);assert.equal(p.secondary,'pistol');assert.equal(p.ammo,30);p.x=2050;p.y=1370;for(let i=0;i<82;i++)api.storyTick(.05);assert.equal(w.story.stage,2);api.storyTick(1);assert.equal(w.story.defense,0);p.x=1800;p.y=1530;for(let i=0;i<46;i++)api.storyTick(1);assert.equal(w.won,true);assert.equal(w.ended,true);});
test('endless does not end after story timer and never revives dead teammates',()=>{const {api,w}=game();w.mode='endless';w.between=0;w.remaining=0;w.players[1].hp=0;api.tick(.05);assert.equal(w.players[1].hp,0);assert.equal(w.between,9);assert.equal(w.ended,false);});
test('sprint consumes stamina, walking restores it and collisions stop walls',()=>{const {api,w}=game(),p=w.players[0];w.between=100;api.setInput({x:1,sprint:true});for(let i=0;i<10;i++)api.tick(.05);assert.ok(p.stamina<90);api.setInput({});for(let i=0;i<10;i++)api.tick(.05);assert.ok(p.stamina>90);const h=w.houses[0];p.x=h.x-20;p.y=h.y+40;api.move(p,100,0);assert.ok(p.x<h.x);});
test('chest opening drops loot, pickup requires release and a second press',()=>{const {api,w}=game(),p=w.players[0],chest=w.chests[0];w.mode='endless';w.between=100;p.x=chest.x;p.y=chest.y;api.setInput({use:true});for(let i=0;i<30;i++)api.tick(.05);assert.equal(chest.opened,true);assert.ok(w.drops.length);api.setInput({});api.tick(.05);api.setInput({use:true});api.tick(.05);assert.equal(w.drops.length,0);});
test('projectile substeps hit targets and produce capped effects and blood',()=>{const {api,w}=game();w.mode='endless';w.between=0;w.remaining=2;const p=w.players[0];w.zombies=[{x:p.x+33,y:p.y,hp:20,maxHp:20,speed:0,attack:100}];w.shots=[{x:p.x,y:p.y,vx:730,vy:0,life:1,damage:25,owner:p.id}];api.tick(.05);assert.equal(w.zombies.length,0);assert.equal(p.kills,1);assert.ok(w.effects.length);assert.ok(w.blood.length);for(let i=0;i<40;i++)api.burst(1,1,'#ffffff',20);assert.equal(w.effects.length,180);});
test('host processes guest movement, equipment and door actions',()=>{const {api,c,w}=game();w.between=100;const p=w.players[1];c.window.deadZoneHandle('guest',{v:1,id:'test',t:'dz-input',input:{x:1,sprint:true}});const x=p.x;api.tick(.05);assert.ok(p.x>x);p.inventory.push('axe');c.window.deadZoneHandle('guest',{v:1,id:'test',t:'dz-equip',slot:1,hand:'secondary'});assert.equal(p.weapon,'axe');const h=w.houses[0];p.x=h.doorX;p.y=h.doorY+30;c.window.deadZoneHandle('guest',{v:1,id:'test',t:'dz-input',input:{door:true}});api.tick(.05);assert.equal(h.doorOpen,true);});
test('guest door press is consumed once, even across multiple host ticks',()=>{const {api,c,w}=game(),p=w.players[1],h=w.houses[0];w.between=100;p.x=h.doorX;p.y=h.doorY+30;c.window.deadZoneHandle('guest',{v:1,id:'test',t:'dz-input',input:{door:true}});api.tick(.02);api.tick(.02);api.tick(.02);assert.equal(h.doorOpen,true);});
test('melee cannot hit through closed doors',()=>{const {api,w}=game(),p=w.players[0],h=w.houses[0];w.mode='endless';w.between=100;p.x=h.doorX;p.y=h.doorY+20;w.zombies=[{x:h.doorX,y:h.doorY-20,hp:100,maxHp:100,speed:0,attack:99}];api.setInput({fire:true,ax:h.doorX,ay:h.doorY-20});api.tick(.05);assert.equal(w.zombies[0].hp,100);});
// Contact separation intentionally keeps infected 27.5 units from survivors.
test('infected can enter an open house without position jumps',()=>{const {api,w}=game(),p=w.players[0],h=w.houses[0];w.mode='endless';w.between=0;w.remaining=10;w.spawned=-1000;w.players[1].hp=0;h.doorOpen=true;p.x=h.doorX;p.y=h.doorY-60;p.invuln=100;const z={x:h.x-70,y:h.y-30,hp:100,maxHp:100,speed:90,attack:99};w.zombies=[z];let near=Infinity;for(let i=0;i<400;i++){const x=z.x,y=z.y;api.tick(.025);assert.ok(Math.hypot(z.x-x,z.y-y)<4);near=Math.min(near,Math.hypot(z.x-p.x,z.y-p.y));}assert.ok(near<=28,'Zombie must reach survivor contact distance without overlapping, distance '+near);});
test('projectiles keep moving during resupply and the countdown starts the next wave',()=>{const {api,w}=game(),p=w.players[0];w.mode='endless';w.between=.2;w.shots=[{x:p.x,y:p.y,vx:730,vy:0,life:1,damage:25,owner:p.id}];api.tick(.05);assert.ok(w.shots[0].x>p.x+30);for(let i=0;i<5;i++)api.tick(.05);assert.equal(w.wave,1);assert.ok(w.remaining>0);});
module.exports={game};

test('protocol 2 guest replays unacknowledged movement and leaves authoritative state intact',()=>{
 const {api,c,w}=game();c.currentUser.id='guest';c.state.friends.host={};api.setMenu({style:{}});
 api.setSession({mode:'guest',host:'host',id:'test',phase:'play'});
 c.window.deadZoneHandle('host',{v:1,t:'dz-start',id:'test',world:JSON.parse(JSON.stringify(w))});
 const own=api.getWorld().players[1],x=own.x;for(let i=0;i<12;i++)api.prediction.step({x:1,sprint:true});
 assert.ok(api.prediction.state.x>x+20);assert.equal(own.x,x);
 const packet=api.networkSnapshot();packet.seq=10;packet.ack={guest:0};api.receiveSnapshot(packet,1000);
 assert.ok(api.prediction.lastError<.01);assert.ok(api.prediction.state.x>x+20);assert.equal(api.getWorld().players[1].x,x);
 packet.world.players[1].x=500;packet.seq=9;api.receiveSnapshot(packet,1100);assert.equal(api.getWorld().players[1].x,x);
});
test('compact snapshots exclude inventories, map geometry, blood and projectile trails',()=>{
 const {api,w}=game();w.players[0].inventory=Array(50).fill('rifle');w.shots=[{x:100,y:100,vx:700,vy:0,life:.5,trail:Array(50).fill({x:1,y:1})}];
 const packet=api.networkSnapshot();assert.equal(packet.protocol,2);assert.equal(packet.world.players[0].inventory,undefined);
 for(const key of ['houses','chests','blood','drops'])assert.equal(packet.world[key],undefined);
 assert.ok(Array.isArray(packet.world.shots[0]));assert.ok(JSON.stringify(packet).length<JSON.stringify(w).length*.3);
});

test('resync generations reject delayed input, state and metadata from an old stream',()=>{
 const {api,c,w}=game(),N=require('../dead-zone-net.js'),g=api.getSession().peers.get('guest');g.epoch='current';
 const send=epoch=>c.window.deadZoneHandle('guest',{v:1,t:'dz-input',id:'test',epoch,commands:[N.packCommand({seq:1,input:N.cleanInput({x:1,door:true})})]});
 send('old');assert.equal(api.hostStreams.size,0);send('current');assert.equal(api.hostStreams.get('guest').queue.size,1);
 c.window.deadZoneHandle('guest',{v:1,t:'dz-resync',id:'test',epoch:'current'});assert.notEqual(g.epoch,'current');send('current');assert.equal(api.hostStreams.size,0);send(g.epoch);assert.equal(api.hostStreams.size,1);
 c.currentUser.id='guest';c.state.friends.host={};api.setMenu({style:{}});api.setSession({mode:'guest',host:'host',id:'test',phase:'play'});
 c.window.deadZoneHandle('host',{v:1,t:'dz-start',id:'test',epoch:'new-client',world:JSON.parse(JSON.stringify(w))});
 const x=api.getWorld().players[1].x,packet=api.networkSnapshot();packet.world.players[1].x=x+100;packet.seq=999;packet.epoch='old-client';api.receiveSnapshot(packet,1000);assert.equal(api.getWorld().players[1].x,x);
 api.receiveMetadata({seq:999,epoch:'old-client',data:{players:[{id:'guest',ammo:999}]}});assert.equal(api.getWorld().players[1].ammo,0);
 packet.epoch='new-client';api.receiveSnapshot(packet,1100);assert.equal(api.getWorld().players[1].x,x+100);
});
test('reliable metadata restores doors, loot, inventory and deduplicates blood',()=>{
 const {api,w}=game(),p=w.players[0];
 const d={seq:1,data:{players:[{id:p.id,ammo:42,inventory:['bat','rifle']}],doors:w.houses.map(h=>[true,210,2,210]),chests:w.chests.map(()=>true),drops:[{id:8,item:'boards',x:10,y:10}]},blood:[{netId:1,x:10,y:10,r:8,a:0}]};
 api.receiveMetadata(d);assert.equal(p.ammo,42);assert.equal(w.houses[0].doorMaxHp,210);assert.equal(w.chests[0].opened,true);assert.equal(w.drops[0].id,8);
 api.receiveMetadata({...d,seq:2});assert.equal(w.blood.length,1);
});
test('save round trip preserves old format, inventory and scenery without networking state',()=>{
 const {api,c,w}=game(),storage=new Map();c.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 w.players[0].ammo=42;w.houses[0].doorOpen=true;w.chests[0].opened=true;api.networkSnapshot();
 assert.equal(api.saveGame(),true);const saved=api.readSave();assert.equal(saved.version,1);assert.equal(saved.world.players.length,1);
 assert.equal(saved.world.players[0].ammo,42);assert.equal(saved.world.houses[0].doorOpen,true);assert.equal(saved.world.chests[0].opened,true);assert.equal(saved.world.ack,undefined);
});

test('real host worker advances and handles guest commands with no host animation loop',async()=>{
 const {Worker}=require('node:worker_threads'),path=require('node:path'),N=require('../dead-zone-net.js');const {w}=game();w.between=100;w.mode='endless';w.players.forEach(p=>p.invuln=100);
 w.zombies=Array.from({length:65},(_,i)=>({netId:i+1,x:1930+i%8*26,y:1190+Math.floor(i/8)*28,hp:100,maxHp:100,kind:'walker',speed:20,attack:0}));w.zombieSerial=65;
 const wrapper=`const {parentPort,workerData}=require('node:worker_threads'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');globalThis.self=globalThis;globalThis.postMessage=data=>parentPort.postMessage(data);globalThis.importScripts=(...names)=>names.forEach(name=>vm.runInThisContext(fs.readFileSync(path.join(workerData,name.split('?')[0]),'utf8'),{filename:name}));vm.runInThisContext(fs.readFileSync(path.join(workerData,'dead-zone-host-worker.js'),'utf8'));parentPort.on('message',data=>self.onmessage({data}));`;
 const worker=new Worker(wrapper,{eval:true,workerData:path.join(__dirname,'..')});
 let latest=null,saved=null,epoch='';const errors=[];worker.on('error',e=>errors.push(e));worker.on('message',data=>{if(data.type==='view')latest=data.packet;if(data.type==='checkpoint'&&data.save)saved=data.world;if(data.type==='network'&&data.packet.t==='dz-start'){epoch=data.packet.epoch;worker.postMessage({type:'packet',from:'guest',packet:{v:1,id:'test',t:'dz-ready',epoch}});}});
 try{
  worker.postMessage({type:'init',host:'host',players:['host','guest'],names:{host:'Host',guest:'Guest'},session:{id:'test',gameMode:'endless',difficulty:'normal'},peers:['guest'],world:w});
  const commands=Array.from({length:90},(_,i)=>N.packCommand({seq:i+1,input:N.cleanInput({x:1,sprint:true,ax:3000,ay:1300})}));
  const deadline=Date.now()+1800;while(Date.now()<deadline){if(epoch)worker.postMessage({type:'packet',from:'guest',packet:{v:1,id:'test',t:'dz-input',epoch,commands}});await new Promise(r=>setTimeout(r,50));}
  assert.deepEqual(errors,[]);assert.ok(latest,'worker must publish without any render calls');assert.ok(latest.world.time>1.2);assert.equal(latest.ack.guest,90);
  assert.ok(latest.world.players.find(p=>p.id==='guest').x>w.players[1].x+100);
  worker.postMessage({type:'save'});for(let i=0;i<20&&!saved;i++)await new Promise(r=>setTimeout(r,20));assert.ok(saved);assert.ok(saved.houses.length);assert.equal(saved.players.length,2);
 }finally{await worker.terminate();}
});

test('two complete game clients keep moving, rendering and saving after host UI timers stop',async()=>{
 const {Worker:Thread}=require('node:worker_threads'),path=require('node:path');const host=game(),guest=game(),errors=[];
 guest.c.currentUser.id='guest';guest.c.state.friends.host={};guest.api.setSession({mode:'guest',phase:'lobby',id:'test',host:'host',peers:new Map()});
 const wrapper=`const {parentPort,workerData}=require('node:worker_threads'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');globalThis.self=globalThis;globalThis.postMessage=data=>parentPort.postMessage(data);globalThis.importScripts=(...names)=>names.forEach(name=>vm.runInThisContext(fs.readFileSync(path.join(workerData,name.split('?')[0]),'utf8'),{filename:name}));vm.runInThisContext(fs.readFileSync(path.join(workerData,'dead-zone-host-worker.js'),'utf8'));parentPort.on('message',data=>self.onmessage({data}));`;
 class WorkerAdapter{constructor(){this.thread=new Thread(wrapper,{eval:true,workerData:path.join(__dirname,'..')});this.thread.on('message',data=>{try{this.onmessage?.({data});}catch(e){errors.push(e);}});this.thread.on('error',e=>errors.push(e));}postMessage(data){this.thread.postMessage(data);}terminate(){this.thread.terminate();}}
 function ui(){const gradient={addColorStop(){}},ctx=new Proxy({createRadialGradient:()=>gradient},{get:(o,k)=>o[k]||(()=>{})});let count=0;const nodes={};for(const name of ['wave','score','time','enemies','countdown','hp','stamina','weapon','armor','ammo','boards','medkits','mints','energy','primary','secondary','hpBar','staminaBar'])nodes[name]={dataset:{dz:name},textContent:'',style:{},parentElement:{setAttribute(){}}};const toggle={};return{root:{style:{display:'flex'}},canvas:{focus(){}},menu:{style:{}},ctx,labels:{get firstChild(){return count?{}:null},set innerHTML(v){count++;},get builds(){return count},querySelectorAll:()=>Object.values(nodes),querySelector:()=>toggle}};}
 let sent=0,active=true;const storage=new Map();
 for(const [client,other,id]of [[host,guest,'host'],[guest,host,'guest']]){
  client.c.setInterval=setInterval;client.c.clearInterval=clearInterval;client.c.Worker=id==='host'?WorkerAdapter:undefined;client.c.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  client.ui=ui();client.api.setUI(client.ui);const deliver=(to,packet)=>{const n=++sent;if(['dz-state','dz-input'].includes(packet.t)&&n%7===0)return true;setTimeout(()=>{if(active)try{other.c.window.deadZoneHandle(id,JSON.parse(JSON.stringify(packet)));}catch(e){errors.push(e);}},60+(n%4)*7);return true;};client.c.sendTo=deliver;client.c.window.deadZoneSendRealtime=deliver;
 }
 host.w.between=100;host.w.mode='endless';host.w.players.forEach(p=>p.invuln=100);
 try{
  host.api.startNetworkMatch();const end=Date.now()+5000;while(guest.api.getSession().phase!=='play'&&Date.now()<end)await new Promise(r=>setTimeout(r,20));assert.equal(guest.api.getSession().phase,'play');assert.ok(host.api.getWorker());
  const x=guest.api.getWorld().players[1].x;guest.api.setInput({x:1,sprint:true,ax:3000,ay:1300});await new Promise(r=>setTimeout(r,600));guest.api.setInput({});
  host.api.draw();guest.api.draw();const authoritativeX=guest.api.getWorld().players[1].x;guest.api.draw();assert.equal(guest.api.getWorld().players[1].x,authoritativeX,'drawing must not mutate state');
  const t=host.api.getWorld().time,oldX=host.api.getWorld().players[1].x;host.api.stopHostUI();guest.api.setInput({x:-1,ax:100,ay:1300});await new Promise(r=>setTimeout(r,1100));guest.api.setInput({});
  assert.ok(oldX>x+40);assert.ok(host.api.getWorld().time>t+.8);assert.ok(host.api.getWorld().players[1].x<oldX-30);assert.ok(guest.api.prediction.pending.length<40);assert.ok(guest.api.prediction.lastError<.1);
  assert.equal(host.api.saveGame(),true);await new Promise(r=>setTimeout(r,100));const saved=JSON.parse(storage.get('deadzone-save-v1-host'));assert.equal(saved.version,1);assert.equal(saved.world.players.length,1);assert.ok(saved.world.houses.length);
  guest.api.draw();assert.equal(guest.ui.labels.builds,1,'HUD must keep the same nodes across updates');
  host.c.document.querySelector=()=>null;host.c.setTimeout=setTimeout;host.c.clearTimeout=clearTimeout;
  active=false;host.c.window.closeDeadZone();await new Promise(r=>setTimeout(r,100));assert.equal(host.api.getSession(),null);assert.equal(host.api.getWorker(),null);assert.ok(JSON.parse(storage.get('deadzone-save-v1-host')).world.time>t+.8,'exit save must come from the worker');
  assert.deepEqual(errors,[]);
 }finally{active=false;host.api.resetNetwork();guest.api.resetNetwork();}
});
