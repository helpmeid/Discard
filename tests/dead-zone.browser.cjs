/* Optional real-browser checks: npm install --no-save playwright, then
   node tests/dead-zone.browser.cjs. Uses installed Edge by default.
   Set DZ_BROWSER=chromium for Playwright Chromium, DZ_SCREENSHOT for a PNG. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.DZ_PLAYWRIGHT||'playwright');
const source=fs.readFileSync(path.join(__dirname,'../dead-zone.js'),'utf8').replace(
 'window.openDeadZone=open;',
 'window.dzTest={getWorld:()=>world,getSession:()=>session,tick,draw};window.openDeadZone=open;'
);
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.DZ_BROWSER==='chromium'?{}:{channel:'msedge'})});
 try{
  const pages={},errors=[];
  for(const id of ['host','guest']){
   const page=await browser.newPage({viewport:{width:1440,height:900}});pages[id]=page;
   page.on('pageerror',e=>errors.push(id+': '+e.message));
   await page.exposeFunction('relayMsg',async(to,data)=>{if(pages[to])await pages[to].evaluate(({from,data})=>window.deadZoneHandle?.(from,data),{from:id,data});});
   await page.route('https://deadzone.test/',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"></body></html>'}));
   await page.goto('https://deadzone.test/');
   await page.addScriptTag({content:`var currentUser={id:${JSON.stringify(id)}},state={friends:{host:{},guest:{}}};function viewPerson(id){return {displayName:id==='host'?'Ranger':'Medic'}}function connectTo(){}function sendTo(to,data){window.relayMsg(to,data)}`});
   await page.addScriptTag({content:source});
  }
  const {host,guest}=pages;
  await host.evaluate(()=>openDeadZone());
  await host.getByRole('button',{name:'Invite friend',exact:true}).click();
  await guest.waitForFunction(()=>!!window.openDeadZone);
  await guest.evaluate(()=>openDeadZone());
  await guest.getByRole('button',{name:'Join Ranger',exact:true}).click();
  await host.waitForFunction(()=>dzTest.getWorld().players.length===2);
  await host.getByRole('button',{name:/DEPLOY/}).click();
  await guest.waitForFunction(()=>dzTest.getSession().phase==='play');
  const before=await host.evaluate(()=>dzTest.getWorld().players[1].x);
  await guest.locator('canvas').focus();await guest.keyboard.down('KeyD');await guest.keyboard.down('ShiftLeft');
  await guest.waitForTimeout(450);await guest.keyboard.up('KeyD');await guest.keyboard.up('ShiftLeft');
  await host.waitForFunction(x=>dzTest.getWorld().players[1].x>x+20,before);
  const stamina=await host.evaluate(()=>dzTest.getWorld().players[1].stamina);assert.ok(stamina<100);
  await guest.keyboard.press('KeyI');assert.ok(await guest.locator('.dz-inventory').isVisible());
  await guest.keyboard.press('Escape');await guest.keyboard.press('Escape');
  await guest.getByRole('button',{name:/Settings/}).click();assert.ok(await guest.getByRole('button',{name:/Move up/}).isVisible());
  await guest.getByRole('button',{name:'← Back',exact:true}).click();await guest.getByRole('button',{name:/Resume/}).click();
  // Exercise host-authoritative combat and snapshot delivery with a reproducible encounter.
  await host.evaluate(()=>{const w=dzTest.getWorld(),p=w.players[0];p.x=1800;p.y=1300;p.inventory.push('shotgun');p.weapon='shotgun';p.ammo=80;w.between=0;w.wave=1;w.remaining=25;for(let i=0;i<15;i++)w.zombies.push({x:1900+i%4*28,y:1210+Math.floor(i/4)*47,hp:40,maxHp:40,speed:50,attack:0});});
  await host.mouse.move(920,430);await host.mouse.down();await host.waitForTimeout(1600);await host.mouse.up();
  const stats=await host.evaluate(()=>{const w=dzTest.getWorld();return {kills:w.players[0].kills,particles:w.effects.length,stains:w.blood.length,mode:w.mode,health:w.players[0].hp};});
  assert.ok(stats.stains>0);await guest.waitForFunction(()=>dzTest.getWorld().blood.length>0);
  if(process.env.DZ_SCREENSHOT)await host.screenshot({path:process.env.DZ_SCREENSHOT});
  await host.setViewportSize({width:800,height:600});await host.waitForTimeout(150);
  const fit=await host.evaluate(()=>{const c=document.querySelector('canvas').getBoundingClientRect();return {ratio:c.width/c.height,width:c.width,height:c.height};});
  assert.ok(Math.abs(fit.ratio-1.6)<.01);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({twoPeerRelay:true,stats,fit,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
