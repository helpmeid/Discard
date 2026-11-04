const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../oakhaven-core.js');
const run=(s,input,n=60)=>{for(let i=0;i<n;i++)C.step(s,input,1/60);};
test('normalized movement, bounded world, two independent players',()=>{
  const a=C.create(2),b=C.create();run(a,[{right:true,down:true},{left:true}]);run(b,[{right:true}]);
  assert.ok(Math.abs(Math.hypot(a.players[0].x-160,a.players[0].y-190)-Math.hypot(b.players[0].x-160,b.players[0].y-190))<.01);
  assert.ok(a.players[1].x<188);run(a,[{right:true,down:true}],1000);assert.ok(a.players[0].x<=620&&a.players[0].y<=345);
});
test('roll consumes stamina and grants a short invulnerability window',()=>{
  const s=C.create(),p=s.players[0];C.step(s,[{roll:true}],1/60);assert.equal(s.rolls,1);assert.equal(p.stamina,70);C.hurt(s,p,30,{x:p.x+10,y:p.y});assert.equal(p.hp,100);
  run(s,[{}],120);assert.equal(p.roll,0);assert.equal(p.stamina,100);
});
test('front perfect parry, late block, and rear damage differ',()=>{
  const s=C.create(),p=s.players[0];C.step(s,[{block:true}],1/60);C.hurt(s,p,20,{x:p.x+20,y:p.y});assert.equal(s.parries,1);assert.equal(p.hp,100);
  s.freeze=0;run(s,[{block:true}],20);C.hurt(s,p,20,{x:p.x+20,y:p.y});assert.equal(s.parries,1);assert.equal(p.stamina,90);
  C.hurt(s,p,20,{x:p.x-20,y:p.y});assert.equal(p.hp,80);
});
test('heavy hit applies directional knockback, four-frame hitstop and poise stagger',()=>{
  const s=C.create(),p=s.players[0],e=C.enemy(s,p.x+30,p.y);s.enemies=[e];e.poise=10;C.strike(s,p,true);
  assert.equal(e.hp,8);assert.ok(e.kx>0);assert.ok(e.stagger>0);assert.equal(s.freeze,4/60);assert.equal(s.shake,12);assert.ok(s.particles.length>0);
  const x=e.x;C.step(s,[{}],1/60);assert.equal(e.x,x);
});
test('strikes miss behind player and attack cooldown prevents duplicate damage',()=>{
  const s=C.create(),p=s.players[0],front=C.enemy(s,p.x+25,p.y),back=C.enemy(s,p.x-25,p.y);s.enemies=[front,back];C.strike(s,p,false);C.strike(s,p,false);assert.equal(front.hp,30);assert.equal(back.hp,50);
});
test('optional training never blocks starting the mission',()=>{
  const s=C.create();C.step(s,[{interact:true}],1/60);assert.equal(s.scene,'mire');assert.equal(s.parries,0);assert.equal(s.enemies.length,4);
});
test('boar wave leads to Huntsman, phase transition, then victory',()=>{
  const s=C.create();C.deploy(s);s.enemies.forEach(e=>e.hp=0);C.step(s,[{}],1/60);assert.equal(s.enemies[0].kind,'marauder');s.enemies.forEach(e=>e.hp=0);C.step(s,[{}],1/60);assert.equal(s.enemies[0].kind,'huntsman');s.players[0].x=1030;s.players[0].y=620;s.enemies[0].hp=190;C.step(s,[{}],1/60);assert.equal(s.enemies[0].phase,2);s.freeze=0;s.enemies[0].hp=0;C.step(s,[{}],1/60);assert.equal(s.won,true);
});
test('projectile parry and trap root are simulation-owned',()=>{
  const s=C.create();C.deploy(s);const p=s.players[0];p.blocking=true;p.blockAge=0;C.hurt(s,p,12,{x:p.x+10,y:p.y});assert.equal(s.parries,1);
  s.freeze=0;p.blocking=false;s.traps=[{x:p.x,y:p.y,life:10}];C.step(s,[{}],1/60);assert.equal(p.rooted,1.5);const x=p.x;s.freeze=0;run(s,[{right:true}],20);assert.equal(p.x,x);
});
test('network rejects extra input fields, bad coordinate snapshots and oversized arrays',()=>{
  assert.equal(C.validInput({attack:true,roll:false}),true);assert.equal(C.validInput({attack:1}),false);assert.equal(C.validInput({hp:1000}),false);
  const s=C.create(2);assert.equal(C.validSnapshot(s),true);s.players[0].x=NaN;assert.equal(C.validSnapshot(s),false);s.players[0].x=0;s.enemies=Array(17).fill({x:1,y:1});assert.equal(C.validSnapshot(s),false);
});
test('long host simulation keeps transient objects bounded and serializable',()=>{
  const s=C.create(2);C.deploy(s);for(let n=0;n<36000;n++){s.players.forEach(p=>p.hp=100);C.step(s,[{attack:true,right:n%240<120,left:n%240>=120},{block:n%30<10}],1/60);}
  assert.ok(C.validSnapshot(JSON.parse(JSON.stringify(s))));assert.ok(s.particles.length<=160);assert.ok(s.projectiles.length<=32);assert.ok(s.traps.length<=12);
});
