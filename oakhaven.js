/* Browser adapter: scoped input, native 3D, account-local settings, Discard party transport. */
(() => {
  'use strict';
  const C=window.OakhavenCore;
  let root,canvas,renderer,menu,hud,cinema,cinemaTitle,cinemaLine,film,speaker,filmProgress,chapter,hotbar,floatLayer,meters,bossPanel,bossName,bossFill,mentorLabel,session=null,world=null,keys=new Set(),pressed=new Set(),bindings,raf=0,last=0,acc=0,netClock=0,remote={},remoteAt=0,invite=null,previousFocus=null,reduced=false,rebinding=false,audio=null,sound=true,lastAttack=0,lastHealth=200,meterKey="",shotKey=-1,shotElapsed=0,pointerAim=null,hotbarKey="",hotbarLayout="",slotRefs=[],vitalRefs=[];
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
  const account=()=>currentUser?.id||'guest';
  const key=()=>`discard-oakhaven-v1-${account()}`;
  const me=()=>state?.me?.id;
  const send=(id,data)=>{connectTo(id);return sendTo(id,data);};
  const el=(tag,text,parent)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;parent?.append(e);return e;};
  const button=(text,fn,parent)=>{const b=el('button',text,parent);b.type='button';b.className='profile-btn';b.onclick=fn;return b;};
  const keyLabel=code=>String(code||'').replace(/^Key|^Digit/,'').replace('Arrow','');
  function savedCheckpoint(){const old=read(key(),{}).checkpoint;if(!old)return null;const candidate=old.version===3?{...old,version:C.VERSION}:old;return C.validSnapshot(candidate)?candidate:null;}
  function build(){
    if(root)return;
    const style=el('style');style.textContent=`
      #oakRoot{position:fixed;inset:0;z-index:250;display:flex;flex-direction:column;overflow:hidden;background:#0d171c;color:#f0e5ce;font:13px system-ui,sans-serif}#oakRoot.hidden{display:none}
      #oakRoot header{display:flex;align-items:center;gap:12px;min-height:44px;box-sizing:border-box;padding:6px 16px;border-bottom:1px solid #b49b5940;background:#142128}#oakRoot header h2{font:700 16px Georgia;margin:0;color:#e2c790;letter-spacing:.15em}#oakRoot header span{flex:1;font-size:10px;letter-spacing:.12em;color:#9eaca5}#oakRoot .profile-btn{border:1px solid #a38d5d70;border-radius:3px;background:#23363c;color:#e5dbc3;padding:9px 14px;font:650 12px system-ui;cursor:pointer}#oakRoot .profile-btn:hover{background:#354b4f}#oakRoot button:focus-visible,#oakRoot summary:focus-visible{outline:3px solid #e0c586;outline-offset:3px}#oakRoot header button{font-size:11px;padding:6px 10px}
      #oakStage{position:relative;flex:1;min-height:0;display:flex;overflow:hidden}#oakCanvas{display:block;width:100%;height:100%;min-height:0;object-fit:fill;background:#102027;outline:none}#oakRoot.playing #oakStage,#oakRoot.playing #oakStage *{cursor:none}
      #oakMenu{position:absolute;inset:0;z-index:8;overflow:auto;display:flex;flex-direction:column;align-items:flex-start;gap:18px;padding:clamp(22px,5vw,65px);box-sizing:border-box;background-color:#12222b;background-size:cover;background-position:center}#oakMenu[hidden]{display:none}#oakMenu>h1{font:500 clamp(44px,6vw,82px) Georgia;letter-spacing:-.035em;color:#edcf92;margin:5vh 0 0;text-shadow:0 2px 20px #102027}#oakMenu>p{max-width:450px;color:#d0d2c1;line-height:1.75;font-size:13px;margin:0}#oakMenu .oakRow{display:flex;gap:10px;flex-wrap:wrap;align-items:center}#oakMenu>.oakRow{max-width:650px}#oakMenu>.oakRow>button{padding:13px 22px}#oakMenu>.oakRow>button:first-child{color:#14222a;background:#d3b779;border-color:#ead59f}#oakMenu>small{color:#b7b59d;font-size:10px}.oakSettings{width:min(680px,100%);box-sizing:border-box;padding:12px 16px;border:1px solid #9e956550;background:#10232de8;border-radius:4px}.oakSettings summary{color:#d8c79d;font-weight:650;cursor:pointer}.oakSettings .oakRow{margin:14px 0}.oakSettings label{display:flex;gap:7px;align-items:center;color:#bac7bd;font-size:12px}.oakSettings p{line-height:1.7;color:#b7c7bf;font-size:12px}.oakSettings fieldset{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0;border:1px solid #68817c55;padding:12px}.oakSettings legend{font-size:10px;letter-spacing:.12em;color:#c3ae7d}#oakMenu select{max-width:260px;padding:8px;background:#1f343d;color:#e5dbc5;border:1px solid #7a8c7b}
      #oakQuest{position:absolute;top:18px;right:18px;width:min(275px,45%);box-sizing:border-box;padding:12px 15px;border-right:3px solid #c2a86d;background:linear-gradient(270deg,#12232fe8,#12232f55);color:#d6c9a5;white-space:pre-line;text-align:right;font-size:11px;line-height:1.7;pointer-events:none}
      #oakMeters{position:absolute;left:20px;right:20px;bottom:114px;display:flex;justify-content:space-between;gap:16px;pointer-events:none}.oakPlayer{width:210px;max-width:45%;padding:10px 12px;border-left:2px solid #b5a06b;background:linear-gradient(90deg,#12232eea,#12232e88)}.oakPlayer>strong{display:block;font-size:9px;letter-spacing:.12em;color:#d8c58d;margin-bottom:7px}.oakVitalRow{display:flex;align-items:center;gap:10px}.oakOrb{flex:none;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;border:3px solid #9d8559;box-shadow:inset 0 0 0 2px #17282c,inset -6px -5px 12px #351e21;font:750 17px system-ui;color:#fff0db;text-shadow:0 2px #44252b}.oakVitalText{flex:1;min-width:0;font-size:10px;color:#bcc9c1}.oakVitalText b{display:block;color:#e5d6b4;font-size:11px;margin-bottom:6px}.oakStamina{height:5px;background:#203139;border:1px solid #5c7365;margin:5px 0}.oakStamina i{display:block;height:100%;background:#9cc393}
      #oakHotbar{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:18px;max-width:97%;pointer-events:none}.oakLoadout{display:flex;gap:5px;align-items:flex-end}.oakSlot{position:relative;overflow:hidden;box-sizing:border-box;width:58px;height:72px;padding:7px 4px 4px;background:linear-gradient(#263a40,#14252e);border:2px solid #8d825c;box-shadow:0 3px 0 #0b171d;text-align:center}.oakSlot.ready{border-color:#c3ab71}.oakSlotShade{position:absolute;inset:0 0 auto;background:#07141ccc;pointer-events:none}.oakIcon{display:block;position:relative;width:24px;height:24px;margin:0 auto 4px;color:#e6d9b6}.oakIcon svg{width:100%;height:100%}.oakSlot b{position:relative;display:block;font-size:9px;color:#d8cba9;font-weight:650}.oakSlot small{position:relative;display:block;font-size:10px;color:#eee2c5;line-height:1.5}.oakSlot .oakTimer{position:absolute;top:7px;right:4px;color:#e9d2ad;font-size:9px}
      #oakFloats{position:absolute;inset:0;pointer-events:none;overflow:hidden}#oakFloats span{position:absolute;font-size:14px;font-weight:800;text-shadow:0 2px 3px #102028;transform:translate(-50%,-50%)}#oakQuest[hidden],#oakHotbar[hidden],#oakFloats[hidden],#oakMeters[hidden]{display:none}
      #oakHud{flex:none;min-height:25px;box-sizing:border-box;padding:6px 16px;background:#142128;border-top:1px solid #9a855340;color:#abbbb0;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4}
      #oakCinema{position:absolute;inset:0;z-index:7;display:flex;flex-direction:column;overflow:hidden;background:#080e13}#oakCinema[hidden]{display:none}#oakFilm{display:block;position:relative;flex:1;width:100%;height:calc(100% - 142px);min-height:0;object-fit:contain;image-rendering:auto;transform:none!important}#oakCinema>div:not(#oakFilmProgress){flex:none;box-sizing:border-box;min-height:142px;padding:16px 9% 18px;background:#0c171e;text-align:center;display:grid;justify-items:center;align-content:center;gap:7px}#oakCinema h2{font:500 clamp(16px,2.1vw,26px) Georgia;color:#d9c18b;letter-spacing:.14em;margin:0}#oakCinema p{max-width:900px;min-height:2.8em;line-height:1.5;font-size:clamp(11px,1.4vw,16px);color:#dedcc6;margin:0;text-wrap:balance}#oakCinema small{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#8da79d}#oakCinema>button{position:absolute;right:15px;top:12px;z-index:2;pointer-events:auto;cursor:pointer!important}#oakFilmProgress{position:absolute;bottom:0;left:0;height:2px;background:#c4a96d;z-index:3}
      #oakBoss{position:absolute;top:17px;left:50%;transform:translateX(-50%);width:min(360px,60%);text-align:center;pointer-events:none;background:#14212dcc;padding:9px 13px;border:1px solid #b39b6344;box-sizing:border-box}#oakBoss strong{font:650 11px system-ui;color:#dfc28b;letter-spacing:.14em}#oakBoss>div{height:7px;background:#332c2b;margin-top:7px;border:1px solid #80684c}#oakBoss i{display:block;height:100%;background:#b36750}#oakBoss[hidden],#oakMentor[hidden]{display:none}#oakRoot.oakBossActive #oakQuest{top:87px}#oakMentor{position:absolute;transform:translate(-50%,-50%);pointer-events:none;color:#e5d0a2;text-shadow:0 2px 3px #102029;font-size:9px;letter-spacing:.08em;text-align:center}
      @media(max-width:760px){#oakRoot header span{display:none}#oakRoot header{padding:6px 10px}#oakRoot header h2{flex:1;font-size:14px}#oakQuest{font-size:10px;top:10px;right:10px;width:44%;padding:8px 10px}#oakMeters{left:10px;right:10px;bottom:110px}.oakPlayer{width:165px;padding:7px}.oakOrb{width:42px;height:42px;font-size:14px}.oakSlot{width:49px;height:66px}.oakIcon{width:21px;height:21px}.oakLoadout{gap:3px}#oakHotbar{gap:10px}#oakRoot.oakCouch #oakHotbar{flex-direction:column;gap:6px;bottom:10px}#oakRoot.oakCouch #oakMeters{bottom:166px}#oakCinema>div:not(#oakFilmProgress){padding:14px 7%;min-height:130px}}
`;document.head.append(style);
    root=el('section');root.id='oakRoot';root.className='hidden';root.setAttribute('role','dialog');root.setAttribute('aria-label','Oakhaven: Ash and Oath');root.setAttribute('aria-modal','true');
    const header=el('header',undefined,root);el('h2','OAKHAVEN',header);el('span','ASH & OATH · 3D adventure',header);
    button('Pause / settings (Esc)',()=>pause(),header);button('Leave game',()=>close(),header);
    const stage=el('div',undefined,root);stage.id='oakStage';canvas=el('canvas',undefined,stage);canvas.id='oakCanvas';canvas.width=640;canvas.height=360;canvas.tabIndex=0;canvas.setAttribute('aria-label','Game arena. Use configured keyboard controls. Escape pauses.');try{renderer=window.Oakhaven3D?.create(canvas);}catch(error){console.warn('Oakhaven renderer:',error);}
    cinema=el('div',undefined,stage);cinema.id='oakCinema';cinema.hidden=true;const caption=el('div',undefined,cinema);cinemaTitle=el('h2','',caption);cinemaLine=el('p','',caption);speaker=el('small','',caption);film=el('img',undefined,cinema);film.id='oakFilm';film.alt='';film.onerror=()=>{film.hidden=true;};filmProgress=el('div',undefined,cinema);filmProgress.id='oakFilmProgress';button('Skip intro (E)',()=>{if(world&&session?.mode!=='guest')world.intro=C.INTRO_DURATION;},cinema);
    meters=el('div',undefined,stage);meters.id='oakMeters';chapter=el('div',undefined,stage);chapter.id='oakQuest';hotbar=el('div',undefined,stage);hotbar.id='oakHotbar';floatLayer=el('div',undefined,stage);floatLayer.id='oakFloats';for(let i=0;i<20;i++)el('span','',floatLayer);bossPanel=el('div',undefined,stage);bossPanel.id='oakBoss';bossName=el('strong','THE HUNTSMAN',bossPanel);bossFill=el('i',undefined,el('div',undefined,bossPanel));mentorLabel=el('div','OLD MAN GARROW · MENTOR',stage);mentorLabel.id='oakMentor';
    menu=el('div',undefined,stage);menu.id='oakMenu';hud=el('div',undefined,root);hud.id='oakHud';hud.setAttribute('role','status');document.body.append(root);
    canvas.onpointerdown=e=>{if(!session||session.mode==='couch'||!menu.hidden)return;canvas.focus();pointerAim={x:e.clientX,y:e.clientY};pressed.add(e.button===2?'block':'attack');keys.add(e.button===2?'Mouse2':'Mouse0');};
    canvas.onpointermove=e=>{if(!world||session?.mode==='couch'||!menu.hidden)return;pointerAim={x:e.clientX,y:e.clientY};};
    canvas.oncontextmenu=e=>e.preventDefault();window.addEventListener('pointerup',()=>{keys.delete('Mouse2');keys.delete('Mouse0');});
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
    else {const checkpoint=savedCheckpoint();if(checkpoint&&checkpoint.scene==='mire'&&!checkpoint.won)button('Continue expedition',()=>{start('solo');if(session){world=checkpoint;world.intro=C.INTRO_DURATION;}},row);button('Solo expedition',()=>start('solo'),row);button('Two-player couch expedition',()=>start('couch'),row);}
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
      if(!select.value)return;start('host',select.value);if(!session)return;session.waiting=true;pause();hud.textContent='Invitation sent. Waiting for your friend to accept; both players must remain online.';send(select.value,{t:'oak-invite',id:session.id,version:C.VERSION});
    },row);b.disabled=!select.options.length;
    el('p','Online beta: two players, host-controlled combat, 15 snapshots/sec. Invitations use your existing Discard friend connection. No host migration or reconnect yet. Couch and online modes are separate.',menu);
  }
  function open(){build();previousFocus=document.activeElement;root.classList.remove('hidden');document.querySelector('#gamesHub').classList.add('hidden');loadBindings();reduced=read(key(),{}).reduced??matchMedia('(prefers-reduced-motion: reduce)').matches;sound=read(key(),{}).sound!==false;showMenu();draw();}
  function start(mode,other=null,id=null){
    if(!renderer){hud.textContent='WebGL is required for the new 3D game. Please enable browser hardware acceleration.';return;}
    initAudio();hotbarKey='';root.classList.remove('oakCouch');if(mode==='couch')root.classList.add('oakCouch');meterKey='';shotKey=-1;world=C.create(mode==='solo'?1:2);lastHealth=world.players.length*100;lastAttack=0;world.intro=mode==='guest'?C.INTRO_DURATION:0;session={mode,other,id:id||crypto.randomUUID(),paused:false,waiting:mode==='guest',lastSeen:performance.now(),owner:account()};remote={};remoteAt=0;last=0;acc=0;netClock=0;
    if(mode==='guest'){pause();hud.textContent='Joining host…';}else resume();
    if(!raf)raf=requestAnimationFrame(frame);
  }
  function resume(){if(!session)return;if(session.waiting){hud.textContent='Waiting for the party connection…';return;}session.paused=false;pointerAim=null;menu.hidden=true;root.classList.add('playing');keys.clear();pressed.clear();canvas.focus();}
  function pause(){if(!session)return;stopMusic();pointerAim=null;checkpoint(true);session.paused=true;showMenu('Take a breath');if(session.mode==='guest')send(session.other,{t:'oak-input',id:session.id,input:{}});}
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
    if(!keys.has(e.code)&&bindings.some(b=>['up','down','left','right'].some(a=>b[a]===e.code)))pointerAim=null;
    if(bindings.some(b=>Object.values(b).includes(e.code))){e.preventDefault();e.stopImmediatePropagation();if(!keys.has(e.code))pressed.add(e.code);keys.add(e.code);}
  }
  function input(i){const b=bindings[i],a=Object.fromEntries(C.actions.map(action=>[action,(action==='roll'||action==='interact')?pressed.has(b[action]):(keys.has(b[action])||pressed.has(b[action]))||(i===0&&((action==='attack'&&(pressed.has('attack')||keys.has('Mouse0')))||(action==='block'&&keys.has('Mouse2'))))]));if(i===0&&pointerAim&&session?.mode!=='couch'){const p=world?.players[session?.mode==='guest'?1:0],v=p&&renderer?.aim(pointerAim.x,pointerAim.y,p),length=v&&Math.hypot(v.x,v.y);if(length>.01){a.lookX=v.x/length;a.lookY=v.y/length;}}return a;}
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
  const slotIcons={attack:'<path d="m5 19 3-3m-4-3 7 7M8 16 19 5l-1-2-2 1L5 15"/>',heavy:'<path d="m5 20 11-13M12 4l7 6 3-4-7-5zM4 16l5 5"/>',ranged:'<path d="M6 3q17 9 0 18L9 12zM5 12h16m-4-4 4 4-4 4"/>',roll:'<path d="M5 8a8 8 0 1 1-1 8M2 4v6h6m2 2 3-3 3 3-3 3z"/>',heal:'<path d="M9 2h6v4l4 5v9H5v-9l4-5zM9 14h6m-3-3v6"/>',interact:'<path d="M5 20V9l2-2 3 4V3h3v8l2-6 3 1-1 7 3-2 2 2-5 8z"/>'};
  function renderHotbar(s){
    const count=session?.mode==='couch'?2:1,rows=Array.from({length:count},(_,i)=>({p:s.players[session?.mode==='guest'?1:i]||s.players[0],b:bindings[i]}));
    const layout=rows.map(({b})=>Object.values(b).join(',')).join('|'),state=rows.map(({p})=>[Math.ceil(p.cooldown*10),Math.ceil(p.bowCooldown*10),Math.ceil(p.healCooldown),Math.ceil(p.roll*10),Math.floor(p.stamina/5)].join(':')).join('|');
    if(layout===hotbarLayout&&state===hotbarKey)return;hotbarKey=state;
    if(layout!==hotbarLayout){hotbarLayout=layout;hotbar.replaceChildren();slotRefs=rows.map(({b})=>{const loadout=el('div',undefined,hotbar);loadout.className='oakLoadout';return ['attack','heavy','ranged','roll','heal','interact'].map(action=>{const slot=el('div',undefined,loadout);const shade=el('div',undefined,slot);shade.className='oakSlotShade';const icon=el('span',undefined,slot);icon.className='oakIcon';icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">'+slotIcons[action]+'</svg>';const title=el('b','',slot);el('small',keyLabel(b[action]),slot);const timer=el('span','',slot);timer.className='oakTimer';return{slot,shade,title,timer};});});}
    rows.forEach(({p,b},i)=>{const data=[['attack','Sword',p.cooldown,.6],['heavy','Heavy',p.stamina<25?(25-p.stamina)/23:0,1],['ranged','Bow',p.bowCooldown,.65],['roll','Dodge',p.roll||Math.max(0,30-p.stamina)/23,1.3],['heal','Potion',p.healCooldown,18],['interact','Use',0,1]];data.forEach(([action,label,remaining,total],j)=>{const ref=slotRefs[i][j];ref.slot.className='oakSlot'+(remaining<=0?' ready':'');ref.slot.setAttribute('aria-label',label+' · '+keyLabel(b[action])+(remaining>0?' · cooldown '+Math.ceil(remaining)+' seconds':''));ref.shade.style.height=Math.min(100,remaining/total*100)+'%';ref.title.textContent=label;ref.timer.hidden=remaining<=0;ref.timer.textContent=String(Math.ceil(remaining));});});
  }
  function renderVitals(s){const state=s.players.map(p=>[Math.ceil(p.hp),Math.ceil(p.stamina),p.level,p.revived].join(',')).join('|');if(state===meterKey)return;meterKey=state;if(vitalRefs.length!==s.players.length){meters.replaceChildren();vitalRefs=s.players.map(()=>{const pane=el('div',undefined,meters);pane.className='oakPlayer';const name=el('strong','',pane),row=el('div',undefined,pane);row.className='oakVitalRow';const orb=el('div','',row);orb.className='oakOrb';orb.setAttribute('role','progressbar');orb.setAttribute('aria-label','Health');orb.setAttribute('aria-valuemin','0');orb.setAttribute('aria-valuemax','100');const info=el('div',undefined,row);info.className='oakVitalText';const title=el('b','',info),track=el('div',undefined,info);track.className='oakStamina';const fill=el('i',undefined,track),detail=el('small','',info);return{name,orb,title,fill,detail};});}s.players.forEach((p,i)=>{const ref=vitalRefs[i];ref.name.textContent=(i?'PLAYER II':'PLAYER I')+(session?.mode==='guest'?(i?' · YOU':' · HOST'):'')+' · AGE 18';ref.orb.textContent=String(Math.ceil(p.hp));ref.orb.style.background='linear-gradient(to top,#a34841 '+Math.max(0,p.hp)+'%,#25343a '+Math.max(0,p.hp)+'%)';ref.orb.setAttribute('aria-valuenow',String(Math.ceil(p.hp)));ref.title.textContent=p.hp<=0?'FALLEN':p.level>1?'FORGED BLADE':'OAKHAVEN SQUIRE';ref.fill.style.width=Math.max(0,p.stamina)+'%';ref.detail.textContent=p.hp<=0?'Partner: interact to revive':Math.ceil(p.stamina)+' stamina';});}

  function draw(){
    if(!renderer)return;const s=world,illustrated=s&&s.intro<C.INTRO_DURATION&&window.OakhavenArt?.length===4?window.Oakhaven3D?.beat?.(s.intro):null,result=illustrated?{cutscene:illustrated}:renderer.render(s,reduced);const beat=result?.cutscene;
    cinema.hidden=!beat||!menu.hidden;meters.hidden=!!beat||!menu.hidden;
    chapter.hidden=hotbar.hidden=!!beat||!menu.hidden;floatLayer.hidden=!!beat||!menu.hidden;
    const boss=s?.enemies.find(e=>e.kind==='huntsman'&&e.hp>0&&s.players.some(p=>p.hp>0&&Math.hypot(p.x-e.x,p.y-e.y)<300));bossPanel.hidden=!boss||!!beat||!menu.hidden;if(!bossPanel.hidden){bossName.textContent=boss.phase===2?'THE HUNTSMAN · FRENZIED':'THE HUNTSMAN';bossFill.style.width=Math.max(0,boss.hp/boss.maxHp*100)+'%';root.classList.add('oakBossActive');}else root.classList.remove('oakBossActive');const mentorPoint=s?.scene==='hub'&&!beat&&menu.hidden&&renderer.project?.(275,190,2.15);mentorLabel.hidden=!mentorPoint;if(mentorPoint){mentorLabel.style.left=mentorPoint.x+'%';mentorLabel.style.top=mentorPoint.y+'%';}
    if(beat){
      const art=window.OakhavenArt?.[beat.panel];if(art&&film.src!==art){film.src=art;film.hidden=false;}
      const progress=beat.progress||0;film.style.transform='none';
      film.style.opacity=String(Math.min(1,progress*12,(1-progress)*12));cinemaTitle.textContent=beat.title;speaker.textContent=beat.who||'';
      const shown=reduced?beat.line.length:Math.min(beat.line.length,Math.floor(progress*6*34));cinemaLine.textContent=beat.line.slice(0,shown);filmProgress.style.width=((s.intro||0)/C.INTRO_DURATION*100)+'%';
      if(shotKey!==beat.start){shotKey=beat.start;if(!session?.paused)chord(beat.panel);}
    }
    else if(s){
      const titles=['THE FORGOTTEN WATCHTOWER','I · THE WILD HUNT','II · THE BROKEN CROSSING','III · THE HUNTSMAN'];const target=s.scene==='hub'?{x:275,y:190}:s.enemies?.[0];let label=s.scene==='hub'?'E · Set out on your expedition':s.won?'THE MIRE IS FREE':s.message.split('—').slice(1).join('—').trim();
      chapter.textContent=(titles[s.wave]||'YOUR OATH BEGINS')+'\n'+label+(target?' · '+Math.ceil(Math.hypot(target.x-s.players[0].x,target.y-s.players[0].y)/20)+' m':'');
      renderHotbar(s);
      [...floatLayer.children].forEach((node,i)=>{const e=s.events?.[i],point=e&&renderer.project?.(e.x,e.y,2.1+(1-e.life)*1.3);node.hidden=!point;if(point){node.textContent=e.text;node.style.left=point.x+'%';node.style.top=point.y+'%';node.style.color=e.color;node.style.opacity=Math.min(1,e.life*3);}});
    }
    if(!s){hud.textContent='A kingdom in ashes. An oath worth keeping.';return;}
    const hp=s.players.reduce((n,p)=>n+p.hp,0);if(hp<lastHealth)tone(85,.18,'sawtooth',.035);lastHealth=hp;
    if(s.players[0].cooldown>lastAttack+.1)tone(s.players[0].heavy?120:260,.12,'triangle');lastAttack=s.players[0].cooldown;
    renderVitals(s);
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
      if(data.version!==C.VERSION){const status=document.querySelector('#oakInviteStatus');if(status)status.textContent='Oakhaven versions differ. Both players should reopen the Discard loader.';return;}
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
