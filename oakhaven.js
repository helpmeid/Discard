/* Browser adapter: scoped input, native 3D, account-local settings, Discard party transport. */
(() => {
  'use strict';
  const C=window.OakhavenCore;
  let root,canvas,renderer,menu,hud,cinema,cinemaTitle,cinemaLine,film,speaker,filmProgress,chapter,hotbar,floatLayer,meters,session=null,world=null,keys=new Set(),pressed=new Set(),bindings,raf=0,last=0,acc=0,netClock=0,remote={},remoteAt=0,invite=null,previousFocus=null,reduced=false,rebinding=false,audio=null,sound=true,lastAttack=0,lastHealth=200,meterKey="",shotKey=-1,shotElapsed=0;
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
  const account=()=>currentUser?.id||'guest';
  const key=()=>`discard-oakhaven-v1-${account()}`;
  const me=()=>state?.me?.id;
  const send=(id,data)=>{connectTo(id);return sendTo(id,data);};
  const el=(tag,text,parent)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;parent?.append(e);return e;};
  const button=(text,fn,parent)=>{const b=el('button',text,parent);b.type='button';b.className='profile-btn';b.onclick=fn;return b;};
  const keyLabel=code=>String(code||'').replace(/^Key|^Digit/,'').replace('Arrow','');
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
      #oakRoot #oakMenu{background-size:cover;background-position:center;gap:18px}#oakMenu>h1{margin-top:8vh!important;font-size:clamp(45px,7vw,88px)!important;letter-spacing:-.03em}#oakMenu>p{max-width:470px!important}#oakMenu>.oakRow{max-width:560px;gap:12px}#oakMenu>.oakRow>button{padding:14px 22px!important}.oakSettings{max-width:700px;background:#14252ce8;border:1px solid #c3ab7450;border-radius:9px;padding:12px 16px;color:#c7cdbf}.oakSettings summary{cursor:pointer;font-weight:650;color:#d9c598}.oakSettings p{margin:12px 0!important}#oakMenu>small{color:#c0b58d;font-size:11px}
      #oakCinema{border:0;background:#080d13;overflow:hidden;z-index:4}#oakFilm{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;will-change:transform}#oakCinema::after{content:'';position:absolute;inset:0;border-top:7vh solid #080c12;border-bottom:18vh solid #080c12;box-sizing:border-box;pointer-events:none;background:linear-gradient(transparent 55%,#080c12a0)}#oakCinema>div:not(#oakFilmProgress){z-index:2;bottom:3vh;left:12%;right:12%}#oakCinema h2{font-size:clamp(16px,2.3vw,27px);margin-bottom:8px}#oakCinema p{min-height:2.5em;line-height:1.5;color:#e2ddc8;text-wrap:balance}#oakCinema small{color:#9daea4;text-transform:uppercase;font-size:10px;letter-spacing:.15em}#oakCinema>button{z-index:5;top:9vh}#oakFilmProgress{position:absolute!important;bottom:0!important;left:0!important;height:2px;background:#bd9d65;z-index:5!important}
      #oakQuest{position:absolute;top:22px;left:24px;max-width:min(540px,70%);padding:12px 17px;border-left:2px solid #c9af78;background:linear-gradient(90deg,#10212dde,transparent);color:#ded1b0;white-space:pre-line;font-size:12px;line-height:1.7;pointer-events:none}#oakHotbar{position:absolute;bottom:15px;left:50%;transform:translateX(-50%);max-width:92%;width:max-content;background:#12232eea;border:1px solid #baa26c55;border-radius:8px;padding:10px 17px;color:#e3d8bd;font-size:11px;pointer-events:none}#oakMeters{bottom:65px}.oakPlayer{min-width:135px}#oakFloats{position:absolute;inset:0;pointer-events:none;overflow:hidden}#oakFloats span{position:absolute;font-size:15px;font-weight:800;text-shadow:0 2px 4px #13202b;transform:translate(-50%,-50%)}#oakQuest[hidden],#oakHotbar[hidden],#oakFloats[hidden]{display:none}
      @media(max-width:650px){#oakHotbar{font-size:9px;white-space:normal;text-align:center;width:85%}#oakQuest{font-size:10px;top:10px;left:12px}#oakMeters{left:12px;right:12px}.oakPlayer{min-width:110px;padding:8px}#oakRoot header{padding:8px}#oakRoot header span{display:none}#oakCinema>div:not(#oakFilmProgress){left:7%;right:7%}}
    `;document.head.append(style);
    root=el('section');root.id='oakRoot';root.className='hidden';root.setAttribute('role','dialog');root.setAttribute('aria-label','Oakhaven: Ash and Oath');root.setAttribute('aria-modal','true');
    const header=el('header',undefined,root);el('h2','OAKHAVEN',header);el('span','ASH & OATH · 3D adventure',header);
    button('Pause / settings (Esc)',()=>pause(),header);button('Leave game',()=>close(),header);
    const stage=el('div',undefined,root);stage.id='oakStage';canvas=el('canvas',undefined,stage);canvas.id='oakCanvas';canvas.width=640;canvas.height=360;canvas.tabIndex=0;canvas.setAttribute('aria-label','Game arena. Use configured keyboard controls. Escape pauses.');try{renderer=window.Oakhaven3D?.create(canvas);}catch(error){console.warn('Oakhaven renderer:',error);}
    cinema=el('div',undefined,stage);cinema.id='oakCinema';cinema.hidden=true;const caption=el('div',undefined,cinema);cinemaTitle=el('h2','',caption);cinemaLine=el('p','',caption);speaker=el('small','',caption);film=el('img',undefined,cinema);film.id='oakFilm';film.alt='';film.onerror=()=>{film.hidden=true;};filmProgress=el('div',undefined,cinema);filmProgress.id='oakFilmProgress';button('Skip intro (E)',()=>{if(world&&session?.mode!=='guest')world.intro=C.INTRO_DURATION;},cinema);
    meters=el('div',undefined,stage);meters.id='oakMeters';chapter=el('div',undefined,stage);chapter.id='oakQuest';hotbar=el('div',undefined,stage);hotbar.id='oakHotbar';floatLayer=el('div',undefined,stage);floatLayer.id='oakFloats';for(let i=0;i<20;i++)el('span','',floatLayer);
    menu=el('div',undefined,stage);menu.id='oakMenu';hud=el('div',undefined,root);hud.id='oakHud';hud.setAttribute('role','status');document.body.append(root);
    canvas.onpointerdown=e=>{if(!session||session.mode==='couch'||!menu.hidden)return;canvas.focus();pressed.add(e.button===2?'block':'attack');if(e.button===2)keys.add('Mouse2');};
    canvas.onpointermove=e=>{if(!world||session?.mode==='couch'||session?.mode==='guest'||!menu.hidden)return;const p=world.players[0],v=renderer?.aim(e.clientX,e.clientY,p);if(v){const n=Math.hypot(v.x,v.y);if(n>1){p.fx=v.x/n;p.fy=v.y/n;}}};
    canvas.oncontextmenu=e=>e.preventDefault();window.addEventListener('pointerup',()=>keys.delete('Mouse2'));
    document.addEventListener('keydown',onKey,true);document.addEventListener('keyup',e=>keys.delete(e.code),true);
    window.addEventListener('blur',()=>{keys.clear();pressed.clear();if(session&&menu.hidden)pause();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&session&&menu.hidden)pause();});
  }
  function loadBindings(){const saved=read(key(),{}).bindings,used=new Set(),reserved=new Set((Array.isArray(saved)?saved:[]).flatMap(b=>C.actions.map(a=>b?.[a])).filter(v=>typeof v==='string')),pool=['KeyT','KeyY','KeyV','KeyB','KeyN','KeyM','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6'];bindings=C.presets.map((base,i)=>Object.fromEntries(C.actions.map(a=>{const value=saved?.[i]?.[a],custom=typeof value==='string'&&value.length<30&&!['Tab','Escape','Enter'].includes(value)&&!used.has(value);const code=custom?value:(!used.has(base[a])&&!reserved.has(base[a])?base[a]:pool.find(k=>!used.has(k)&&!reserved.has(k))||base[a]);used.add(code);return[a,code];})));}
  function saveBindings(){const old=read(key(),{});if(!write(key(),{...old,bindings}))hud.textContent='Settings could not be saved: browser storage is full or unavailable.';}
  function showMenu(title='Oakhaven'){
    root.classList.remove('playing');menu.hidden=false;menu.replaceChildren();keys.clear();pressed.clear();if(window.OakhavenArt?.[0])menu.style.backgroundImage='linear-gradient(90deg,#101e27f5 10%,#101e27d9 48%,#101e2750),url("'+window.OakhavenArt[0]+'")';
    el('h1',title,menu);el('p','ASH & OATH · A home lost. A promise kept. Take up your father’s blade and venture into the Howling Mire.',menu);
    const row=el('div',undefined,menu);row.className='oakRow';
    if(session)button('Resume',resume,row);
    else {const checkpoint=read(key(),{}).checkpoint;if(checkpoint&&C.validSnapshot(checkpoint)&&checkpoint.scene==='mire'&&!checkpoint.won)button('Continue expedition',()=>{start('solo');if(session){world=checkpoint;world.intro=C.INTRO_DURATION;}},row);button('Solo expedition',()=>start('solo'),row);button('Two-player couch expedition',()=>start('couch'),row);}
    if(session){if(session.mode!=='guest')button('Return to Watchtower',()=>{world=C.create(world.players.length);resume();},row);button('Leave expedition',()=>close(),row);}
    else partyMenu();
    const settings=el('details',undefined,menu);settings.className='oakSettings';el('summary','Controls & settings',settings);
    const opts=el('div',undefined,settings);opts.className='oakRow';
    const label=el('label',undefined,opts),check=el('input',undefined,label);check.type='checkbox';check.checked=reduced;el('span','Reduce shake and flashes',label);check.onchange=()=>{reduced=check.checked;write(key(),{...read(key(),{}),reduced});};
    el('p','WASD: move relative to the screen · F: sword combo · G: heavy strike · Space: dodge · R: shield · Q: bow · H: healing potion · E: interact / revive. Arrow keys + J/K/L/I/U/P/O for Player II. Move to face a target; attacks assist your aim. Escape pauses. Tab and Enter navigate menus. Controls below can be rebound.',settings);
    const audioLabel=el('label',undefined,opts),audioCheck=el('input',undefined,audioLabel);audioCheck.type='checkbox';audioCheck.checked=sound;el('span','Sound & music',audioLabel);audioCheck.onchange=()=>{sound=audioCheck.checked;stopMusic();write(key(),{...read(key(),{}),sound});};
    if(!renderer)el('p','3D rendering is unavailable. Enable hardware acceleration / WebGL in your browser, then reopen the game.',menu);
    bindings.forEach((b,i)=>{
      const field=el('fieldset',undefined,settings);el('legend',`Player ${i+1} keybinds`,field);
      for(const a of C.actions){const btn=button(`${a}: ${b[a]}`,()=>{rebinding=true;btn.textContent='Press a key (Esc cancels)';btn.onkeydown=e=>{e.preventDefault();e.stopPropagation();if(e.code==='Tab')return;if(e.code!=='Escape'){
        if(['Escape','Tab','Enter'].includes(e.code)||bindings.some((other,j)=>Object.entries(other).some(([act,code])=>code===e.code&&(j!==i||act!==a)))){hud.textContent='That key is reserved or already used by a player.';}else{b[a]=e.code;saveBindings();}
      }rebinding=false;btn.textContent=`${a}: ${b[a]}`;btn.onkeydown=null;};btn.onblur=()=>{rebinding=false;btn.textContent=`${a}: ${b[a]}`;btn.onkeydown=null;};},field);}
    });
    button('Restore default keys',()=>{bindings=C.presets.map(b=>({...b}));saveBindings();showMenu(title);},settings);
    el('small','First expedition · Work in progress',menu);
    menu.querySelector('button')?.focus();
  }
  function partyMenu(){
    if(invite){const row=el('div',undefined,menu);el('p',`${viewPerson(invite.from).displayName} invited you to Oakhaven (experimental online co-op).`,row);button('Accept invitation',()=>{const i=invite;invite=null;start('guest',i.from,i.id);if(!session)return;send(i.from,{t:'oak-join',id:i.id});},row);button('Decline',()=>{invite=null;showMenu();},row);return;}
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
    initAudio();meterKey='';shotKey=-1;world=C.create(mode==='solo'?1:2);lastHealth=world.players.length*100;lastAttack=0;world.intro=mode==='guest'?C.INTRO_DURATION:0;session={mode,other,id:id||crypto.randomUUID(),paused:false,waiting:mode==='guest',lastSeen:performance.now(),owner:account()};remote={};remoteAt=0;last=0;acc=0;netClock=0;
    if(mode==='guest'){pause();hud.textContent='Joining host…';}else resume();
    if(!raf)raf=requestAnimationFrame(frame);
  }
  function resume(){if(!session)return;if(session.waiting){hud.textContent='Waiting for the party connection…';return;}session.paused=false;menu.hidden=true;root.classList.add('playing');keys.clear();pressed.clear();canvas.focus();}
  function pause(){if(!session)return;stopMusic();checkpoint(true);session.paused=true;showMenu('Take a breath');if(session.mode==='guest')send(session.other,{t:'oak-input',id:session.id,input:{}});}
  function checkpoint(force=false){if(typeof ownsAccountSession==='function'&&!ownsAccountSession())return;if(session?.owner!==account()||session?.mode!=='solo'||world?.scene!=='mire'||world.won||world.players.every(p=>p.hp<=0))return;if(!force&&world.time-(session.savedAt||0)<8)return;session.savedAt=world.time;const saved=JSON.parse(JSON.stringify(world));saved.events=[];saved.particles=[];saved.projectiles=[];saved.freeze=0;write(key(),{...read(key(),{}),checkpoint:saved});}
  function close(notify=true){
    stopMusic();
    checkpoint(true);
    if(session&&notify&&session.other)send(session.other,{t:'oak-end',id:session.id});
    session=null;world=null;invite=null;rebinding=false;keys.clear();pressed.clear();if(root){root.classList.add('hidden');root.classList.remove('playing');}cancelAnimationFrame(raf);raf=0;previousFocus?.focus?.();
  }
  window.closeOakhaven=close;
  window.oakhavenIsPlaying=()=>!!session&&!session.paused&&!session.hostPaused&&!session.waiting&&!world?.won&&world?.players.some(p=>p.hp>0)&&!(world.intro<C.INTRO_DURATION);
  function onKey(e){
    if(!root||root.classList.contains('hidden'))return;
    if(rebinding)return;
    if(e.code==='Tab'&&!menu.hidden){const items=[...root.querySelectorAll('button,input,select')].filter(n=>!n.disabled&&(!n.getClientRects||n.getClientRects().length>0));const first=items[0],end=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus();}return;}
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
    checkpoint();
  }
  function initAudio(){if(audio)return;try{const AC=window.AudioContext||window.webkitAudioContext;if(AC)audio=new AC();}catch{}audio?.resume?.();}
  function tone(hz,duration=.1,type='triangle',volume=.06){if(!sound||!audio||audio.state==='suspended')return;const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(hz,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(30,hz*.4),audio.currentTime+duration);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}
  const musicVoices=new Set();
  function stopMusic(){for(const osc of musicVoices){try{osc.stop();}catch{}}musicVoices.clear();}
  function chord(panel){if(!sound||!audio||audio.state==='suspended')return;stopMusic();const notes=[[146.83,185,220],[73.42,87.31,110],[65.41,77.78,98],[146.83,174.61,220]][panel];for(const hz of notes){const osc=audio.createOscillator(),g=audio.createGain(),now=audio.currentTime;osc.type='sine';osc.frequency.value=hz;g.gain.setValueAtTime(.001,now);g.gain.linearRampToValueAtTime(.025,now+.6);g.gain.exponentialRampToValueAtTime(.001,now+5.8);osc.connect(g);g.connect(audio.destination);osc.onended=()=>musicVoices.delete(osc);osc.start();osc.stop(now+6);musicVoices.add(osc);}}
  function draw(){
    if(!renderer)return;const s=world,illustrated=s&&s.intro<C.INTRO_DURATION&&window.OakhavenArt?.length===4?window.Oakhaven3D?.beat?.(s.intro):null,result=illustrated?{cutscene:illustrated}:renderer.render(s,reduced);const beat=result?.cutscene;
    cinema.hidden=!beat||!menu.hidden;meters.hidden=!!beat||!menu.hidden;
    chapter.hidden=hotbar.hidden=!!beat||!menu.hidden;floatLayer.hidden=!!beat||!menu.hidden;
    if(beat){
      const art=window.OakhavenArt?.[beat.panel];if(art&&film.src!==art){film.src=art;film.hidden=false;}
      const progress=beat.progress||0,zoom=reduced?1:1.035+progress*.055;film.style.transform='scale('+zoom+') translateX('+(reduced?0:(progress-.5)*(beat.panel%2?-2:2))+'%)';
      film.style.opacity=String(Math.min(1,progress*12,(1-progress)*12));cinemaTitle.textContent=beat.title;speaker.textContent=beat.who||'';
      const shown=reduced?beat.line.length:Math.min(beat.line.length,Math.floor(progress*6*34));cinemaLine.textContent=beat.line.slice(0,shown);filmProgress.style.width=((s.intro||0)/C.INTRO_DURATION*100)+'%';
      if(shotKey!==beat.start){shotKey=beat.start;if(!session?.paused)chord(beat.panel);}
    }
    else if(s){
      const titles=['THE FORGOTTEN WATCHTOWER','I · THE WILD HUNT','II · THE BROKEN CROSSING','III · THE HUNTSMAN'];const target=s.scene==='hub'?{x:275,y:190}:s.enemies?.[0];let label=s.scene==='hub'?'E · Set out on your expedition':s.won?'THE MIRE IS FREE':s.message.split('—').slice(1).join('—').trim();
      chapter.textContent=(titles[s.wave]||'YOUR OATH BEGINS')+'\n'+label+(target?' · '+Math.ceil(Math.hypot(target.x-s.players[0].x,target.y-s.players[0].y)/20)+' m':'');
      hotbar.textContent=bindings.slice(0,session?.mode==='couch'?2:1).map((b,i)=>{const p=s.players[i]||s.players[0];return (session?.mode==='couch'?'P'+(i+1)+'  ':'')+keyLabel(b.attack)+' Sword   '+keyLabel(b.heavy)+' Heavy   '+keyLabel(b.roll)+' Dodge   '+keyLabel(b.ranged)+' Bow   '+keyLabel(b.heal)+' '+(p.healCooldown>0?Math.ceil(p.healCooldown)+'s':'Heal')+'   '+keyLabel(b.interact)+' Interact';}).join('  |  ');
      [...floatLayer.children].forEach((node,i)=>{const e=s.events?.[i],point=e&&renderer.project?.(e.x,e.y,2.1+(1-e.life)*1.3);node.hidden=!point;if(point){node.textContent=e.text;node.style.left=point.x+'%';node.style.top=point.y+'%';node.style.color=e.color;node.style.opacity=Math.min(1,e.life*3);}});
    }
    if(!s){hud.textContent='A kingdom in ashes. An oath worth keeping.';return;}
    const hp=s.players.reduce((n,p)=>n+p.hp,0);if(hp<lastHealth)tone(85,.18,'sawtooth',.035);lastHealth=hp;
    if(s.players[0].cooldown>lastAttack+.1)tone(s.players[0].heavy?120:260,.12,'triangle');lastAttack=s.players[0].cooldown;
    const nextMeterKey=s.players.map(p=>[Math.ceil(p.hp),Math.ceil(p.stamina),p.level,p.revived].join(',')).join('|');if(nextMeterKey!==meterKey){meterKey=nextMeterKey;meters.replaceChildren();s.players.forEach((p,i)=>{const pane=el('div',undefined,meters);pane.className='oakPlayer';el('strong',i?'PLAYER II':'PLAYER I',pane);const health=el('div',undefined,pane);health.className='oakHealth';const fill=el('i',undefined,health);fill.style.width=Math.max(0,p.hp)+'%';const stamina=el('div',undefined,pane);stamina.className='oakStamina';const st=el('i',undefined,stamina);st.style.width=Math.max(0,p.stamina)+'%';el('small',p.hp<=0?'Fallen · partner: E to revive':'Lv '+p.level+' · '+Math.ceil(p.hp)+' health',pane);});}
    let status=session?.hostPaused?'Host paused the expedition.':s.message;
    if(beat)status='ASH & OATH · E to skip the prologue';
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
