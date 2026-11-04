/* Original low-poly 3D scene. Native WebGL, no engine/CDN/model downloads. */
(function(root){
  'use strict';
  const norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
  function camera(eye,target,aspect,span){
    const z=norm(eye.map((x,i)=>x-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);
    const view=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
    const sx=1/(span*aspect),sy=1/span,sz=-2/180;
    return view.map((v,i)=>v*([sx,sy,sz,1][i%4])).map((v,i)=>i===14?v-1:v);
  }
  const rgb=c=>typeof c==='string'?[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255):c;
  class Mesh{
    constructor(){this.data=[];}
    tri(a,b,c,color){const n=norm(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i]))),light=.52+Math.max(0,dot(n,norm([-.6,1,.4])))*.48,co=rgb(color);for(const p of [a,b,c])this.data.push(...p,...co.map(v=>v*light));}
    box(x,y,z,w,h,d,c,angle=0){
      const co=Math.cos(angle),si=Math.sin(angle),p=[];
      for(const [a,b,e] of [[-1,0,-1],[1,0,-1],[1,1,-1],[-1,1,-1],[-1,0,1],[1,0,1],[1,1,1],[-1,1,1]])p.push([x+a*w/2*co+e*d/2*si,y+b*h,z-a*w/2*si+e*d/2*co]);
      for(const [a,b,e,f] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){this.tri(p[a],p[b],p[e],c);this.tri(p[a],p[e],p[f],c);}
    }
    cone(x,y,z,r,h,c,sides=8,r2=0){for(let i=0;i<sides;i++){const a=i*2*Math.PI/sides,b=(i+1)*2*Math.PI/sides,p=[x+Math.cos(a)*r,y,z+Math.sin(a)*r],q=[x+Math.cos(b)*r,y,z+Math.sin(b)*r],u=[x+Math.cos(a)*r2,y+h,z+Math.sin(a)*r2],v=[x+Math.cos(b)*r2,y+h,z+Math.sin(b)*r2];this.tri(p,u,q,c);this.tri(q,u,v,c);this.tri([x,y+h,z],v,u,c);}}
    sphere(x,y,z,r,c,sx=1,sy=1,sz=1){
      const point=(a,b)=>[x+Math.sin(a)*Math.cos(b)*r*sx,y+Math.cos(a)*r*sy,z+Math.sin(a)*Math.sin(b)*r*sz];
      const rings=r>.7?3:5,sides=r>.7?6:8;for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const a=j*Math.PI/rings,b=(j+1)*Math.PI/rings,u=i*Math.PI*2/sides,v=(i+1)*Math.PI*2/sides;this.tri(point(a,u),point(b,v),point(b,u),c);this.tri(point(a,u),point(a,v),point(b,v),c);}
    }
    ring(x,y,z,r,c,start=0,end=Math.PI*2,width=.07){for(let a=start;a<end;a+=.16){const b=Math.min(a+.16,end),p=t=>[x+Math.cos(t)*r,y,z+Math.sin(t)*r],q=t=>[x+Math.cos(t)*(r+width),y,z+Math.sin(t)*(r+width)];this.tri(p(a),q(a),p(b),c);this.tri(p(b),q(a),q(b),c);}}
    bone(a,b,r,c){const d=norm(b.map((v,i)=>v-a[i])),u=norm(cross(d,Math.abs(d[1])>.9?[1,0,0]:[0,1,0])),v=cross(d,u);for(let i=0;i<7;i++){const p=(k,o)=>{const t=k*Math.PI*2/7;return o.map((n,j)=>n+r*(u[j]*Math.cos(t)+v[j]*Math.sin(t)));};this.tri(p(i,a),p(i,b),p(i+1,b),c);this.tri(p(i,a),p(i+1,b),p(i+1,a),c);}}
  }
  function human(m,x,z,a,t,opts={}){
    const begin=m.data.length,scale=opts.child?.64:opts.duke||opts.brute?1.35:1,skin=opts.duke?'#807b8c':'#deb28d',armor=opts.color||'#a3b6bb',cloth=opts.duke?'#742f3d':opts.mentor?'#795a3d':opts.enemy?'#6e4652':'#20656c';
    const p=(dx,y,dz)=>{if(opts.roll){const theta=(1-opts.roll/.22)*Math.PI*2,dy=y-.8;y=.65+dy*Math.cos(theta)-dz*Math.sin(theta);dz=dy*Math.sin(theta)+dz*Math.cos(theta);}return[x+(dx*Math.cos(a)+dz*Math.sin(a))*scale,y*scale,z+(-dx*Math.sin(a)+dz*Math.cos(a))*scale];};
    const box=(dx,y,dz,w,h,d,c,turn=0)=>m.box(...p(dx,y,dz),w*scale,h*scale,d*scale,c,a+turn);
    const gait=opts.walk?Math.sin(t*10)*.25:0,swing=opts.swing?Math.sin((1-opts.swing/(opts.heavy?.3:.24))*Math.PI):0;
    for(const side of [-1,1]){const g=gait*side;box(side*.18,.13,g,.23,.58,.26,'#4e5e68');box(side*.18,.03,.07+g,.27,.18,.38,'#293942');}
    box(0,.69,0,.59,.52,.34,cloth);box(0,.88,.015,.63,.38,.37,armor);box(0,.68,.216,.29,.55,.035,cloth);box(0,.87,.24,.05,.24,.03,'#c9ad6e');box(0,1.02,.24,.18,.04,.03,'#c9ad6e');box(0,.68,.2,.63,.075,.1,'#8e7048');
    for(const side of [-1,1]){const lift=side===1?swing*.25:opts.block?.12:0,reach=side===1?swing*.65:-gait*.25;box(side*.43,.88+lift,reach,.23,.32,.28,armor);box(side*.45,.66+lift,.06+reach,.21,.3,.23,cloth);box(side*.45,.63+lift,.1+reach,.22,.14,.24,skin);}
    // The playable hero is 18: skin-colored chin, visible brown hair, no facial-hair geometry.
    box(0,1.27,0,.46,.5,.43,skin);box(0,1.72,-.025,.49,.13,.46,opts.mentor?'#bcb9a7':'#5a3f31');box(0,1.45,-.205,.49,.3,.07,opts.mentor?'#bcb9a7':'#5a3f31');
    for(const side of [-1,1])box(side*.115,1.55,.222,.065,.065,.025,'#27383a');
    if(opts.enemy||opts.duke){box(0,1.73,0,.54,.16,.49,armor);box(0,1.5,.245,.43,.08,.055,'#273139');}
    else if(!opts.mentor&&!opts.child){box(0,1.79,-.03,.52,.07,.48,armor);box(-.27,1.62,0,.065,.18,.4,armor);box(.27,1.62,0,.065,.18,.4,armor);}
    for(let i=0;i<2;i++){const l=-.32+i*.32,r=l+.32,wave=Math.sin(t*3+i)*.04,topL=p(l,1.2,-.23),topR=p(r,1.2,-.23),bottomL=p(l*1.1,.36,-.32+wave-(opts.walk?.15:0)),bottomR=p(r*1.1,.36,-.32-wave-(opts.walk?.15:0));m.tri(topL,bottomL,bottomR,cloth);m.tri(topL,bottomR,topR,cloth);}
    if(opts.mentor){box(0,1.19,.22,.32,.23,.12,'#c4c1ab');box(-.54,.01,.1,.065,1.6,.065,'#ab8d5f');}
    else if(!opts.child){
      if(opts.bow){box(.46,.67,.34,.06,.85,.08,'#bba072');box(.46,.68,.43,.025,.82,.025,'#dfd2ab');}
      else if(opts.swing){const turn=-1.1+swing*2.2;box(Math.sin(turn)*.6,.86,.55+Math.cos(turn)*.45,.09,.08,1.4,'#e0e2d2',turn);box(.45,.85,.25,.35,.07,.12,'#b69b64');}
      else {box(.49,.7,.18,.085,.88,.09,'#e0e2d2');box(.49,.72,.18,.33,.065,.12,'#b69b64');}
      box(-.51,.61,opts.block?.45:.24,.48,.62,.1,opts.block?'#c5dbcb':'#58808b');box(-.51,.82,opts.block?.51:.30,.13,.15,.04,'#c1a66d');
    }
    if(opts.fallen)for(let i=begin;i<m.data.length;i+=6){const y=m.data[i+1],dz=m.data[i+2]-z;m.data[i+1]=.2+dz*.4;m.data[i+2]=z+y;}
  }
  function beast(m,e,t){const x=e.x/20,z=e.y/20,angle=Math.atan2(e.fx||0,e.fy||1),c=e.flash>0?'#e9d3b1':e.kind==='hound'?'#68736c':'#7b6553';const part=(dx,y,dz,w,h,d,color)=>m.box(x+dx*Math.cos(angle)+dz*Math.sin(angle),y,z-dx*Math.sin(angle)+dz*Math.cos(angle),w,h,d,color,angle);part(0,.28,0,.85,.54,1.2,c);part(0,.45,.65,.61,.44,.5,c);part(0,.42,.96,.5,.22,.2,'#4c3e36');for(const side of [-1,1]){part(side*.21,.84,.56,.14,.23,.18,c);part(side*.21,.66,.92,.06,.06,.03,'#efb56d');if(e.kind!=='hound')part(side*.24,.36,.95,.08,.23,.08,'#d9c99d');for(const dz of [-.38,.38])part(side*.28,.015,dz+Math.sin(t*9+dz*8)*.045,.18,.33,.2,'#3c3934');}}
  function tree(m,x,z,size=1){m.box(x,0,z,.28*size,2.1*size,.28*size,'#6f5940');for(const [dx,y,dz,w,h] of [[0,1.5,0,1.9,1.1],[-.25,2.4,.12,1.55,.8],[.25,3,-.15,1.0,.6]])m.box(x+dx*size,y*size,z+dz*size,w*size,h*size,w*size,y>2.5?'#5b7850':'#3e5f46');}
  function house(m,x,z,a=0){m.box(x,0,z,3,2.1,2.5,'#b6a887',a);m.box(x,0,z,3.12,.25,2.65,'#777a69',a);m.cone(x,2.1,z,2.25,1.25,'#71564c',4);m.box(x,.1,z+1.27,.65,1.3,.06,'#51453a');m.box(x-.85,.9,z+1.28,.5,.6,.07,'#e1b86b');m.box(x+.85,.9,z+1.28,.5,.6,.07,'#e1b86b');m.box(x+1,2.4,z-.3,.5,1.3,.5,'#8b8475');}
  function environment(scene){const m=new Mesh(),hub=scene==='hub',village=scene==='village',w=hub||village?32:64,d=hub||village?18:40;
    m.box(w/2,-.65,d/2,w+.6,.65,d+.6,scene==='village'?'#5b7050':'#465d4b');m.box(w/2,-1.2,d/2,w+.5,.55,d+.5,'#393e39');
    // Winding walkable trail, shrubs, scattered stone slabs and trees.
    const points=hub||village?[[4,10],[10,10],[16,10],[22,10],[28,10]]:[[5,10],[12,12],[20,16],[28,18],[36,18],[44,23],[52,29],[58,33]];
    for(let i=0;i<points.length-1;i++){const [x,z]=points[i],[u,v]=points[i+1],dist=Math.hypot(u-x,v-z);for(let j=0;j<=dist;j+=1.1){const q=j/dist;m.cone(x+(u-x)*q,.012,z+(v-z)*q,2.25,.04,'#8d8b70',8);}}
    for(let i=0;i<(hub||village?110:260);i++){const x=.8+(i*4.713)%(w-1.6),z=.8+(i*2.371)%(d-1.6);const trail=points.some(p=>Math.hypot(x-p[0],z-p[1])<2.5);if(trail){m.sphere(x,.06,z,.08+(i%3)*.035,'#a8a28a',1.8,.25,1);continue;}m.cone(x,.015,z,.25,.02,i%2?'#506b48':'#3c5741',5);if(i%3===0){m.cone(x,.02,z,.06,.28,'#72875d',3);m.cone(x+.1,.02,z,.04,.2,'#8b9464',3);}if(i%11===0)m.sphere(x,.18,z,.065,'#d7b67e');}
    for(let i=0;i<(hub||village?23:85);i++){const x=1+(i*7.37)%(w-2),z=1+(i*3.17)%(d-2);if(points.some(p=>Math.hypot(x-p[0],z-p[1])<3.2))continue;if(i%4===0)m.sphere(x,.25,z,.6,'#727b6b',1.4,.7,1);else tree(m,x,z,.7+(i%4)*.15);}
    if(hub){m.cone(24,0,4.8,2.3,4,'#777e70',10,2.1);m.cone(24,4,4.8,2.6,.3,'#9b9a80',10);for(let i=0;i<8;i++){const a=i*Math.PI/4;m.box(24+Math.cos(a)*2.15,4.3,4.8+Math.sin(a)*2.15,.65,.65,.65,'#838b7a');}m.box(24,.05,6.95,.8,1.8,.12,'#252f31');m.box(6,.04,13,2,.15,1.4,'#665b48');m.cone(6,.2,13,.65,1,'#b97a3e',7);}
    if(village){house(m,6,4);house(m,15,3);house(m,25,5);house(m,6,15);house(m,26,15);m.cone(16,.1,10,1.1,.65,'#8e9581',10,1.1);m.cone(16,.76,10,.9,.02,'#507d83',10);}
    if(!hub&&!village){m.cone(27,.025,9,4,.025,'#355c60',20);m.cone(48,.025,35,5,.025,'#355c60',20);m.box(33,.045,18,6,.025,6,'#456d6b');for(let i=0;i<7;i++)m.box(31+i*.7,.1,18, .62,.13,3.6,'#77674e');for(const z of [16.4,19.6]){m.box(33,.6,z,4.8,.08,.09,'#a3926d');for(const x of [31,33,35])m.box(x,.1,z,.12,.65,.12,'#8b7959');}house(m,38,14);for(const x of [48,58]){m.cone(x,0,29,1,2.4,'#727969',8);m.cone(x,2.4,29,1.2,.2,'#a8a187',8);}m.ring(53,.04,31,4.8,'#a58f63',0,Math.PI*2,.16);
      for(let i=0;i<12;i++){const a=i*Math.PI/6,x=53+Math.cos(a)*5.2,z=31+Math.sin(a)*5.2;m.box(x,0,z,.75,.45+(i%3)*.5,.7,'#7b826c',a);m.box(x,.45+(i%3)*.5,z,.9,.16,.8,'#aaa58b',a);}
      for(const [x,z] of [[29,17],[36,20],[48,28],[58,29]]){m.box(x,0,z,.2,1.4,.2,'#6e5940');m.cone(x,1.4,z,.22,.45,'#c78d47',6);m.cone(x,1.5,z,.1,.3,'#eed197',6);}
    }
    return new Float32Array(m.data);
  }
  const beats=[
    {start:0,end:6,panel:0,title:'OAKHAVEN',line:'Before the ash. Before the oath. There was home.',who:'Prologue'},
    {start:6,end:12,panel:0,title:'A PROMISE',line:'Father: Courage is not being unafraid. It is staying kind when the world is cruel.',who:'Father'},
    {start:12,end:18,panel:1,title:'THE NIGHT OF CINDERS',line:'Father: Into the cellar. Stay hidden, little oak. I will come back for you.',who:'Father'},
    {start:18,end:24,panel:1,title:'THE OBSIDIAN DUKE',line:'You remember the boots on the stairs. The heat. And then his voice.',who:'The last night'},
    {start:24,end:30,panel:2,title:'THE LAST STAND',line:'The Duke: Your oath ends here. Father: Then you will have to break it.',who:'The village square'},
    {start:30,end:36,panel:2,title:'ASH AND SILENCE',line:'The shield broke. The promise did not.',who:'Oakhaven falls'},
    {start:36,end:42,panel:3,title:'EIGHT YEARS LATER',line:'You kept his sword. You carried his name. But grief was never a road forward.',who:'The Forgotten Watchtower'},
    {start:42,end:48,panel:3,title:'YOUR OATH BEGINS',line:'Garrow: A blade can avenge the dead. A shield can still protect the living. Choose.',who:'Old Man Garrow'}
  ];
  const beat=t=>{const b=beats.find(b=>t>=b.start&&t<b.end);return b?{...b,progress:(t-b.start)/(b.end-b.start)}:null;};
  function create(canvas){
    const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power'});if(!gl||typeof gl.createShader!=='function')return null;
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,'attribute vec3 position;attribute vec3 color;uniform mat4 matrix;varying mediump vec3 vColor;varying mediump vec3 world;void main(){vColor=color;world=position;gl_Position=matrix*vec4(position,1.0);}'));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying mediump vec3 vColor;varying mediump vec3 world;uniform float night;uniform vec2 focusPoint;uniform vec2 viewport;void main(){vec3 c=vColor*vec3(1.06,.99,.90);float grain=fract(sin(dot(floor(world.xz*7.0),vec2(12.9898,78.233)))*43758.5453);if(world.y<.07)c*=.94+grain*.1;float fog=smoothstep(10.0,30.0,distance(world.xz,focusPoint));c=mix(c,vec3(.17,.25,.26),fog*.5);vec2 uv=gl_FragCoord.xy/viewport-.5;float edge=smoothstep(.25,.75,length(uv));c*=1.0-edge*.3;c*=vec3(1.0-night*.3,1.0-night*.4,1.0-night*.18);gl_FragColor=vec4(c,1.0);}'));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('3D shader link failed');gl.useProgram(p);gl.enable(gl.DEPTH_TEST);
    const matrix=gl.getUniformLocation(p,'matrix'),night=gl.getUniformLocation(p,'night'),focusPoint=gl.getUniformLocation(p,'focusPoint'),viewport=gl.getUniformLocation(p,'viewport'),buffer=gl.createBuffer(),cache={},pos=gl.getAttribLocation(p,'position'),col=gl.getAttribLocation(p,'color');
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(col);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(col,3,gl.FLOAT,false,24,12);
    let focus=[12,0,9],lastData=new Float32Array(0),lastMatrix;
    function render(s,reduced=false){
      const cssWidth=canvas.clientWidth||960,cssHeight=canvas.clientHeight||540,scale=Math.min(1,1600/cssWidth,1000/cssHeight),width=Math.max(1,Math.round(cssWidth*scale)),height=Math.max(1,Math.round(cssHeight*scale));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
      const intro=Number.isFinite(s?.intro)&&s.intro<48,t=s?.time||0,cut=s?.intro||0,scene=intro&&cut<36?'village':s?.scene||'hub';
      if(!cache[scene])cache[scene]=environment(scene);
      const m=new Mesh(),players=s?.players||[{x:200,y:190,fx:1,fy:0,hp:100}];
      let target=[players.reduce((n,p)=>n+p.x,0)/players.length/20,0,players.reduce((n,p)=>n+p.y,0)/players.length/20];
      if(intro){target=cut<7?[12+cut*.3,0,9]:cut<14?[16,0,10]:cut<23?[19,0,10]:[12,0,9];
        if(cut<23){if(cut<14)human(m,11,10,1,cut,{child:true,walk:cut<7});human(m,18,10,-1,cut,{color:'#b7c3bb',block:cut>14,fallen:cut>20.3});if(cut>10)human(m,21,10,-1,cut,{duke:true,color:'#4b4e62',swing:cut>19&&cut<21?.1:0});
          if(cut>7)for(let i=0;i<22;i++){const x=5+(i*7.23)%23,z=3+(i*5.3)%14;const flame=.4+Math.sin(cut*7+i)*.2;m.cone(x,.3,z,.3,1+flame,'#d78649',5);m.cone(x,.4,z,.16,.7+flame,'#f6c568',5);m.sphere(x,2+(cut+i)%2,z,.25,'#59545a',1,1.3,1);}
          if(cut>19&&cut<21)m.ring(20,.08,10,(cut-19)*6,'#e4b170',0,Math.PI*2,.25);
        }else {human(m,10,10,1,cut,{color:'#b2bfc2'});human(m,13.75,9.5,-1,cut,{mentor:true});}
      }else{
        for(let i=0;i<players.length;i++){const e=players[i];if(e.hp<=0){m.ring(e.x/20,.08,e.y/20,.5,'#bc715c');continue;}const a=Math.atan2(e.fx,e.fy);m.cone(e.x/20,.06,e.y/20,.55,.012,'#293e39',12);human(m,e.x/20,e.y/20,a,t,{color:e.invulnerable>0&&!reduced?'#e1d3b5':i?'#8db5c0':'#b7c4bf',walk:e.moving,swing:e.swing,block:e.blocking,roll:e.roll,bow:e.draw>0,heavy:e.heavy});m.ring(e.x/20,.075,e.y/20,.58,i?'#8dc1db':'#d5b77e');m.ring(e.x/20+e.fx*2,.075,e.y/20+e.fy*2,.12,i?'#8dc1db':'#e3ca8b');if(e.swing>0)m.ring(e.x/20,.9,e.y/20,e.heavy?3.25:2.4,'#f5d79c',Math.PI/2-a-Math.acos(.25),Math.PI/2-a+Math.acos(.25),.12);}
        if(scene==='hub'){human(m,13.75,9.5,-1,t,{mentor:true});m.ring(13.75,.04,9.5,1.2,s?.trainingClock>1.45?'#e7ac76':'#b8b78c');m.ring(28,.05,10,1,'#c5c18d');}
        for(const e of s?.enemies||[]){m.cone(e.x/20,.06,e.y/20,.55,.012,'#293e39',10);if(['huntsman','marauder','archer','brute'].includes(e.kind))human(m,e.x/20,e.y/20,Math.atan2(e.fx??(players[0].x-e.x),e.fy??(players[0].y-e.y)),t,{color:e.flash>0&&!reduced?'#ffe6ae':e.kind==='huntsman'?'#9d8e69':e.kind==='brute'?'#72606b':'#8d6361',enemy:true,brute:e.kind==='brute',bow:e.kind==='archer',walk:!e.windup,swing:e.windup>0?.1:0});else beast(m,e,t);if(e.windup>0){const start=Math.atan2(e.attackFY??e.fy??0,e.attackFX??e.fx??1),arc=e.kind==='brute'?Math.PI:Math.acos(.4);m.ring(e.x/20,.08,e.y/20,e.kind==='brute'?3.75:2.75,'#d98560',start-arc,start+arc,.16);}m.box(e.x/20,2.55,e.y/20,1.4,.09,.08,'#453e3c');m.box(e.x/20-(1-e.hp/e.maxHp)*.7,2.56,e.y/20,1.4*Math.max(0,e.hp/e.maxHp),.08,.09,'#d8a16e');}
        for(const b of s?.projectiles||[])m.bone([b.x/20,.85,b.y/20],[b.x/20-b.vx*.0015,.85,b.y/20-b.vy*.0015],.035,b.friendly?'#c9ddc8':'#e8a577');
        for(const p of s?.particles||[])m.box(p.x/20,.3+p.life*2,p.y/20,.07,.07,.07,p.color);
        for(const tr of s?.traps||[])m.cone(tr.x/20,.02,tr.y/20,.19,.22,'#b9b7a5',4);
        for(const p of s?.loot||[]){m.sphere(p.x/20,.5+Math.sin(t*3)*.1,p.y/20,.18,p.kind==='health'?'#cf7165':'#e6c57c');m.ring(p.x/20,.035,p.y/20,.4,'#bda46c');}
        if(scene==='mire'){m.box(40.5,.08,21,1.3,.65,.8,'#65523c');m.box(40.5,.73,21,1.4,.12,.9,'#c5a86b',s?.chestOpen?.25:0);if(s?.chestReady&&!s.chestOpen)m.ring(40.5,.06,21,1.2,'#e2c278');const marker=s?.enemies?.[0];if(marker)m.ring(marker.x/20,.075,marker.y/20,1,'#baae7e',t,t+Math.PI*1.4,.05);}
      }
      focus=focus.map((v,i)=>v+(target[i]-v)*(intro?.04:.14));const shake=!reduced?(s?.shake||0)/70:0;const eye=[focus[0]+12+Math.sin(t*170)*shake,19,focus[2]+15];const span=intro?(cut<14?8:5.8):Math.max(5.6,players.length===2?Math.hypot(players[0].x-players[1].x,players[0].y-players[1].y)/55:0);
      lastMatrix=camera(eye,focus,width/height,span);const fixed=cache[scene];lastData=new Float32Array(fixed.length+m.data.length);lastData.set(fixed);lastData.set(m.data,fixed.length);
      gl.clearColor(.075,.11,.13,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(matrix,false,new Float32Array(lastMatrix));gl.uniform1f(night,intro&&cut>7&&cut<23?.7:0);gl.uniform2f(focusPoint,focus[0],focus[2]);gl.uniform2f(viewport,width,height);gl.bufferData(gl.ARRAY_BUFFER,lastData,gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,lastData.length/6);
      return {triangles:lastData.length/18,cutscene:intro?beat(cut):null};
    }
    function aim(clientX,clientY,p){const r=canvas.getBoundingClientRect(),nx=(clientX-r.left)/r.width*2-1,ny=1-(clientY-r.top)/r.height*2;const a=lastMatrix;if(!a)return null;const b=nx-a[12],c=ny-a[13],det=a[0]*a[9]-a[8]*a[1];if(Math.abs(det)<1e-8)return null;return {x:(b*a[9]-a[8]*c)/det*20-p.x,y:(a[0]*c-b*a[1])/det*20-p.y};}
    function project(x,z,height=0){if(!lastMatrix)return null;const a=lastMatrix,px=x/20,pz=z/20;return {x:(a[0]*px+a[4]*height+a[8]*pz+a[12]+1)*50,y:(1-a[1]*px-a[5]*height-a[9]*pz-a[13])*50};}
    return {render,aim,project,dispose(){gl.deleteBuffer(buffer);gl.deleteProgram(p);},stats:()=>({vertices:lastData.length/6})};
  }
  const api={create,Mesh,camera,beat,human,environment};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Oakhaven3D=api;
})(typeof globalThis!=='undefined'?globalThis:this);
