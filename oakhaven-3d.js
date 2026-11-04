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
      for(let j=0;j<5;j++)for(let i=0;i<8;i++){const a=j*Math.PI/5,b=(j+1)*Math.PI/5,u=i*Math.PI/4,v=(i+1)*Math.PI/4;this.tri(point(a,u),point(b,v),point(b,u),c);this.tri(point(a,u),point(a,v),point(b,v),c);}
    }
    ring(x,y,z,r,c,start=0,end=Math.PI*2,width=.07){for(let a=start;a<end;a+=.16){const b=Math.min(a+.16,end),p=t=>[x+Math.cos(t)*r,y,z+Math.sin(t)*r],q=t=>[x+Math.cos(t)*(r+width),y,z+Math.sin(t)*(r+width)];this.tri(p(a),q(a),p(b),c);this.tri(p(b),q(a),q(b),c);}}
  }
  function human(m,x,z,a,t,opts={}){
    const begin=m.data.length;
    const scale=opts.child?.64:opts.duke?1.45:1,skin=opts.duke?'#807b8c':'#d8a77e',armor=opts.color||'#a3b6bb',cloth=opts.duke?'#4a2137':opts.mentor?'#7d7660':'#37757e';
    const p=(dx,y,dz)=>[x+(dx*Math.cos(a)+dz*Math.sin(a))*scale,y*scale,z+(-dx*Math.sin(a)+dz*Math.cos(a))*scale];
    const sphere=(dx,y,dz,r,c,sx=1,sy=1,sz=1)=>m.sphere(...p(dx,y,dz),r*scale,c,sx,sy,sz);
    const box=(dx,y,dz,w,h,d,c,turn=0)=>m.box(...p(dx,y,dz),w*scale,h*scale,d*scale,c,a+turn);
    const gait=opts.walk?Math.sin(t*11)*.2:0;
    // Separate boots, articulated limbs, tunic, breastplate, head, helmet, visor and cape.
    sphere(-.19,.24,gait,.19,'#303d45',.8,1.5,1);sphere(.19,.24,-gait,.19,'#303d45',.8,1.5,1);
    sphere(-.19,.08,.08+gait,.19,'#27333a',1,.6,1.5);sphere(.19,.08,.08-gait,.19,'#27333a',1,.6,1.5);
    sphere(0,.72,0,.39,cloth,.95,1.1,.7);sphere(0,.92,.05,.34,armor,1.05,1,.65);
    sphere(-.42,.94,0,.22,armor);sphere(.42,.94,0,.22,armor);
    sphere(-.46,.63,.08,.14,skin,1,1.6,1);sphere(.46,.65,.1,.14,skin,1,1.6,1);
    sphere(0,1.44,0,.28,skin,.85,1.08,.9);
    if(!opts.child&&!opts.mentor){sphere(0,1.55,-.035,.3,armor,1,1,.9);box(0,1.35,.225,.36,.08,.055,'#202d36');box(0,1.34,.26,.045,.17,.035,'#d4d7c5');}
    else {sphere(0,1.58,-.07,.28,'#634537',1,.7,1);sphere(-.09,1.47,.23,.025,'#252a30');sphere(.09,1.47,.23,.025,'#252a30');}
    box(0,.47,-.28,.57,.66,.07,cloth);box(0,.58,.23,.7,.09,.12,'#a18659');
    if(opts.mentor){sphere(0,1.19,.19,.15,'#c4c1ab',.85,1.6,.8);box(-.55,0,.12,.065,1.7,.065,'#ab8d5f');}
    else if(!opts.child){
      const swing=opts.swing?(-1.5+opts.swing*15):0;
      if(opts.swing){box(.55+Math.sin(swing)*.4,.85,.7,.085,.08,1.5,'#e2e4ce',swing);box(.55,.8,.24,.4,.07,.12,'#b69b64',swing);}
      else {box(.55,.65,.24,.085,opts.duke?1.3:.9,.09,'#e2e4ce');box(.55,.65,.24,.4,.07,.12,'#b69b64');}
      sphere(-.53,.64,.26,.35,opts.block?'#c5dbcb':'#6e8795',.75,1.1,.24);sphere(-.53,.64,.34,.11,'#bd9c62',1,1,.3);
    }
    if(opts.fallen)for(let i=begin;i<m.data.length;i+=6){const y=m.data[i+1],dz=m.data[i+2]-z;m.data[i+1]=.2+dz*.4;m.data[i+2]=z+y;}
  }
  function beast(m,e,t){const x=e.x/20,z=e.y/20,a=Math.atan2(e.fx||1,e.fy||0),c=e.flash>0?'#e9d3b1':e.kind==='hound'?'#68736c':'#7b6553';
    m.sphere(x,.5,z,.55,c,1.1,.8,1.5);m.sphere(x,.58,z+.53,.33,c,1,.9,1.2);m.sphere(x,.48,z+.84,.18,'#4c3e36',1,.6,.6);
    for(const dx of [-.3,.3])for(const dz of [-.32,.32])m.cone(x+dx,.02,z+dz,.11,.4,'#3c3934',5);
    m.cone(x-.2,.69,z+.35,.13,.22,c,4);m.cone(x+.2,.69,z+.35,.13,.22,c,4);
    m.cone(x-.2,.43,z+.78,.06,.19,'#d9c99d',5);m.cone(x+.2,.43,z+.78,.06,.19,'#d9c99d',5);
    m.sphere(x-.15,.65,z+.79,.035,'#e9aa54');m.sphere(x+.15,.65,z+.79,.035,'#e9aa54');
  }
  function tree(m,x,z,size=1){m.cone(x+.3,.01,z+.2,1.05*size,.02,'#354b3b',8);m.cone(x,0,z,.16*size,1.9*size,'#735d43',6,.11*size);m.cone(x,1.05*size,z,1.1*size,2.15*size,'#344f43',7);m.cone(x,1.9*size,z,.85*size,1.6*size,'#42624a',7);}
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
    if(!hub&&!village){m.cone(27,.025,9,4,.025,'#355c60',20);m.cone(48,.025,35,5,.025,'#355c60',20);m.box(33,.045,18,6,.025,6,'#456d6b');for(let i=0;i<7;i++)m.box(31+i*.7,.1,18, .62,.13,3.6,'#77674e');for(const z of [16.4,19.6]){m.box(33,.6,z,4.8,.08,.09,'#a3926d');for(const x of [31,33,35])m.box(x,.1,z,.12,.65,.12,'#8b7959');}house(m,38,14);m.box(40,.05,20,1.7,.85,1.3,'#7d6545');for(const x of [48,58]){m.cone(x,0,29,1,2.4,'#727969',8);m.cone(x,2.4,29,1.2,.2,'#a8a187',8);}m.ring(53,.04,31,4.8,'#a58f63',0,Math.PI*2,.16);}
    return new Float32Array(m.data);
  }
  const beats=[
    {end:7,title:'OAKHAVEN',line:'Before the ash. Before the oath. There was home.',who:'Prologue'},
    {end:14,title:'THE NIGHT OF CINDERS',line:'Father: Get below the floorboards. Whatever you hear, stay hidden.',who:'Oakhaven · nightfall'},
    {end:23,title:'THE OBSIDIAN DUKE',line:'The Duke: A shield cannot protect a kingdom that has already fallen.',who:'The last stand'},
    {end:30,title:'EIGHT YEARS LATER',line:'Garrow: Grief brought you here. What you do next is your choice.',who:'The Forgotten Watchtower'}
  ];
  const beat=t=>beats.find(b=>t<b.end)||null;
  function create(canvas){
    const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power'});if(!gl||typeof gl.createShader!=='function')return null;
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,'attribute vec3 position;attribute vec3 color;uniform mat4 matrix;varying vec3 vColor;void main(){vColor=color;gl_Position=matrix*vec4(position,1.0);}'));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 vColor;uniform float night;void main(){gl_FragColor=vec4(vColor*vec3(1.0-night*.3,1.0-night*.4,1.0-night*.18),1.0);}'));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('3D shader link failed');gl.useProgram(p);gl.enable(gl.DEPTH_TEST);
    const matrix=gl.getUniformLocation(p,'matrix'),night=gl.getUniformLocation(p,'night'),buffer=gl.createBuffer(),cache={},pos=gl.getAttribLocation(p,'position'),col=gl.getAttribLocation(p,'color');
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(col);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(col,3,gl.FLOAT,false,24,12);
    let focus=[12,0,9],lastData=new Float32Array(0),lastMatrix;
    function render(s,reduced=false){
      const width=Math.max(320,Math.min(1600,canvas.clientWidth||960)),height=Math.max(240,Math.min(1000,canvas.clientHeight||540));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
      const intro=Number.isFinite(s?.intro)&&s.intro<30,t=s?.time||0,cut=s?.intro||0,scene=intro&&cut<23?'village':s?.scene||'hub';
      if(!cache[scene])cache[scene]=environment(scene);
      const m=new Mesh(),players=s?.players||[{x:200,y:190,fx:1,fy:0,hp:100}];
      let target=[players.reduce((n,p)=>n+p.x,0)/players.length/20,0,players.reduce((n,p)=>n+p.y,0)/players.length/20];
      if(intro){target=cut<7?[12+cut*.3,0,9]:cut<14?[16,0,10]:cut<23?[19,0,10]:[12,0,9];
        if(cut<23){if(cut<14)human(m,11,10,1,cut,{child:true,walk:cut<7});human(m,18,10,-1,cut,{color:'#b7c3bb',block:cut>14,fallen:cut>20.3});if(cut>10)human(m,21,10,-1,cut,{duke:true,color:'#4b4e62',swing:cut>19&&cut<21?.1:0});
          if(cut>7)for(let i=0;i<22;i++){const x=5+(i*7.23)%23,z=3+(i*5.3)%14;const flame=.4+Math.sin(cut*7+i)*.2;m.cone(x,.3,z,.3,1+flame,'#d78649',5);m.cone(x,.4,z,.16,.7+flame,'#f6c568',5);m.sphere(x,2+(cut+i)%2,z,.25,'#59545a',1,1.3,1);}
          if(cut>19&&cut<21)m.ring(20,.08,10,(cut-19)*6,'#e4b170',0,Math.PI*2,.25);
        }else {human(m,10,10,1,cut,{color:'#b2bfc2'});human(m,13.75,9.5,-1,cut,{mentor:true});}
      }else{
        for(let i=0;i<players.length;i++){const e=players[i];if(e.hp<=0){m.ring(e.x/20,.08,e.y/20,.5,'#bc715c');continue;}const a=Math.atan2(e.fx,e.fy);human(m,e.x/20,e.y/20,a,t,{color:e.invulnerable>0&&!reduced?'#e1d3b5':i?'#83acbb':'#a5b7ba',walk:e.moving,swing:e.swing,block:e.blocking});m.ring(e.x/20,.035,e.y/20,.55,i?'#8dc1db':'#d5b77e');if(e.swing>0)m.ring(e.x/20,.7,e.y/20,e.heavy?2.6:1.8,'#f5d79c',Math.PI/2-a-.85,Math.PI/2-a+.85,.12);}
        if(scene==='hub'){human(m,13.75,9.5,-1,t,{mentor:true});m.ring(13.75,.04,9.5,1.2,s?.trainingClock>1.45?'#e7ac76':'#b8b78c');m.ring(28,.05,10,1,'#c5c18d');}
        for(const e of s?.enemies||[]){if(e.kind==='huntsman'||e.kind==='marauder')human(m,e.x/20,e.y/20,Math.atan2(players[0].x-e.x,players[0].y-e.y),t,{color:e.flash>0&&!reduced?'#ffe6ae':e.kind==='huntsman'?'#9d8e69':'#8d6361',walk:!e.windup,swing:e.windup>0?.1:0});else beast(m,e,t);if(e.windup>0)m.ring(e.x/20,.04,e.y/20,2.4,'#d98560',0,Math.PI*2,.12);m.box(e.x/20,2.15,e.y/20,1.4,.09,.08,'#453e3c');m.box(e.x/20-(1-e.hp/e.maxHp)*.7,2.16,e.y/20,1.4*Math.max(0,e.hp/e.maxHp),.08,.09,'#d8a16e');}
        for(const b of s?.projectiles||[])m.cone(b.x/20,.6,b.y/20,.08,.4,'#e8c587',5);
        for(const p of s?.particles||[])m.sphere(p.x/20,.3+p.life*2,p.y/20,.065,p.color);
        for(const tr of s?.traps||[])m.cone(tr.x/20,.02,tr.y/20,.19,.22,'#b9b7a5',4);
        for(const p of s?.loot||[]){m.sphere(p.x/20,.5+Math.sin(t*3)*.1,p.y/20,.18,p.kind==='health'?'#cf7165':'#e6c57c');m.ring(p.x/20,.035,p.y/20,.4,'#bda46c');}
      }
      focus=focus.map((v,i)=>v+(target[i]-v)*(intro?.04:.14));const shake=!reduced?(s?.shake||0)/70:0;const eye=[focus[0]+12+Math.sin(t*170)*shake,19,focus[2]+15];const span=intro?(cut<14?8:5.8):Math.max(6.6,players.length===2?Math.hypot(players[0].x-players[1].x,players[0].y-players[1].y)/55:0);
      lastMatrix=camera(eye,focus,width/height,span);const fixed=cache[scene];lastData=new Float32Array(fixed.length+m.data.length);lastData.set(fixed);lastData.set(m.data,fixed.length);
      gl.clearColor(.075,.11,.13,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(matrix,false,new Float32Array(lastMatrix));gl.uniform1f(night,intro&&cut>7&&cut<23?.7:0);gl.bufferData(gl.ARRAY_BUFFER,lastData,gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,lastData.length/6);
      return {triangles:lastData.length/18,cutscene:intro?beat(cut):null};
    }
    function aim(clientX,clientY,p){const r=canvas.getBoundingClientRect(),nx=(clientX-r.left)/r.width*2-1,ny=1-(clientY-r.top)/r.height*2;const a=lastMatrix;if(!a)return null;const b=nx-a[12],c=ny-a[13],det=a[0]*a[9]-a[8]*a[1];if(Math.abs(det)<1e-8)return null;return {x:(b*a[9]-a[8]*c)/det*20-p.x,y:(a[0]*c-b*a[1])/det*20-p.y};}
    return {render,aim,dispose(){gl.deleteBuffer(buffer);gl.deleteProgram(p);},stats:()=>({vertices:lastData.length/6})};
  }
  const api={create,Mesh,camera,beat,human,environment};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Oakhaven3D=api;
})(typeof globalThis!=='undefined'?globalThis:this);
