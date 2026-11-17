(function () {
  "use strict";
  const games = [
    ["horizon","Event Horizon","🌌","hubPlayHorizon","vfRoot"],
    ["oakhaven","Oakhaven","⚔️","hubPlayOakhaven","oakRoot"],
    ["freedraw","Free Draw","🎨","hubPlayFreeDraw","freeDrawRoot"],
    ["mtd","Tower Defense","🛡️","hubPlayMemeTD","mtdRoot"],
    ["blockblast","Block Blast","🧩","hubPlayBlockBlast","bbRoot"],
    ["tetris","Tetris","🟪","hubPlayTetris","tetRoot"],
    ["deadzone","Dead Zone","🧟","hubPlayDeadZone","deadZoneRoot"]
  ];
  const byId = Object.fromEntries(games.map(g => [g[0],g]));
  const tabs = ["discard"];
  let active = "discard";
  let lastGame = null;
  const style = document.createElement("style");
  style.textContent = `
  #discardBrowser{position:fixed;inset:0 0 auto;height:88px;z-index:2147483000;display:flex;flex-direction:column;background:#e7edf5;color:#253246;font:500 12px "Segoe UI",system-ui,sans-serif;box-shadow:0 2px 9px #14233b24;user-select:none;isolation:isolate}
  #discardBrowser[hidden]{display:none!important}
  #discardBrowser button{font:inherit;cursor:pointer}
  #discardBrowser button:focus-visible,#discardBrowser .db-address:focus-visible{outline:2px solid #1478d4;outline-offset:-2px}
  #discardBrowser .db-topline{display:flex;align-items:end;gap:6px;height:40px;padding:5px 12px 0;min-width:0;background:#dce5f0}
  #discardBrowser .db-tabstrip{display:flex;align-items:end;gap:3px;flex:0 1 auto;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
  #discardBrowser .db-tabstrip::-webkit-scrollbar{display:none}
  #discardBrowser .db-tab{position:relative;display:flex;align-items:center;gap:8px;flex:0 0 176px;max-width:205px;min-width:92px;height:34px;padding:0 9px 0 12px;border:0;border-radius:9px 9px 0 0;background:#d2dce9;color:#485b70;white-space:nowrap;transition:background .14s}
  #discardBrowser .db-tab:hover{background:#eaf0f8}
  #discardBrowser .db-tab[aria-selected=true]{background:#fff;color:#192f49;box-shadow:0 -1px 3px #18345811;z-index:1}
  #discardBrowser .db-tab-icon{flex:none;width:17px;height:17px;display:grid;place-items:center;font-size:15px}
  #discardBrowser .db-tab-icon img{width:17px;height:17px;object-fit:contain;border-radius:4px}
  #discardBrowser .db-title{overflow:hidden;text-overflow:ellipsis;flex:1;text-align:left;font-size:12px}
  #discardBrowser .db-close{border:0;background:transparent;color:inherit;border-radius:5px;width:22px;height:22px;flex:none;font-size:17px;line-height:1}
  #discardBrowser .db-close:hover{background:#9eb1c54d}
  #discardBrowser .db-new{height:29px;width:29px;align-self:center;margin-bottom:2px;border:0;border-radius:7px;background:transparent;color:#405570;font-size:22px}
  #discardBrowser .db-new:hover{background:#c4d3e6}
  #discardBrowser .db-window-title{margin-left:auto;align-self:center;font-size:11px;color:#62758a;padding:0 4px;white-space:nowrap}
  #discardBrowser .db-toolbar{display:flex;align-items:center;gap:6px;min-width:0;height:48px;padding:6px 12px 7px;background:#fff;border-bottom:1px solid #d5deea}
  #discardBrowser .db-tool{width:29px;height:29px;flex:none;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:#45566b;font-size:18px}
  #discardBrowser .db-tool:hover{background:#edf2f9}
  #discardBrowser .db-tool:disabled{opacity:.3;cursor:default}
  #discardBrowser .db-address-wrap{display:flex;align-items:center;gap:9px;flex:1;min-width:0;height:32px;padding:0 12px;border:1px solid #e2e8f0;border-radius:18px;background:#f1f4f9;transition:background .15s,border-color .15s}
  #discardBrowser .db-address-wrap:focus-within{background:#fff;border-color:#2787d5;box-shadow:0 0 0 2px #2681ce20}
  #discardBrowser .db-lock{color:#6b8099;font-size:13px;flex:none}
  #discardBrowser .db-address{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#32445b;font:400 12px "Segoe UI",system-ui,sans-serif}
  #discardBrowser .db-more{font-weight:700}
  body.db-ready #chatView:not(.hidden){height:calc(100dvh - 88px)!important;margin-top:88px}
  body.db-ready #gamesHub:not(.hidden){top:88px!important;height:calc(100dvh - 88px)!important}
  body.db-ready .db-away{display:none!important}
  body.db-ready :is(#vfRoot,#oakRoot,#deadZoneRoot,#freeDrawRoot,#mtdRoot,#bbRoot,#tetRoot):not(.hidden):not(.db-away){top:88px!important;bottom:0!important;height:calc(100dvh - 88px)!important;max-height:calc(100dvh - 88px)!important}
  @media(max-width:700px){#discardBrowser .db-topline{padding-left:5px;padding-right:5px;gap:2px}#discardBrowser .db-tab{flex-basis:125px;padding:0 5px 0 8px;gap:4px}#discardBrowser .db-window-title{display:none}#discardBrowser .db-toolbar{padding-left:6px;padding-right:6px;gap:2px}#discardBrowser .db-address-wrap{padding:0 8px}#discardBrowser .db-tool{width:27px}}
  `;
  document.head.append(style);
  const bar = document.createElement("nav");
  bar.id = "discardBrowser";
  bar.hidden = true;
  bar.setAttribute("aria-label","Discard browser tabs");
  const topLine = document.createElement("div");
  topLine.className="db-topline";
  const strip = document.createElement("div");
  strip.className = "db-tabstrip";
  strip.setAttribute("role","tablist");
  const tool = (title,label,action,className="db-tool") => {
    const b = document.createElement("button");
    b.type="button";b.className=className;b.title=title;b.setAttribute("aria-label",title);
    b.textContent=label;b.addEventListener("click",action);return b;
  };
  const openHub=()=>{
    activate("discard");
    document.getElementById("gamesToggle")?.click();
  };
  const newTab=tool("New tab","+ ",openHub,"db-new");
  const windowTitle=document.createElement("span");windowTitle.className="db-window-title";windowTitle.textContent="Discard";
  topLine.append(strip,newTab,windowTitle);
  const toolbar=document.createElement("div");toolbar.className="db-toolbar";
  let history=["discard"], historyPosition=0;
  const back=tool("Back","‹",()=>navigateHistory(-1));
  const forward=tool("Forward","›",()=>navigateHistory(1));
  const reload=tool("Reload Discard","↻",()=>window.location.reload());
  const home=tool("Games","⌂",openHub);
  const addressWrap=document.createElement("div");addressWrap.className="db-address-wrap";
  const lock=document.createElement("span");lock.className="db-lock";lock.textContent="◇";
  const location=document.createElement("input");
  location.className="db-address";location.setAttribute("aria-label","Discard address");
  location.autocomplete="off";location.spellcheck=false;
  location.placeholder="Search tabs or enter Discard location";
  const more=tool("Return to Discard","⋯",()=>activate("discard"));
  more.classList.add("db-more");
  location.addEventListener("keydown",event=>{
    if(event.key==="Escape"){location.blur();render();}
    if(event.key!=="Enter")return;
    event.preventDefault();
    const value=location.value.trim().toLowerCase();
    const match=games.find(g=>value===g[0]||value===g[1].toLowerCase()||value==="discard://games/"+g[0]);
    if(value==="discard"||value==="discard://home"||value==="discard://chats")activate("discard");
    else if(value==="games"||value==="discard://games")openHub();
    else if(match&&tabs.includes(match[0]))activate(match[0]);
    else if(match)document.getElementById(match[3])?.click();
    else{location.setCustomValidity("Use Discard, Games, or an available game name.");location.reportValidity();setTimeout(()=>location.setCustomValidity(""),1800);}
    location.blur();
  });
  addressWrap.append(lock,location);
  toolbar.append(back,forward,reload,home,addressWrap,more);
  bar.append(topLine,toolbar);
  document.body.append(bar);
  function root(game) {return document.getElementById(byId[game]?.[4]);}
  function visible(el) {return !!el && !el.classList.contains("hidden") && !el.hasAttribute("hidden") && el.style.display!=="none";}
  function render() {
    strip.replaceChildren();
    for (const id of tabs) {
      const data = byId[id], tab = document.createElement("button");
      tab.type="button";tab.className="db-tab";tab.setAttribute("role","tab");
      tab.setAttribute("aria-selected",String(id===active));
      tab.title=data?data[1]:"Discard — your chats";
      const icon=document.createElement("span");icon.className="db-tab-icon";
      if(data)icon.textContent=data[2];else{const favicon=document.createElement("img");favicon.src="discard-icon.png";favicon.alt="";icon.append(favicon);}
      const name=document.createElement("span");name.className="db-title";name.textContent=data?data[1]:"Discard";
      tab.append(icon,name);
      tab.addEventListener("click",()=>activate(id));
      if (id!=="discard") {
        const close=document.createElement("button");
        close.type="button";close.className="db-close";close.textContent="×";close.title="Close "+data[1];
        close.setAttribute("aria-label","Close "+data[1]+" tab");
        close.addEventListener("click",e=>{e.stopPropagation();closeTab(id);});
        tab.append(close);
      }
      strip.append(tab);
    }
    location.value=active==="discard"?"discard://chats":"discard://games/"+active;
    back.disabled=historyPosition<=0;forward.disabled=historyPosition>=history.length-1;
    for (const game of games) root(game[0])?.classList.toggle("db-away",game[0]!==active);
    // The browser bar is above game canvases and available even in full-screen game menus.
    const signedIn = visible(document.getElementById("chatView"));
    bar.hidden=!signedIn;
    document.body.classList.toggle("db-ready",signedIn);
  }
  function navigateHistory(direction){
    const pos=historyPosition+direction;
    if(pos<0||pos>=history.length)return;
    historyPosition=pos;activate(history[pos],false);
  }
  function activate(id,record=true) {
    if (id!=="discard"&&!tabs.includes(id)) return;
    active=id;
    if(record && history[historyPosition]!==id){history=history.slice(0,historyPosition+1);history.push(id);historyPosition=history.length-1;}
    if(id!=="discard")lastGame=id;
    document.getElementById("gamesHub")?.classList.add("hidden");
    render();
    window.dispatchEvent(new Event("resize"));
  }
  function openGame(id) {
    if(!byId[id])return;
    if(!tabs.includes(id))tabs.push(id);
    activate(id);
  }
  function closeTab(id) {
    if(id==="discard")return;
    const i=tabs.indexOf(id);if(i<0)return;
    tabs.splice(i,1);
    history=history.filter(entry=>entry!==id);
    if(!history.length)history=["discard"];
    historyPosition=Math.min(historyPosition,history.length-1);
    // Releasing an existing in-app game uses its own Leave/Back action where available.
    // The root is kept mounted until the game handles its own cleanup, so save/session
    // behavior is not silently reset by destroying its DOM.
    root(id)?.classList.add("db-away");
    document.getElementById("gamesHub")?.classList.add("hidden");
    if(active===id)activate(tabs[i]||tabs[i-1]||"discard");
    else render();
  }
  for(const game of games) {
    document.getElementById(game[3])?.addEventListener("click",()=>{
      // Existing hub handlers perform initialization first. Register the tab afterward.
      setTimeout(()=>{if(visible(root(game[0])))openGame(game[0]);},50);
    });
  }
  document.addEventListener("click", event => {
    const btn = event.target?.closest?.("button");
    if (!btn) return;
    const found = games.find(game => root(game[0])?.contains(btn));
    const id = found?.[0];
    if (!id || !tabs.includes(id)) return;
    const label = (btn.textContent || "").replace(/\s+/g, " ").trim();
    if (!/back to games|close tab|return to discard/i.test(label) && !["mtdExit","mtdLeave","tetExit","bbBackGames","bbExit"].includes(btn.id)) return;
    queueMicrotask(() => {
      if (tabs.includes(id)) closeTab(id);
      document.getElementById("gamesHub")?.classList.add("hidden");
    });
  }, true);
  // Native game exits can also hide their roots without a button click.
  const afterNativeExit = id => {
    queueMicrotask(() => {
      if (!visible(root(id)) && tabs.includes(id)) closeTab(id);
      document.getElementById("gamesHub")?.classList.add("hidden");
    });
  };
  document.addEventListener("keydown",e=>{
    if(!visible(document.getElementById("chatView")))return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="w" && active!=="discard"){
      e.preventDefault();closeTab(active);
    } else if((e.ctrlKey||e.metaKey)&&e.key==="Tab"){
      e.preventDefault();
      const i=tabs.indexOf(active);
      activate(tabs[(i+(e.shiftKey?-1:1)+tabs.length)%tabs.length]);
    } else if((e.ctrlKey||e.metaKey)&&e.key==="1"){
      e.preventDefault();activate("discard");
    }
  });
  const chat=document.getElementById("chatView");
  if(chat)new MutationObserver(render).observe(chat,{attributes:true,attributeFilter:["class"]});
  for(const game of games){
    const el=root(game[0]);
    if(!el)continue;
    new MutationObserver(()=>{
      if(game[0]===active && !visible(el) && !el.classList.contains("db-away")){
        afterNativeExit(game[0]);
      }
    }).observe(el,{attributes:true,attributeFilter:["class","hidden","style"]});
  }
  // A chat invite can open a game without clicking the Games hub.
  window.discardBrowserTabs={open:openGame,activate,close:closeTab};
  render();
})();