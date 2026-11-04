/* Oakhaven: deterministic, DOM-free simulation. Host owns combat; clients send intent. */
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const INTRO_DURATION=48,VERSION=4;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const unit = (x, y) => { const n = Math.hypot(x, y) || 1; return { x: x / n, y: y / n }; };
  const bounds=s=>s.scene==='mire'?{w:1280,h:800}:{w:640,h:360};
  function collide(s,p){const objects=s.scene==='hub'?[[480,96,53]]:[[760,280,42],[540,180,57],[960,700,65]];for(const [x,y,r] of objects){const dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy);if(d<r+9){const v=unit(dx||1,dy);p.x=x+v.x*(r+9);p.y=y+v.y*(r+9);}}}
  const actions = ['up', 'down', 'left', 'right', 'attack', 'heavy', 'roll', 'block', 'interact', 'ranged', 'heal'];
  const presets = [
    { up:'KeyW', down:'KeyS', left:'KeyA', right:'KeyD', attack:'KeyF', heavy:'KeyG', roll:'Space', block:'KeyR', interact:'KeyE',ranged:'KeyQ',heal:'KeyH' },
    { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight', attack:'KeyJ', heavy:'KeyK', roll:'KeyL', block:'KeyI', interact:'KeyO',ranged:'KeyU',heal:'KeyP' }
  ];
  const player = i => ({ x:160 + i * 28, y:190, hp:100, stamina:100, fx:1, fy:0, cooldown:0, roll:0, invulnerable:0, blockAge:99, blocking:false, kills:0,bowCooldown:0,healCooldown:0,draw:0,level:1,revived:false });
  function create(count = 1) {
    return { version:VERSION, scene:'hub', players:Array.from({length:clamp(count,1,2)}, (_,i)=>player(i)), enemies:[], projectiles:[], particles:[], traps:[],loot:[],events:[],chestReady:false,chestOpen:false,time:0, freeze:0, shake:0, slow:0, parries:0, rolls:0, scrap:0, wave:0, phase:'ready', message:'Garrow: E to set out. Q fires your bow. H drinks a healing potion. Stay moving.', nextId:1, won:false };
  }
  function enemy(s, x, y, kind = 'boar') {
    const boss = kind === 'huntsman';
    const hp=boss?480:kind==='brute'?150:kind==='marauder'?75:50;
    return { id:s.nextId++, x,y,kind,hp,maxHp:hp,poise:0,flash:0,stagger:0,cooldown:boss?2:1,windup:0,kx:0,ky:0,phase:1,pack:20,combo:0 };
  }
  function sparks(s,x,y,color,n=10) {
    for (let i=0;i<n && s.particles.length<160;i++) {
      const a = i * 2.399 + s.time;
      s.particles.push({x,y,vx:Math.cos(a)*55,vy:Math.sin(a)*55,life:.35,color});
    }
  }
  function impact(s,x,y,weight=4,color='#ffd97b') { s.shake=Math.max(s.shake,weight); s.freeze=Math.max(s.freeze,weight>=10?4/60:2/60); sparks(s,x,y,color); }
  function event(s,x,y,text,color='#f1d49a'){if(s.events.length<20)s.events.push({x,y,text,color,life:.8});}
  function damageEnemy(s,e,amount,p,heavy=false){if(e.hp<=0)return;const v=unit(e.x-p.x,e.y-p.y);e.hp-=amount;e.flash=.13;e.kx=v.x*(heavy?240:100);e.ky=v.y*(heavy?240:100);e.poise+=heavy?55:20;if(e.poise>=60){e.stagger=.85;e.poise=0;e.windup=0;e.cooldown=Math.max(e.cooldown,.65);event(s,e.x,e.y,'STAGGER');}event(s,e.x,e.y,String(amount));impact(s,e.x,e.y,heavy?12:3);if(e.hp<=0){p.kills++;s.scrap++;if(s.loot.length<24)s.loot.push({x:e.x,y:e.y,kind:s.scrap%3===0?'health':'gold'});sparks(s,e.x,e.y,'#8acb8c',18);if(heavy)s.slow=.2;}}
  function deploy(s) {
    s.scene='mire'; s.phase='hunt'; s.wave=1; s.won=false; s.traps=[]; s.projectiles=[];s.loot=[];
    s.players.forEach((p,i)=>Object.assign(p,player(i)));
    s.enemies=[enemy(s,340,255),enemy(s,420,320),enemy(s,475,270),enemy(s,485,355,'archer')];
    s.message='I · THE WILD HUNT — Follow the trail east. Clear the corrupted beasts.';
  }
  function hurt(s,p,damage,source) {
    if(p.invulnerable>0 || p.hp<=0) return;
    const v=unit(source.x-p.x,source.y-p.y);
    const facing=p.fx*v.x+p.fy*v.y > .05;
    if(p.blocking && facing && p.stamina>=10) {
      if(p.blockAge<=.18) {
        s.parries++; p.stamina=clamp(p.stamina+12,0,100);
        if(source.hp) {damageEnemy(s,source,10,p);source.stagger=1;source.poise=0;source.windup=0;source.cooldown=Math.max(source.cooldown,.7);}
        impact(s,p.x,p.y,8);event(s,p.x,p.y,'PARRY','#a9dfde');return;
      }
      p.stamina-=10; impact(s,p.x,p.y,3); return;
    }
    p.hp=Math.max(0,p.hp-damage); p.invulnerable=.65;
    const b=bounds(s);p.x=clamp(p.x-v.x*14,20,b.w-20); p.y=clamp(p.y-v.y*14,35,b.h-15);
    impact(s,p.x,p.y,5,'#ed775e');
    event(s,p.x,p.y,'−'+damage,'#ee9e8b');
  }
  function strike(s,p,heavy) {
    if(p.cooldown>0 || p.roll>0 || p.hp<=0 || (heavy && p.stamina<25)) return;
    p.chain=(p.chain||0)%3+1;p.cooldown=heavy?.6:.25;p.draw=0;p.swing=heavy?.3:.24;p.heavy=heavy;
    // Assistance may choose a target in front of the aim, but must never rotate the swing.
    if(heavy) p.stamina-=25;
    for(const e of s.enemies) {
      if(e.hp<=0 || distance(p,e)>(heavy?65:48)) continue;
      const v=unit(e.x-p.x,e.y-p.y);
      if(distance(p,e)>12&&v.x*p.fx+v.y*p.fy<.25) continue;
      damageEnemy(s,e,Math.round((heavy?42:p.chain===3?27:20)*(1+(p.level-1)*.25)),p,heavy);
    }
  }
  function step(s, inputs, dt) {
    dt=clamp(dt,0,1/30); s.time+=dt;
    if(Number.isFinite(s.intro)&&s.intro<INTRO_DURATION){s.intro=inputs.some(a=>a?.interact)?INTRO_DURATION:Math.min(INTRO_DURATION,s.intro+dt);return;}
    const area=bounds(s);
    s.events=s.events.filter(e=>(e.life-=dt)>0);
    s.shake=Math.max(0,s.shake-dt*26);
    s.particles=s.particles.filter(p=>(p.life-=dt)>0);
    for(const p of s.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;}
    s.players.forEach((p,i)=>{const a=inputs[i]||{};if(a.attack||a.heavy){p.attackQueued=.14;p.queueHeavy=!!a.heavy;}for(const action of ['roll','ranged','heal'])if(a[action])p[action+'Queued']=.14;});
    if(s.freeze>0){s.freeze-=dt;return;}
    if(s.slow>0){s.slow-=dt;dt*=.25;}
    s.players.forEach((p,i)=>{
      const a={...inputs[i]};for(const action of ['roll','ranged','heal']){const name=action+'Queued';if(p[name]>0)a[action]=true;p[name]=Math.max(0,(p[name]||0)-dt);}
      p.cooldown=Math.max(0,p.cooldown-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);p.swing=Math.max(0,(p.swing||0)-dt);
      p.bowCooldown=Math.max(0,p.bowCooldown-dt);p.healCooldown=Math.max(0,p.healCooldown-dt);p.draw=Math.max(0,p.draw-dt);
      if(p.hp<=0)return;
      p.blockAge=a.block?(p.blocking?p.blockAge+dt:0):99;p.blocking=!!a.block;
      let x=(a.right?1:0)-(a.left?1:0),y=(a.down?1:0)-(a.up?1:0);
      const v=unit(x+y,y-x);
      if(!p.roll){if(Number.isFinite(a.lookX)&&Number.isFinite(a.lookY)&&Math.hypot(a.lookX,a.lookY)>.01){const aim=unit(a.lookX,a.lookY);p.fx=aim.x;p.fy=aim.y;}else if(x||y){p.fx=v.x;p.fy=v.y;}}
      if(a.roll && !p.roll && !(p.rooted>0) && p.stamina>=30){p.rollQueued=0;p.roll=.22;p.invulnerable=.25;p.stamina-=30;p.rollFX=p.fx;p.rollFY=p.fy;s.rolls++;}
      const rolling=p.roll>0;p.roll=Math.max(0,p.roll-dt);
      p.rooted=Math.max(0,(p.rooted||0)-dt);
      const speed=p.rooted>0?0:rolling?340:p.blocking?62:135;
      if(rolling)p.blocking=false;
      p.moving=!!(x||y)||rolling;p.x=clamp(p.x+(rolling?(p.rollFX??p.fx):v.x)*speed*dt,20,area.w-20);p.y=clamp(p.y+(rolling?(p.rollFY??p.fy):v.y)*speed*dt,35,area.h-15);
      collide(s,p);
      if(!rolling && !p.blocking)p.stamina=clamp(p.stamina+23*dt,0,100);
      p.attackQueued=Math.max(0,(p.attackQueued||0)-dt);if(a.ranged)p.attackQueued=0;else if(a.attack||a.heavy){p.attackQueued=.14;p.queueHeavy=!!a.heavy;}
      if(p.attackQueued>0&&!p.cooldown&&!p.roll&&(!p.queueHeavy||p.stamina>=25)){strike(s,p,p.queueHeavy);p.attackQueued=0;}
      if(a.ranged&&!p.bowCooldown&&!p.cooldown&&s.projectiles.length<32&&!p.roll){p.rangedQueued=0;const aim={x:p.fx,y:p.fy};p.swing=0;p.draw=.28;p.cooldown=.18;p.bowCooldown=.65;s.projectiles.push({x:p.x,y:p.y,vx:aim.x*360,vy:aim.y*360,life:1.5,friendly:true,owner:i});}
      if(a.heal&&!p.healCooldown&&p.hp<100){p.healQueued=0;p.hp=clamp(p.hp+55,0,100);p.healCooldown=18;sparks(s,p.x,p.y,'#9fd4a8',18);event(s,p.x,p.y,'HEALED','#a9dfaf');}
      if(a.interact && s.scene==='hub') {
        deploy(s);
      }
      if(a.interact&&s.scene==='mire'){if(s.chestReady&&!s.chestOpen&&distance(p,{x:810,y:420})<90){s.chestOpen=true;s.players.forEach(q=>{q.level=2;if(q.hp>0)q.hp=Math.min(100,q.hp+20);});s.scrap+=15;event(s,p.x,p.y,'BLADE UPGRADED');}else{const down=s.players.find(q=>q.hp<=0&&!q.revived&&distance(p,q)<65);if(down){down.hp=40;down.revived=true;down.invulnerable=2;event(s,down.x,down.y,'REVIVED','#a9dfaf');}}}
    });
    if(s.scene==='hub') {
      s.trainingClock=(s.trainingClock||0)+dt;
      if(s.trainingClock>=2) {
        s.trainingClock=0;
        for(const p of s.players)if(distance(p,{x:275,y:190})<140){hurt(s,p,5,{x:275,y:190});p.hp=100;}
      }
      return;
    }
    if(s.won || s.players.every(p=>p.hp<=0))return;
    for(const e of s.enemies) {
      if(e.hp<=0)continue;
      e.flash=Math.max(0,e.flash-dt);e.stagger=Math.max(0,e.stagger-dt);
      e.x=clamp(e.x+e.kx*dt,24,area.w-24);e.y=clamp(e.y+e.ky*dt,40,area.h-20);e.kx*=.8;e.ky*=.8;
      if(e.stagger>0)continue;
      const p=s.players.filter(p=>p.hp>0).sort((a,b)=>distance(a,e)-distance(b,e))[0];if(!p)continue;
      const v=unit(p.x-e.x,p.y-e.y),d=distance(e,p),boss=e.kind==='huntsman',ranged=e.kind==='archer'||boss&&e.phase===1;
      if(!e.windup){e.fx=v.x;e.fy=v.y;}
      if(d>300)continue;
      if(boss && e.hp<e.maxHp/2 && e.phase===1){e.phase=2;e.stagger=1.5;e.windup=0;impact(s,e.x,e.y,12);s.message='The Huntsman shatters his crossbow. Watch the overhead chop!';continue;}
      e.cooldown-=dt;
      if(e.windup>0) {
        e.windup-=dt;
        if(e.windup<=0){
          if(ranged){for(let j=boss?-1:0;j<=(boss?1:0);j++){const a=Math.atan2(e.attackFY??v.y,e.attackFX??v.x)+j*.18;if(s.projectiles.length<32)s.projectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*160,vy:Math.sin(a)*160,life:4});}}
          else {const facing=v.x*(e.attackFX??e.fx)+v.y*(e.attackFY??e.fy);if(d<(e.kind==='brute'?75:55)&&(e.kind==='brute'||facing>.4))hurt(s,p,boss?20:e.kind==='brute'?24:12,e);else if(boss||e.kind==='brute')impact(s,e.x,e.y,6,'#857554');if(boss){e.stagger=1;for(let j=0;j<3 && s.traps.length<12;j++)s.traps.push({x:clamp(e.x+(j-1)*32,25,area.w-25),y:clamp(e.y+35,40,area.h-20),life:10});}}
        }
        continue;
      }
      if(e.cooldown<=0 && (d<(e.kind==='brute'?65:43) || ranged)){e.windup=e.kind==='brute'?1.1:boss?.8:.55;e.attackFX=v.x;e.attackFY=v.y;e.cooldown=boss?1.9:1.5;}
      else {
        const direction=ranged?(d<155?-1:d>190?1:0):1;
        e.x=clamp(e.x+v.x*direction*(boss?90:62)*dt,24,area.w-24);e.y=clamp(e.y+v.y*direction*(boss?90:62)*dt,40,area.h-20);
      }
      if(boss&&e.phase===1 && (e.pack-=dt)<=0){e.pack=20;if(s.enemies.length<15){s.enemies.push(enemy(s,e.x+40,e.y-45,'hound'),enemy(s,e.x-40,e.y+45,'hound'));}s.message='The Huntsman calls the pack!';}
    }
    // Keep bodies from occupying the same point and invalidating facing / hit tests.
    for(const e of s.enemies){if(e.hp<=0)continue;collide(s,e);for(const p of s.players){if(p.hp<=0||p.roll>0)continue;const d=distance(p,e),min=e.kind==='brute'?29:23;if(d<min){const away=unit(e.x-p.x||p.fx||1,e.y-p.y||p.fy||0);e.x=p.x+away.x*min;e.y=p.y+away.y*min;}}e.x=clamp(e.x,24,area.w-24);e.y=clamp(e.y,40,area.h-20);}
    for(const b of s.projectiles){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.friendly){for(const e of s.enemies)if(b.life>0&&e.hp>0&&distance(e,b)<18){damageEnemy(s,e,28,s.players[b.owner]||s.players[0]);b.life=0;}}else for(const p of s.players)if(b.life>0&&distance(p,b)<12){hurt(s,p,12,{x:b.x-b.vx*.1,y:b.y-b.vy*.1});b.life=0;}}
    s.projectiles=s.projectiles.filter(b=>b.life>0&&b.x>0&&b.x<area.w&&b.y>0&&b.y<area.h).slice(0,32);
    s.loot=s.loot.filter(l=>{const p=s.players.find(p=>p.hp>0&&distance(p,l)<25);if(!p)return true;if(l.kind==='health')p.hp=clamp(p.hp+35,0,100);else s.scrap+=2;return false;});
    for(const t of s.traps){t.life-=dt;for(const p of s.players)if(t.life>0&&distance(t,p)<12&&p.invulnerable<=0){hurt(s,p,8,t);p.rooted=1.5;t.life=0;}}
    s.traps=s.traps.filter(t=>t.life>0);
    s.enemies=s.enemies.filter(e=>e.hp>0);
    if(!s.enemies.length) {
      if(s.wave===1){s.wave=2;s.enemies=[enemy(s,730,350,'marauder'),enemy(s,800,400,'brute'),enemy(s,850,340,'archer'),enemy(s,800,450,'hound')];s.message='II · THE BROKEN CROSSING — Dodge the brute’s slam. Q: bow. H: healing potion.';}
      else if(s.wave===2){s.wave=3;s.chestReady=true;s.enemies=[enemy(s,1060,620,'huntsman')];s.message='III · THE HUNTSMAN — E at the camp chest to upgrade your blade. Then follow the trail southeast.';s.players.forEach(p=>{if(p.hp>0)p.hp=Math.min(100,p.hp+30);});}
      else {s.won=true;s.phase='complete';s.message='The Mire is free. Garrow: One oath kept. The Duke still waits. Vertical slice complete.';}
    }
  }
  function validInput(a) {return a && typeof a==='object' && actions.every(k=>a[k]===undefined||typeof a[k]==='boolean') && Object.keys(a).every(k=>actions.includes(k)||['lookX','lookY'].includes(k))&&(a.lookX===undefined&&a.lookY===undefined||Number.isFinite(a.lookX)&&Number.isFinite(a.lookY)&&Math.abs(a.lookX)<=1&&Math.abs(a.lookY)<=1&&Math.hypot(a.lookX,a.lookY)>.01);}
  function validSnapshot(s) {
    if(!s || s.version!==VERSION || !['hub','mire'].includes(s.scene) || !Array.isArray(s.players)||s.players.length<1||s.players.length>2)return false;
    if(!Array.isArray(s.events)||s.events.length>20||!s.events.every(e=>e&&Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.life)&&typeof e.text==='string'&&e.text.length<30&&/^#[0-9a-f]{6}$/i.test(e.color)))return false;
    if(!Array.isArray(s.loot)||s.loot.length>24||!s.loot.every(l=>l&&Number.isFinite(l.x)&&Number.isFinite(l.y)&&['health','gold'].includes(l.kind)))return false;
    if(s.intro!==undefined&&(!Number.isFinite(s.intro)||s.intro<0||s.intro>INTRO_DURATION))return false;
    for(const key of ['players','enemies','projectiles','particles','traps'])if(!Array.isArray(s[key])||s[key].length>({players:2,enemies:16,projectiles:32,particles:160,traps:12}[key]))return false;
    if(typeof s.message!=='string'||s.message.length>500)return false;
    if(!['time','freeze','shake','slow','parries','rolls','scrap','wave','nextId'].every(k=>Number.isFinite(s[k])&&Math.abs(s[k])<1e9))return false;
    if(typeof s.won!=='boolean'||typeof s.phase!=='string'||s.phase.length>30)return false;
    if(!s.players.every(p=>p&&['hp','stamina','fx','fy','cooldown','roll','invulnerable','blockAge','kills','bowCooldown','healCooldown','draw','level'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<1e9)))return false;
    if(!s.enemies.every(e=>e&&['boar','hound','huntsman','marauder','archer','brute'].includes(e.kind)&&['hp','maxHp','windup','flash'].every(k=>Number.isFinite(e[k])&&Math.abs(e[k])<1e9)))return false;
    if(!s.particles.every(p=>p&&typeof p.color==='string'&&/^#[0-9a-f]{6}$/i.test(p.color)))return false;
    return ['players','enemies','projectiles','particles','traps'].every(k=>s[k].every(e=>e&&Number.isFinite(e.x)&&Number.isFinite(e.y)&&Math.abs(e.x)<2000&&Math.abs(e.y)<2000));
  }
  const api={create,step,deploy,hurt,strike,enemy,actions,presets,validInput,validSnapshot,INTRO_DURATION,VERSION};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OakhavenCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
