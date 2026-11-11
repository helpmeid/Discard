/* Dead Zone multiplayer protocol 2. Pure simulation helpers are also used by tests. */
(function(root){
'use strict';
const STEP=1/60,MAX_PENDING=120;
const finite=(n,min,max)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:0));
function cleanInput(a={}){return{x:finite(a.x,-1,1),y:finite(a.y,-1,1),ax:finite(a.ax,0,3600),ay:finite(a.ay,0,2600),sprint:!!a.sprint,fire:!!a.fire,use:!!a.use,mint:!!a.mint,door:!!a.door,board:!!a.board,repair:!!a.repair,barrier:!!a.barrier,sandevistan:!!a.sandevistan,swap:a.swap===1||a.swap===2?a.swap:0};}
function packCommand(c){const a=c.input;return[c.seq,a.x,a.y,(a.sprint?1:0)|(a.fire?2:0)|(a.use?4:0)|(a.mint?8:0)|(a.door?16:0)|(a.board?32:0)|(a.repair?64:0)|(a.barrier?128:0)|(a.sandevistan?256:0),Math.round(a.ax),Math.round(a.ay),a.swap];}
function unpackCommand(c){if(!Array.isArray(c)||c.length!==7||!c.every(Number.isFinite)||!Number.isSafeInteger(c[0])||c[0]<1)return null;return{seq:c[0],input:cleanInput({x:c[1],y:c[2],sprint:c[3]&1,fire:c[3]&2,use:c[3]&4,mint:c[3]&8,door:c[3]&16,board:c[3]&32,repair:c[3]&64,barrier:c[3]&128,sandevistan:c[3]&256,ax:c[4],ay:c[5],swap:c[6]})};}
// The exact same integrator runs once per acknowledged command on both machines.
function stepMovement(p,a,move,dt=STEP){
 if(p.hp<=0)return;
 dt*=Math.max(.1,Math.min(1,p.timeScale??1));
 if((p.stamina??100)<=1)p.exhausted=true;if(p.stamina>=25)p.exhausted=false;
 if((p.energy||0)>0&&(p.stamina??100)<30){p.energy--;p.stamina=Math.min(100,p.stamina+75);p.exhausted=false;}
 const dx=finite(a.x,-1,1),dy=finite(a.y,-1,1),len=Math.max(1,Math.hypot(dx,dy));
 const sprint=!!a.sprint&&Math.hypot(dx,dy)>.1&&!p.exhausted&&(p.stamina??100)>1,speed=(sprint?245:112)*(p.sandyBoost?2.15:1),accel=p.sandyBoost?23:(sprint?10:15);
 p.stamina=Math.max(0,Math.min(100,(p.stamina??100)+(p.sandyBoost?30:(sprint?-27:18))*dt));
 p.vx=(p.vx||0)+(dx/len*speed-(p.vx||0))*Math.min(1,dt*accel);p.vy=(p.vy||0)+(dy/len*speed-(p.vy||0))*Math.min(1,dt*accel);
 move(p,p.vx*dt,p.vy*dt);
 if(Number.isFinite(a.ax)&&Number.isFinite(a.ay))p.face=Math.atan2(a.ay-p.y,a.ax-p.x);
}
class HostInputs{
 constructor(){this.ack=0;this.queue=new Map();this.last=cleanInput();this.credit=0;this.lastPacket=-Infinity;}
 receive(batch,now){if(!Array.isArray(batch)||batch.length>MAX_PENDING)return false;let valid=false;for(const packed of batch){const c=unpackCommand(packed);if(c&&c.seq>this.ack&&c.seq<=this.ack+MAX_PENDING){this.queue.set(c.seq,c);valid=true;}}if(valid)this.lastPacket=now;return valid;}
 consume(dt,now){
  this.credit=Math.min(6,this.credit+dt/STEP);const steps=[];let firePressed=false;const edges={mint:false,door:false,board:false,repair:false,barrier:false,sandevistan:false,swap:0};
  while(steps.length<2&&this.credit>=1-1e-6){const c=this.queue.get(this.ack+1);if(!c)break;this.queue.delete(c.seq);firePressed||=c.input.fire&&!this.last.fire;this.last=c.input;this.ack=c.seq;steps.push(c);this.credit-=1;for(const k of Object.keys(edges))edges[k]=c.input[k]||edges[k];}
  const held=now-this.lastPacket>600?cleanInput():this.last;
  return{...held,...edges,_network:true,_steps:steps,_firePressed:firePressed};
 }
}
class Prediction{
 constructor(move){this.move=move;this.reset();}
 reset(){this.seq=0;this.pending=[];this.state=null;this.errorX=0;this.errorY=0;this.ack=0;this.lastError=0;}
 seed(p){this.state={...p};}
 step(a){if(!this.state||this.pending.length>=MAX_PENDING)return null;const c={seq:++this.seq,input:cleanInput(a)};this.pending.push(c);stepMovement(this.state,c.input,this.move);return c;}
 reconcile(p,ack){
  if(!Number.isSafeInteger(ack)||ack<this.ack||ack>this.seq)return false;
  this.pending=this.pending.filter(c=>c.seq>ack);const before=this.state;this.state={...p};for(const c of this.pending)stepMovement(this.state,c.input,this.move);
  this.lastError=before?Math.hypot(before.x-this.state.x,before.y-this.state.y):0;
  if(before&&this.lastError<100&&p.hp>0){this.errorX+=(before.x-this.state.x);this.errorY+=(before.y-this.state.y);}else this.errorX=this.errorY=0;
  this.ack=ack;return true;
 }
 visual(dt){if(!this.state)return null;const decay=Math.exp(-dt*18);this.errorX*=decay;this.errorY*=decay;return{...this.state,x:this.state.x+this.errorX,y:this.state.y+this.errorY};}
 packet(){return this.pending.map(packCommand);}
}
const angle=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
class SnapshotBuffer{
 constructor(){this.reset();}
 reset(){this.samples=[];this.delay=.1;this.renderTime=-Infinity;this.jitter=0;}
 push(time,entities,now){const last=this.samples.at(-1);if(last&&time<=last.time)return false;if(last){const variance=Math.abs((now-last.at)/1000-(time-last.time));this.jitter=this.jitter*.9+variance*.1;this.delay=Math.min(.2,Math.max(.1,.075+this.jitter*2));}this.samples.push({time,entities,at:now});if(this.samples.length>32)this.samples.shift();return true;}
 sample(now){
  const latest=this.samples.at(-1);if(!latest)return new Map();
  this.renderTime=Math.max(this.renderTime,latest.time+Math.min(.2,Math.max(0,(now-latest.at)/1000))-this.delay);
  const target=Math.min(latest.time+.05,this.renderTime);let a=this.samples[0],b=latest;
  for(let i=1;i<this.samples.length;i++){b=this.samples[i];if(b.time>=target)break;a=b;}
  if(target>=latest.time){a=this.samples.at(-2)||latest;b=latest;}
  const t=a===b?1:Math.min(2,Math.max(0,(target-a.time)/(b.time-a.time))),result=new Map();
  for(const [id,to]of b.entities){const from=a.entities.get(id)||to;const snap=to.hp<=0||Math.hypot(to.x-from.x,to.y-from.y)>180;
   result.set(id,{...to,x:snap?to.x:from.x+(to.x-from.x)*t,y:snap?to.y:from.y+(to.y-from.y)*t,face:angle(from.face||0,to.face||0,Math.min(1,t))});}
  return result;
 }
}
// Negotiated channel avoids interfering with PeerJS's own ondatachannel handler.
// Both endpoints reserve ID 42; old snapshots are never retransmitted or queued.
class RealtimeTransport{
 constructor({getConnection,allowed,receive,clock=()=>performance.now()}){Object.assign(this,{getConnection,allowed,receive,clock});this.channels=new Map();this.attempts=new Map();}
 open(id){
  if(!this.allowed(id))return null;const conn=this.getConnection(id),pc=conn?.peerConnection;if(!pc||pc.connectionState==='closed')return null;
  const old=this.channels.get(id);if(old?.pc===pc&&old.channel.readyState!=='closed')return old.channel;
  if(this.clock()-(this.attempts.get(id)??-Infinity)<1000)return null;this.attempts.set(id,this.clock());if(old)old.channel.close();
  try{const channel=pc.createDataChannel('dead-zone-realtime-v2',{negotiated:true,id:42,ordered:false,maxRetransmits:0});const entry={pc,channel};this.channels.set(id,entry);
   channel.onmessage=e=>{if(!this.allowed(id)||this.channels.get(id)!==entry||typeof e.data!=='string'||e.data.length>49152)return;try{const d=JSON.parse(e.data);if(d.v===1&&d.z==='deadzone'&&['dz-input','dz-state'].includes(d.t))this.receive(id,d);}catch{}};
   return channel;
  }catch{return null;}
 }
 send(id,payload){const c=this.open(id);if(!c||c.readyState!=='open')return false;if(c.bufferedAmount>8192)return true;try{const text=JSON.stringify(payload);if(text.length>49152)return false;c.send(text);return true;}catch{return false;}}
 close(id){const entry=this.channels.get(id);this.channels.delete(id);this.attempts.delete(id);try{entry?.channel.close();}catch{}}
}
const api={STEP,MAX_PENDING,cleanInput,packCommand,unpackCommand,stepMovement,HostInputs,Prediction,SnapshotBuffer,RealtimeTransport};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.DeadZoneNet=api;
})(typeof window!=='undefined'?window:globalThis);
