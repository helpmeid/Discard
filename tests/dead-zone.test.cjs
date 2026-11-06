const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function game(){const code=fs.readFileSync(require('node:path').join(__dirname,'../dead-zone.js'),'utf8').replace('window.openDeadZone=open;',`window.test={setMenu:m=>menu=m,networkSnapshot,updateGuestVisuals,guestVisuals,saveGame,readSave,newWorld,tick,solid,move,action,equip,swapWeapon,storyTick,zombieSpawn,draw,build,open,lobby,missionSites,binds,burst,setSession:s=>session=s,getSession:()=>session,setWorld:w=>world=w,getWorld:()=>world,setInput:a=>localInput=a,inputs};window.openDeadZone=open;`);const c={console,Math,Set,Map,Number,JSON,crypto:require('node:crypto').webcrypto,performance,localStorage:{getItem:()=>null},currentUser:{id:'host'},viewPerson:()=>({displayName:'Tester'}),state:{friends:{guest:{}}},connectTo(){},sendTo(){},window:{},document:{},requestAnimationFrame(){}};vm.createContext(c);vm.runInContext(code,c);const api=c.window.test;api.setSession({mode:'host',gameMode:'story',difficulty:'normal',phase:'play',id:'test',host:'host',peers:new Map([['guest',{}]])});api.setWorld(api.newWorld(['host','guest']));return {api,c,w:api.getWorld()};}
test('story supplies, radio, timed extraction, victory and dead-player exclusion',()=>{const {api,w}=game();const p=w.players[0];p.x=1680;p.y=1170;api.setInput({use:true});for(let i=0;i<42;i++)api.storyTick(.05);assert.equal(w.story.stage,1);assert.equal(p.secondary,'pistol');assert.equal(p.ammo,30);p.x=2050;p.y=1370;for(let i=0;i<82;i++)api.storyTick(.05);assert.equal(w.story.stage,2);api.storyTick(1);assert.equal(w.story.defense,0);p.x=1800;p.y=1530;for(let i=0;i<46;i++)api.storyTick(1);assert.equal(w.won,true);assert.equal(w.ended,true);});
test('endless does not end after story timer and never revives dead teammates',()=>{const {api,w}=game();w.mode='endless';w.between=0;w.remaining=0;w.players[1].hp=0;api.tick(.05);assert.equal(w.players[1].hp,0);assert.equal(w.between,9);assert.equal(w.ended,false);});
test('sprint consumes stamina, walking restores it and collisions stop walls',()=>{const {api,w}=game(),p=w.players[0];w.between=100;api.setInput({x:1,sprint:true});for(let i=0;i<10;i++)api.tick(.05);assert.ok(p.stamina<90);api.setInput({});for(let i=0;i<10;i++)api.tick(.05);assert.ok(p.stamina>90);const h=w.houses[0];p.x=h.x-20;p.y=h.y+40;api.move(p,100,0);assert.ok(p.x<h.x);});
test('chest opening drops loot, pickup requires release and a second press',()=>{const {api,w}=game(),p=w.players[0],chest=w.chests[0];w.mode='endless';w.between=100;p.x=chest.x;p.y=chest.y;api.setInput({use:true});for(let i=0;i<30;i++)api.tick(.05);assert.equal(chest.opened,true);assert.ok(w.drops.length);api.setInput({});api.tick(.05);api.setInput({use:true});api.tick(.05);assert.equal(w.drops.length,0);});
test('projectile substeps hit targets and produce capped effects and blood',()=>{const {api,w}=game();w.mode='endless';w.between=0;w.remaining=2;const p=w.players[0];w.zombies=[{x:p.x+33,y:p.y,hp:20,maxHp:20,speed:0,attack:100}];w.shots=[{x:p.x,y:p.y,vx:730,vy:0,life:1,damage:25,owner:p.id}];api.tick(.05);assert.equal(w.zombies.length,0);assert.equal(p.kills,1);assert.ok(w.effects.length);assert.ok(w.blood.length);for(let i=0;i<40;i++)api.burst(1,1,'#ffffff',20);assert.equal(w.effects.length,180);});
test('host processes guest movement, equipment and door actions',()=>{const {api,c,w}=game();w.between=100;const p=w.players[1];c.window.deadZoneHandle('guest',{v:1,id:'test',t:'dz-input',input:{x:1,sprint:true}});const x=p.x;api.tick(.05);assert.ok(p.x>x);p.inventory.push('axe');c.window.deadZoneHandle('guest',{v:1,id:'test',t:'dz-equip',slot:1,hand:'secondary'});assert.equal(p.weapon,'axe');const h=w.houses[0];p.x=h.doorX;p.y=h.doorY+30;c.window.deadZoneHandle('guest',{v:1,id:'test',t:'dz-input',input:{door:true}});api.tick(.05);assert.equal(h.doorOpen,true);});
test('guest door press is consumed once, even across multiple host ticks',()=>{const {api,c,w}=game(),p=w.players[1],h=w.houses[0];w.between=100;p.x=h.doorX;p.y=h.doorY+30;c.window.deadZoneHandle('guest',{v:1,id:'test',t:'dz-input',input:{door:true}});api.tick(.02);api.tick(.02);api.tick(.02);assert.equal(h.doorOpen,true);});
test('melee cannot hit through closed doors',()=>{const {api,w}=game(),p=w.players[0],h=w.houses[0];w.mode='endless';w.between=100;p.x=h.doorX;p.y=h.doorY+20;w.zombies=[{x:h.doorX,y:h.doorY-20,hp:100,maxHp:100,speed:0,attack:99}];api.setInput({fire:true,ax:h.doorX,ay:h.doorY-20});api.tick(.05);assert.equal(w.zombies[0].hp,100);});
test('infected can enter an open house without position jumps',()=>{const {api,w}=game(),p=w.players[0],h=w.houses[0];w.mode='endless';w.between=0;w.remaining=10;w.spawned=-1000;w.players[1].hp=0;h.doorOpen=true;p.x=h.doorX;p.y=h.doorY-60;p.invuln=100;const z={x:h.x-70,y:h.y-30,hp:100,maxHp:100,speed:90,attack:99};w.zombies=[z];let near=Infinity;for(let i=0;i<400;i++){const x=z.x,y=z.y;api.tick(.025);assert.ok(Math.hypot(z.x-x,z.y-y)<4);near=Math.min(near,Math.hypot(z.x-p.x,z.y-p.y));}assert.ok(near<27,'Zombie must reach survivor inside house, distance '+near);});
test('projectiles keep moving during resupply and the countdown starts the next wave',()=>{const {api,w}=game(),p=w.players[0];w.mode='endless';w.between=.2;w.shots=[{x:p.x,y:p.y,vx:730,vy:0,life:1,damage:25,owner:p.id}];api.tick(.05);assert.ok(w.shots[0].x>p.x+30);for(let i=0;i<5;i++)api.tick(.05);assert.equal(w.wave,1);assert.ok(w.remaining>0);});
module.exports={game};

