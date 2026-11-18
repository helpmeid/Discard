(()=>{
'use strict';
const W=10,H=20,SHAPES={
 I:[[0,1],[1,1],[2,1],[3,1]],O:[[1,0],[2,0],[1,1],[2,1]],
 T:[[1,0],[0,1],[1,1],[2,1]],S:[[1,0],[2,0],[0,1],[1,1]],
 Z:[[0,0],[1,0],[1,1],[2,1]],J:[[0,0],[0,1],[1,1],[2,1]],
 L:[[2,0],[0,1],[1,1],[2,1]]
},COLORS={I:'#40dcff',O:'#ffe36a',T:'#b484ff',S:'#57eea1',Z:'#ff688b',J:'#6595ff',L:'#ffad62'};
const $=id=>document.getElementById('tet'+id);
let root,board,active,queue=[],bag=[],held=null,holdUsed=false,score=0,lines=0,level=1,best=0,playing=false,paused=false,over=false,interval=null,last=0,elapsed=0,soft=false;
const heldKeys=new Set();let repeatTimer=null,repeatAction=null,repeatStart=0,repeatLast=0;
const REPEAT_DELAY=145,REPEAT_RATE=42;
function clearControls(){heldKeys.clear();soft=false;repeatAction=null;if(repeatTimer){clearInterval(repeatTimer);repeatTimer=null;}}
function syncHeld(){soft=heldKeys.has('ArrowDown')||heldKeys.has('s');const direction=heldKeys.has('ArrowLeft')||heldKeys.has('a')?'left':heldKeys.has('ArrowRight')||heldKeys.has('d')?'right':null;if(direction!==repeatAction){repeatAction=direction;repeatStart=performance.now();repeatLast=repeatStart;if(direction)press(direction);}}
function controlTick(){if(!root||root.classList.contains('hidden')||!playing||paused){clearControls();return;}if(!repeatAction)return;const now=performance.now();if(now-repeatStart>=REPEAT_DELAY&&now-repeatLast>=REPEAT_RATE){press(repeatAction);repeatLast=now;}}
function editableTarget(t){return t instanceof Element&&!!t.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"]');}
const key='discard-tetris-best-v1';
const empty=()=>Array.from({length:H},()=>Array(W).fill(''));
function refill(){if(!bag.length){bag=Object.keys(SHAPES);for(let i=bag.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[bag[i],bag[j]]=[bag[j],bag[i]];}}return bag.pop();}
function fillQueue(){while(queue.length<5)queue.push(refill());}
function newPiece(type){return {type,cells:SHAPES[type].map(c=>c.slice()),x:3,y:-1};}
function collides(p,dx=0,dy=0,cells=p.cells){return cells.some(([cx,cy])=>{const x=p.x+cx+dx,y=p.y+cy+dy;return x<0||x>=W||y>=H||(y>=0&&!!board[y][x]);});}
function spawn(type){active=newPiece(type||queue.shift());fillQueue();if(collides(active)){clearControls();playing=false;over=true;pauseTimer();render();}}
function start(){clearControls();board=empty();queue=[];bag=[];held=null;holdUsed=false;score=0;lines=0;level=1;elapsed=0;playing=true;paused=false;over=false;fillQueue();spawn();last=performance.now();runTimer();render();}
function pauseTimer(){if(interval)clearInterval(interval);interval=null;}
function runTimer(){pauseTimer();interval=setInterval(()=>{if(!playing||paused||document.hidden)return;const now=performance.now(),dt=Math.min(200,now-last);last=now;elapsed+=dt;const speed=soft?40:Math.max(95,820*Math.pow(.82,level-1));if(elapsed>=speed){elapsed=0;step();}render();},40);}
function step(){if(!playing||paused)return;if(!collides(active,0,1))active.y++;else lock();}
function move(dx){if(!playing||paused)return;if(!collides(active,dx,0))active.x+=dx;render();}
function rotate(){if(!playing||paused||active.type==='O')return;const rotated=active.cells.map(([x,y])=>[3-y,x]);for(const dx of [0,-1,1,-2,2]){if(!collides(active,dx,0,rotated)){active.cells=rotated;active.x+=dx;break;}}render();}
function hardDrop(){if(!playing||paused)return;let n=0;while(!collides(active,0,1)){active.y++;n++;}score+=n*2;lock();}
function lock(){for(const [cx,cy] of active.cells){const x=active.x+cx,y=active.y+cy;if(y<0){clearControls();playing=false;over=true;pauseTimer();render();return;}board[y][x]=active.type;}
let removed=0;for(let y=H-1;y>=0;y--){if(board[y].every(Boolean)){board.splice(y,1);board.unshift(Array(W).fill(''));removed++;y++;}}
if(removed){score+=[0,100,300,500,800][removed]*level;lines+=removed;level=1+Math.floor(lines/10);}
if(score>best){best=score;try{localStorage.setItem(key,String(best));}catch{}}
holdUsed=false;spawn();render();}
function hold(){if(!playing||paused||holdUsed)return;const old=active.type;if(held){spawn(held);held=old;}else{held=old;spawn();}holdUsed=true;render();}
function ghostY(){let dy=0;while(!collides(active,0,dy+1))dy++;return active.y+dy;}
function cellMarkup(type,extra=''){return '<div class="tet-cell '+extra+(type?' filled':'')+'" '+(type?'style="--c:'+COLORS[type]+'"':'')+'></div>';}
function miniature(type){if(!type)return '';const cells=SHAPES[type];return '<div class="tet-mini">'+Array.from({length:16},(_,i)=>{const x=i%4,y=Math.floor(i/4);return cellMarkup(cells.some(v=>v[0]===x&&v[1]===y)?type:'');}).join('')+'</div>';}
function draw(){if(!root)return;const stage=$('Board');if(!stage)return;
const m=board.map(row=>row.slice());const ghosts=new Set(),live=new Map();
if(active&&playing){const gy=ghostY();for(const [cx,cy] of active.cells){const gx=active.x+cx,by=gy+cy,ay=active.y+cy;if(by>=0&&by<H)ghosts.add(by*W+gx);if(ay>=0&&ay<H)live.set(ay*W+gx,active.type);}}
stage.innerHTML=m.flatMap((row,y)=>row.map((v,x)=>{const i=y*W+x;return cellMarkup(live.get(i)||v,(!live.has(i)&&!v&&ghosts.has(i))?' ghost':'');})).join('');
$('Score').textContent=score.toLocaleString();$('Best').textContent=best.toLocaleString();$('Lines').textContent=lines;$('Level').textContent=level;
$('Next').innerHTML=queue.slice(0,3).map(miniature).join('');$('Hold').innerHTML=miniature(held)||'<span class="tet-muted">Empty</span>';
$('Pause').textContent=paused?'▶ Resume':'Ⅱ Pause';
$('Overlay').classList.toggle('hidden',playing&&!paused);
$('Overlay').innerHTML=over?'<h2>GAME OVER</h2><p>Final score: '+score.toLocaleString()+'</p><button class="tet-btn primary" id="tetAgain">Play again</button>':paused?'<h2>PAUSED</h2><button class="tet-btn primary" id="tetResume">Resume</button>':'';
$('Again')?.addEventListener('click',start);$('Resume')?.addEventListener('click',togglePause);
}
function render(){draw();}
function togglePause(){if(!playing)return;clearControls();paused=!paused;last=performance.now();render();}
function close(){clearControls();pauseTimer();playing=false;paused=false;root?.classList.add('hidden');window.setDiscardGameActivity?.('');document.querySelector('#gamesHub')?.classList.remove('hidden');}
function press(action){if(action==='left')move(-1);if(action==='right')move(1);if(action==='rotate')rotate();if(action==='down'){if(playing&&!paused){if(!collides(active,0,1)){active.y++;score++;render();}else lock();}}if(action==='drop')hardDrop();if(action==='hold')hold();if(action==='pause')togglePause();}
function setup(){if(root)return;const style=document.createElement('style');style.textContent=`
#tetRoot{position:fixed;inset:0;z-index:15000;background:radial-gradient(ellipse at 45% -25%,#253968,#090e22 65%);color:#f0f6ff;overflow:auto;font:500 14px/1.4 system-ui,sans-serif}
#tetRoot.hidden{display:none!important}#tetRoot *{box-sizing:border-box}
#tetRoot .tet-shell{max-width:980px;min-height:100dvh;margin:auto;padding:14px 20px;display:flex;flex-direction:column;gap:14px}
#tetRoot .tet-top{display:flex;justify-content:space-between;align-items:center;gap:12px}#tetRoot h1{font-size:clamp(22px,3vw,33px);margin:0;letter-spacing:3px;background:linear-gradient(90deg,#5bdcff,#bd85ff);background-clip:text;color:transparent}#tetRoot .tet-kicker{color:#8a9fca;letter-spacing:2px;font-size:10px;font-weight:800}
#tetRoot .tet-content{display:grid;grid-template-columns:minmax(0,340px) minmax(0,240px);gap:24px;justify-content:center;align-items:start}
#tetRoot .tet-board-frame{position:relative;padding:7px;border:2px solid #58689e;border-radius:12px;background:#0e1733;box-shadow:0 0 60px #549aff20}
#tetRoot .tet-board{width:100%;aspect-ratio:1/2;display:grid;grid-template-columns:repeat(10,1fr);grid-template-rows:repeat(20,1fr);gap:2px;background:#091126}
#tetRoot .tet-cell{min-width:0;min-height:0;border:1px solid #23305055;border-radius:3px;background:#17233c45}
#tetRoot .tet-cell.filled{background:var(--c);border:1px solid #ffffff66;box-shadow:inset -3px -3px 0 #0003,inset 2px 2px 0 #fff7,0 0 9px color-mix(in srgb,var(--c),transparent 65%)}
#tetRoot .tet-cell.ghost{border:2px solid #ffffff77;background:#ffffff12}
#tetRoot .tet-side{display:flex;flex-direction:column;gap:10px}#tetRoot .tet-card{border:1px solid #475782;background:#151e3b;border-radius:12px;padding:11px 14px}
#tetRoot .tet-card small{display:block;color:#9bafd8;letter-spacing:1.6px;font-weight:750;font-size:10px}#tetRoot .tet-card strong{font-size:26px;font-variant-numeric:tabular-nums}
#tetRoot .tet-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}#tetRoot .tet-metrics .tet-card{padding:8px 11px}
#tetRoot .tet-mini{display:grid;grid-template-columns:repeat(4,20px);grid-template-rows:repeat(4,20px);gap:2px;margin:7px auto 11px;width:max-content}#tetRoot .tet-mini .tet-cell{border-color:transparent;background:transparent}#tetRoot .tet-mini .tet-cell.filled{background:var(--c);border-color:#ffffff55}
#tetRoot .tet-btn{border:1px solid #6274ac;background:#25365f;color:#f3f8ff;border-radius:10px;padding:10px 13px;cursor:pointer;font-weight:750}#tetRoot .tet-btn.primary{border-color:#5496ff;background:linear-gradient(125deg,#347cce,#7757d3)}#tetRoot .tet-btn:hover{filter:brightness(1.2)}
#tetRoot .tet-actions{display:flex;gap:8px;flex-wrap:wrap}#tetRoot .tet-help{color:#a7b8dd;font-size:12px;line-height:1.9}
#tetRoot .tet-overlay{position:absolute;inset:7px;background:#090e22dc;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:13px;z-index:4;border-radius:8px}#tetRoot .tet-overlay.hidden{display:none!important}#tetRoot .tet-overlay h2{letter-spacing:3px;font-size:27px;margin:0}#tetRoot .tet-overlay p{margin:0}
#tetRoot .tet-controls{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;touch-action:manipulation}#tetRoot .tet-controls .tet-btn{min-width:48px;padding:11px}
#tetRoot .tet-playtime{color:#a9c6f5;font-size:13px;text-align:center}#tetRoot .tet-muted{color:#8090b7}
@media(max-width:650px){#tetRoot .tet-shell{padding:8px;gap:7px}#tetRoot .tet-content{grid-template-columns:minmax(0, min(49vw,280px)) minmax(0,140px);gap:8px}#tetRoot .tet-card{padding:7px}#tetRoot .tet-card strong{font-size:18px}#tetRoot .tet-mini{grid-template-columns:repeat(4,13px);grid-template-rows:repeat(4,13px);gap:1px}#tetRoot .tet-help{font-size:10px}#tetRoot .tet-board{gap:1px}#tetRoot .tet-controls{gap:4px}#tetRoot .tet-controls .tet-btn{min-width:40px;padding:9px}#tetRoot .tet-side{gap:5px}}
@media(max-height:690px) and (min-width:651px){#tetRoot .tet-content{grid-template-columns:minmax(0,230px) minmax(0,250px)}}
`;document.head.appendChild(style);
root=document.createElement('section');root.id='tetRoot';root.className='hidden';root.innerHTML=`
<div class="tet-shell"><header class="tet-top"><div><div class="tet-kicker">DISCARD ARCADE</div><h1>TETRIS</h1></div><button id="tetExit" class="tet-btn">✕ Close Tab</button></header>
<div class="tet-content"><div class="tet-board-frame"><div id="tetBoard" class="tet-board" aria-label="10 by 20 Tetris board"></div><div id="tetOverlay" class="tet-overlay hidden"></div></div>
<aside class="tet-side"><div class="tet-metrics"><div class="tet-card"><small>SCORE</small><strong id="tetScore">0</strong></div><div class="tet-card"><small>BEST</small><strong id="tetBest">0</strong></div><div class="tet-card"><small>LINES</small><strong id="tetLines">0</strong></div><div class="tet-card"><small>LEVEL</small><strong id="tetLevel">1</strong></div></div><div class="tet-card"><small>NEXT</small><div id="tetNext"></div></div><div class="tet-card"><small>HOLD (C)</small><div id="tetHold"></div></div><div class="tet-actions"><button class="tet-btn" id="tetPause">Ⅱ Pause</button><button class="tet-btn" id="tetRestart">↻ Restart</button></div><div class="tet-help">← → or A/D move · ↑ or W rotate · ↓ or S soft drop<br>Space hard drop · C hold · P pause</div></aside></div>
<div class="tet-controls"><button class="tet-btn" data-action="left">◀</button><button class="tet-btn" data-action="rotate">↻</button><button class="tet-btn" data-action="right">▶</button><button class="tet-btn" data-action="down">▼</button><button class="tet-btn primary" data-action="drop">DROP</button><button class="tet-btn" data-action="hold">HOLD</button></div><div class="tet-playtime" data-playtime="tetris">0h 0m played</div>
</div>`;document.body.appendChild(root);
$('Exit').onclick=close;$('Pause').onclick=togglePause;$('Restart').onclick=start;
root.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>press(b.dataset.action));
const keyActions={'ArrowLeft':'left','ArrowRight':'right','ArrowDown':'down','ArrowUp':'rotate','a':'left','d':'right','s':'down','w':'rotate',' ':'drop','c':'hold','p':'pause'};
window.addEventListener('keydown',e=>{
  if(root.classList.contains('hidden')||editableTarget(e.target)||e.ctrlKey||e.metaKey||e.altKey)return;
  const key=e.key.length===1?e.key.toLowerCase():e.key,action=keyActions[key];
  if(!action)return;
  e.preventDefault();
  if(e.repeat||heldKeys.has(key))return;
  if(action==='left'||action==='right'||action==='down'){
    heldKeys.add(key);
    if(action==='down'){soft=true;press('down');}
    else syncHeld();
    if(!repeatTimer)repeatTimer=setInterval(controlTick,16);
  }else press(action);
},{capture:true});
window.addEventListener('keyup',e=>{
  const key=e.key.length===1?e.key.toLowerCase():e.key;
  if(!heldKeys.delete(key))return;
  syncHeld();
  if(!heldKeys.size){clearControls();}
});
window.addEventListener('blur',clearControls);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing&&!paused){clearControls();paused=true;render();}last=performance.now();});
try{best=Number(localStorage.getItem(key))||0;}catch{}
}
window.tetrisIsPlaying=()=>!!(root&&!root.classList.contains('hidden')&&playing&&!paused&&!over);
window.openTetris=()=>{setup();root.classList.remove('hidden');window.setDiscardGameActivity?.('Tetris');start();};
})();
