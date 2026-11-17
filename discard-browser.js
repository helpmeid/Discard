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
  #discardBrowser { position:fixed;top:0;left:0;right:0;height:48px;z-index:2147483000;display:flex;align-items:end;gap:5px;padding:7px 10px 0;background:#18241f;color:#daeae0;font:500 12px system-ui,sans-serif;box-shadow:0 2px 14px #0004;user-select:none }
  #discardBrowser[hidden] { display:none!important }
  #discardBrowser .db-tabstrip {display:flex;gap:4px;flex:1;min-width:0;overflow:auto hidden;scrollbar-width:thin}
  #discardBrowser button {font:inherit;cursor:pointer}
  #discardBrowser .db-tab {display:flex;align-items:center;gap:7px;flex:0 1 178px;min-width:90px;max-width:190px;height:36px;padding:0 9px;border:1px solid transparent;border-radius:10px 10px 0 0;background:#2b3b34;color:#b4c8ba;white-space:nowrap}
  #discardBrowser .db-tab[aria-selected=true] {background:var(--white,#fffefa);color:var(--ink,#202b28);border-color:#85968b}
  #discardBrowser .db-title {overflow:hidden;text-overflow:ellipsis;flex:1;text-align:left}
  #discardBrowser .db-close {border:0;background:transparent;color:inherit;border-radius:5px;width:22px;height:23px;flex:none;font-size:17px;line-height:1}
  #discardBrowser .db-close:hover {background:#8885}
  #discardBrowser .db-tool {border:0;border-radius:7px;background:#31423a;color:#e7f2e9;min-width:32px;height:32px;padding:0 9px;margin-bottom:3px}
  #discardBrowser .db-tool:hover {background:#4b6556}
  #discardBrowser .db-location {align-self:center;color:#b1c5b8;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 5px;margin-bottom:7px}
  body.db-ready #chatView:not(.hidden) {height:calc(100dvh - 48px)!important;margin-top:48px}
  body.db-ready #gamesHub:not(.hidden) {top:48px!important;height:calc(100dvh - 48px)!important}
  body.db-ready :is(#vfRoot,#oakRoot,#deadZoneRoot,#freeDrawRoot,#mtdRoot,#bbRoot,#tetRoot):not(.hidden) {max-height:calc(100dvh - 48px)!important}
  body.db-ready .db-away {display:none!important}
  body.db-ready :is(#vfRoot,#oakRoot,#deadZoneRoot,#freeDrawRoot,#mtdRoot,#bbRoot,#tetRoot):not(.db-away) {top:48px!important;bottom:0!important;height:calc(100dvh - 48px)!important}
  @media(max-width:700px) {#discardBrowser {padding-left:4px;padding-right:4px;gap:2px}#discardBrowser .db-tab {min-width:75px;flex-basis:124px;padding:0 5px;gap:3px}#discardBrowser .db-location {display:none}#discardBrowser .db-tool {padding:0 6px;min-width:28px}}
  `;
  document.head.append(style);
  const bar = document.createElement("nav");
  bar.id = "discardBrowser";
  bar.hidden = true;
  bar.setAttribute("aria-label","Discard browser tabs");
  const strip = document.createElement("div");
  strip.className = "db-tabstrip";
  strip.setAttribute("role","tablist");
  const tool = (title,label,action) => {
    const b = document.createElement("button");
    b.type="button";b.className="db-tool";b.title=title;b.setAttribute("aria-label",title);
    b.textContent=label;b.addEventListener("click",action);return b;
  };
  const openHub = () => {
    activate("discard");
    document.getElementById("gamesToggle")?.click();
  };
  bar.append(strip,tool("New game tab","+ ",openHub),tool("Games home","⌂",openHub),tool("Return to Discard","↶",()=>activate("discard")));
  const location = document.createElement("span");
  location.className="db-location";location.textContent="discard://home";bar.append(location);
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
      const icon=document.createElement("span");icon.textContent=data?data[2]:"◉";
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
    location.textContent=active==="discard"?"discard://chats":"discard://games/"+active;
    for (const game of games) root(game[0])?.classList.toggle("db-away",game[0]!==active);
    // The browser bar is above game canvases and available even in full-screen game menus.
    const signedIn = visible(document.getElementById("chatView"));
    bar.hidden=!signedIn;
    document.body.classList.toggle("db-ready",signedIn);
  }
  function activate(id) {
    if (id!=="discard"&&!tabs.includes(id)) return;
    active=id;
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
    // Releasing an existing in-app game uses its own Leave/Back action where available.
    // The root is kept mounted until the game handles its own cleanup, so save/session
    // behavior is not silently reset by destroying its DOM.
    root(id)?.classList.add("db-away");
    if(active===id)activate(tabs[i]||tabs[i-1]||"discard");
    else render();
  }
  for(const game of games) {
    document.getElementById(game[3])?.addEventListener("click",()=>{
      // Existing hub handlers perform initialization first. Register the tab afterward.
      setTimeout(()=>{if(visible(root(game[0])))openGame(game[0]);},50);
    });
  }
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
        activate("discard");
      }
    }).observe(el,{attributes:true,attributeFilter:["class","hidden","style"]});
  }
  // A chat invite can open a game without clicking the Games hub.
  window.discardBrowserTabs={open:openGame,activate,close:closeTab};
  render();
})();