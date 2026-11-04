const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../oakhaven-core.js');
const R=require('../oakhaven-3d.js');
// Minimal DOM/clock fixture tests adapter behavior without claiming browser rendering QA.
function fixture(id='alice',friends={bob:{}}){
  let now=0,frame=null;const storage=new Map(),events={},messages=[],intervals=[];
  const nodes=[];
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.hidden=false;this.style={};this.attrs={};this.classes=new Set();nodes.push(this);this.classList={add:(...s)=>s.forEach(x=>this.classes.add(x)),remove:(...s)=>s.forEach(x=>this.classes.delete(x)),contains:s=>this.classes.has(s)};}
    set className(v){this.classes=new Set(v.split(' '));}get className(){return [...this.classes].join(' ');}
    append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(k,f){this['on'+k]=f;}focus(){document.activeElement=this;}get options(){return this.children;}
    querySelectorAll(selector){const tags=selector.split(',');return this.children.flatMap(n=>[...(tags.includes(n.tagName)?[n]:[]),...n.querySelectorAll(selector)]);}
    querySelector(s){return this.querySelectorAll(s)[0];}getContext(){return new Proxy({},{get:()=>()=>{}});}
  }
  const document={hidden:false,activeElement:null,hasFocus:()=>true,createElement:t=>new Element(t),head:new Element('head'),body:new Element('body'),getElementById:id=>nodes.find(n=>n.id===id),querySelector:s=>s.startsWith('#')?nodes.find(n=>n.id===s.slice(1)):nodes.find(n=>n.attrs['data-playtime']===s.match(/"(.*?)"/)?.[1]),addEventListener:(k,f)=>{(events[k]||=[]).push(f);}};
  for(const n of ['gamesHub','hubPlayOakhaven','oakInviteStatus']){const e=new Element('div');e.id=n;document.body.append(e);}
  const sandbox={document,currentUser:{id},state:{me:{id},friends},OakhavenCore:C,console,performance:{now:()=>now},crypto:{randomUUID:()=>`${id}-party`},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},matchMedia:()=>({matches:false}),connectTo:()=>{},sendTo:(to,data)=>{messages.push({to,data:structuredClone(data)});return true;},viewPerson:id=>({displayName:id}),requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame:()=>{frame=null;},setInterval:(fn,ms)=>intervals.push({fn,ms})};
  sandbox.window=sandbox;sandbox.addEventListener=(k,f)=>{(events[k]||=[]).push(f);};vm.createContext(sandbox);
  sandbox.Oakhaven3D={beat:R.beat,create:()=>({render:()=>({cutscene:null}),aim:()=>null})};
  const load=file=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),sandbox);
  load('oakhaven.js');
  const click=text=>{const b=nodes.findLast(n=>n.tagName==='button'&&n.textContent===text);assert.ok(b,`button ${text}`);b.onclick();if(['Solo expedition','Two-player couch expedition','Accept invitation'].includes(text)){const skip=nodes.findLast(n=>n.textContent==='Skip intro (E)');skip?.onclick();}return b;};
  return {sandbox,document,storage,messages,intervals,load,click,open:()=>document.querySelector('#hubPlayOakhaven').onclick(),tick:(ms=17)=>{now+=ms;const f=frame;frame=null;f?.(now);},key:(code,type='keydown')=>{const e={code,preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}};for(const f of events[type]||[])f(e);return e;}};
}
test('solo and couch menus, pause/resume, cursor state and close lifecycle',()=>{
  const f=fixture();f.open();f.click('Two-player couch expedition');assert.equal(f.sandbox.oakhavenIsPlaying(),true);assert.ok(f.document.querySelector('#oakRoot').classList.contains('playing'));
  f.key('Escape');assert.equal(f.sandbox.oakhavenIsPlaying(),false);assert.equal(f.document.querySelector('#oakMenu').hidden,false);
  f.click('Resume');f.tick();assert.equal(f.sandbox.oakhavenIsPlaying(),true);f.sandbox.closeOakhaven();assert.equal(f.document.querySelector('#oakRoot').classList.contains('hidden'),true);
});
test('keybind capture saves only non-conflicting keys per account',()=>{
  const f=fixture();f.open();const b=f.click('attack: KeyF');b.onkeydown({code:'KeyZ',preventDefault(){},stopPropagation(){}});
  assert.equal(JSON.parse(f.storage.get('discard-oakhaven-v1-alice')).bindings[0].attack,'KeyZ');
  const conflict=f.click('heavy: KeyG');conflict.onkeydown({code:'KeyZ',preventDefault(){},stopPropagation(){}});assert.equal(JSON.parse(f.storage.get('discard-oakhaven-v1-alice')).bindings[0].heavy,'KeyG');
});
test('two simulated Discard peers invite, accept, exchange input/snapshot and end',()=>{
  const host=fixture('alice',{bob:{}}),guest=fixture('bob',{alice:{}});host.open();const select=host.document.querySelector('#oakMenu').querySelector('select');select.value='bob';host.click('Invite friend (online beta)');
  const invitation=host.messages.find(m=>m.data.t==='oak-invite').data;guest.sandbox.oakhavenHandle('alice',invitation);guest.open();guest.click('Accept invitation');
  const join=guest.messages.find(m=>m.data.t==='oak-join').data;host.sandbox.oakhavenHandle('bob',join);host.click('Skip intro (E)');assert.equal(host.sandbox.oakhavenIsPlaying(),true);
  for(let i=0;i<8;i++)host.tick();const snapshot=host.messages.findLast(m=>m.data.t==='oak-state').data;assert.equal(C.validSnapshot(snapshot.world),true);guest.sandbox.oakhavenHandle('alice',snapshot);assert.equal(guest.sandbox.oakhavenIsPlaying(),true);
  guest.key('KeyD');for(let i=0;i<4;i++)guest.tick();const input=guest.messages.findLast(m=>m.data.t==='oak-input').data;assert.equal(input.input.right,true);host.sandbox.oakhavenHandle('bob',input);
  for(let i=0;i<8;i++)host.tick();const next=host.messages.findLast(m=>m.data.t==='oak-state').data;assert.ok(next.world.players[1].x>snapshot.world.players[1].x);
  host.sandbox.closeOakhaven();guest.sandbox.oakhavenHandle('alice',host.messages.at(-1).data);assert.equal(guest.sandbox.oakhavenIsPlaying(),false);
});
test('network ignores strangers and stale sessions; invitation expires',()=>{
  const f=fixture();f.sandbox.oakhavenHandle('stranger',{t:'oak-invite',id:'x'});assert.equal(f.document.querySelector('#oakInviteStatus').textContent,'');f.open();f.document.querySelector('#oakMenu').querySelector('select').value='bob';f.click('Invite friend (online beta)');f.sandbox.oakhavenHandle('bob',{t:'oak-join',id:'stale'});assert.equal(f.sandbox.oakhavenIsPlaying(),false);f.tick(61000);assert.equal(f.sandbox.oakhavenIsPlaying(),false);assert.match(f.document.querySelector('#oakHud').textContent,/expired/);
});
test('playtime persists active foreground time and excludes pause/account changes',()=>{
  const f=fixture();f.load('game-time.js');const timer=f.intervals.find(i=>i.ms===1000).fn,save=f.intervals.find(i=>i.ms===10000).fn;timer();f.open();f.click('Solo expedition');f.tick(1000);timer();save();assert.equal(JSON.parse(f.storage.get('discard-game-time-v1-alice')).oakhaven,1000);
  f.key('Escape');f.tick(1000);timer();save();assert.equal(JSON.parse(f.storage.get('discard-game-time-v1-alice')).oakhaven,1000);
  f.sandbox.currentUser={id:'bob'};timer();save();assert.equal(f.storage.has('discard-game-time-v1-bob'),false);
});
test('solo checkpoint can be restored from the title menu after leaving',()=>{
  const f=fixture();f.open();f.click('Solo expedition');f.tick();f.key('KeyE');f.tick(34);f.key('KeyE','keyup');f.key('Escape');
  const saved=JSON.parse(f.storage.get('discard-oakhaven-v1-alice'));assert.equal(saved.checkpoint.scene,'mire');assert.equal(C.validSnapshot(saved.checkpoint),true);assert.equal(saved.checkpoint.projectiles.length,0);
  f.sandbox.closeOakhaven();f.open();f.click('Continue expedition');assert.equal(f.sandbox.oakhavenIsPlaying(),true);
});
test('adding bow controls preserves an older custom bind and resolves its collision',()=>{
  const f=fixture(),old=C.presets.map(b=>({...b}));old[0].attack='KeyQ';delete old[0].ranged;delete old[0].heal;f.storage.set('discard-oakhaven-v1-alice',JSON.stringify({bindings:old}));f.open();
  const fields=f.document.querySelector('#oakMenu').querySelectorAll('button').map(b=>b.textContent);assert.ok(fields.includes('attack: KeyQ'));assert.ok(!fields.includes('ranged: KeyQ'));assert.ok(fields.some(s=>s.startsWith('ranged: ')));
});
test('illustrated opening selects its art and captions, then keyboard skip returns to play',()=>{
  const f=fixture();f.load('oakhaven-art.js');f.open();const start=f.document.querySelector('#oakMenu').querySelectorAll('button').find(b=>b.textContent==='Solo expedition');start.onclick();f.tick();assert.equal(f.document.querySelector('#oakCinema').hidden,false);assert.match(f.document.querySelector('#oakFilm').src,/^data:image\/jpeg/);assert.equal(f.sandbox.oakhavenIsPlaying(),false);f.key('KeyE');f.tick(34);f.key('KeyE','keyup');assert.equal(f.document.querySelector('#oakCinema').hidden,true);assert.equal(f.sandbox.oakhavenIsPlaying(),true);
});
