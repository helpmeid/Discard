/* Browser adapter: scoped input, pixel canvas, account-local settings, Discard party transport. */
(() => {
  'use strict';
  const C=window.OakhavenCore;
  let root,canvas,ctx,menu,hud,session=null,world=null,keys=new Set(),pressed=new Set(),bindings,raf=0,last=0,acc=0,netClock=0,remote={},remoteAt=0,invite=null,previousFocus=null,reduced=false,rebinding=false;
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
  const account=()=>currentUser?.id||'guest';
  const key=()=>`discard-oakhaven-v1-${account()}`;
  const me=()=>state?.me?.id;
  const send=(id,data)=>{connectTo(id);return sendTo(id,data);};
  const el=(tag,text,parent)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;parent?.append(e);return e;};
  const button=(text,fn,parent)=>{const b=el('button',text,parent);b.type='button';b.className='profile-btn';b.onclick=fn;return b;};
  function build(){
    if(root)return;
    const style=el('style');style.textContent=`
      #oakRoot {position:fixed;inset:0;z-index:250;background:#101719;color:#f3e6c8;display:flex;flex-direction:column;font:14px system-ui;overflow:auto}
      #oakRoot.hidden{display:none} #oakRoot header{display:flex;gap:12px;align-items:center;padding:10px 20px;background:#192428;flex-wrap:wrap}
      #oakRoot h2{font-size:18px;margin:0;letter-spacing:.12em} #oakRoot header span{flex:1;color:#b7c6b3}
      #oakCanvas{width:100%;height:100%;object-fit:contain;image-rendering:pixelated;background:#0d1519;outline-offset:-4px;min-height:0}
      #oakStage{position:relative;flex:1;min-height:260px;display:flex;overflow:hidden} #oakRoot.playing #oakStage,#oakRoot.playing #oakStage *{cursor:none}
      #oakMenu{position:absolute;inset:0;overflow:auto;background:#10191aee;padding:clamp(12px,4vw,48px);display:flex;flex-direction:column;gap:12px}
      #oakMenu[hidden]{display:none} #oakMenu h1{font:700 clamp(25px,4vw,48px) Georgia;margin:0;color:#f2cc85} #oakMenu p{max-width:740px;line-height:1.6;margin:0}
      #oakMenu .oakRow{display:flex;flex-wrap:wrap;gap:10px;align-items:center} #oakMenu label{display:flex;gap:8px;align-items:center}
      #oakMenu fieldset{display:flex;flex-wrap:wrap;gap:8px;border:1px solid #53665c;padding:12px} #oakMenu select{max-width:280px}
      #oakHud{padding:9px 20px;background:#192428;min-height:38px;white-space:pre-line;color:#d3d9bd} #oakRoot button:focus-visible{outline:3px solid #f2cc85;outline-offset:3px}
    `;document.head.append(style);
    root=el('section');root.id='oakRoot';root.className='hidden';root.setAttribute('role','dialog');root.setAttribute('aria-label','Oakhaven: Ash and Oath');root.setAttribute('aria-modal','true');
    const header=el('header',undefined,root);el('h2','OAKHAVEN',header);el('span','ASH & OATH · playable vertical slice',header);
    button('Pause / settings (Esc)',()=>pause(),header);button('Leave game',()=>close(),header);
    const stage=el('div',undefined,root);stage.id='oakStage';canvas=el('canvas',undefined,stage);canvas.id='oakCanvas';canvas.width=640;canvas.height=360;canvas.tabIndex=0;canvas.setAttribute('aria-label','Game arena. Use configured keyboard controls. Escape pauses.');ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=false;
    menu=el('div',undefined,stage);menu.id='oakMenu';hud=el('div',undefined,root);hud.id='oakHud';hud.setAttribute('role','status');document.body.append(root);
    canvas.onpointerdown=e=>{if(!session||session.mode==='couch'||!menu.hidden)return;canvas.focus();pressed.add(e.button===2?'block':'attack');if(e.button===2)keys.add('Mouse2');};
    canvas.onpointermove=e=>{if(!world||session?.mode==='couch'||!menu.hidden)return;const r=canvas.getBoundingClientRect(),scale=Math.min(r.width/640,r.height/360);const x=(e.clientX-r.left-(r.width-640*scale)/2)/scale,y=(e.clientY-r.top-(r.height-360*scale)/2)/scale;const p=world.players[0],n=Math.hypot(x-p.x,y-p.y);if(n>1){p.fx=(x-p.x)/n;p.fy=(y-p.y)/n;}};
    canvas.oncontextmenu=e=>e.preventDefault();window.addEventListener('pointerup',()=>keys.delete('Mouse2'));
    document.addEventListener('keydown',onKey,true);document.addEventListener('keyup',e=>keys.delete(e.code),true);
    window.addEventListener('blur',()=>{keys.clear();pressed.clear();if(session&&menu.hidden)pause();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&session&&menu.hidden)pause();});
  }
  function loadBindings(){const saved=read(key(),{}).bindings;bindings=C.presets.map((base,i)=>{const b=saved?.[i];return b&&C.actions.every(a=>typeof b[a]==='string'&&b[a].length<30)?{...b}:{...base};});}
  function saveBindings(){const old=read(key(),{});if(!write(key(),{...old,bindings}))hud.textContent='Settings could not be saved: browser storage is full or unavailable.';}
  function showMenu(title='An oath in the ashes'){
    root.classList.remove('playing');menu.hidden=false;menu.replaceChildren();keys.clear();pressed.clear();
    el('h1',title,menu);el('p','Oakhaven fell eight years ago. Train with Old Man Garrow at the Forgotten Watchtower, then enter the Howling Mire and face the Huntsman. This is a short combat slice; the three-biome campaign and Obsidian Duke finale are still in development.',menu);
    const row=el('div',undefined,menu);row.className='oakRow';
    if(session)button('Resume',resume,row);
    else {button('Solo expedition',()=>start('solo'),row);button('Two-player couch expedition',()=>start('couch'),row);}
    if(session){if(session.mode!=='guest')button('Return to Watchtower',()=>{world=C.create(world.players.length);resume();},row);button('Leave expedition',()=>close(),row);}
    else partyMenu();
    const opts=el('div',undefined,menu);opts.className='oakRow';
    const label=el('label',undefined,opts),check=el('input',undefined,label);check.type='checkbox';check.checked=reduced;el('span','Reduce shake and flashes',label);check.onchange=()=>{reduced=check.checked;write(key(),{...read(key(),{}),reduced});};
    el('p','Move to aim in any direction. F: strike · G: heavy · Space: roll · R: block · E: interact. Face Garrow (east of spawn); tap block just before the staff lands. His staff glows red during the windup. Complete 5 parries and 3 rolls, then interact to deploy. Escape pauses; Tab and Enter activate menus. Couch P2 uses arrows, J/K/L/I/O. Hold attack to repeat. Keyboard rollover limits vary by device.',menu);
    bindings.forEach((b,i)=>{
      const field=el('fieldset',undefined,menu);el('legend',`Player ${i+1} keybinds`,field);
      for(const a of C.actions){const btn=button(`${a}: ${b[a]}`,()=>{rebinding=true;btn.textContent='Press a key (Esc cancels)';btn.onkeydown=e=>{e.preventDefault();e.stopPropagation();if(e.code==='Tab')return;if(e.code!=='Escape'){
        if(['Escape','Tab','Enter'].includes(e.code)||bindings.some((other,j)=>Object.entries(other).some(([act,code])=>code===e.code&&(j!==i||act!==a)))){hud.textContent='That key is reserved or already used by a player.';}else{b[a]=e.code;saveBindings();}
      }rebinding=false;btn.textContent=`${a}: ${b[a]}`;btn.onkeydown=null;};btn.onblur=()=>{rebinding=false;btn.textContent=`${a}: ${b[a]}`;btn.onkeydown=null;};},field);}
    });
    button('Restore default keys',()=>{bindings=C.presets.map(b=>({...b}));saveBindings();showMenu(title);},menu);
    menu.querySelector('button')?.focus();
  }
  function partyMenu(){
    if(invite){const row=el('div',undefined,menu);el('p',`${viewPerson(invite.from).displayName} invited you to Oakhaven (experimental online co-op).`,row);button('Accept invitation',()=>{const i=invite;invite=null;start('guest',i.from,i.id);send(i.from,{t:'oak-join',id:i.id});},row);button('Decline',()=>{invite=null;showMenu();},row);return;}
    const row=el('div',undefined,menu);row.className='oakRow';const select=el('select',undefined,row);select.setAttribute('aria-label','Friend to invite');
    for(const id of Object.keys(state?.friends||{})){const option=el('option',viewPerson(id).displayName,select);option.value=id;}
    const b=button('Invite friend (online beta)',()=>{
      if(!select.value)return;start('host',select.value);session.waiting=true;pause();hud.textContent='Invitation sent. Waiting for your friend to accept; both players must remain online.';send(select.value,{t:'oak-invite',id:session.id});
    },row);b.disabled=!select.options.length;
    el('p','Online beta: two players, host-controlled combat, 15 snapshots/sec. Invitations use your existing Discard friend connection. No host migration or reconnect yet. Couch and online modes are separate.',menu);
  }
  function open(){build();previousFocus=document.activeElement;root.classList.remove('hidden');document.querySelector('#gamesHub').classList.add('hidden');loadBindings();reduced=read(key(),{}).reduced??matchMedia('(prefers-reduced-motion: reduce)').matches;showMenu();draw();}
  function start(mode,other=null,id=null){
    world=C.create(mode==='solo'?1:2);session={mode,other,id:id||crypto.randomUUID(),paused:false,waiting:mode==='guest',lastSeen:performance.now(),owner:account()};remote={};remoteAt=0;last=0;acc=0;netClock=0;
    if(mode==='guest'){pause();hud.textContent='Joining host…';}else resume();
    if(!raf)raf=requestAnimationFrame(frame);
  }
  function resume(){if(!session)return;if(session.waiting){hud.textContent='Waiting for the party connection…';return;}session.paused=false;menu.hidden=true;root.classList.add('playing');keys.clear();pressed.clear();canvas.focus();}
  function pause(){if(!session)return;session.paused=true;showMenu('Take a breath');if(session.mode==='guest')send(session.other,{t:'oak-input',id:session.id,input:{}});}
  function close(notify=true){
    if(session&&notify&&session.other)send(session.other,{t:'oak-end',id:session.id});
    session=null;world=null;invite=null;rebinding=false;keys.clear();pressed.clear();if(root){root.classList.add('hidden');root.classList.remove('playing');}cancelAnimationFrame(raf);raf=0;previousFocus?.focus?.();
  }
  window.closeOakhaven=close;
  window.oakhavenIsPlaying=()=>!!session&&!session.paused&&!session.hostPaused&&!session.waiting&&!world?.won&&world?.players.some(p=>p.hp>0);
  function onKey(e){
    if(!root||root.classList.contains('hidden'))return;
    if(rebinding)return;
    if(e.code==='Tab'&&!menu.hidden){const items=[...root.querySelectorAll('button,input,select')].filter(n=>!n.disabled);const first=items[0],end=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus();}return;}
    if(e.code==='Escape'&&session){e.preventDefault();e.stopImmediatePropagation();if(menu.hidden)pause();else resume();return;}
    if(!menu.hidden)return;
    if(e.code==='Tab'){e.preventDefault();return;}
    if(bindings.some(b=>Object.values(b).includes(e.code))){e.preventDefault();e.stopImmediatePropagation();if(!keys.has(e.code))pressed.add(e.code);keys.add(e.code);}
  }
  function input(i){const b=bindings[i];return Object.fromEntries(C.actions.map(a=>[a,(a==='roll'||a==='interact')?pressed.has(b[a]):keys.has(b[a])||(i===0&&((a==='attack'&&pressed.has('attack'))||(a==='block'&&keys.has('Mouse2'))))]));}
  function frame(t){
    raf=requestAnimationFrame(frame);if(!session)return;
    const dt=Math.min((t-(last||t))/1000,.1);last=t;
    if(session.other&&t-session.lastSeen>(session.waiting?60000:15000)){close(false);open();hud.textContent='Party disconnected or invitation expired. Start a new expedition.';return;}
    if(session.mode==='guest'&&!session.waiting){netClock+=dt;if(netClock>=1/30){send(session.other,{t:'oak-input',id:session.id,input:session.paused?{}:input(0)});netClock=0;pressed.clear();}}
    if(!session.paused&&!session.waiting){
      const a=input(0);
      if(session.mode!=='guest'){acc+=dt;let first=true;while(acc>=1/60){const inputs=[a,session.mode==='couch'?input(1):(t-remoteAt<500?{...remote}:{})];if(!first){inputs.forEach(v=>{v.roll=false;v.interact=false;});}C.step(world,inputs,1/60);remote.roll=false;remote.interact=false;acc-=1/60;first=false;}if(!first)pressed.clear();}
    }
    if(session.mode==='host'&&!session.waiting){netClock+=dt;if(netClock>=1/15){send(session.other,{t:'oak-state',id:session.id,world,paused:session.paused});netClock=0;}}
    draw();
  }
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
  function text(str,x,y,color='#f0e4c6',size=10){ctx.fillStyle=color;ctx.font=`${size}px monospace`;ctx.fillText(str,x,y);}
  function sprite(p,color,enemy=false){
    rect(p.x-6,p.y+9,15,4,'#102323');rect(p.x-5,p.y-5,11,13,color);rect(p.x-4,p.y-12,9,8,enemy?'#b4b0a1':'#e6bd91');rect(p.x-5,p.y-13,11,3,enemy?'#3b4443':'#8b8d8c');rect(p.x-4,p.y+8,3,5,'#2a302b');rect(p.x+3,p.y+8,3,5,'#2a302b');
    if(!enemy){rect(p.x+p.fx*10-2,p.y+p.fy*10-4,4,11,'#ede7c8');if(p.blocking)rect(p.x+p.fx*13-4,p.y+p.fy*13-6,9,12,'#78a8bc');}
  }
  function draw(){
    if(!ctx)return;const s=world;rect(0,0,640,360,'#172724');
    if(!s){text('THE FORGOTTEN WATCHTOWER',40,70,'#c6bb89',20);return;}
    ctx.save();if(!reduced&&s.shake)ctx.translate(Math.sin(s.time*180)*s.shake,Math.cos(s.time*155)*s.shake*.6);
    for(let y=0;y<360;y+=20)for(let x=0;x<640;x+=20){const n=(x*13+y*7)%53;rect(x,y,20,20,s.scene==='hub'?(n<20?'#354c3d':'#304638'):(y>250?'#293f3c':n<20?'#304b3d':'#2b4236'));if(n<10)rect(x+4,y+6,3,2,'#6d7851');}
    if(s.scene==='hub'){
      rect(390,35,170,115,'#242d2d');rect(400,45,150,95,'#586155');rect(420,65,34,46,'#1b2527');rect(490,65,34,46,'#1b2527');rect(240,165,70,50,'#7b7050');sprite({x:275,y:190},s.trainingClock>1.45?'#e68a5a':'#a9a17a',true);
      text('GARROW',252,157);text(s.trainingClock>1.45?'BLOCK NOW':'Staff: every 2 seconds',212,232);text('Forgotten Watchtower',400,168,'#e2ca94');
      rect(80,240,45,20,'#4b3d31');rect(95,230,10,18,'#edac52');text('OAKHAVEN · EIGHT YEARS LATER',25,27,'#d7ca9f');
    }else{
      for(let i=0;i<18;i++){const x=(i*97+32)%640,y=(i*71+24)%340;if(x>120&&x<570&&y>100&&y<290)continue;rect(x+6,y+12,5,20,'#554a36');rect(x-4,y,27,23,'#182f2d');rect(x,y-8,19,19,'#213c32');}
      text('THE HOWLING MIRE',25,27,'#d7ca9f');
    }
    for(const t of s.traps){rect(t.x-4,t.y-3,8,6,'#b8ad96');text('^',t.x-3,t.y+2,'#383b37');}
    for(const e of [...s.enemies].sort((a,b)=>a.y-b.y)){
      if(e.windup>0){ctx.strokeStyle='#e7a167';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,24,0,Math.PI*2);ctx.stroke();}
      sprite(e,e.flash>0&&!reduced?'#fff3c3':e.kind==='huntsman'?'#ad7650':'#786c60',true);
      rect(e.x-15,e.y-22,30,3,'#172326');rect(e.x-15,e.y-22,30*Math.max(0,e.hp/e.maxHp),3,'#d78c63');
    }
    s.players.forEach((p,i)=>{if(p.hp<=0){text('DOWN',p.x-10,p.y,'#d7a18d');return;}sprite(p,i?'#719fb2':'#d6bc74');text(`P${i+1}`,p.x-6,p.y-20);if(p.swing>0){ctx.strokeStyle=p.heavy?'#f5c867':'#e9e5c2';ctx.lineWidth=p.heavy?5:3;ctx.beginPath();const a=Math.atan2(p.fy,p.fx);ctx.arc(p.x,p.y,p.heavy?45:30,a-.9,a+.9);ctx.stroke();}});
    for(const b of s.projectiles)rect(b.x-2,b.y-2,5,3,'#edd8a2');
    for(const p of s.particles)rect(p.x,p.y,2,2,p.color);
    if(s.slow>0&&!reduced){rect(0,0,640,12,'#0a1117');rect(0,348,640,12,'#0a1117');}
    ctx.restore();
    s.players.forEach((p,i)=>{const x=18+i*310;rect(x,318,130,8,'#162328');rect(x,318,p.hp*1.3,8,i?'#719fb2':'#d6bc74');rect(x,330,130,4,'#162328');rect(x,330,p.stamina*1.3,4,'#86b58b');text(`P${i+1} HP ${Math.ceil(p.hp)}  stamina ${Math.ceil(p.stamina)}`,x,349);});
    if(s.players.every(p=>p.hp<=0)){text('EXPEDITION LOST · Esc to return to Watchtower',95,180,'#ffd08c',15);}
    if(s.won)text('THE MIRE IS FREE · Esc for menu',125,180,'#ffd08c',17);
    const status=`${session?.hostPaused?'Host paused the expedition.':s.message}\nParries ${s.parries}/5 · Rolls ${s.rolls}/3 · Scrap ${s.scrap}${session?.mode==='guest'?' · Online guest: you control P2':''}`;
    if(hud.textContent!==status && !session?.waiting)hud.textContent=status;
  }
  window.oakhavenHandle=(from,data)=>{
    if(!state?.friends?.[from] || typeof data.id!=='string'||data.id.length>80)return;
    if(data.t==='oak-invite'){
      if(session||invite)return;invite={from,id:data.id};
      // Non-modal invitation: joining is always an explicit local action.
      const status=document.querySelector('#oakInviteStatus');if(status)status.textContent=`${viewPerson(from).displayName} invited you. Open Oakhaven to accept.`;return;
    }
    if(!session||session.other!==from||session.id!==data.id)return;
    if(data.t==='oak-join'&&session.mode==='host'&&session.waiting){session.waiting=false;session.lastSeen=performance.now();resume();return;}
    if(data.t==='oak-input'&&session.mode==='host'&&C.validInput(data.input)){remote={...data.input};remoteAt=performance.now();session.lastSeen=remoteAt;return;}
    if(data.t==='oak-state'&&session.mode==='guest'&&C.validSnapshot(data.world)){
      world=data.world;session.hostPaused=!!data.paused;session.lastSeen=performance.now();if(session.waiting){session.waiting=false;resume();}if(data.paused)hud.textContent='Host paused the expedition.';return;
    }
    if(data.t==='oak-end'){close(false);open();hud.textContent='The other player left the expedition.';}
  };
  document.querySelector('#hubPlayOakhaven').addEventListener('click',open);
})();
