const {test}=require('node:test');const assert=require('node:assert/strict');
const N=require('../dead-zone-net.js');
const free=(p,x,y)=>{p.x+=x;p.y+=y;};
const survivor=()=>({x:100,y:100,vx:0,vy:0,hp:100,stamina:100,energy:1,exhausted:false});
test('prediction reconciles exact commands under latency, jitter, loss and reordering',()=>{
 const server=survivor(),client=new N.Prediction(free),host=new N.HostInputs();client.seed(server);
 const packets=[];let worst=0,dropped=0,maxPending=0;
 for(let frame=0;frame<900;frame++){
  const input=frame<600?{x:frame%180<90?1:-1,y:frame%240<120?.4:-.4,sprint:true,ax:1000,ay:700}:{};
  client.step(input);maxPending=Math.max(maxPending,client.pending.length);
  if(frame%3===0){if(frame%21===0){dropped++;}else packets.push({at:frame+6+(frame%5),type:'input',data:client.packet()});}
  const due=packets.filter(p=>p.at<=frame).reverse();for(const packet of due){packets.splice(packets.indexOf(packet),1);if(packet.type==='input')host.receive(packet.data,frame*N.STEP*1000);else{client.reconcile(packet.data.p,packet.data.ack);worst=Math.max(worst,client.lastError);}}
  const a=host.consume(N.STEP,frame*N.STEP*1000);for(const c of a._steps)N.stepMovement(server,c.input,free);
  if(frame%3===0&&frame%27!==0)packets.push({at:frame+6+(frame%7),type:'state',data:{ack:host.ack,p:{...server}}});
 }
 assert.ok(dropped>20);assert.ok(maxPending<40);assert.ok(worst<1e-8,'Reconciliation introduced movement error: '+worst);
 assert.ok(host.ack>875);assert.ok(client.pending.length<30);
});
test('host deduplicates retransmissions, waits for gaps, and consumes actions once',()=>{
 const host=new N.HostInputs(),one={seq:1,input:N.cleanInput({door:true,x:1})},two={seq:2,input:N.cleanInput({x:1})};
 host.receive([N.packCommand(two)],0);assert.equal(host.consume(N.STEP,1)._steps.length,0);
 host.receive([N.packCommand(one),N.packCommand(two)],2);const a=host.consume(N.STEP,3);assert.equal(a._steps.length,2);assert.equal(a.door,true);assert.equal(host.ack,2);
 host.receive([N.packCommand(one)],4);assert.equal(host.consume(N.STEP,5).door,false);assert.equal(host.queue.size,0);
 assert.equal(host.consume(N.STEP,1000).fire,false);
});
test('host rejects invalid commands and bounds simulation credit and memory',()=>{
 const host=new N.HostInputs();host.receive([[Infinity,0,0,0,0,0,0],[99999,0,0,0,0,0,0]],0);assert.equal(host.queue.size,0);
 const batch=Array.from({length:120},(_,i)=>N.packCommand({seq:i+1,input:N.cleanInput({x:1})}));host.receive(batch,0);
 for(let i=0;i<10;i++)assert.ok(host.consume(N.STEP,i)._steps.length<=2);assert.ok(host.ack<=10);
 assert.equal(host.receive(Array(121).fill(batch[0]),0),false);
});
test('prediction keeps collision, stamina, energy and release behavior deterministic',()=>{
 const wall=(p,x,y)=>{p.x=Math.min(150,p.x+x);p.y+=y;},p=survivor(),client=new N.Prediction(wall);client.seed(p);
 const commands=[];for(let i=0;i<300;i++)commands.push(client.step({x:1,sprint:true}));for(const c of commands.filter(Boolean))N.stepMovement(p,c.input,wall);
 assert.ok(client.state.x<=150);assert.equal(client.pending.length,120,'bounded history stops prediction instead of discarding unacknowledged input');
 client.reconcile(p,120);assert.ok(client.lastError<1e-8);assert.equal(client.pending.length,0);
 const stopped={...p};for(let i=0;i<60;i++){client.step({});N.stepMovement(stopped,{},wall);}assert.ok(Math.abs(client.state.x-stopped.x)<1e-8);assert.ok(Math.abs(client.state.vx)<.001);
});
test('snapshot interpolation uses server time and freezes bounded extrapolation during outages',()=>{
 const buffer=new N.SnapshotBuffer();const entry=x=>new Map([['p:other',{x,y:10,face:0,hp:100}]]);
 buffer.push(1,entry(100),1000);buffer.push(1.05,entry(105),1050);buffer.push(1.1,entry(110),1100);
 const v=buffer.sample(1125).get('p:other');assert.ok(v.x>100&&v.x<110);
 assert.equal(buffer.push(1.05,entry(999),1200),false);
 assert.ok(buffer.sample(5000).get('p:other').x<=115.0001);
 buffer.push(5,entry(1000),5000);assert.equal(buffer.sample(5100).get('p:other').x,1000,'teleports snap instead of sliding through walls');
});
test('realtime transport uses unordered non-retransmitting data and drops congestion',()=>{
 const channels=[],received=[];let connection={peerConnection:{createDataChannel(label,options){const c={readyState:'open',bufferedAmount:0,sent:[],send(p){this.sent.push(p);},close(){this.readyState='closed';},options,label};channels.push(c);return c;}}};
 let allowed=true;const t=new N.RealtimeTransport({getConnection:()=>connection,allowed:()=>allowed,receive:(id,p)=>received.push(p),clock:()=>2000});
 const p={v:1,z:'deadzone',t:'dz-state',id:'game'};assert.equal(t.send('guest',p),true);const c=channels[0];
 assert.deepEqual(c.options,{negotiated:true,id:42,ordered:false,maxRetransmits:0});assert.equal(c.sent.length,1);
 c.bufferedAmount=9000;t.send('guest',p);assert.equal(c.sent.length,1);
 c.onmessage({data:JSON.stringify(p)});assert.equal(received.length,1);allowed=false;c.onmessage({data:JSON.stringify(p)});assert.equal(received.length,1);
 allowed=true;c.onmessage({data:JSON.stringify({...p,t:'dz-chat'})});assert.equal(received.length,1);t.close('guest');assert.equal(c.readyState,'closed');
});