test('compact snapshots omit geometry, resync scenery and strip projectile trails',()=>{
 const {api,w}=game();w.shots=[{x:100,y:100,vx:10,vy:0,trail:Array(50).fill({x:1,y:1})}];
 const first=api.networkSnapshot(),next=api.networkSnapshot();
 assert.equal(next.world.houses,undefined);assert.equal(next.world.chests,undefined);
 assert.equal(next.world.shots[0].trail,undefined);assert.equal(next.scenery,undefined);
 assert.ok(first.scenery);assert.ok(next.seq>first.seq);
 assert.ok(JSON.stringify(next).length<JSON.stringify(w).length*.5);
 w.houses[0].doorOpen=true;w.chests[0].opened=true;
 const changed=api.networkSnapshot();assert.equal(changed.scenery.doors[0][0],true);assert.equal(changed.scenery.chests[0],true);
 w.time+=1.1;assert.ok(api.networkSnapshot().scenery,'periodic scenery repairs skipped snapshots');
});
test('guest movement predicts before a host reply without changing authoritative state',()=>{
 const {api,w}=game(),p=w.players[0];api.setSession({mode:'guest'});api.setInput({x:1,sprint:true});
 const x=p.x;api.updateGuestVisuals(1000);for(let t=1016;t<1110;t+=16)api.updateGuestVisuals(t);
 const v=api.guestVisuals.get('p:host');assert.ok(v.x>x+5);assert.equal(p.x,x);assert.equal(p.stamina,100);
 p.hp=0;api.setInput({x:1});const deadX=v.x;for(let t=1120;t<1600;t+=16)api.updateGuestVisuals(t);assert.ok(v.x<=deadX);
 w.players=[];api.updateGuestVisuals(1700);assert.equal(api.guestVisuals.size,0);
});
test('predicted movement respects closed walls',()=>{
 const {api,w}=game(),p=w.players[0],h=w.houses[0];p.x=h.x-20;p.y=h.y+40;
 api.setInput({x:1,sprint:true});api.updateGuestVisuals(1000);for(let t=1016;t<2000;t+=16)api.updateGuestVisuals(t);
 assert.ok(api.guestVisuals.get('p:host').x<h.x-10);
});
test('save round trip retains gameplay state and excludes transient networking',()=>{
 const {api,c,w}=game(),storage=new Map();c.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 w.players[0].ammo=42;w.houses[0].doorOpen=true;w.chests[0].opened=true;api.networkSnapshot();
 assert.equal(api.saveGame(),true);const saved=api.readSave();assert.equal(saved.world.players.length,1);
 assert.equal(saved.world.players[0].ammo,42);assert.equal(saved.world.houses[0].doorOpen,true);assert.equal(saved.world.chests[0].opened,true);
 assert.equal(saved.world.seq,undefined);assert.equal(saved.version,1);
});

test('guest applies compact state, scenery and rejects stale sequence numbers',()=>{
 const {api,c,w}=game();api.setMenu({style:{}});c.state.friends.host={};
 api.setSession({mode:'guest',host:'host',id:'test',phase:'play'});
 const send=d=>c.window.deadZoneHandle('host',JSON.parse(JSON.stringify({v:1,id:'test',...d})));
 send({t:'dz-start',world:w});const houses=api.getWorld().houses;
 const active=api.getWorld();active.houses[0].doorOpen=true;active.houses[0].doorMaxHp=210;active.chests[0].opened=true;active.players[0].ammo=52;
 active.zombies=[{x:1900.123,y:1300,hp:50,maxHp:50,kind:'runner',speed:120}];
 const packet=api.networkSnapshot();assert.ok(Array.isArray(packet.world.zombies[0]));send(packet);
 const loaded=api.getWorld();assert.equal(loaded.houses,houses);assert.equal(loaded.houses[0].doorOpen,true);
 assert.equal(loaded.houses[0].doorMaxHp,210);assert.equal(loaded.chests[0].opened,true);assert.equal(loaded.players[0].ammo,52);
 assert.equal(loaded.zombies[0].kind,'runner');assert.equal(loaded.zombies[0].x,1900.1);assert.ok(loaded.zombies[0].netId>0);
 packet.world.players[0].ammo=0;send(packet);assert.equal(api.getWorld().players[0].ammo,52);
});
