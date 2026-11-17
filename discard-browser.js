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
  let unreadCount=0;
  let active = "discard";
  const storageKey = "discard-browser-workspace-v2";
  const settingsKey = "discard-browser-preferences-v1";
  let browserTheme = "light";
  try {const saved=JSON.parse(localStorage.getItem(settingsKey)||"{}");if(["light","dark","system"].includes(saved.theme))browserTheme=saved.theme;}catch{}
  try {
    const saved=JSON.parse(localStorage.getItem(storageKey)||"{}");
    if(Array.isArray(saved.tabs)) {
      for(const id of saved.tabs) if(byId[id]&&!tabs.includes(id))tabs.push(id);
    }
    if(saved.active==="discard"||tabs.includes(saved.active))active=saved.active||"discard";
  } catch {}
  let restoring = false;
  let restoreAttempted = false;
  const saveWorkspace = () => {try{localStorage.setItem(storageKey,JSON.stringify({tabs,active}));}catch{}};
  const saveSettings = () => {try{localStorage.setItem(settingsKey,JSON.stringify({theme:browserTheme}));}catch{}};

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
  #dbTabPreview{position:fixed;z-index:2147483002;width:320px;padding:8px;border:1px solid #bfd0e1;border-radius:12px;background:#f8fbff;color:#28374b;box-shadow:0 12px 36px #07162b55;font:12px "Segoe UI",system-ui,sans-serif;pointer-events:none}
  #dbTabPreview[hidden]{display:none!important}
  #dbTabPreview .db-preview-title{font-weight:700;padding:3px 4px 8px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
  #dbTabPreview .db-preview-window{position:relative;width:302px;height:188px;overflow:hidden;border:1px solid #cbd8e7;border-radius:7px;background:#fff;isolation:isolate}
  #dbTabPreview .db-preview-stage{position:absolute;left:0;top:0;width:960px;height:600px;transform:scale(.3145833);transform-origin:top left;overflow:hidden;pointer-events:none}
  #dbTabPreview .db-preview-stage>*{position:relative!important;inset:auto!important;top:0!important;left:0!important;display:block!important;visibility:visible!important;width:960px!important;height:600px!important;max-width:none!important;max-height:none!important;margin:0!important;overflow:hidden!important;transform:none!important;opacity:1!important}
  #dbTabPreview .db-preview-placeholder{display:grid;place-items:center;width:100%;height:100%;padding:20px;text-align:center;color:#65778d;background:linear-gradient(135deg,#eef4fc,#dfeaf7);font-size:14px}
  #discardBrowser[data-browser-theme="dark"]~#dbTabPreview{background:#303945;color:#eef4fa;border-color:#64758a}

  #discardBrowser .db-tab[aria-selected=true]{background:#fff;color:#192f49;box-shadow:0 -1px 3px #18345811;z-index:1}
  #discardBrowser .db-tab-icon{flex:none;width:17px;height:17px;display:grid;place-items:center;font-size:15px}
  #discardBrowser .db-tab-icon img{width:17px;height:17px;object-fit:contain;border-radius:4px}
  #discardBrowser .db-title{overflow:hidden;text-overflow:ellipsis;flex:1;text-align:left;font-size:12px}
  #discardBrowser .db-unread{display:none;flex:none;min-width:18px;height:18px;line-height:18px;padding:0 5px;border-radius:10px;background:#e32a46;color:#fff;text-align:center;font-size:10px;font-weight:750}
  #discardBrowser .db-unread[data-show="true"]{display:block}
  #discardBrowser .db-tab[data-has-unread="true"]{font-weight:700}
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
  #discardBrowser[data-browser-theme="dark"]{background:#21252d;color:#f3f6fb}
  #discardBrowser[data-browser-theme="dark"] .db-topline{background:#292e38}
  #discardBrowser[data-browser-theme="dark"] .db-tab{background:#383f4b;color:#d0d8e5}
  #discardBrowser[data-browser-theme="dark"] .db-tab:hover{background:#454f5c}
  #discardBrowser[data-browser-theme="dark"] .db-tab[aria-selected=true]{background:#414956;color:#fff}
  #discardBrowser[data-browser-theme="dark"] .db-toolbar{background:#414956;border-color:#303842}
  #discardBrowser[data-browser-theme="dark"] :is(.db-tool,.db-new){color:#e3eaf3}
  #discardBrowser[data-browser-theme="dark"] :is(.db-tool,.db-new):hover{background:#535e70}
  #discardBrowser[data-browser-theme="dark"] .db-address-wrap{background:#2d3540;border-color:#596779}
  #discardBrowser[data-browser-theme="dark"] .db-address{color:#e9f1fb}
  #discardBrowser[data-browser-theme="dark"] .db-lock{color:#c2d2e8}
  #discardBrowser[data-browser-theme="dark"] .db-window-title{color:#b8c5d6}
  #discardBrowser .db-settings{position:absolute;z-index:10;right:10px;top:84px;min-width:260px;padding:13px;border:1px solid #d7e0ec;border-radius:12px;background:#fff;color:#26364c;box-shadow:0 16px 42px #0003;font:13px "Segoe UI",system-ui,sans-serif}
  #discardBrowser .db-settings[hidden]{display:none!important}
  #discardBrowser .db-settings h3{margin:3px 4px 12px;font-size:15px}
  #discardBrowser .db-settings label{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:9px 4px}
  #discardBrowser .db-settings select{padding:7px 8px;border:1px solid #cbd6e5;border-radius:7px;background:#f7f9fc;color:#26364c}
  #discardBrowser .db-settings button{width:100%;margin-top:8px;padding:9px;border:0;border-radius:8px;background:#e8f0fc;color:#174b8c;text-align:left}
  #discardBrowser .db-settings button:hover{background:#d5e6fa}
  #discardBrowser .db-settings .db-settings-action{display:flex;align-items:center;justify-content:flex-start;gap:10px;width:100%;height:auto;min-height:39px;padding:10px 12px;margin:8px 0 0;border:0;border-radius:8px;background:#e8f0fc;color:#174b8c;font-size:13px;font-weight:600;line-height:1.35;white-space:normal;text-align:left}
  #discardBrowser .db-settings .db-settings-action:hover{background:#d5e6fa}
  #dbFullscreenExit{display:none;position:fixed;top:12px;right:14px;z-index:2147483646;border:1px solid #8599ae;border-radius:10px;background:#1e2d43;color:#fff;padding:10px 14px;box-shadow:0 3px 16px #0005;font:600 13px "Segoe UI",system-ui,sans-serif;cursor:pointer}
  body.db-app-fullscreen #dbFullscreenExit{display:block}
  html:has(body.db-ready),body.db-ready{height:100%;max-height:100dvh;overflow:hidden!important;overscroll-behavior:none}
  body.db-ready #chatView:not(.hidden){overflow:hidden!important}
  body.db-ready #gamesHub:not(.hidden){overflow-y:auto}
  body.db-app-fullscreen #discardBrowser{display:none!important}
  body.db-app-fullscreen #dbTabPreview{display:none!important}
  body.db-app-fullscreen #chatView:not(.hidden){margin-top:0!important;height:100dvh!important}
  body.db-app-fullscreen #gamesHub:not(.hidden){top:0!important;height:100dvh!important}
  body.db-app-fullscreen :is(#vfRoot,#oakRoot,#deadZoneRoot,#freeDrawRoot,#mtdRoot,#bbRoot,#tetRoot):not(.hidden):not(.db-away){top:0!important;height:100dvh!important;max-height:100dvh!important}
  body.db-app-fullscreen #dbFullscreenExit:focus-visible{outline:3px solid #7dc6ff}

  #discardBrowser[data-browser-theme="dark"] .db-settings{background:#343d49;border-color:#586474;color:#f4f7fa}
  #discardBrowser[data-browser-theme="dark"] .db-settings select{background:#242b34;color:#f4f7fa;border-color:#6e7a8b}
  #discardBrowser[data-browser-theme="dark"] .db-settings button{background:#475668;color:#f6f9fc}

  body.db-ready #chatView:not(.hidden){height:calc(100dvh - 88px)!important;margin-top:88px}
  body.db-ready #gamesHub:not(.hidden){top:88px!important;height:calc(100dvh - 88px)!important}
  body.db-ready .db-away{display:none!important}
  body.db-ready :is(#vfRoot,#oakRoot,#deadZoneRoot,#freeDrawRoot,#mtdRoot,#bbRoot,#tetRoot):not(.hidden):not(.db-away){top:88px!important;bottom:0!important;height:calc(100dvh - 88px)!important;max-height:calc(100dvh - 88px)!important}
  /* Apply fullscreen overrides after normal browser spacing rules so games really fill the viewport. */
  body.db-ready.db-app-fullscreen #chatView:not(.hidden){margin-top:0!important;height:100dvh!important;max-height:100dvh!important}
  body.db-ready.db-app-fullscreen #gamesHub:not(.hidden){top:0!important;height:100dvh!important}
  body.db-ready.db-app-fullscreen :is(#vfRoot,#oakRoot,#deadZoneRoot,#freeDrawRoot,#mtdRoot,#bbRoot,#tetRoot):not(.hidden):not(.db-away){top:0!important;bottom:0!important;height:100dvh!important;max-height:100dvh!important}
  @media(max-width:700px){#discardBrowser .db-topline{padding-left:5px;padding-right:5px;gap:2px}#discardBrowser .db-tab{flex-basis:125px;padding:0 5px 0 8px;gap:4px}#discardBrowser .db-window-title{display:none}#discardBrowser .db-toolbar{padding-left:6px;padding-right:6px;gap:2px}#discardBrowser .db-address-wrap{padding:0 8px}#discardBrowser .db-tool{width:27px}}
  `;
  document.head.append(style);
  const bar = document.createElement("nav");
  bar.id = "discardBrowser";
  bar.hidden = true;
  bar.setAttribute("aria-label","Discard browser tabs");
  // Preview content is cloned only on hover so live games are never moved.
  const preview=document.createElement("aside");
  preview.id="dbTabPreview";preview.hidden=true;
  preview.setAttribute("aria-hidden","true");
  document.body.append(preview);
  let previewTimer=null;
  const hidePreview=()=>{
    clearTimeout(previewTimer);
    preview.hidden=true;
    preview.replaceChildren();
  };
  const showPreview=(id,tab)=>{
    hidePreview();
    previewTimer=setTimeout(()=>{
      if(!tab.isConnected||bar.hidden||document.body.classList.contains("db-app-fullscreen"))return;
      const game=byId[id];
      const title=document.createElement("div");
      title.className="db-preview-title";
      title.textContent=game?game[1]:"Discard — Messages";
      const windowEl=document.createElement("div");
      windowEl.className="db-preview-window";
      const target=id==="discard"?document.getElementById("chatView"):root(id);
      if(target&&target.isConnected){
        try{
          const clone=target.cloneNode(true);
          clone.removeAttribute("id");
          clone.removeAttribute("hidden");
          clone.classList.remove("hidden","db-away");
          clone.querySelectorAll("[id]").forEach(n=>n.removeAttribute("id"));
          clone.querySelectorAll("script,iframe,video,audio").forEach(n=>n.remove());
          clone.querySelectorAll("input,textarea").forEach(n=>{n.value="";n.setAttribute("value","");});
          const originals=target.querySelectorAll("canvas");
          const copies=clone.querySelectorAll("canvas");
          copies.forEach((canvas,i)=>{
            try{
              const image=document.createElement("img");
              image.src=originals[i].toDataURL("image/png");
              image.style.cssText=canvas.style.cssText;
              image.width=originals[i].width;image.height=originals[i].height;
              image.style.width=canvas.getBoundingClientRect().width+"px";
              image.style.height=canvas.getBoundingClientRect().height+"px";
              canvas.replaceWith(image);
            }catch{}
          });
          const stage=document.createElement("div");stage.className="db-preview-stage";
          stage.append(clone);windowEl.append(stage);
        }catch{
          const placeholder=document.createElement("div");
          placeholder.className="db-preview-placeholder";
          placeholder.textContent=game?game[2]+" "+game[1]:"Discard messages";
          windowEl.append(placeholder);
        }
      }else{
        const placeholder=document.createElement("div");
        placeholder.className="db-preview-placeholder";
        placeholder.textContent=game?game[2]+" "+game[1]+" — open tab to load":"Discard messages";
        windowEl.append(placeholder);
      }
      preview.append(title,windowEl);
      const rect=tab.getBoundingClientRect();
      const left=Math.max(8,Math.min(window.innerWidth-328,rect.left));
      preview.style.left=left+"px";
      preview.style.top=Math.min(window.innerHeight-225,Math.max(42,rect.bottom+8))+"px";
      preview.hidden=false;
    },400);
  };
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
  const reload=tool("Reload Discard","↻",()=>window.location.reload());
  const home=tool("Games","⌂",openHub);
  const addressWrap=document.createElement("div");addressWrap.className="db-address-wrap";
  const lock=document.createElement("span");lock.className="db-lock";lock.textContent="◇";
  const location=document.createElement("input");
  location.className="db-address";location.setAttribute("aria-label","Discard address");
  location.autocomplete="off";location.spellcheck=false;
  location.placeholder="Search tabs or enter Discard location";
  const more=tool("Browser settings","⋯",()=>{settingsPanel.hidden=!settingsPanel.hidden;});
  more.classList.add("db-more");
  const settingsPanel=document.createElement("section");settingsPanel.className="db-settings";settingsPanel.hidden=true;
  settingsPanel.setAttribute("aria-label","Browser settings");
  const settingsTitle=document.createElement("h3");settingsTitle.textContent="Browser settings";
  const themeLabel=document.createElement("label");themeLabel.textContent="Appearance";
  const themeSelect=document.createElement("select");themeSelect.setAttribute("aria-label","Browser appearance");
  [["system","Use system"],["light","Light"],["dark","Dark"]].forEach(([value,label])=>{
    const option=document.createElement("option");option.value=value;option.textContent=label;themeSelect.append(option);
  });
  themeSelect.value=browserTheme;
  const updateTheme=()=>{
    const dark=browserTheme==="dark"||(browserTheme==="system"&&window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    bar.dataset.browserTheme=dark?"dark":"light";
  };
  themeSelect.addEventListener("change",()=>{browserTheme=themeSelect.value;saveSettings();updateTheme();});
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change",updateTheme);
  themeLabel.append(themeSelect);
  // In-app fullscreen fills Discard's own viewport; never request browser or OS fullscreen.
  let appFullscreen=false;
  const fullscreen=document.createElement("button");
  fullscreen.type="button";
  fullscreen.className="db-settings-action";
  const fullscreenSymbol=document.createElement("span");
  fullscreenSymbol.setAttribute("aria-hidden","true");
  fullscreenSymbol.textContent="⛶";
  const fullscreenText=document.createElement("span");
  fullscreen.append(fullscreenSymbol,fullscreenText);
  const fullscreenExit=document.createElement("button");
  fullscreenExit.id="dbFullscreenExit";
  fullscreenExit.type="button";
  fullscreenExit.textContent="⤢ Exit fullscreen";
  fullscreenExit.setAttribute("aria-label","Exit Discard fullscreen");
  document.body.append(fullscreenExit);
  const setAppFullscreen=enabled=>{
    hidePreview();
    appFullscreen=Boolean(enabled);
    document.body.classList.toggle("db-app-fullscreen",appFullscreen);
    const gameTitle=byId[active]?.[1]||"Discard";
    fullscreenText.textContent=appFullscreen?"Exit "+gameTitle+" fullscreen":"Fullscreen current tab";
    fullscreen.title=fullscreenText.textContent;
    fullscreen.setAttribute("aria-pressed",String(appFullscreen));
    settingsPanel.hidden=true;
    if(appFullscreen && active!=="discard" && !visible(root(active)))restoreActiveGame();
    window.dispatchEvent(new Event("resize"));
  };
  fullscreen.addEventListener("click",()=>setAppFullscreen(!appFullscreen));
  fullscreenExit.addEventListener("click",()=>setAppFullscreen(false));
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&appFullscreen&&
       !event.target?.matches?.("input,textarea,select")){
      setAppFullscreen(false);
    }
  });
  setAppFullscreen(false);
  settingsPanel.append(settingsTitle,themeLabel,fullscreen);
  updateTheme();
  document.addEventListener("pointerdown",event=>{
    if(!settingsPanel.hidden&&!settingsPanel.contains(event.target)&&event.target!==more)settingsPanel.hidden=true;
  });
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
  toolbar.append(reload,home,addressWrap,more);
  bar.append(topLine,toolbar,settingsPanel);
  document.body.append(bar);
  function root(game) {return document.getElementById(byId[game]?.[4]);}
  function visible(el) {return !!el && !el.classList.contains("hidden") && !el.hasAttribute("hidden") && el.style.display!=="none";}
  function render() {
    hidePreview();
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
      if(id==="discard"){
        const badge=document.createElement("span");badge.className="db-unread";
        badge.dataset.show=String(unreadCount>0&&active!=="discard");
        badge.textContent=unreadCount>99?"99+":String(unreadCount);
        badge.setAttribute("aria-label",unreadCount+" unread messages");
        tab.dataset.hasUnread=String(unreadCount>0&&active!=="discard");
        tab.append(badge);
      }
      tab.addEventListener("mouseenter",()=>showPreview(id,tab));
      tab.addEventListener("mouseleave",hidePreview);
      tab.addEventListener("focus",()=>showPreview(id,tab));
      tab.addEventListener("blur",hidePreview);
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
    for (const game of games) root(game[0])?.classList.toggle("db-away",game[0]!==active);
    // The browser bar is above game canvases and available even in full-screen game menus.
    const signedIn = visible(document.getElementById("chatView"));
    bar.hidden=!signedIn;
    document.body.classList.toggle("db-ready",signedIn);
    if(!signedIn && appFullscreen)setAppFullscreen(false);
    if(signedIn && !restoreAttempted){
      restoreAttempted=true;
      setTimeout(restoreActiveGame,350);
    }
  }
  function activate(id) {
    if (id!=="discard"&&!tabs.includes(id)) return;
    hidePreview();
    active=id;
    saveWorkspace();
    if(appFullscreen){
      fullscreenText.textContent="Exit "+(byId[active]?.[1]||"Discard")+" fullscreen";
    }
    document.getElementById("gamesHub")?.classList.add("hidden");
    render();
    if(id!=="discard")setTimeout(restoreActiveGame,0);
    window.dispatchEvent(new Event("resize"));
  }
  function restoreActiveGame(){
    if(restoring||active==="discard"||!tabs.includes(active))return;
    const game=byId[active];
    if(!game||visible(root(active)))return;
    const launcher=document.getElementById(game[3]);
    if(!launcher){restoreAttempted=false;return;}
    restoring=true;
    // Reopen the selected game's screen after refresh; other saved tabs remain
    // available and are loaded only when selected, avoiding multiple game sessions.
    launcher.click();
    setTimeout(()=>{restoring=false;},200);
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
    saveWorkspace();
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
  window.addEventListener("discard:unread-change",event=>{
    const next=Math.max(0,Math.floor(Number(event.detail?.count)||0));
    if(next===unreadCount)return;
    unreadCount=next;
    render();
  });
  bar.addEventListener("keydown",event=>{
    if(event.target?.matches?.("input,textarea,select") || event.target?.isContentEditable)event.stopPropagation();
  },true);
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
  window.discardBrowserTabs={open:openGame,activate,close:closeTab,activeTab:()=>active};
  render();
})();