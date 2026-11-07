/* node tests/dead-zone.browser.cjs
   DZ_PLAYWRIGHT: optional module path; DZ_LATENCY_MS/DZ_JITTER_MS/DZ_DROP_EVERY:
   optional simulated network impairment. Uses real local WebRTC data channels. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.DZ_PLAYWRIGHT||'playwright');
const root=path.join(__dirname,'..'),game=fs.readFileSync(path.join(root,'dead-zone.js'),'utf8');
const source=game.replace('window.openDeadZone=open;',`window.dzTest={getWorld:()=>world,getSession:()=>session,getWorker:()=>hostWorker,prediction,guestVisuals,saveGame,draw,setRAFStopped:()=>{window.requestAnimationFrame=()=>0;releaseControls();}};window.openDeadZone=open;`);
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.DZ_BROWSER==='chromium'?{}:{channel:'msedge'}),ignoreDefaultArgs:['--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
 try{
  const pages={},errors=[];const lag=Number(process.env.DZ_LATENCY_MS||0),jitter=Number(process.env.DZ_JITTER_MS||0),drop=Number(process.env.DZ_DROP_EVERY||0);
  for(const id of ['host','guest']){
   const page=await browser.newPage({viewport:{width:1440,height:900}});pages[id]=page;page.on('pageerror',e=>errors.push(id+': '+e.message));
   await page.route('https://deadzone.test/**',r=>{const name=new URL(r.request().url()).pathname.slice(1);if(!name)return r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"></body></html>'});if(['dead-zone.js','dead-zone-net.js','dead-zone-host-worker.js'].includes(name))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,name),'utf8')});return r.abort();});
   await page.goto('https://deadzone.test/');await page.addScriptTag({path:path.join(root,'dead-zone-net.js')});
   await page.addScriptTag({content:`
    var currentUser={id:${JSON.stringify(id)}},state={friends:{host:{},guest:{}}};
    function viewPerson(id){return{displayName:id==='host'?'Ranger':'Medic'}}function connectTo(){}
    window.__stats={fastBytes:0,fastPackets:0,reliableBytes:0,reliablePackets:0,dropped:0};
    window.__pc=new RTCPeerConnection({iceServers:[]});window.__reliable=__pc.createDataChannel('control',{negotiated:true,id:0,ordered:true});
    const other=${JSON.stringify(id==='host'?'guest':'host')};let received=0;
    function deliver(data,fast){const n=++received;if(fast&&${drop}>0&&n%${drop}===0){__stats.dropped++;return;}const delay=${lag}+(fast?((n*17)%(${jitter}+1)):0);if(delay)setTimeout(()=>deadZoneHandle(other,data),delay);else window.deadZoneHandle?.(other,data);}
    __reliable.onmessage=e=>deliver(JSON.parse(e.data),false);
    window.__transport=new DeadZoneNet.RealtimeTransport({getConnection:()=>({peerConnection:__pc}),allowed:()=>true,receive:(id,data)=>deliver(data,true)});__transport.open(other);
    function sendTo(to,data){const text=JSON.stringify(data);__stats.reliableBytes+=text.length;__stats.reliablePackets++;__reliable.send(text);return true;}
    window.deadZoneSendRealtime=(to,data)=>{const result=__transport.send(to,data);if(result){__stats.fastBytes+=JSON.stringify(data).length;__stats.fastPackets++;}return result;};
   `});
   await page.addScriptTag({content:source});
  }
  const {host,guest}=pages;
  const offer=await host.evaluate(async()=>{await __pc.setLocalDescription(await __pc.createOffer());if(__pc.iceGatheringState!=='complete')await new Promise(r=>__pc.addEventListener('icegatheringstatechange',()=>{if(__pc.iceGatheringState==='complete')r();}));return __pc.localDescription.toJSON();});
  const answer=await guest.evaluate(async offer=>{await __pc.setRemoteDescription(offer);await __pc.setLocalDescription(await __pc.createAnswer());if(__pc.iceGatheringState!=='complete')await new Promise(r=>__pc.addEventListener('icegatheringstatechange',()=>{if(__pc.iceGatheringState==='complete')r();}));return __pc.localDescription.toJSON();},offer);
  await host.evaluate(answer=>__pc.setRemoteDescription(answer),answer);
  await Promise.all([host,guest].map(p=>p.waitForFunction(()=>__reliable.readyState==='open'&&[...__transport.channels.values()][0]?.channel.readyState==='open')));
  await host.evaluate(()=>openDeadZone());const sid=await host.evaluate(()=>dzTest.getSession().id);await guest.evaluate(id=>deadZoneHandle('host',{v:1,t:'dz-invite',id}),sid);await guest.evaluate(()=>openDeadZone());
  await guest.getByRole('button',{name:'Join Ranger',exact:true}).click();await host.waitForFunction(()=>dzTest.getWorld().players.length===2);
  await host.evaluate(()=>{const w=dzTest.getWorld(),p=w.players[0];w.mode='endless';w.between=100;w.remaining=10;p.x=1800;p.y=1300;p.inventory.push('shotgun');p.weapon=p.primary='shotgun';p.ammo=80;p.invuln=100;w.players[1].invuln=100;for(let i=0;i<65;i++)w.zombies.push({netId:i+1,x:1930+i%8*26,y:1190+Math.floor(i/8)*28,hp:30,maxHp:30,kind:'walker',speed:20,attack:0});w.zombieSerial=65;});
  await host.getByRole('button',{name:/DEPLOY/}).click();await guest.waitForFunction(()=>dzTest.getSession().phase==='play');await host.waitForFunction(()=>!!dzTest.getWorker());
  const before=await guest.evaluate(()=>{window.__moveStart=performance.now();window.__startX=dzTest.prediction.state.x;return dzTest.prediction.state.x;});
  await guest.locator('canvas').first().focus();await guest.keyboard.down('KeyD');await guest.keyboard.down('ShiftLeft');
  const response=await guest.evaluate(()=>new Promise(resolve=>{const check=()=>{if(dzTest.prediction.state.x>__startX+.1)resolve(performance.now()-__moveStart);else requestAnimationFrame(check);};check();}));
  await guest.waitForTimeout(450);await guest.keyboard.up('KeyD');await guest.keyboard.up('ShiftLeft');await host.waitForFunction(x=>dzTest.getWorld().players[1].x>x+20,before);
  await guest.waitForTimeout(700);const motion=await guest.evaluate(()=>({pending:dzTest.prediction.pending.length,error:dzTest.prediction.lastError,x:dzTest.prediction.state.x,authority:dzTest.getWorld().players.find(p=>p.id==='guest').x}));assert.ok(motion.pending<40);assert.ok(motion.error<3);assert.ok(response<250);
  const button=await guest.locator('#dzInventoryToggle').elementHandle();await guest.waitForTimeout(350);assert.ok(await button.evaluate(e=>e.isConnected),'HUD controls must retain their identity');
  await guest.keyboard.press('KeyI');assert.ok(await guest.locator('.dz-inventory').isVisible());await guest.keyboard.press('Escape');await guest.keyboard.press('Escape');await guest.getByRole('button',{name:/Resume/}).click();
  const box=await host.locator('canvas').first().boundingBox();await host.mouse.move(box.x+box.width*580/960,box.y+box.height*300/600);await host.mouse.down();await host.waitForTimeout(120);await host.mouse.up();
  await guest.waitForFunction(()=>dzTest.getWorld().blood.length>0);await host.waitForFunction(()=>dzTest.getWorld().score>0);
  // No host animation frames, foreground focus or host input are needed from here on.
  const timeBefore=await host.evaluate(()=>{dzTest.setRAFStopped();return dzTest.getWorld().time;});await guest.bringToFront();
  const xBefore=await host.evaluate(()=>dzTest.getWorld().players[1].x);await guest.locator('canvas').first().focus();await guest.keyboard.down('KeyA');await guest.waitForTimeout(1200);await guest.keyboard.up('KeyA');
  const background=await host.evaluate(()=>({time:dzTest.getWorld().time,x:dzTest.getWorld().players[1].x,worker:!!dzTest.getWorker()}));assert.ok(background.time>timeBefore+.7,'worker simulation must continue without host RAF');assert.ok(background.x<xBefore-40);
  await host.evaluate(()=>dzTest.saveGame());await host.waitForFunction(()=>!!localStorage.getItem('deadzone-save-v1-host'));const save=await host.evaluate(()=>JSON.parse(localStorage.getItem('deadzone-save-v1-host')));assert.equal(save.version,1);assert.equal(save.world.players.length,1);assert.ok(save.world.houses.length>0);assert.ok(save.world.zombies.every(z=>Number.isFinite(z.speed)));
  const stats=await guest.evaluate(()=>__stats);assert.ok(stats.fastPackets>40);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({realWebRTC:true,workerWithoutHostRAF:true,impairment:{lag,jitter,drop},responseMs:Math.round(response),motion,background,stats,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
