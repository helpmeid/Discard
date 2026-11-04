// DOM/clock/peer adapters only. This fixture is not a browser, WebGL driver or real WebRTC test.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const E=require('../oakhaven-engine.js');
module.exports=function fixture(id='alice',friends={bob:{}}){
  let now=0,frame=null;const nodes=[],storage=new Map(),events={},messages=[],intervals=[];
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.textContent='';this.hidden=false;this.attrs={};this.classes=new Set();nodes.push(this);this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),contains:v=>this.classes.has(v)};}
    set className(v){this.classes=new Set(v.split(' '));}get className(){return [...this.classes].join(' ');}
    setAttribute(k,v){this.attrs[k]=v;}append(...children){for(const c of children){c.parentElement=this;this.children.push(c);}}replaceChildren(...c){this.children=[];this.append(...c);}
    querySelectorAll(s){const tags=s.toUpperCase().split(',');return this.children.flatMap(n=>[...(tags.includes(n.tagName)?[n]:[]),...n.querySelectorAll(s)]);}querySelector(s){return this.querySelectorAll(s)[0];}
    addEventListener(k,f){this['on'+k]=f;}focus(){document.activeElement=this;}click(){if(!this.disabled)this.onclick?.();}get options(){return this.children;}
    getClientRects(){for(let p=this;p;p=p.parentElement)if(p.hidden)return[];return[{}];}getContext(){return new Proxy({},{get:()=>()=>{}});}
  }
  const document={hidden:false,activeElement:null,hasFocus:()=>true,head:new Element('head'),body:new Element('body'),createElement:t=>new Element(t),getElementById:id=>nodes.find(n=>n.id===id),querySelector:s=>s[0]==='#'?nodes.find(n=>n.id===s.slice(1)):null,addEventListener:(k,f)=>(events[k]||=[]).push(f)};
  for(const id of ['gamesHub','hubPlayOakhaven','oakInviteStatus']){const n=new Element('button');n.id=id;document.body.append(n);}
  const sandbox={document,currentUser:{id},state:{friends},OakhavenEngine:E,console,performance:{now:()=>now},crypto:{randomUUID:()=>id+'-party'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},matchMedia:()=>({matches:false}),connectTo:()=>{},sendTo:(to,data)=>{messages.push({to,data:structuredClone(data)});return true;},viewPerson:id=>({displayName:id}),ownsAccountSession:()=>true,requestAnimationFrame:f=>{frame=f;return 1;},cancelAnimationFrame:()=>{frame=null;},setInterval:(f,ms)=>intervals.push({f,ms}),OakhavenArt:['data:image/jpeg;base64,fixture']};
  sandbox.window=sandbox;sandbox.addEventListener=(k,f)=>(events[k]||=[]).push(f);sandbox.OakhavenRenderer={create:()=>({render:s=>{sandbox.rendered=s;return{};},project:()=>({x:.5,y:.5}),ground:()=>({x:18,z:14}),pick:()=>sandbox.pick||({type:'move',x:18,z:14}),dispose:()=>{}})};vm.createContext(sandbox);
  const load=file=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),sandbox);load('oakhaven-game.js');
  const click=text=>{const n=document.querySelector('#oakMenu')?.querySelectorAll('button').find(n=>n.textContent===text);assert.ok(n,'button '+text);n.click();return n;};
  const tick=(ms=17)=>{now+=ms;const f=frame;frame=null;f?.(now);};
  const key=(code,type='keydown',extra={})=>{const e={code,preventDefault(){},stopImmediatePropagation(){},...extra};for(const f of events[type]||[])f(e);};
  const open=()=>document.querySelector('#hubPlayOakhaven').onclick();
  const begin=(couch=false)=>{open();click(couch?'Couch co-op · 2 players':'Begin story');tick();key('KeyE');tick(34);key('KeyE','keyup');tick();return sandbox.rendered;};
  return{sandbox,document,storage,messages,intervals,load,click,tick,key,open,begin};
};
