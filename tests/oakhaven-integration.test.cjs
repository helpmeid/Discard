const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../oakhaven-core.js');
// Minimal DOM/clock fixture tests adapter behavior without claiming browser rendering QA.
function fixture(id='alice',friends={bob:{}}){
  let now=0,frame=null;const storage=new Map(),events={},messages=[],intervals=[];
  const nodes=[];
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.hidden=false;this.attrs={};this.classes=new Set();nodes.push(this);this.classList={add:(...s)=>s.forEach(x=>this.classes.add(x)),remove:(...s)=>s.forEach(x=>this.classes.delete(x)),contains:s=>this.classes.has(s)};}
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
  const load=file=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),sandbox);
  load('oakhaven.js');
  const click=text=>{const b=nodes.findLast(n=>n.tagName==='button'&&n.textContent===text);assert.ok(b,`button ${text}`);b.onclick();return b;};
  return {sandbox,document,storage,messages,intervals,load,click,open:()=>document.querySelector('#hubPlayOakhaven').onclick(),tick:(ms=17)=>{now+=ms;const f=frame;frame=null;f?.(now);},key:(code,type='keydown')=>{const e={code,preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}};for(const f of events[type]||[])f(e);return e;}};
}
test('solo and couch menus, pause/resume, cursor state and close lifecycle',()=>{
  const f=fixture();f.open();f.click('Two-player couch expedition');assert.equal(f.sandbox.oakhavenIsPlaying(),true);assert.ok(f.document.querySelector('#oakRoot').classList.contains('playing'));
  f.key('Escape');assert.equal(f.sandbox.oakhavenIsPlaying(),false);assert.equal(f.document.querySelector('#oakMenu').hidden,false);
  f.click('Resume');f.tick();assert.equal(f.sandbox.oakhavenIsPlaying(),true);f.sandbox.closeOakhaven();assert.equal(f.document.querySelector('#oakRoot').classList.contains('hidden'),true);
});
test('keybind capture saves only non-conflicting keys per account',()=>{
  const f=fixture();f.open();const b=f.click('attack: KeyF');b.onkeydown({code:'KeyQ',preventDefault(){},stopPropagation(){}});
  assert.equal(JSON.parse(f.storage.get('discard-oakhaven-v1-alice')).bindings[0].attack,'KeyQ');
  const conflict=f.click('heavy: KeyG');conflict.onkeydown({code:'KeyQ',preventDefault(){},stopPropagation(){}});assert.equal(JSON.parse(f.storage.get('discard-oakhaven-v1-alice')).bindings[0].heavy,'KeyG');
});
test('two simulated Discard peers invite, accept, exchange input/snapshot and end',()=>{
  const host=fixture('alice',{bob:{}}),guest=fixture('bob',{alice:{}});host.open();const select=host.document.querySelector('#oakMenu').querySelector('select');select.value='bob';host.click('Invite friend (online beta)');
  const invitation=host.messages.find(m=>m.data.t==='oak-invite').data;guest.sandbox.oakhavenHandle('alice',invitation);guest.open();guest.click('Accept invitation');
  const join=guest.messages.find(m=>m.data.t==='oak-join').data;host.sandbox.oakhavenHandle('bob',join);assert.equal(host.sandbox.oakhavenIsPlaying(),true);
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
