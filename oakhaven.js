/* Browser adapter: scoped input, native 3D, account-local settings, Discard party transport. */
(() => {
  'use strict';
  const C=window.OakhavenCore;
  let root,canvas,renderer,menu,hud,cinema,cinemaTitle,cinemaLine,meters,session=null,world=null,keys=new Set(),pressed=new Set(),bindings,raf=0,last=0,acc=0,netClock=0,remote={},remoteAt=0,invite=null,previousFocus=null,reduced=false,rebinding=false,audio=null,sound=true,lastAttack=0,lastHealth=200;
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
      #oakCanvas{width:100%;height:100%;object-fit:contain;background:#0d1519;outline-offset:-4px;min-height:0}
      #oakStage{position:relative;flex:1;min-height:260px;display:flex;overflow:hidden} #oakRoot.playing #oakStage,#oakRoot.playing #oakStage *{cursor:none}
      #oakMenu{position:absolute;inset:0;overflow:auto;background:#10191aee;padding:clamp(12px,4vw,48px);display:flex;flex-direction:column;gap:12px}
      #oakMenu[hidden]{display:none} #oakMenu h1{font:700 clamp(25px,4vw,48px) Georgia;margin:0;color:#f2cc85} #oakMenu p{max-width:740px;line-height:1.6;margin:0}
      #oakMenu .oakRow{display:flex;flex-wrap:wrap;gap:10px;align-items:center} #oakMenu label{display:flex;gap:8px;align-items:center}
      #oakMenu fieldset{display:flex;flex-wrap:wrap;gap:8px;border:1px solid #53665c;padding:12px} #oakMenu select{max-width:280px}
      #oakHud{padding:9px 20px;background:#192428;min-height:38px;white-space:pre-line;color:#d3d9bd} #oakRoot button:focus-visible{outline:3px solid #f2cc85;outline-offset:3px}
      #oakRoot{background:#101a22;color:#f5eee0;font-family:system-ui,sans-serif} #oakRoot header{padding:12px 24px;border-bottom:1px solid #b9a57835;background:#14202b} #oakRoot header h2{letter-spacing:.22em;color:#e0c28c}
      #oakRoot .profile-btn{background:#293a45;color:#ecdfc8;border:1px solid #8c987b55;padding:10px 16px;border-radius:7px;font-weight:650;cursor:pointer}#oakRoot .profile-btn:hover{background:#3b4d54}
      #oakRoot #oakMenu{background:linear-gradient(90deg,#0e1b25f5,#14242be6 60%,#182729ba);gap:15px}#oakRoot #oakMenu h1{font:500 clamp(34px,5vw,64px) Georgia;color:#e4c896;max-width:680px}#oakRoot #oakMenu p{color:#bdc6c6;font-size:13px;line-height:1.7}#oakMenu .oakRow>button:first-child{background:#bc9c60;color:#18232b;border-color:#d8c194}#oakMenu fieldset{border-color:#6e7b7444;border-radius:8px}#oakMenu legend{letter-spacing:.1em;color:#d3c5a6}
      #oakCanvas{image-rendering:auto;object-fit:fill}#oakStage{min-height:300px}#oakHud{background:#14202b;border-top:1px solid #b9a57835;color:#d7c7a9;font-size:12px;letter-spacing:.02em}
      #oakCinema{position:absolute;inset:0;border-top:7vh solid #080c12;border-bottom:11vh solid #080c12;pointer-events:none;box-sizing:border-box;background:linear-gradient(transparent 65%,#080c12a0)}#oakCinema[hidden],#oakMeters[hidden]{display:none}#oakCinema>div{position:absolute;bottom:-9vh;left:8%;right:8%;text-align:center}#oakCinema h2{color:#e0c28c;font:500 clamp(18px,3vw,32px) Georgia;letter-spacing:.16em;margin:0 0 7px}#oakCinema p{color:#e1e1d7;font-size:clamp(11px,1.5vw,16px);margin:0}#oakCinema>button{position:absolute;right:18px;top:12px;pointer-events:auto;opacity:.8}
      #oakMeters{position:absolute;bottom:20px;left:24px;right:24px;display:flex;justify-content:space-between;pointer-events:none;gap:16px}.oakPlayer{min-width:160px;max-width:40%;padding:11px 15px;background:#101c28d9;border:1px solid #c6b38444;border-radius:8px}.oakPlayer strong{display:block;font-size:10px;letter-spacing:.16em;color:#ddc38c}.oakPlayer small{font-size:10px;color:#c3cfc9}.oakHealth,.oakStamina{height:7px;background:#1c2a32;border-radius:4px;overflow:hidden;margin:7px 0}.oakStamina{height:4px}.oakHealth i,.oakStamina i{display:block;height:100%;background:#c88b72}.oakStamina i{background:#98b99b}
    `;document.head.append(style);
    root=el('section');root.id='oakRoot';root.className='hidden';root.setAttribute('role','dialog');root.setAttribute('aria-label','Oakhaven: Ash and Oath');root.setAttribute('aria-modal','true');
    const header=el('header',undefined,root);el('h2','OAKHAVEN',header);el('span','ASH & OATH · 3D adventure',header);
    button('Pause / settings (Esc)',()=>pause(),header);button('Leave game',()=>close(),header);
    const stage=el('div',undefined,root);stage.id='oakStage';canvas=el('canvas',undefined,stage);canvas.id='oakCanvas';canvas.width=640;canvas.height=360;canvas.tabIndex=0;canvas.setAttribute('aria-label','Game arena. Use configured keyboard controls. Escape pauses.');try{renderer=window.Oakhaven3D?.create(canvas);}catch(error){console.warn('Oakhaven renderer:',error);}
    cinema=el('div',undefined,stage);cinema.id='oakCinema';cinema.hidden=true;const caption=el('div',undefined,cinema);cinemaTitle=el('h2','',caption);cinemaLine=el('p','',caption);button('Skip intro (E)',()=>{if(world&&session?.mode!=='guest')world.intro=30;},cinema);
    meters=el('div',undefined,stage);meters.id='oakMeters';
    menu=el('div',undefined,stage);menu.id='oakMenu';hud=el('div',undefined,root);hud.id='oakHud';hud.setAttribute('role','status');document.body.append(root);
    canvas.onpointerdown=e=>{if(!session||session.mode==='couch'||!menu.hidden)return;canvas.focus();pressed.add(e.button===2?'block':'attack');if(e.button===2)keys.add('Mouse2');};
    canvas.onpointermove=e=>{if(!world||session?.mode==='couch'||session?.mode==='guest'||!menu.hidden)return;const p=world.players[0],v=renderer?.aim(e.clientX,e.clientY,p);if(v){const n=Math.hypot(v.x,v.y);if(n>1){p.fx=v.x/n;p.fy=v.y/n;}}};
    canvas.oncontextmenu=e=>e.preventDefault();window.addEventListener('pointerup',()=>keys.delete('Mouse2'));
    document.addEventListener('keydown',onKey,true);document.addEventListener('keyup',e=>keys.delete(e.code),true);
    window.addEventListener('blur',()=>{keys.clear();pressed.clear();if(session&&menu.hidden)pause();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&session&&menu.hidden)pause();});
  }
  function loadBindings(){const saved=read(key(),{}).bindings;bindings=C.presets.map((base,i)=>{const b=saved?.[i];return b&&C.actions.every(a=>typeof b[a]==='string'&&b[a].length<30)?{...b}:{...base};});}
  function saveBindings(){const old=read(key(),{});if(!write(key(),{...old,bindings}))hud.textContent='Settings could not be saved: browser storage is full or unavailable.';}
  function showMenu(title='An oath in the ashes'){
    root.classList.remove('playing');menu.hidden=false;menu.replaceChildren();keys.clear();pressed.clear();
    el('h1',title,menu);el('p','Oakhaven fell eight years ago. Train with Old Man Garrow at the Forgotten Watchtower, then enter the Howling Mire and face the Huntsman. A new 3D opening and a three-stage expedition await. The full campaign is still in development.',menu);
    const row=el('div',undefined,menu);row.className='oakRow';
    if(session)button('Resume',resume,row);
    else {button('Solo expedition',()=>start('solo'),row);button('Two-player couch expedition',()=>start('couch'),row);}
    if(session){if(session.mode!=='guest')button('Return to Watchtower',()=>{world=C.create(world.players.length);resume();},row);button('Leave expedition',()=>close(),row);}
    else partyMenu();
    const opts=el('div',undefined,menu);opts.className='oakRow';
    const label=el('label',undefined,opts),check=el('input',undefined,label);check.type='checkbox';check.checked=reduced;el('span','Reduce shake and flashes',label);check.onchange=()=>{reduced=check.checked;write(key(),{...read(key(),{}),reduced});};
    el('p','Move to aim in any direction. F: strike · G: heavy · Space: roll · R: block · E: interact. Face Garrow (east of spawn); tap block just before the staff lands. His staff glows red during the windup. Training is optional. Press E to set out immediately. Follow the trail east, cross the bridge, then find the Huntsman in the southeast. Escape pauses; Tab and Enter activate menus. Couch P2 uses arrows, J/K/L/I/O. Hold attack to repeat. Keyboard rollover limits vary by device.',menu);
    const audioLabel=el('label',undefined,opts),audioCheck=el('input',undefined,audioLabel);audioCheck.type='checkbox';audioCheck.checked=sound;el('span','Sound effects',audioLabel);audioCheck.onchange=()=>{sound=audioCheck.checked;write(key(),{...read(key(),{}),sound});};
    if(!renderer)el('p','3D rendering is unavailable. Enable hardware acceleration / WebGL in your browser, then reopen the game.',menu);
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
      if(!select.value)return;start('host',select.value);if(!session)return;session.waiting=true;pause();hud.textContent='Invitation sent. Waiting for your friend to accept; both players must remain online.';send(select.value,{t:'oak-invite',id:session.id});
    },row);b.disabled=!select.options.length;
    el('p','Online beta: two players, host-controlled combat, 15 snapshots/sec. Invitations use your existing Discard friend connection. No host migration or reconnect yet. Couch and online modes are separate.',menu);
  }
  function open(){build();previousFocus=document.activeElement;root.classList.remove('hidden');document.querySelector('#gamesHub').classList.add('hidden');loadBindings();reduced=read(key(),{}).reduced??matchMedia('(prefers-reduced-motion: reduce)').matches;sound=read(key(),{}).sound!==false;showMenu();draw();}
  function start(mode,other=null,id=null){
    if(!renderer){hud.textContent='WebGL is required for the new 3D game. Please enable browser hardware acceleration.';return;}
    initAudio();world=C.create(mode==='solo'?1:2);lastHealth=world.players.length*100;lastAttack=0;world.intro=mode==='guest'?30:0;session={mode,other,id:id||crypto.randomUUID(),paused:false,waiting:mode==='guest',lastSeen:performance.now(),owner:account()};remote={};remoteAt=0;last=0;acc=0;netClock=0;
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
  window.oakhavenIsPlaying=()=>!!session&&!session.paused&&!session.hostPaused&&!session.waiting&&!world?.won&&world?.players.some(p=>p.hp>0)&&!(world.intro<30);
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
  function initAudio(){if(audio)return;try{const AC=window.AudioContext||window.webkitAudioContext;if(AC)audio=new AC();}catch{}audio?.resume?.();}
  function tone(hz,duration=.1,type='triangle',volume=.06){if(!sound||!audio||audio.state==='suspended')return;const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(hz,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(30,hz*.4),audio.currentTime+duration);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}
  function draw(){
    if(!renderer)return;const s=world,result=renderer.render(s,reduced);const beat=result?.cutscene;
    cinema.hidden=!beat||!menu.hidden;meters.hidden=!!beat||!menu.hidden;
    if(beat){cinemaTitle.textContent=beat.title;cinemaLine.textContent=beat.line;}
    if(!s){hud.textContent='A kingdom in ashes. An oath worth keeping.';return;}
    const hp=s.players.reduce((n,p)=>n+p.hp,0);if(hp<lastHealth)tone(85,.18,'sawtooth',.035);lastHealth=hp;
    if(s.players[0].cooldown>lastAttack+.1)tone(s.players[0].heavy?120:260,.12,'triangle');lastAttack=s.players[0].cooldown;
    meters.replaceChildren();s.players.forEach((p,i)=>{const pane=el('div',undefined,meters);pane.className='oakPlayer';el('strong',i?'PLAYER II':'PLAYER I',pane);const health=el('div',undefined,pane);health.className='oakHealth';const fill=el('i',undefined,health);fill.style.width=Math.max(0,p.hp)+'%';const stamina=el('div',undefined,pane);stamina.className='oakStamina';const st=el('i',undefined,stamina);st.style.width=Math.max(0,p.stamina)+'%';el('small',p.hp<=0?'Fallen · finish together':Math.ceil(p.hp)+' health · '+Math.ceil(p.stamina)+' stamina',pane);});
    let status=session?.hostPaused?'Host paused the expedition.':s.message;
    if(beat)status='OAKHAVEN · PROLOGUE — E to skip';
    else if(s.won)status='THE MIRE IS FREE · Expedition complete · Esc to return to camp';
    else if(s.players.every(p=>p.hp<=0))status='YOUR OATH IS NOT OVER · Esc → Return to Watchtower to retry';
    if(!beat)status+=' · '+s.scrap+' gold'+(session?.mode==='guest'?' · You control Player II':'');
    if(hud.textContent!==status&&!session?.waiting)hud.textContent=status;
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
