/* Ground-up Oakhaven world authoring. Coordinates are meters/blocks, not screen pixels. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hash=(x,z,seed=7)=>{let n=Math.imul(x+seed,374761393)^Math.imul(z+seed*11,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
  const palettes={grass:['#709052','#729154','#6e8e51','#719053','#739354'],path:['#bda572','#bda673','#bca473','#bea675'],water:['#437e87','#487e85','#508991'],stone:['#858b7b','#949583','#7f877a'],earth:['#78634b','#846d50','#685b47'],bridge:['#9d8159','#a98c60']};
  class Map{
    constructor(id,w,h){this.id=id;this.width=w;this.depth=h;this.tiles=Array.from({length:w*h},(_,i)=>({x:i%w,z:Math.floor(i/w),height:0,type:'grass',walk:true}));this.props=[];this.interactables=[];this.encounters=[];this.spawn={x:7,z:10};this.title='';this.seed=id==='camp'?19:31;}
    tile(x,z){x=Math.floor(x);z=Math.floor(z);return x<0||z<0||x>=this.width||z>=this.depth?null:this.tiles[z*this.width+x];}
    rect(x,z,w,h,data){for(let j=z;j<z+h;j++)for(let i=x;i<x+w;i++){const t=this.tile(i,j);if(t)Object.assign(t,data);}return this;}
    line(points,width=2,type='path'){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dist=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let s=0;s<=dist;s+=.3){const x=a[0]+(b[0]-a[0])*s/dist,z=a[1]+(b[1]-a[1])*s/dist;for(let dz=-width;dz<=width;dz++)for(let dx=-width;dx<=width;dx++){const t=this.tile(x+dx,z+dz);if(t&&Math.hypot(t.x+.5-x,t.z+.5-z)<=width&&t.type!=='water')t.type=type;}}}return this;}
    prop(kind,x,z,options={}){const rail=['fence','bridgeRail'].includes(kind);const p={id:this.props.length,kind,x,z,y:this.tile(x,z)?.height||0,rotation:0,solid:rail,radius:.35,...(rail?{w:1.35,d:.12}:{}),...options};this.props.push(p);return p;}
    index(){this.solidProps=this.props.filter(p=>p.solid);this.buckets={};for(const p of this.solidProps){const r=(p.w?Math.max(p.w,p.d)/2:p.radius)+.5;for(let z=Math.floor(p.z-r);z<=p.z+r;z++)for(let x=Math.floor(p.x-r);x<=p.x+r;x++)(this.buckets[x+','+z]||=([])).push(p);}return this;}
    canWalk(x,z,r=.28,fromHeight=null){for(const dx of [-r,r])for(const dz of [-r,r]){const t=this.tile(x+dx,z+dz);if(!t?.walk||(fromHeight!==null&&Math.abs(t.height-fromHeight)>.65))return false;}for(const p of this.buckets?(this.buckets[Math.floor(x)+','+Math.floor(z)]||[]):(this.solidProps||this.props)){if(!p.solid)continue;if(p.w&&Math.abs(x-p.x)<p.w/2+r&&Math.abs(z-p.z)<p.d/2+r)return false;if(!p.w&&Math.hypot(x-p.x,z-p.z)<p.radius+r)return false;}return true;}
    height(x,z){return this.tile(x,z)?.height||0;}
    canTraverse(x,z,tx,tz){const steps=Math.ceil(Math.hypot(tx-x,tz-z)/.12),h=this.height(x,z);for(let i=1;i<=steps;i++)if(!this.canWalk(x+(tx-x)*i/steps,z+(tz-z)*i/steps,.28,h))return false;return true;}
    canOccupyAir(x,z,r,y){const t=this.tile(x,z);if(!t||(!t.walk&&t.type!=='water')||t.height>y+.15)return false;for(const p of this.buckets?(this.buckets[Math.floor(x)+','+Math.floor(z)]||[]):this.props){if(!p.solid)continue;const top=p.y+(['fence','bridgeRail'].includes(p.kind)?.95:p.kind==='tree'?3.7:4);if(y>top)continue;if(p.w?Math.abs(x-p.x)<p.w/2+r&&Math.abs(z-p.z)<p.d/2+r:Math.hypot(x-p.x,z-p.z)<p.radius+r)return false;}return true;}
    lineClear(x,z,tx,tz){const d=Math.hypot(tx-x,tz-z);for(let s=.15;s<d;s+=.15){const q=s/d,px=x+(tx-x)*q,pz=z+(tz-z)*q;for(const p of this.buckets?(this.buckets[Math.floor(px)+','+Math.floor(pz)]||[]):(this.solidProps||this.props))if(p.solid&&(p.w?Math.abs(px-p.x)<p.w/2&&Math.abs(pz-p.z)<p.d/2:Math.hypot(px-p.x,pz-p.z)<p.radius))return false;}return true;}
  }
  function decorate(m){
    for(let z=1;z<m.depth-1;z++)for(let x=1;x<m.width-1;x++){
      const t=m.tile(x,z),n=hash(x,z,m.seed);if(t.type!=='grass'||!t.walk)continue;
      const closeRoad=[[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dz])=>m.tile(x+dx,z+dz)?.type==='path');
      if(!closeRoad&&n>.93&&m.canWalk(x+.5,z+.5,1.1)){m.prop('tree',x+.5,z+.5,{solid:true,radius:.22,scale:.8+hash(z,x)*.5,tone:Math.floor(n*91)%3});}
      else if(n>.7){m.prop(n>.87?'flowers':'grass',x+.3+hash(z,x)*.4,z+.3+hash(x+4,z)*.4,{tone:Math.floor(hash(x,z+9)*5),count:3+Math.floor(n*4)});}
      else if(n<.035&&!closeRoad)m.prop('rock',x+.5,z+.5,{solid:false,scale:.3+n*5});
    }
  }
  function camp(){
    const m=new Map('camp',34,27);m.title='The Forgotten Watchtower';m.spawn={x:10.5,z:15};
    m.rect(0,0,34,2,{height:-.6,walk:false}).rect(0,25,34,2,{height:-.6,walk:false});
    m.rect(2,3,7,7,{height:.45});m.rect(24,2,8,7,{height:.6});
    m.line([[5,19],[10,16],[17,15],[24,14],[31,16]],2.1).line([[17,15],[18,9],[24,6]],1.5);
    m.rect(1,10,4,8,{type:'water',height:-.2,walk:false});m.rect(2,16,5,2,{type:'bridge',height:.05,walk:true});
    m.prop('watchtower',24.5,5,{solid:true,w:4.2,d:4.2});m.prop('house',6.2,5.5,{solid:true,w:4.1,d:3.3,roof:'#9b6d46'});
    m.prop('tent',12.5,10.5,{solid:true,w:2.4,d:2,rotation:.15});m.prop('anvil',15.2,11,{solid:true,radius:.5});
    m.prop('campfire',18,16.8,{solid:true,radius:.4});m.prop('bench',17,18.2,{rotation:Math.PI/2});m.prop('well',7.8,20.7,{solid:true,radius:.8});
    m.prop('cart',26,20.2,{solid:true,w:1.5,d:2.1});m.prop('banner',22.3,10,{tone:0});m.prop('banner',27,9,{tone:0});
    m.prop('banner',29.5,15.5,{tone:0});
    for(let x=5;x<=28;x+=1.5){if(x>9&&x<13)continue;m.prop('fence',x,22,{rotation:0});}
    for(let i=0;i<9;i++)m.prop('flowers',6+i*.8,19.2+Math.sin(i)*.35,{tone:i%3,count:6});
    for(const [x,z] of [[16,12],[21,13],[28,15]])m.prop('lantern',x,z);
    m.interactables=[{id:'garrow',kind:'mentor',x:17,z:14.1,name:'Old Man Garrow'},{id:'map',kind:'mission',x:29.5,z:15.5,name:'The Ashen Road'},{id:'dummy',kind:'dummy',x:20,z:9,name:'Training dummy'}];
    decorate(m);m.props=m.props.filter(p=>p.kind!=='tree'||(Math.hypot(p.x-18,p.z-16.8)>4.5&&!(p.x>17&&p.x<26&&p.z>16&&p.z<25)));return m;
  }
  function forest(){
    const m=new Map('forest',64,48);m.title='The Ashen Road';m.spawn={x:6.5,z:12};
    for(let z=0;z<48;z++)for(let x=0;x<64;x++){const t=m.tile(x,z);if(x<2||z<2||x>61||z>45){t.height=-.8;t.walk=false;}else if(x>48&&z>29)t.height=.5;else if(x<15&&z>28)t.height=.5;}
    m.line([[3,13],[10,13],[17,17],[23,19],[28,21],[34,24],[40,23],[46,28],[51,33],[56,36]],2.1);
    m.line([[19,18],[20,10],[27,8]],1.25).line([[34,24],[35,32],[42,35]],1.4);
    m.line([[34,24],[39,20],[43,14],[47,13]],1.4).line([[17,18],[15,25],[15,34],[12,39]],1.3);
    for(let z=3;z<43;z++){const x=25+Math.floor(Math.sin(z*.18)*2);m.rect(x,z,3,1,{height:-.32,type:'water',walk:false});}
    m.rect(23,19,8,3,{type:'bridge',height:.06,walk:true});
    m.prop('house',7,7.7,{solid:true,w:4.2,d:3.5,roof:'#a17b4d'});m.prop('house',14.5,10,{solid:true,w:3.4,d:3,roof:'#796448'});
    m.prop('well',11,7.4,{solid:true,radius:.65});m.prop('cart',18.7,16,{solid:true,w:1.5,d:2});
    m.prop('house',11,31,{solid:true,w:3.4,d:2.8,roof:'#60765d'});m.prop('house',18,36,{solid:true,w:3.6,d:3,roof:'#8a7451'});m.prop('lantern',14,33);m.prop('well',12,35.5,{solid:true,radius:.7});m.prop('ruinArch',12,40);
    for(let i=0;i<8;i++)m.prop('rock',44+(i%4)*1.2,9+Math.floor(i/4)*1.6,{scale:1.1+(i%3)*.25});m.prop('cart',48,12,{solid:true,w:1.5,d:2});m.prop('banner',45,15,{tone:0});
    for(let x=4;x<19;x+=1.3){m.prop('fence',x,10.6);if(x<15)m.prop('fence',x,17.6);}
    for(const z of [19.1,21.9])for(let x=23.5;x<30;x+=1.5)m.prop('bridgeRail',x,z);
    m.prop('tent',34,17.7,{solid:true,w:2.8,d:2.3,rotation:.2});m.prop('tent',39,18.2,{solid:true,w:2.6,d:2.1,rotation:-.2});
    m.prop('campfire',36,20,{solid:true,radius:.5});m.prop('cart',42.5,25,{solid:true,w:1.6,d:2});
    for(const [x,z] of [[19,9],[33,22],[43,22],[49,30],[57,30]])m.prop('lantern',x,z);
    for(const [x,z] of [[30,27],[36,28],[41,25]])m.prop('cage',x,z);
    m.prop('ruinArch',51,32,{solid:false});m.prop('banner',49.5,32,{tone:1});m.prop('banner',58.5,34,{tone:1});
    for(let i=0;i<13;i++){const a=i*Math.PI*2/13;m.prop('ruin',56+Math.cos(a)*5,37+Math.sin(a)*4,{height:1+hash(i,3)*1.5,solid:true,radius:.4,rotation:a});}
    m.rect(52,34,8,7,{type:'stone'});m.line([[51,33],[54,35],[56,37]],1.7,'stone');
    m.interactables=[
      {id:'chest1',kind:'chest',x:22,z:8,name:'Lost knight’s chest',item:'garrow'},
      {id:'cage1',kind:'cage',x:30,z:27,name:'Rescue the miller'},
      {id:'cage2',kind:'cage',x:36,z:28,name:'Rescue the smith'},
      {id:'cage3',kind:'cage',x:41,z:25,name:'Rescue the scout'},
      {id:'chest2',kind:'chest',x:43,z:35,name:'Abandoned armory',item:'cragbreaker'},
      {id:'chest3',kind:'chest',x:46,z:13,name:'Quarry pay chest',item:'craghelm'},
      {id:'chest4',kind:'chest',x:15,z:35,name:'Mirewalker’s cache',item:'mireboots'},
      {id:'chest5',kind:'chest',x:12,z:39,name:'The Veil’s lost compass',item:'veilcharm'},
      {id:'exit',kind:'exit',x:58,z:39,name:'Return to the Watchtower'}
    ];
    m.encounters=[
      {group:'orchard',units:[['soldier',15,14],['boar',18,18],['archer',20,16],['soldier',20,12]]},
      {group:'crossing',units:[['soldier',30,22],['brute',35,24],['archer',38,22],['hound',32,26],['soldier',40,26]]},
      {group:'ridge',units:[['archer',47,30],['soldier',48,34],['hound',46,33]]},
      {group:'quarry',units:[['soldier',44,14],['archer',47,15],['brute',46,11]]},
      {group:'mire',units:[['hound',14,30],['boar',17,33],['soldier',11,37]]},
      {group:'boss',units:[['huntsman',56,37]]}
    ];
    decorate(m);m.props=m.props.filter(p=>!['tree','rock'].includes(p.kind)||!m.interactables.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<1.8));return m;
  }
  function prologue(){const m=new Map('prologue',34,30);m.title='Oakhaven · Before the Ash';m.spawn={x:16,z:16};m.line([[3,18],[12,17],[19,17],[28,11]],2.5).line([[15,17],[16,8]],1.5);for(const [x,z,w,d,roof]of[[7,11,4.5,3.5,'#b18a4e'],[17,8,4.1,3.6,'#aa7d47'],[26,9,4.4,3.5,'#8f6e47'],[28,27,4,3.3,'#9b754c']])m.prop('house',x,z,{w,d,roof});m.prop('well',12,12,{solid:false});m.prop('cart',29,22,{solid:false});for(let x=3;x<29;x+=1.4){if(x>13&&x<19)continue;m.prop('fence',x,21.5);}for(const [x,z]of[[11,18],[20,14],[26,16]])m.prop('lantern',x,z);decorate(m);m.props=m.props.filter(p=>p.kind!=='tree'||!(p.x>10&&p.x<27&&p.z>11&&p.z<24));return m;}

  const travelPoints=[{id:'watchtower',map:'camp',name:'Watchtower Waystone',x:12,z:19},{id:'road',map:'forest',name:'Oakhaven Gate',x:8.5,z:13.5},{id:'orchard',map:'forest',name:'Orchard Shrine',x:19.5,z:18.5},{id:'mill',map:'forest',name:'Miller’s Stone',x:34,z:25},{id:'ridge',map:'forest',name:'Sanctuary Beacon',x:49,z:32}];
  const railStations=travelPoints; // Save/input compatibility for existing worlds.
  function waystones(m){m.stations=travelPoints.filter(s=>s.map===m.id);for(const q of m.stations){m.interactables.push({...q,kind:'station'});m.prop('waystone',q.x,q.z,{name:q.name});}if(m.id==='camp')m.line([[12,19],[14,17],[17,15]],1.1);}
  function borders(m){for(const t of m.tiles)if(t.x===0||t.z===0||t.x===m.width-1||t.z===m.depth-1)t.walk=false;const add=(x,z,rotation)=>{if(m.tile(x,z)?.type==='water')return;m.prop('borderWall',x,z,{rotation,height:m.id==='camp'?1.05:.8});};for(let x=1;x<m.width-1;x+=1.5){add(x,.65,0);add(x,m.depth-.65,0);}for(let z=1;z<m.depth-1;z+=1.5){add(.65,z,Math.PI/2);add(m.width-.65,z,Math.PI/2);}}
  function chapterWorld(m,chapter,mission=0){
    const themes=[
      {title:'The Ashen Road',seed:31},
      {title:'The Howling Mire',seed:43},
      {title:'The Iron Crags',seed:59},
      {title:'The Whispering Veil',seed:71},
      {title:'The Obsidian Citadel',seed:83}
    ];
    const theme=themes[chapter]||themes[0];
    m.title=theme.title;
    m.seed=theme.seed;
    if(!chapter)return m;
    // Retain the tested navigation graph, but each region gains its own landmarks, ground, encounters and hazards.
    for(const tile of m.tiles){
      if(!tile.walk||tile.type==='bridge'||tile.type==='water')continue;
      const n=hash(tile.x,tile.z,theme.seed);
      if(chapter===1&&tile.type==='grass'&&n<.32)tile.type='earth';
      if(chapter===2&&tile.type==='grass'&&n<.46)tile.type='stone';
      if(chapter===3&&tile.type==='grass'&&n<.27)tile.type='earth';
      if(chapter===4&&tile.type==='grass'&&n<.64)tile.type='stone';
    }
    if(chapter===1){for(const [x,z]of [[13,27],[18,32],[36,13],[43,37]])m.prop('tent',x,z,{solid:false,rotation:.3});}
    if(chapter===2){for(const [x,z]of [[12,27],[21,35],[43,9],[49,25]])m.prop('ruinArch',x,z,{solid:false});}
    if(chapter===3){for(const [x,z]of [[10,29],[20,9],[40,32],[51,22]])m.prop('ruin',x,z,{solid:false,rotation:.2});}
    if(chapter===4){for(const [x,z]of [[17,8],[36,11],[46,36],[56,28]])m.prop('banner',x,z,{tone:1});}
    if(mission>0){
      // Mission variants alter patrols and landmarks without invalidating paths in older saves.
      const encounter=m.encounters.find(e=>e.group=== (mission===1?'crossing':'ridge'));
      if(encounter)encounter.units.push([chapter===2?'brute':chapter===3?'archer':'hound',mission===1?33:48,mission===1?22:31]);
      for(const [x,z] of (mission===1?[[31,17],[38,30]]:[[47,21],[54,29]])){
        m.prop(chapter===2?'ruinArch':chapter===4?'banner':'tent',x,z,{solid:false,rotation:mission*.4});
      }
      m.title+=' · '+(mission+1);
    }
    const tasks=[
      [],
      [['Supply wagon','Marauder provisions','Explosive powder'],['Gator tracks','Infected nest','The beast’s trail'],['Trapper’s snare','Rolling-log trap','Fortress gate']],
      [['Captive blacksmith','Forge shackles','Smithing supplies'],['Bridge barricade','Enemy signal fire','Bridge explosives'],['Stone bastion lock','Powder cache','Siege breach']],
      [['Lookout report','Spy signal beacon','Scout hideout'],['Antidote ingredients','Toxic vent','Alchemical formula'],['Hidden passage','Illusion mirror','Poisoned dagger stash']],
      [['City gate supplies','Siege banner','Duke’s signal flare'],['The final seal','Captive family','Obsidian war banner']]
    ];
    if(chapter>0){
      const names=tasks[chapter][mission]||tasks[chapter][0];
      m.interactables.filter(q=>q.kind==='cage').forEach((q,i)=>{q.name=names[i];q.kind='task';});
    }
    const boss=m.encounters.find(e=>e.group==='boss');
    if(boss)boss.units=chapter===2?[['brute',56,37]]:chapter===4?[['huntsman',56,37],['soldier',53,35],['archer',59,38]]:chapter===3?[['huntsman',56,37],['hound',53,35]]:boss.units;
    if(chapter===1)m.encounters.find(e=>e.group==='orchard').units.push(['hound',14,18]);
    if(chapter===2)m.encounters.find(e=>e.group==='ridge').units.push(['brute',50,30]);
    if(chapter===3)m.encounters.find(e=>e.group==='quarry').units.push(['archer',42,15]);
    if(chapter===4)m.encounters.find(e=>e.group==='crossing').units.push(['brute',38,26]);
    return m;
  }
  function build(id,chapter=0,mission=0){const m=id==='forest'?chapterWorld(forest(),chapter,mission):id==='prologue'?prologue():camp();if(['camp','forest'].includes(id)){waystones(m);borders(m);}const avoid=[m.spawn,...m.interactables,...m.encounters.flatMap(e=>e.units.map(q=>({x:q[1],z:q[2]})))];m.props=m.props.filter(p=>p.kind!=='tree'||!avoid.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<1.4));return m.index();}
  function pathfind(m,sx,sz,tx,tz){
    const start=m.tile(sx,sz),goal=m.tile(tx,tz);if(!start||!goal||!m.canWalk(goal.x+.5,goal.z+.5))return[];
    const key=(x,z)=>z*m.width+x,source=key(start.x,start.z),target=key(goal.x,goal.z),cost=new Float32Array(m.width*m.depth).fill(Infinity),parent=new Int32Array(cost.length).fill(-1),open=[{k:source,x:start.x,z:start.z,f:0}],seen=new Uint8Array(cost.length);cost[source]=0;
    const push=v=>{open.push(v);let i=open.length-1;while(i>0){const p=(i-1)>>1;if(open[p].f<=v.f)break;open[i]=open[p];i=p;}open[i]=v;};
    const pop=()=>{const first=open[0],last=open.pop();if(open.length){let i=0;while(i*2+1<open.length){let c=i*2+1;if(c+1<open.length&&open[c+1].f<open[c].f)c++;if(open[c].f>=last.f)break;open[i]=open[c];i=c;}open[i]=last;}return first;};
    let count=0;while(open.length&&count++<m.width*m.depth*2){const p=pop();if(seen[p.k])continue;seen[p.k]=1;if(p.k===target){const result=[];let k=target;while(k!==source&&k>=0){result.push({x:k%m.width+.5,z:Math.floor(k/m.width)+.5});k=parent[k];}return result.reverse();}
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=p.x+dx,z=p.z+dz,t=m.tile(x,z);if(!t||!m.canWalk(x+.5,z+.5,.28,m.tile(p.x,p.z).height))continue;if(dx&&dz&&(!m.canWalk(p.x+dx+.5,p.z+.5)||!m.canWalk(p.x+.5,p.z+dz+.5)))continue;if(!m.canTraverse(p.x+.5,p.z+.5,x+.5,z+.5))continue;const k=key(x,z),g=cost[p.k]+(dx&&dz?1.414:1);if(g>=cost[k])continue;cost[k]=g;parent[k]=p.k;push({k,x,z,f:g+Math.hypot(goal.x-x,goal.z-z)});}
    }return[];
  }
  const api={Map,build,pathfind,hash,palettes,clamp,railStations,travelPoints};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OakhavenWorld=api;
})(typeof globalThis!=='undefined'?globalThis:this);
