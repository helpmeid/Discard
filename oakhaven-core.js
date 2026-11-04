/* Oakhaven: deterministic, DOM-free simulation. Host owns combat; clients send intent. */
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const unit = (x, y) => { const n = Math.hypot(x, y) || 1; return { x: x / n, y: y / n }; };
  const actions = ['up', 'down', 'left', 'right', 'attack', 'heavy', 'roll', 'block', 'interact'];
  const presets = [
    { up:'KeyW', down:'KeyS', left:'KeyA', right:'KeyD', attack:'KeyF', heavy:'KeyG', roll:'Space', block:'KeyR', interact:'KeyE' },
    { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight', attack:'KeyJ', heavy:'KeyK', roll:'KeyL', block:'KeyI', interact:'KeyO' }
  ];
  const player = i => ({ x:160 + i * 28, y:190, hp:100, stamina:100, fx:1, fy:0, cooldown:0, roll:0, invulnerable:0, blockAge:99, blocking:false, kills:0 });
  function create(count = 1) {
    return { version:1, scene:'hub', players:Array.from({length:clamp(count,1,2)}, (_,i)=>player(i)), enemies:[], projectiles:[], particles:[], traps:[], time:0, freeze:0, shake:0, slow:0, parries:0, rolls:0, scrap:0, wave:0, phase:'training', message:'Old Man Garrow: Eight years since Oakhaven burned. Show me you can survive. E: train or deploy.', nextId:1, won:false };
  }
  function enemy(s, x, y, kind = 'boar') {
    const boss = kind === 'huntsman';
    return { id:s.nextId++, x,y,kind,hp:boss?480:50,maxHp:boss?480:50,poise:0,flash:0,stagger:0,cooldown:boss?2:1,windup:0,kx:0,ky:0,phase:1,pack:20,combo:0 };
  }
  function sparks(s,x,y,color,n=10) {
    for (let i=0;i<n && s.particles.length<160;i++) {
      const a = i * 2.399 + s.time;
      s.particles.push({x,y,vx:Math.cos(a)*55,vy:Math.sin(a)*55,life:.35,color});
    }
  }
  function impact(s,x,y,weight=4,color='#ffd97b') { s.shake=Math.max(s.shake,weight); s.freeze=Math.max(s.freeze,weight>=10?4/60:2/60); sparks(s,x,y,color); }
  function deploy(s) {
    s.scene='mire'; s.phase='hunt'; s.wave=1; s.won=false; s.traps=[]; s.projectiles=[];
    s.players.forEach((p,i)=>Object.assign(p,player(i)));
    s.enemies=[enemy(s,350,170),enemy(s,430,260),enemy(s,510,150)];
    s.message='The Wild Hunt: defeat the corrupted boars. The Huntsman waits beyond.';
  }
  function hurt(s,p,damage,source) {
    if(p.invulnerable>0 || p.hp<=0) return;
    const v=unit(source.x-p.x,source.y-p.y);
    const facing=p.fx*v.x+p.fy*v.y > .05;
    if(p.blocking && facing && p.stamina>=10) {
      if(p.blockAge<=.18) {
        s.parries++; p.stamina=clamp(p.stamina+12,0,100);
        if(source.hp) {source.stagger=1; source.poise=0; source.hp-=10;}
        impact(s,p.x,p.y,8); s.message='Perfect parry!'; return;
      }
      p.stamina-=10; impact(s,p.x,p.y,3); return;
    }
    p.hp=Math.max(0,p.hp-damage); p.invulnerable=.65;
    p.x=clamp(p.x-v.x*14,20,620); p.y=clamp(p.y-v.y*14,35,345);
    impact(s,p.x,p.y,5,'#ed775e');
  }
  function strike(s,p,heavy) {
    if(p.cooldown>0 || p.roll>0 || p.hp<=0 || (heavy && p.stamina<25)) return;
    p.cooldown=heavy?.65:.28; p.swing=.14; p.heavy=heavy;
    if(heavy) p.stamina-=25;
    for(const e of s.enemies) {
      if(e.hp<=0 || distance(p,e)>(heavy?65:48)) continue;
      const v=unit(e.x-p.x,e.y-p.y);
      if(v.x*p.fx+v.y*p.fy<.15) continue;
      e.hp-=heavy?35:18; e.poise+=heavy?55:20; e.flash=.13;
      e.kx=v.x*(heavy?220:120); e.ky=v.y*(heavy?220:120);
      if(e.poise>=60){e.stagger=.8;e.poise=0;}
      impact(s,e.x,e.y,heavy?12:3);
      if(e.hp<=0){p.kills++;s.scrap++;sparks(s,e.x,e.y,'#8acb8c',18);if(heavy)s.slow=.2;}
    }
  }
  function step(s, inputs, dt) {
    dt=clamp(dt,0,1/30); s.time+=dt;
    s.shake=Math.max(0,s.shake-dt*26);
    s.particles=s.particles.filter(p=>(p.life-=dt)>0);
    for(const p of s.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;}
    if(s.freeze>0){s.freeze-=dt;return;}
    if(s.slow>0){s.slow-=dt;dt*=.25;}
    s.players.forEach((p,i)=>{
      const a=inputs[i]||{};
      p.cooldown=Math.max(0,p.cooldown-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);p.swing=Math.max(0,(p.swing||0)-dt);
      if(p.hp<=0)return;
      p.blockAge=a.block?(p.blocking?p.blockAge+dt:0):99;p.blocking=!!a.block;
      let x=(a.right?1:0)-(a.left?1:0),y=(a.down?1:0)-(a.up?1:0);
      const v=unit(x,y);
      if(x||y){p.fx=v.x;p.fy=v.y;}
      if(a.roll && !p.roll && p.stamina>=30){p.roll=.22;p.invulnerable=.25;p.stamina-=30;s.rolls++;}
      const rolling=p.roll>0;p.roll=Math.max(0,p.roll-dt);
      p.rooted=Math.max(0,(p.rooted||0)-dt);
      const speed=p.rooted>0?0:rolling?310:p.blocking?48:(s.scene==='mire'&&p.y>250?76:112);
      p.x=clamp(p.x+(rolling?p.fx:v.x)*speed*dt,20,620);p.y=clamp(p.y+(rolling?p.fy:v.y)*speed*dt,35,345);
      if(!rolling && !p.blocking)p.stamina=clamp(p.stamina+23*dt,0,100);
      if(a.attack)strike(s,p,false);if(a.heavy)strike(s,p,true);
      if(a.interact && s.scene==='hub') {
        if(s.parries>=5 && s.rolls>=3)deploy(s);
        else {s.phase='training';s.message='Iron and Reflex: face Garrow and tap block before his staff lands. 5 perfect parries + 3 rolls to deploy.';}
      }
    });
    if(s.scene==='hub') {
      s.trainingClock=(s.trainingClock||0)+dt;
      if(s.phase==='training' && s.trainingClock>=2) {
        s.trainingClock=0;
        for(const p of s.players)if(distance(p,{x:275,y:190})<140){hurt(s,p,5,{x:275,y:190});p.hp=100;}
      }
      return;
    }
    if(s.won || s.players.every(p=>p.hp<=0))return;
    for(const e of s.enemies) {
      if(e.hp<=0)continue;
      e.flash=Math.max(0,e.flash-dt);e.stagger=Math.max(0,e.stagger-dt);
      e.x=clamp(e.x+e.kx*dt,24,616);e.y=clamp(e.y+e.ky*dt,40,340);e.kx*=.8;e.ky*=.8;
      if(e.stagger>0)continue;
      const p=s.players.filter(p=>p.hp>0).sort((a,b)=>distance(a,e)-distance(b,e))[0];if(!p)continue;
      const v=unit(p.x-e.x,p.y-e.y),d=distance(e,p),boss=e.kind==='huntsman';
      if(boss && e.hp<e.maxHp/2 && e.phase===1){e.phase=2;e.stagger=1.5;impact(s,e.x,e.y,12);s.message='The Huntsman shatters his crossbow. Watch the overhead chop!';continue;}
      e.cooldown-=dt;
      if(e.windup>0) {
        e.windup-=dt;
        if(e.windup<=0){
          if(boss&&e.phase===1){for(let j=-1;j<=1;j++){const a=Math.atan2(v.y,v.x)+j*.18;s.projectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*160,vy:Math.sin(a)*160,life:4});}}
          else {if(d<55)hurt(s,p,boss?20:12,e);else if(boss)impact(s,e.x,e.y,6,'#857554');if(boss){e.stagger=1;for(let j=0;j<3 && s.traps.length<12;j++)s.traps.push({x:clamp(e.x+(j-1)*32,25,615),y:clamp(e.y+35,40,340),life:10});}}
        }
        continue;
      }
      if(e.cooldown<=0 && (d<43 || (boss&&e.phase===1))){e.windup=boss?.8:.55;e.cooldown=boss?1.9:1.5;}
      else {
        const direction=boss&&e.phase===1?(d<155?-1:d>190?1:0):1;
        e.x=clamp(e.x+v.x*direction*(boss?75:46)*dt,24,616);e.y=clamp(e.y+v.y*direction*(boss?75:46)*dt,40,340);
      }
      if(boss&&e.phase===1 && (e.pack-=dt)<=0){e.pack=20;if(s.enemies.length<15){s.enemies.push(enemy(s,550,110,'hound'),enemy(s,550,300,'hound'));}s.message='The Huntsman calls the pack!';}
    }
    for(const b of s.projectiles){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;for(const p of s.players)if(b.life>0&&distance(p,b)<12){hurt(s,p,12,{x:b.x-b.vx*.1,y:b.y-b.vy*.1});b.life=0;}}
    s.projectiles=s.projectiles.filter(b=>b.life>0&&b.x>0&&b.x<640&&b.y>0&&b.y<360).slice(0,32);
    for(const t of s.traps){t.life-=dt;for(const p of s.players)if(t.life>0&&distance(t,p)<12&&p.invulnerable<=0){hurt(s,p,8,t);p.rooted=1.5;t.life=0;}}
    s.traps=s.traps.filter(t=>t.life>0);
    s.enemies=s.enemies.filter(e=>e.hp>0);
    if(!s.enemies.length) {
      if(s.wave===1){s.wave=2;s.enemies=[enemy(s,500,175,'huntsman')];s.message='The Huntsman: close the gap, parry the bolts, punish his recovery.';}
      else {s.won=true;s.phase='complete';s.message='The Mire is free. Garrow: One oath kept. The Duke still waits. Vertical slice complete.';}
    }
  }
  function validInput(a) {return a && typeof a==='object' && actions.every(k=>a[k]===undefined||typeof a[k]==='boolean') && Object.keys(a).every(k=>actions.includes(k));}
  function validSnapshot(s) {
    if(!s || s.version!==1 || !['hub','mire'].includes(s.scene) || !Array.isArray(s.players)||s.players.length<1||s.players.length>2)return false;
    for(const key of ['players','enemies','projectiles','particles','traps'])if(!Array.isArray(s[key])||s[key].length>({players:2,enemies:16,projectiles:32,particles:160,traps:12}[key]))return false;
    if(typeof s.message!=='string'||s.message.length>500)return false;
    if(!['time','freeze','shake','slow','parries','rolls','scrap','wave','nextId'].every(k=>Number.isFinite(s[k])&&Math.abs(s[k])<1e9))return false;
    if(typeof s.won!=='boolean'||typeof s.phase!=='string'||s.phase.length>30)return false;
    if(!s.players.every(p=>p&&['hp','stamina','fx','fy','cooldown','roll','invulnerable','blockAge','kills'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<1e9)))return false;
    if(!s.enemies.every(e=>e&&['boar','hound','huntsman'].includes(e.kind)&&['hp','maxHp','windup','flash'].every(k=>Number.isFinite(e[k])&&Math.abs(e[k])<1e9)))return false;
    if(!s.particles.every(p=>p&&typeof p.color==='string'&&/^#[0-9a-f]{6}$/i.test(p.color)))return false;
    return ['players','enemies','projectiles','particles','traps'].every(k=>s[k].every(e=>e&&Number.isFinite(e.x)&&Number.isFinite(e.y)&&Math.abs(e.x)<2000&&Math.abs(e.y)<2000));
  }
  const api={create,step,deploy,hurt,strike,enemy,actions,presets,validInput,validSnapshot};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OakhavenCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
