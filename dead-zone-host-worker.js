/* The match runs here, independently of the host tab's rendering and focus. */
'use strict';
self.window=self;
self.__DEAD_ZONE_WORKER__=true;
self.localStorage={getItem:()=>null,setItem:()=>{}};
self.connectTo=()=>{};
self.sendTo=(to,packet)=>{postMessage({type:'network',to,packet});return true;};
self.deadZoneHostFrame=packet=>postMessage({type:'view',packet});
self.deadZoneHostSave=world=>postMessage({type:'checkpoint',world,save:true});
self.onmessage=({data})=>{
 if(data.type==='init'){
  self.currentUser={id:data.host};self.state={friends:Object.fromEntries(data.players.map(id=>[id,{}]))};
  self.viewPerson=id=>({displayName:data.names[id]||'Survivor'});
  importScripts('dead-zone-net.js?v=2.0.1','dead-zone.js?v=6.5.0');
  self.deadZoneWorker.initialize(data);
  setInterval(()=>postMessage({type:'checkpoint',world:self.deadZoneWorker.getWorld()}),1000);
 }else if(data.type==='packet')self.deadZoneHandle(data.from,data.packet);
 else if(data.type==='input')self.deadZoneWorker.input(data.commands,data.epoch);
 else if(data.type==='equip')self.deadZoneWorker.equip(data.id,data.slot,data.hand);
 else if(data.type==='swap')self.deadZoneWorker.swap(data.id,data.hand);
 else if(data.type==='drop')self.deadZoneWorker.drop(data.id,data.request);
 else if(data.type==='verity')self.deadZoneWorker.verity(data.id,data.request);
 else if(data.type==='merge')self.deadZoneWorker.merge(data.id,data.request);
 else if(data.type==='evolve')self.deadZoneWorker.evolve(data.id,data.request);
 else if(data.type==='pause')self.deadZoneWorker.setPaused(data.paused);
 else if(data.type==='save')self.deadZoneHostSave(self.deadZoneWorker.getWorld());
};
