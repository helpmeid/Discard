"use strict";

const authView = document.querySelector("#authView");
const chatView = document.querySelector("#chatView");
const authForm = document.querySelector("#authForm");
const authMessage = document.querySelector("#authMessage");
const authTitle = document.querySelector("#authTitle");
const authSubtitle = document.querySelector("#authSubtitle");
const authSubmit = document.querySelector("#authSubmit");
const usernameInput = document.querySelector("#username");
const chatList = document.querySelector("#chatList");
const messageArea = document.querySelector("#messageArea");
const messageForm = document.querySelector("#messageForm");
const messageInput = document.querySelector("#messageInput");
const newChatForm = document.querySelector("#newChatForm");
const newChatName = document.querySelector("#newChatName");
const friendsPanel = document.querySelector("#friendsPanel");
const friendForm = document.querySelector("#friendForm");
const friendMessage = document.querySelector("#friendMessage");
const friendUsername = document.querySelector("#friendUsername");
const requestList = document.querySelector("#requestList");
const friendsList = document.querySelector("#friendsList");
const memberChoices = document.querySelector("#memberChoices");
const conversationActions = document.querySelector("#conversationActions");
const groupManagement = document.querySelector("#groupManagement");
const groupMemberList = document.querySelector("#groupMemberList");
const settingsPanel = document.querySelector("#settingsPanel");
const settingsStatus = document.querySelector("#settingsStatus");
const displayNameInput = document.querySelector("#displayNameInput");
const settingControls = {
  theme: document.querySelector("#themePreference"),
  accent: document.querySelector("#accentPreference"),
  cursorEnabled: document.querySelector("#cursorEnabled"),
  cursorStyle: document.querySelector("#cursorPreference"),
  particlesEnabled: document.querySelector("#particlesEnabled"),
  particleStyle: document.querySelector("#particlePreference"),
  cursorColorMode: document.querySelector("#cursorColorMode"),
  cursorColor: document.querySelector("#cursorColor"),
  cursorSize: document.querySelector("#cursorSize"),
  particleColorMode: document.querySelector("#particleColorMode"),
  particleColor: document.querySelector("#particleColor"),
  particleCount: document.querySelector("#particleCount"),
  particleSize: document.querySelector("#particleSize"),
  particleTrail: document.querySelector("#particleTrail"),
  fontSize: document.querySelector("#fontSizePreference"),
  bubbleShape: document.querySelector("#bubblePreference"),
  compact: document.querySelector("#compactPreference"),
  tabDisguise: document.querySelector("#tabDisguise"),
  backgroundStyle: document.querySelector("#backgroundStyle"),
  backgroundColor: document.querySelector("#backgroundColor"),
  backgroundEndColor: document.querySelector("#backgroundEndColor"),
  backgroundMidColor: document.querySelector("#backgroundMidColor"),
  backgroundMidEnabled: document.querySelector("#backgroundMidEnabled"),
  backgroundAngle: document.querySelector("#backgroundAngle"),
  backgroundAnimated: document.querySelector("#backgroundAnimated"),
  backgroundSpeed: document.querySelector("#backgroundSpeed"),
  backgroundTone: document.querySelector("#backgroundTone"),
  panelOpacity: document.querySelector("#panelOpacity"),
  panelBlur: document.querySelector("#panelBlur"),
  borderStrength: document.querySelector("#borderStrength")
};
const defaultPreferences = {
  theme: "meadow",
  accent: "#245c48",
  cursorEnabled: false,
  cursorStyle: "sparkle",
  particlesEnabled: true,
  particleStyle: "sparkle",
  cursorColorMode: "accent",
  cursorColor: "#f2c94c",
  cursorSize: 32,
  particleColorMode: "accent",
  particleColor: "#f2c94c",
  particleCount: 6,
  particleSize: 15,
  particleTrail: false,
  fontSize: "regular",
  bubbleShape: "soft",
  compact: false,
  tabDisguise: false,
  backgroundStyle: "solid",
  backgroundColor: "#f2f3ed",
  backgroundEndColor: "#d7eddf",
  backgroundMidColor: "#f3d9e4",
  backgroundMidEnabled: false,
  backgroundAngle: 135,
  backgroundAnimated: false,
  backgroundSpeed: "medium",
  backgroundTone: "auto",
  panelOpacity: 80,
  panelBlur: 12,
  borderStrength: 0
};

const cursorStyles = ["sparkle", "heart", "diamond", "star", "arrow", "ring", "dot", "paw"];
const particleStyles = ["sparkle", "heart", "bubble", "leaf", "star", "confetti", "snow", "music", "flame"];
function sanitizeEffectPreferences(input, base) {
  const hex = (value, fallback) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
  const range = (value, min, max, fallback) => Number.isFinite(Number(value)) && value !== "" && value !== null ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback;
  return {
    cursorStyle: cursorStyles.includes(input.cursorStyle) ? input.cursorStyle : (cursorStyles.includes(base.cursorStyle) ? base.cursorStyle : "sparkle"),
    cursorColorMode: ["accent", "custom"].includes(input.cursorColorMode) ? input.cursorColorMode : base.cursorColorMode,
    cursorColor: hex(input.cursorColor, base.cursorColor),
    cursorSize: range(input.cursorSize, 20, 64, base.cursorSize),
    particleStyle: particleStyles.includes(input.particleStyle) ? input.particleStyle : (particleStyles.includes(base.particleStyle) ? base.particleStyle : "sparkle"),
    particleColorMode: ["accent", "rainbow", "custom"].includes(input.particleColorMode) ? input.particleColorMode : base.particleColorMode,
    particleColor: hex(input.particleColor, base.particleColor),
    particleCount: range(input.particleCount, 2, 16, base.particleCount),
    particleSize: range(input.particleSize, 10, 32, base.particleSize),
    particleTrail: typeof input.particleTrail === "boolean" ? input.particleTrail : base.particleTrail
  };
}

const backgroundStyles = ["solid", "linear", "radial", "conic", "mesh"];
function sanitizeBackgroundPreferences(input, base) {
  const hex = (value, fallback) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
  const range = (value, min, max, fallback) => Number.isFinite(Number(value)) && value !== "" && value !== null ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback;
  const style = input.backgroundStyle === "gradient" ? "linear" : input.backgroundStyle;
  return {
    backgroundStyle: backgroundStyles.includes(style) ? style : base.backgroundStyle === "gradient" ? "linear" : base.backgroundStyle,
    backgroundColor: hex(input.backgroundColor, base.backgroundColor),
    backgroundEndColor: hex(input.backgroundEndColor, base.backgroundEndColor),
    backgroundMidColor: hex(input.backgroundMidColor, base.backgroundMidColor),
    backgroundMidEnabled: typeof input.backgroundMidEnabled === "boolean" ? input.backgroundMidEnabled : base.backgroundMidEnabled,
    backgroundAngle: range(input.backgroundAngle, 0, 360, base.backgroundAngle),
    backgroundAnimated: typeof input.backgroundAnimated === "boolean" ? input.backgroundAnimated : base.backgroundAnimated,
    backgroundSpeed: ["slow", "medium", "fast"].includes(input.backgroundSpeed) ? input.backgroundSpeed : base.backgroundSpeed,
    backgroundTone: ["auto", "light", "dark"].includes(input.backgroundTone) ? input.backgroundTone : base.backgroundTone,
    panelOpacity: range(input.panelOpacity, 20, 100, base.panelOpacity),
    panelBlur: range(input.panelBlur, 0, 30, base.panelBlur),
    borderStrength: range(input.borderStrength, 0, 100, base.borderStrength ?? 0)
  };
}

function buildBackground(p) {
  const c1 = p.backgroundColor, c2 = p.backgroundEndColor, mid = p.backgroundMidEnabled ? `${p.backgroundMidColor}, ` : "";
  const stops = `${c1}, ${mid}${c2}`;
  switch (p.backgroundStyle) {
    case "linear": return `linear-gradient(${p.backgroundAngle}deg, ${stops})`;
    case "radial": return `radial-gradient(circle at 30% 20%, ${stops})`;
    case "conic": return `conic-gradient(from ${p.backgroundAngle}deg at 50% 50%, ${c1}, ${p.backgroundMidEnabled ? p.backgroundMidColor : c2}, ${c2}, ${c1})`;
    case "mesh": {
      const m = p.backgroundMidColor;
      return `radial-gradient(at 18% 14%, ${c1} 0, transparent 55%), radial-gradient(at 86% 18%, ${m} 0, transparent 52%), radial-gradient(at 78% 92%, ${c2} 0, transparent 55%), radial-gradient(at 8% 86%, ${m} 0, transparent 50%), ${c1}`;
    }
    default: return c1;
  }
}

function backgroundLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

const themePresets = [
  { name: "Aurora", style: "mesh", c1: "#0f3d3e", c2: "#3b1f5e", mid: "#1fa88a", accent: "#7ef0c6", animated: true },
  { name: "Sunset", style: "linear", c1: "#ff9a62", mid: "#ff5e8a", c2: "#5b2a86", midOn: true, angle: 160, accent: "#ffe3a3", animated: true },
  { name: "Lagoon", style: "linear", c1: "#d4f5ee", c2: "#a9d6f5", angle: 150, accent: "#1d7a8a" },
  { name: "Candy", style: "mesh", c1: "#ffd1e8", c2: "#d6c9ff", mid: "#c8f4ff", accent: "#c2407e", animated: true },
  { name: "Forest", style: "linear", c1: "#14301f", c2: "#2f5d3a", angle: 160, accent: "#b7e5a3" },
  { name: "Ember", style: "radial", c1: "#4a1020", c2: "#120408", mid: "#c0392b", midOn: true, accent: "#ffb38a" },
  { name: "Nebula", style: "conic", c1: "#1b1342", c2: "#0d2a52", mid: "#5b2a86", midOn: true, angle: 0, accent: "#c4a8ff", animated: true },
  { name: "Mocha", style: "linear", c1: "#efe3d3", c2: "#d6bfa5", angle: 135, accent: "#7a4a2b" },
  { name: "Neon", style: "mesh", c1: "#0b0b1e", c2: "#12122e", mid: "#ff2d95", accent: "#35f0ff", animated: true },
  { name: "Mint", style: "solid", c1: "#e2f6ea", accent: "#2a8a5c" },
  { name: "Slate", style: "solid", c1: "#1f2530", accent: "#8fb4ff" },
  { name: "Peach", style: "radial", c1: "#fff0e4", c2: "#ffc9b0", accent: "#c2543a" }
];

let mode = "signin";
let currentUser = null;
let snapshot = { friends: [], requests: [], chats: [], user: null };
let activeChatId = null;
let refreshing = false;
let renderedKeys = {};
let renderedChatId = null;
let preferenceSaveTimer = null;

const APP_VERSION = "2.8.0";
document.querySelectorAll(".brand-mark").forEach(image => { image.src = BRAND_IMAGE; });
const tabIcon = document.createElement("link");
tabIcon.rel = "icon";
tabIcon.href = BRAND_IMAGE;
document.head.append(tabIcon);

const mingaIcon = `data:image/svg+xml;base64,${btoa("<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#1e88e5'/><path d='M12 46V22l10 14 10-14v24M36 46V22l10 14 6-8' fill='none' stroke='#fff' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/></svg>")}`;
const disguiseKey = "discard-tab-disguise";

// The disguise is remembered outside the account so the sign-in screen is covered too.
function applyTabDisguise(on, remember = true) {
  document.title = on ? "Minga" : "Discard";
  tabIcon.href = on ? mingaIcon : BRAND_IMAGE;
  if (remember) {
    try { localStorage.setItem(disguiseKey, on ? "1" : ""); } catch {}
  }
}
try { if (localStorage.getItem(disguiseKey)) applyTabDisguise(true, false); } catch {}

const idPattern = /^dsc-[a-z0-9]{6,16}$/;
const safeIdPattern = /^[\w-]{1,64}$/;
const avatarPattern = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const imageUrlPattern = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
const tenorUrlPattern = /^https:\/\/(?:media\d*\.tenor\.com|media\d*\.giphy\.com)\/[\w\-/.%~]+$/;
// Public GIPHY browser key shared by everyone using this app.
const GIPHY_API_KEY = "8tdFAXlnlUWwcCjTd8Njko0kNQozvdc";
const maxWireImageChars = 4.5 * 1024 * 1024;
const maxFileBytes = 5 * 1024 * 1024;
const maxWireFileChars = Math.ceil(maxFileBytes / 3) * 4 + 64;
const fileDataPattern = /^data:application\/octet-stream;base64,[A-Za-z0-9+/=]*$/;

const idb = {
  handle: null,
  name: "discard-p2p-none",
  use(name) {
    this.name = name;
    this.handle = null;
  },
  open() {
    if (!this.handle) {
      this.handle = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore("kv");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.handle;
  },
  async run(mode, work) {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("kv", mode);
      let result;
      work(transaction.objectStore("kv"), value => { result = value; });
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  },
  readAll() {
    return this.run("readonly", (store, done) => {
      const entries = {};
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          entries[cursor.key] = cursor.value;
          cursor.continue();
        } else {
          done(entries);
        }
      };
    });
  },
  write(puts, deletes) {
    return this.run("readwrite", store => {
      Object.entries(puts).forEach(([key, value]) => store.put(value, key));
      deletes.forEach(key => store.delete(key));
    });
  },
  clear() {
    return this.run("readwrite", store => { store.clear(); });
  }
};

let state = null;
const dirty = new Set();
const removedKeys = new Set();
let saveTimer = null;
let saving = false;
let storageLimit = 100 * 1024 * 1024;
let storageNotice = "";

function randomId(length) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return [...crypto.getRandomValues(new Uint8Array(length))].map(byte => chars[byte % chars.length]).join("");
}

function markDirty(key) {
  if (!state) return;
  removedKeys.delete(key);
  dirty.add(key);
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushSave, 100);
}

function touchMeta() { markDirty("meta"); }

function touchChat(chat) {
  chat.rev = (chat.rev || 0) + 1;
  markDirty(`chat:${chat.id}`);
}

function messageBytes(message) {
  return 200 + (message.text?.length || 0) + (message.image?.url?.length || 0) + (message.file?.data?.length || 0);
}

function totalMessageBytes() {
  let total = 0;
  state.chats.forEach(chat => chat.messages.forEach(message => { total += messageBytes(message); }));
  return total;
}

// Deletes the oldest messages across all chats until the saved messages fit in targetBytes.
function trimTo(targetBytes) {
  const all = [];
  state.chats.forEach(chat => chat.messages.forEach(message => all.push({ chat, message, size: messageBytes(message) })));
  let total = all.reduce((sum, item) => sum + item.size, 0);
  if (!all.length || total <= targetBytes) return 0;
  all.sort((first, second) => first.message.createdAt - second.message.createdAt);
  const doomed = new Set();
  for (const item of all) {
    if (total <= targetBytes) break;
    doomed.add(item.message);
    total -= item.size;
  }
  state.chats.forEach(chat => {
    const kept = chat.messages.filter(message => !doomed.has(message));
    if (kept.length !== chat.messages.length) {
      chat.messages = kept;
      touchChat(chat);
    }
  });
  storageNotice = `Storage was running low, so ${doomed.size} of the oldest messages were removed.`;
  return doomed.size;
}

function enforceStorageLimit() {
  if (!state) return;
  if (totalMessageBytes() > storageLimit) trimTo(storageLimit * 0.8);
}

async function refreshStorageLimit() {
  try {
    const estimate = await navigator.storage.estimate();
    if (estimate.quota) storageLimit = Math.min(300 * 1024 * 1024, Math.max(20 * 1024 * 1024, estimate.quota * 0.4));
    navigator.storage.persist?.();
  } catch {}
  enforceStorageLimit();
}

async function flushSave() {
  if (!state) return;
  if (saving) {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(flushSave, 100);
    return;
  }
  saving = true;
  let ok = false;
  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const keys = [...dirty];
      const deletes = [...removedKeys];
      dirty.clear();
      removedKeys.clear();
      const puts = {};
      keys.forEach(key => {
        if (key === "meta") {
          const { chats, ...meta } = state;
          puts.meta = meta;
        } else {
          const chat = state.chats.find(item => `chat:${item.id}` === key);
          if (chat) puts[key] = chat;
          else deletes.push(key);
        }
      });
      try {
        await idb.write(puts, deletes);
        ok = true;
        break;
      } catch (error) {
        keys.forEach(key => dirty.add(key));
        deletes.forEach(key => removedKeys.add(key));
        const total = totalMessageBytes();
        if (!total || !trimTo(total * 0.75)) {
          storageNotice = "Could not save: this computer is out of storage space.";
          break;
        }
      }
    }
  } finally {
    saving = false;
  }
  if (ok && (dirty.size || removedKeys.size)) {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(flushSave, 100);
  }
}

window.addEventListener("pagehide", () => { if (dirty.size) flushSave(); });

function defaultState(me) {
  return { me, friends: {}, people: {}, requests: [], gifs: [], favoriteGifs: [], tenorKey: "", pendingFriendRemovals: [], pendingGroupDeletes: [], pendingGroupLeaves: [], nicknames: {}, chats: [] };
}

async function loadState() {
  const entries = await idb.readAll();
  if (!entries.meta?.me) return null;
  const loaded = { ...defaultState(entries.meta.me), ...entries.meta, chats: [] };
  loaded.me.preferences = { ...defaultPreferences, ...(loaded.me.preferences || {}) };
  Object.entries(entries).forEach(([key, value]) => {
    if (key.startsWith("chat:")) loaded.chats.push({ rev: 0, invites: [], ...value });
  });
  loaded.chats.forEach(chat => chat.messages.sort((first, second) => first.createdAt - second.createdAt));
  return loaded;
}

const officialProfile = { id: OFFICIAL_ID, username: OFFICIAL_USERNAME, displayName: "Discard Official ✓", avatar: BRAND_IMAGE };
const officialReply = "Message received! Thanks for contacting Discard.";
const officialReplyAt = new Map();
let officialKey = null;
let officialPublic = null;

const looksOfficial = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, "").includes("discardofficial");
const isOfficialSelf = () => Boolean(state?.me.official);
const officialTrusted = id => id !== OFFICIAL_ID || isOfficialSelf() || conns.get(id)?.verified === true;
const fromBase64 = text => Uint8Array.from(atob(text), char => char.charCodeAt(0));
const toBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));

async function unlockOfficial(passcode) {
  const { salt, iv, data, iterations } = OFFICIAL_LOCKED_KEY;
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passcode.trim()), "PBKDF2", false, ["deriveKey"]);
  const aes = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: fromBase64(salt), iterations, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const pkcs8 = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, aes, fromBase64(data));
  officialKey = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function signOfficial(text) {
  return toBase64(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, officialKey, new TextEncoder().encode(text)));
}

async function verifyOfficial(text, signature) {
  try {
    officialPublic ||= await crypto.subtle.importKey("jwk", OFFICIAL_PUBLIC_KEY, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, officialPublic, fromBase64(signature), new TextEncoder().encode(text));
  } catch {
    return false;
  }
}

function sanitizeProfile(input, id) {
  if (id === OFFICIAL_ID) return officialProfile;
  if (!input || typeof input !== "object" || typeof input.username !== "string" || !/^[a-zA-Z0-9_]{3,24}$/.test(input.username)) return null;
  const displayName = typeof input.displayName === "string" ? input.displayName.trim().slice(0, 32) : "";
  const avatar = typeof input.avatar === "string" && input.avatar.length <= 300000 && avatarPattern.test(input.avatar) ? input.avatar : null;
  if (looksOfficial(input.username) || looksOfficial(displayName)) return null;
  return { id, username: input.username, displayName: displayName || input.username, avatar };
}

function sanitizeImage(image) {
  if (!image || typeof image.url !== "string") return null;
  if (tenorUrlPattern.test(image.url)) return { id: image.url, url: image.url, type: "image/gif" };
  if (image.url.length > maxWireImageChars || !imageUrlPattern.test(image.url)) return null;
  const id = typeof image.id === "string" && safeIdPattern.test(image.id) ? image.id : randomId(16);
  return { id, url: image.url, type: image.url.slice(5, image.url.indexOf(";")) };
}

function sanitizeFile(file) {
  if (!file || typeof file.data !== "string" || file.data.length > maxWireFileChars || !fileDataPattern.test(file.data)) return null;
  const name = (typeof file.name === "string" ? file.name : "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().slice(0, 100) || "file";
  const type = typeof file.type === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(file.type) && file.type.length <= 100 ? file.type : "application/octet-stream";
  const size = Number.isFinite(file.size) ? Math.max(0, Math.min(Math.floor(file.size), maxFileBytes)) : 0;
  return { id: typeof file.id === "string" && safeIdPattern.test(file.id) ? file.id : randomId(16), name, type, size, data: file.data };
}

function sanitizeAvatar(value) {
  return typeof value === "string" && value.length <= 300000 && avatarPattern.test(value) ? value : null;
}

function sanitizeNickname(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 32) : "";
}

function myProfile() {
  const { id, username, displayName, avatar } = state.me;
  return { id, username, displayName, avatar };
}

function personOf(id) {
  if (id === OFFICIAL_ID && !isOfficialSelf()) return officialProfile;
  if (id === state.me.id) return myProfile();
  return state.people[id] || { id, username: "unknown", displayName: "Former member", avatar: null };
}

// Local-only view of a person: a nickname you set replaces their display name.
function viewPerson(id) {
  const person = personOf(id);
  const nickname = id === state.me.id ? "" : state.nicknames?.[id];
  return nickname ? { ...person, displayName: nickname, realName: person.displayName } : person;
}

function directChatId(otherId) {
  return `dm:${[state.me.id, otherId].sort().join(":")}`;
}

function ensureDirectChat(friendId) {
  const id = directChatId(friendId);
  let chat = state.chats.find(item => item.id === id);
  if (!chat) {
    chat = { id, name: "", isGroup: false, members: [state.me.id, friendId], messages: [], invites: [], createdAt: Date.now(), rev: 0 };
    state.chats.push(chat);
    touchChat(chat);
  }
  return chat;
}

function chatToView(chat) {
  const otherId = chat.isGroup ? null : chat.members.find(id => id !== state.me.id);
  const other = otherId ? viewPerson(otherId) : null;
  return {
    id: chat.id,
    name: chat.isGroup ? chat.name : other.displayName,
    avatar: chat.isGroup ? (chat.avatar || null) : (other?.avatar || null),
    username: other?.username || null,
    isGroup: chat.isGroup,
    ownerId: chat.isGroup ? (chat.ownerId || chat.members[0]) : null,
    online: otherId ? isOnline(otherId) : null,
    members: chat.members.map(viewPerson),
    messages: chat.messages,
    rev: chat.rev || 0
  };
}

function snapshotLocal() {
  Object.keys(state.friends).forEach(ensureDirectChat);
  return {
    user: accountUser(),
    friends: Object.values(state.friends).map(friend => ({ ...viewPerson(friend.id), online: isOnline(friend.id) })),
    requests: state.requests.map(request => ({ id: request.id, direction: request.direction, user: request.user })),
    chats: state.chats.filter(chat => chat.isGroup || state.friends[chat.members.find(id => id !== state.me.id)]).map(chatToView)
  };
}

function accountUser() {
  const { id, username, displayName, avatar, preferences } = state.me;
  return { id, username, displayName, avatar, preferences: { ...preferences } };
}

// ---------- peer-to-peer connections ----------
const conns = new Map();
const lastAttempt = new Map();
let peer = null;
let peerBlocked = false;
const onlineWindow = 35000;

function setNet(text, good) {
  const label = document.querySelector("#netText");
  const dot = document.querySelector("#netDot");
  if (label) label.textContent = text;
  if (dot) dot.classList.toggle("online", Boolean(good));
}

let notifyTimer = null;
function notify() {
  window.clearTimeout(notifyTimer);
  notifyTimer = window.setTimeout(() => { if (currentUser) refreshSnapshot(); }, 30);
}

function isOnline(id) {
  const entry = conns.get(id);
  return Boolean(entry?.conn.open && officialTrusted(id) && Date.now() - entry.lastSeen < onlineWindow);
}

function sendTo(id, payload) {
  const entry = conns.get(id);
  if (!entry?.conn.open || !officialTrusted(id)) return false;
  try {
    entry.conn.send(payload);
    return true;
  } catch {
    return false;
  }
}

function startPeer() {
  if (!state || peerBlocked || (peer && !peer.destroyed)) return;
  if (typeof Peer === "undefined") {
    setNet("Offline: could not load the connection library. Reconnect to the internet and reload.", false);
    return;
  }
  setNet("Connecting...", false);
  const current = new Peer(state.me.id);
  peer = current;
  const restart = delay => {
    if (peer === current) peer = null;
    try { current.destroy(); } catch {}
    window.setTimeout(startPeer, delay);
  };
  current.on("open", () => {
    setNet("Connected. Friends can reach you.", true);
    connectAll();
  });
  current.on("connection", attach);
  current.on("disconnected", () => {
    setNet("Reconnecting...", false);
    window.setTimeout(() => { if (peer === current && !current.destroyed) try { current.reconnect(); } catch {} }, 3000);
  });
  current.on("error", error => {
    if (error.type === "peer-unavailable") return;
    if (error.type === "unavailable-id") {
      setNet("This profile looks open somewhere else. Retrying...", false);
      restart(15000);
    } else {
      setNet("Offline. Retrying...", false);
      restart(6000);
    }
  });
}

function connectTo(id) {
  if (!peer || !peer.open || conns.get(id)?.conn.open) return;
  if (Date.now() - (lastAttempt.get(id) || 0) < 9000) return;
  lastAttempt.set(id, Date.now());
  try { attach(peer.connect(id, { reliable: true })); } catch {}
}

function wantedPeers() {
  const ids = new Set(Object.keys(state.friends));
  state.requests.forEach(request => ids.add(request.id));
  (state.pendingFriendRemovals || []).forEach(removal => ids.add(removal.id));
  state.chats.forEach(chat => {
    chat.members.forEach(id => ids.add(id));
    (chat.pendingGroupUpdateIds || []).forEach(id => ids.add(id));
  });
  (state.pendingGroupDeletes || []).forEach(deletion => deletion.pending.forEach(id => ids.add(id)));
  (state.pendingGroupLeaves || []).forEach(leave => ids.add(leave.ownerId));
  ids.delete(state.me.id);
  return ids;
}

function connectAll() {
  if (state) wantedPeers().forEach(connectTo);
}

function greet(id) {
  sendTo(id, { t: "hello", profile: myProfile() });
  if (state.requests.some(request => request.id === id && request.direction === "outgoing")) {
    sendTo(id, { t: "friend-request", profile: myProfile() });
  }
  flushOutbox(id);
  notify();
}

function attach(conn) {
  const id = conn.peer;
  conn.on("open", () => {
    const entry = { conn, lastSeen: Date.now(), verified: false, nonce: null };
    conns.set(id, entry);
    if (id === OFFICIAL_ID && !isOfficialSelf()) {
      entry.nonce = randomId(32);
      try { conn.send({ t: "challenge", nonce: entry.nonce }); } catch {}
      return;
    }
    greet(id);
  });
  conn.on("data", data => {
    try {
      handleData(id, data);
    } catch {}
  });
  const gone = () => {
    if (conns.get(id)?.conn === conn) conns.delete(id);
    notify();
  };
  conn.on("close", gone);
  conn.on("error", gone);
}

function groupPayload(chat) {
  return { id: chat.id, name: chat.name, avatar: chat.avatar || null, ownerId: chat.ownerId || chat.members[0], members: chat.members.map(personOf) };
}

function groupUpdatePayload(chat) {
  return { ...groupPayload(chat), updateId: chat.pendingGroupUpdateId };
}

function removeChatLocal(chat) {
  state.chats = state.chats.filter(item => item !== chat);
  dirty.delete(`chat:${chat.id}`);
  removedKeys.add(`chat:${chat.id}`);
  touchMeta();
}

function broadcastGroupUpdate(chat, previousMembers) {
  const recipients = new Set([...previousMembers, ...chat.members, ...(chat.invites || [])]);
  recipients.delete(state.me.id);
  chat.pendingGroupUpdateId = randomId(20);
  chat.pendingGroupUpdateIds = [...new Set([...(chat.pendingGroupUpdateIds || []), ...recipients])];
  touchChat(chat);
  recipients.forEach(id => {
    connectTo(id);
    sendTo(id, { t: "group-update", chat: groupUpdatePayload(chat) });
  });
}

function flushOutbox(id) {
  (state.pendingFriendRemovals || []).filter(removal => removal.id === id).forEach(removal => {
    sendTo(id, { t: "friend-remove", removalId: removal.removalId });
  });
  (state.pendingGroupLeaves || []).filter(leave => leave.ownerId === id).forEach(leave => {
    sendTo(id, { t: "group-leave", chatId: leave.chatId });
  });
  (state.pendingGroupDeletes || []).filter(deletion => deletion.pending.includes(id)).forEach(deletion => {
    sendTo(id, { t: "group-delete", chatId: deletion.id });
  });
  state.chats.filter(chat => chat.members.includes(id) || chat.pendingGroupUpdateIds?.includes(id)).forEach(chat => {
    if (chat.isGroup && chat.invites?.includes(id)) sendTo(id, { t: "group", chat: groupPayload(chat) });
    if (chat.isGroup && chat.pendingGroupUpdateIds?.includes(id)) sendTo(id, { t: "group-update", chat: groupUpdatePayload(chat) });
    chat.messages.filter(message => message.sender === state.me.id && message.pending?.includes(id)
      && !chat.deletedMessageIds?.includes(message.id)).forEach(message => {
      sendTo(id, { t: "msg", chatId: chat.id, msg: { id: message.id, text: message.text, image: message.image, file: message.file, replyTo: message.replyTo, createdAt: message.createdAt } });
    });
  });
}

function rememberDeletedMessage(chat, messageId) {
  chat.deletedMessageIds ||= [];
  if (!chat.deletedMessageIds.includes(messageId)) {
    chat.deletedMessageIds.push(messageId);
    if (chat.deletedMessageIds.length > 2000) chat.deletedMessageIds.shift();
  }
}

function chatForSender(from, chatId) {
  if (typeof chatId !== "string") return null;
  if (chatId.startsWith("dm:")) return state.friends[from] && chatId === directChatId(from) ? ensureDirectChat(from) : null;
  const chat = state.chats.find(item => item.id === chatId && item.isGroup);
  return chat?.members.includes(from) ? chat : null;
}

function addFriend(id, profile) {
  state.pendingFriendRemovals = (state.pendingFriendRemovals || []).filter(removal => removal.id !== id);
  state.friends[id] = profile;
  state.people[id] = profile;
  state.requests = state.requests.filter(request => request.id !== id);
  ensureDirectChat(id);
  touchMeta();
}

function handleData(from, data) {
  const entry = conns.get(from);
  if (entry) entry.lastSeen = Date.now();
  if (!data || typeof data !== "object" || typeof data.t !== "string") return;
  if (!officialTrusted(from) && data.t !== "proof") return;
  if (data.t.startsWith("game-")) {
    garlicHandle(from, data);
    return;
  }
  if (data.t.startsWith("party-")) {
    partyGamesHandle(from, data);
    return;
  }
  const profile = data.profile ? sanitizeProfile(data.profile, from) : null;
  switch (data.t) {
    case "challenge":
      if (isOfficialSelf() && officialKey && typeof data.nonce === "string" && data.nonce.length <= 64) {
        signOfficial(`${data.nonce}:${from}`).then(sig => sendTo(from, { t: "proof", sig })).catch(() => {});
      }
      return;
    case "proof":
      if (from === OFFICIAL_ID && !isOfficialSelf() && entry?.nonce && !entry.verified && typeof data.sig === "string") {
        verifyOfficial(`${entry.nonce}:${state.me.id}`, data.sig).then(ok => {
          if (ok && conns.get(from) === entry) {
            entry.verified = true;
            greet(from);
          }
        });
      }
      return;
    case "hello":
      if (!profile) return;
      state.people[from] = profile;
      if (state.friends[from]) state.friends[from] = profile;
      state.requests.forEach(request => { if (request.id === from) request.user = profile; });
      touchMeta();
      break;
    case "friend-request":
      if (!profile) return;
      if (isOfficialSelf() && !state.friends[from] && Object.keys(state.friends).length < 5000) {
        addFriend(from, profile);
        sendTo(from, { t: "friend-accept", profile: myProfile() });
        break;
      }
      if (state.friends[from]) {
        sendTo(from, { t: "friend-accept", profile: myProfile() });
      } else if (state.requests.some(request => request.id === from && request.direction === "outgoing")) {
        addFriend(from, profile);
        sendTo(from, { t: "friend-accept", profile: myProfile() });
      } else if (!state.requests.some(request => request.id === from) && state.requests.length < 50) {
        state.requests.push({ id: from, direction: "incoming", user: profile });
        state.people[from] = profile;
        touchMeta();
      }
      break;
    case "friend-accept":
      if (profile && state.requests.some(request => request.id === from && request.direction === "outgoing")) addFriend(from, profile);
      break;
    case "friend-decline":
      state.requests = state.requests.filter(request => !(request.id === from && request.direction === "outgoing"));
      touchMeta();
      break;
    case "friend-remove": {
      if (!safeIdPattern.test(data.removalId || "")) return;
      delete state.friends[from];
      state.requests = state.requests.filter(request => request.id !== from);
      state.chats.filter(chat => !chat.isGroup && chat.members.includes(from)).forEach(removeChatLocal);
      touchMeta();
      sendTo(from, { t: "friend-remove-ack", removalId: data.removalId });
      notify();
      return;
    }
    case "friend-remove-ack": {
      if (!safeIdPattern.test(data.removalId || "")) return;
      const removal = state.pendingFriendRemovals?.find(item => item.id === from && item.removalId === data.removalId);
      if (!removal) return;
      state.pendingFriendRemovals = state.pendingFriendRemovals.filter(item => item !== removal);
      touchMeta();
      return;
    }
    case "group": {
      const info = data.chat;
      if (!state.friends[from] || !info || typeof info.id !== "string" || !safeIdPattern.test(info.id) || !info.id.startsWith("g-")) return;
      const existing = state.chats.find(item => item.id === info.id);
      if (!existing) {
        const name = typeof info.name === "string" ? info.name.trim().slice(0, 40) : "";
        const members = Array.isArray(info.members) ? info.members.slice(0, 50) : [];
        const profiles = members.map(member => idPattern.test(member?.id) ? sanitizeProfile(member, member.id) : null);
        if (!name || profiles.some(item => !item) || !profiles.some(item => item.id === state.me.id) || !profiles.some(item => item.id === from)) return;
        const ownerId = idPattern.test(info.ownerId) ? info.ownerId : profiles[0]?.id;
        if (!profiles.some(item => item.id === ownerId)) return;
        profiles.forEach(item => { if (item.id !== state.me.id && !state.people[item.id]) state.people[item.id] = item; });
        const chat = { id: info.id, name, isGroup: true, ownerId, members: profiles.map(item => item.id), messages: [], invites: [], createdAt: Date.now(), rev: 0 };
        const groupAvatar = sanitizeAvatar(info.avatar);
        if (groupAvatar) chat.avatar = groupAvatar;
        state.chats.push(chat);
        touchChat(chat);
        touchMeta();
      }
      sendTo(from, { t: "ack", chatId: info.id });
      break;
    }
    case "group-update": {
      const info = data.chat;
      const chat = state.chats.find(item => item.id === info?.id && item.isGroup);
      if (!safeIdPattern.test(info?.updateId || "") || !Array.isArray(info.members)) return;
      if (!chat) {
        if (!info.members.some(member => member?.id === state.me.id)) {
          sendTo(from, { t: "group-update-ack", chatId: info.id, updateId: info.updateId });
        }
        return;
      }
      if (chat.lastGroupUpdateId === info.updateId && chat.lastGroupUpdateSender === from) {
        sendTo(from, { t: "group-update-ack", chatId: chat.id, updateId: info.updateId });
        break;
      }
      if ((chat.ownerId || chat.members[0]) !== from) return;
      const members = info.members.slice(0, 50);
      const profiles = members.map(member => idPattern.test(member?.id) ? sanitizeProfile(member, member.id) : null);
      const ownerId = typeof info.ownerId === "string" ? info.ownerId : from;
      const name = typeof info.name === "string" ? info.name.trim().slice(0, 40) : "";
      if (!name || profiles.length < 1 || profiles.some(item => !item) || new Set(profiles.map(item => item.id)).size !== profiles.length
        || !profiles.some(item => item.id === ownerId) || !profiles.some(item => item.id === from)) return;
      profiles.forEach(item => { if (item.id !== state.me.id) state.people[item.id] = item; });
      chat.name = name;
      const groupAvatar = sanitizeAvatar(info.avatar);
      if (groupAvatar) chat.avatar = groupAvatar;
      else delete chat.avatar;
      chat.ownerId = ownerId;
      chat.members = profiles.map(item => item.id);
      chat.invites = (chat.invites || []).filter(id => chat.members.includes(id));
      chat.lastGroupUpdateId = info.updateId;
      chat.lastGroupUpdateSender = from;
      if (ownerId !== state.me.id && chat.pendingGroupUpdateIds?.length) {
        chat.pendingGroupUpdateIds = chat.pendingGroupUpdateIds.filter(id => !chat.members.includes(id));
        if (!chat.pendingGroupUpdateIds.length) chat.pendingGroupUpdateId = null;
      }
      touchChat(chat);
      sendTo(from, { t: "group-update-ack", chatId: chat.id, updateId: info.updateId });
      if (!chat.members.includes(state.me.id)) removeChatLocal(chat);
      notify();
      break;
    }
    case "group-delete": {
      const chat = state.chats.find(item => item.id === data.chatId && item.isGroup);
      if (chat && (chat.ownerId || chat.members[0]) !== from) return;
      if (chat) removeChatLocal(chat);
      sendTo(from, { t: "group-delete-ack", chatId: data.chatId });
      notify();
      break;
    }
    case "group-update-ack": {
      const chat = state.chats.find(item => item.id === data.chatId && item.isGroup);
      if (!chat || !chat.pendingGroupUpdateIds?.includes(from) || data.updateId !== chat.pendingGroupUpdateId) return;
      chat.pendingGroupUpdateIds = chat.pendingGroupUpdateIds.filter(id => id !== from);
      if (!chat.pendingGroupUpdateIds.length) chat.pendingGroupUpdateId = null;
      touchChat(chat);
      break;
    }
    case "group-delete-ack": {
      const deletion = state.pendingGroupDeletes?.find(item => item.id === data.chatId && item.pending.includes(from));
      if (!deletion) return;
      deletion.pending = deletion.pending.filter(id => id !== from);
      state.pendingGroupDeletes = state.pendingGroupDeletes.filter(item => item.pending.length);
      touchMeta();
      break;
    }
    case "group-leave": {
      const chat = state.chats.find(item => item.id === data.chatId && item.isGroup);
      if (!chat) {
        sendTo(from, { t: "group-leave-ack", chatId: data.chatId });
      } else if ((chat.ownerId || chat.members[0]) === state.me.id) {
        if (chat.members.includes(from) && from !== state.me.id) {
          const previousMembers = [...chat.members];
          chat.members = chat.members.filter(id => id !== from);
          chat.invites = (chat.invites || []).filter(id => id !== from);
          broadcastGroupUpdate(chat, previousMembers);
        }
        sendTo(from, { t: "group-leave-ack", chatId: data.chatId });
      } else {
        const ownerId = chat.ownerId || chat.members[0];
        connectTo(ownerId);
        sendTo(from, { t: "group-owner", chatId: data.chatId, ownerId });
      }
      notify();
      break;
    }
    case "group-owner": {
      const ownerId = typeof data.ownerId === "string" ? data.ownerId : "";
      const leave = state.pendingGroupLeaves?.find(item => item.chatId === data.chatId && item.ownerId === from);
      if (!leave || !idPattern.test(ownerId) || ownerId === state.me.id) return;
      leave.ownerId = ownerId;
      touchMeta();
      connectTo(ownerId);
      sendTo(ownerId, { t: "group-leave", chatId: data.chatId });
      break;
    }
    case "group-leave-ack": {
      const leave = state.pendingGroupLeaves?.find(item => item.chatId === data.chatId && item.ownerId === from);
      if (!leave) return;
      state.pendingGroupLeaves = state.pendingGroupLeaves.filter(item => item !== leave);
      touchMeta();
      break;
    }
    case "msg": {
      const chat = chatForSender(from, data.chatId);
      const msg = data.msg;
      if (!chat || !msg || typeof msg.id !== "string" || !safeIdPattern.test(msg.id)) return;
      if (chat.deletedMessageIds?.includes(msg.id)) {
        sendTo(from, { t: "ack", chatId: chat.id, msgId: msg.id });
        break;
      }
      const text = typeof msg.text === "string" ? msg.text.slice(0, 4000) : "";
      const image = msg.image ? sanitizeImage(msg.image) : null;
      const file = msg.file ? sanitizeFile(msg.file) : null;
      const replyTo = typeof msg.replyTo === "string" && safeIdPattern.test(msg.replyTo) ? msg.replyTo : null;
      if (!text.trim() && !image && !file) return;
      if (!chat.messages.some(message => message.id === msg.id)) {
        const createdAt = Number.isFinite(msg.createdAt) ? Math.min(Math.max(msg.createdAt, 0), Date.now()) : Date.now();
        chat.messages.push({ id: msg.id, sender: from, text, ...(image ? { image } : {}), ...(file ? { file } : {}), ...(replyTo ? { replyTo } : {}), createdAt, pending: [] });
        if (chat.messages.length > 1 && chat.messages.at(-2).createdAt > createdAt) chat.messages.sort((first, second) => first.createdAt - second.createdAt);
        touchChat(chat);
        enforceStorageLimit();
        if (isOfficialSelf() && Date.now() - (officialReplyAt.get(from) || 0) > 20000) {
          officialReplyAt.set(from, Date.now());
          sendMessageLocal(chat, officialReply);
        }
      }
      sendTo(from, { t: "ack", chatId: chat.id, msgId: msg.id });
      break;
    }
    case "msg-delete": {
      const chat = chatForSender(from, data.chatId);
      if (!chat || typeof data.msgId !== "string" || !safeIdPattern.test(data.msgId)) return;
      const index = chat.messages.findIndex(message => message.id === data.msgId && message.sender === from);
      if (index >= 0) chat.messages.splice(index, 1);
      rememberDeletedMessage(chat, data.msgId);
      touchChat(chat);
      break;
    }
    case "ack": {
      const chat = chatForSender(from, data.chatId);
      if (!chat) return;
      if (typeof data.msgId === "string") {
        const message = chat.messages.find(item => item.id === data.msgId && item.sender === state.me.id);
        if (message?.pending?.includes(from)) {
          message.pending = message.pending.filter(id => id !== from);
          touchChat(chat);
        }
      } else if (chat.invites?.includes(from)) {
        chat.invites = chat.invites.filter(id => id !== from);
        touchChat(chat);
      }
      break;
    }
    default:
      return;
  }
  notify();
}

window.setInterval(() => {
  if (!state) return;
  conns.forEach((entry, id) => sendTo(id, { t: "ping" }));
  connectAll();
  enforceStorageLimit();
}, 10000);

// ---------- local stand-in for the old server API ----------
function fail(message) {
  throw new Error(message);
}

function sendMessageLocal(chat, text, image, file, replyTo) {
  const recipients = chat.members.filter(id => id !== state.me.id);
  const message = { id: randomId(20), sender: state.me.id, text, ...(image ? { image } : {}), ...(file ? { file } : {}), ...(replyTo ? { replyTo } : {}), createdAt: Date.now(), pending: [...recipients] };
  chat.messages.push(message);
  touchChat(chat);
  recipients.forEach(id => {
    connectTo(id);
    sendTo(id, { t: "msg", chatId: chat.id, msg: { id: message.id, text, image, file, replyTo, createdAt: message.createdAt } });
  });
  enforceStorageLimit();
}

function libraryGifs() {
  const seen = new Set();
  const list = [];
  const add = image => {
    if (!image?.id || image.type !== "image/gif" || seen.has(image.id)) return;
    seen.add(image.id);
    list.push(image);
  };
  [...state.gifs].reverse().forEach(add);
  state.chats.flatMap(chat => chat.messages).reverse().forEach(message => add(message.image));
  builtinGifs.forEach(add);
  return list;
}

function gifItem(image) {
  return {
    key: image.id,
    src: image.url,
    send: tenorUrlPattern.test(image.url) ? { gifUrl: image.url } : { gifId: image.id },
    favorite: state.favoriteGifs.includes(image.id)
  };
}

async function giphyGifs(query) {
  const params = new URLSearchParams({ api_key: GIPHY_API_KEY, limit: "30", rating: "g" });
  if (query) params.set("q", query);
  const response = await fetch(`https://api.giphy.com/v1/gifs/${query ? "search" : "trending"}?${params}`).catch(() => null);
  if (!response?.ok) fail("Could not reach GIPHY. Check the API key and your internet connection.");
  const result = await response.json().catch(() => ({}));
  const gifs = (result.data || []).map(item => {
    const full = item.images?.fixed_height?.url || item.images?.original?.url;
    const preview = item.images?.fixed_height_downsampled?.url || full;
    return tenorUrlPattern.test(full || "") && tenorUrlPattern.test(preview || "")
      ? { key: full, src: preview, send: { gifUrl: full }, favorite: state.favoriteGifs.includes(full) }
      : null;
  }).filter(Boolean);
  return { configured: true, gifs };
}

function applyPreferencesLocal(input) {
  const themes = ["meadow", "dark", "midnight", "rose", "ocean", "contrast", "custom"];
  const current = { ...defaultPreferences, ...state.me.preferences };
  if (themes.includes(input.theme)) current.theme = input.theme;
  if (typeof input.accent === "string" && /^#[0-9a-f]{6}$/i.test(input.accent)) current.accent = input.accent;
  if (typeof input.cursorEnabled === "boolean") current.cursorEnabled = input.cursorEnabled;
  if (typeof input.particlesEnabled === "boolean") current.particlesEnabled = input.particlesEnabled;
  if (["small", "regular", "large"].includes(input.fontSize)) current.fontSize = input.fontSize;
  if (["soft", "square"].includes(input.bubbleShape)) current.bubbleShape = input.bubbleShape;
  if (typeof input.compact === "boolean") current.compact = input.compact;
  if (typeof input.tabDisguise === "boolean") current.tabDisguise = input.tabDisguise;
  Object.assign(current, sanitizeBackgroundPreferences(input, current), sanitizeEffectPreferences(input, current));
  state.me.preferences = current;
  touchMeta();
  return current;
}

async function api(path, options = {}) {
  const url = new URL(path, "http://local");
  const route = url.pathname;
  const method = options.method || "GET";
  const body = options.body || {};
  if (route === "/api/version") return { version: APP_VERSION };
  if (!state) fail("Please sign in again.");

  if (method === "GET" && route === "/api/me") return { user: accountUser() };
  if (method === "GET" && route === "/api/snapshot") return snapshotLocal();

  if (method === "PATCH" && route === "/api/preferences") {
    return { preferences: applyPreferencesLocal(body.preferences && typeof body.preferences === "object" ? body.preferences : {}) };
  }

  if (method === "PATCH" && route === "/api/profile") {
    if (body.displayName !== undefined) {
      const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
      if (displayName.length > 32) fail("Display name can be at most 32 characters.");
      state.me.displayName = displayName || state.me.username;
    }
    if (body.avatar !== undefined) {
      if (body.avatar === null) state.me.avatar = null;
      else if (typeof body.avatar === "string" && body.avatar.length <= 300000 && avatarPattern.test(body.avatar)) state.me.avatar = body.avatar;
      else fail("Profile picture must be a small PNG, JPEG, or WebP image.");
    }
    touchMeta();
    conns.forEach((entry, id) => sendTo(id, { t: "hello", profile: myProfile() }));
    return { user: accountUser() };
  }

  if (method === "POST" && route === "/api/friends/request") {
    let code = typeof body.username === "string" ? body.username.trim().toLowerCase().replace(/\s+/g, "") : "";
    if (/^[a-z0-9]{6,16}$/.test(code)) code = `dsc-${code}`;
    if (!idPattern.test(code)) fail("That is not a valid friend code. Ask your friend to copy theirs from the Friends panel.");
    if (code === state.me.id) fail("That is your own friend code.");
    if (state.friends[code]) fail("You are already friends.");
    if (state.requests.some(request => request.id === code && request.direction === "outgoing")) fail("You already sent that person a request.");
    const incoming = state.requests.find(request => request.id === code && request.direction === "incoming");
    if (incoming) {
      addFriend(code, incoming.user);
      sendTo(code, { t: "friend-accept", profile: myProfile() });
      connectTo(code);
      return { ok: true };
    }
    state.requests.push({ id: code, direction: "outgoing", user: code === OFFICIAL_ID ? officialProfile : { id: code, username: "pending", displayName: "Waiting for friend to come online", avatar: null } });
    touchMeta();
    connectTo(code);
    return { ok: true };
  }

  if (method === "POST" && route === "/api/friends/respond") {
    const request = state.requests.find(item => item.id === body.requestId && item.direction === "incoming");
    if (!request) fail("Friend request not found.");
    if (body.accept === true) {
      addFriend(request.id, request.user);
      sendTo(request.id, { t: "friend-accept", profile: myProfile() });
      connectTo(request.id);
    } else {
      state.requests = state.requests.filter(item => item !== request);
      sendTo(request.id, { t: "friend-decline" });
      touchMeta();
    }
    return { ok: true };
  }

  if (method === "POST" && route === "/api/friends/remove") {
    const friendId = typeof body.friendId === "string" ? body.friendId : "";
    if (!state.friends[friendId]) fail("Friend not found.");
    state.pendingFriendRemovals = (state.pendingFriendRemovals || []).filter(removal => removal.id !== friendId);
    const removal = { id: friendId, removalId: randomId(20) };
    state.pendingFriendRemovals.push(removal);
    delete state.friends[friendId];
    state.chats.filter(chat => !chat.isGroup && chat.members.includes(friendId)).forEach(removeChatLocal);
    state.requests = state.requests.filter(request => request.id !== friendId);
    touchMeta();
    connectTo(friendId);
    sendTo(friendId, { t: "friend-remove", removalId: removal.removalId });
    return { ok: true };
  }

  if (method === "POST" && route === "/api/nickname") {
    const personId = typeof body.personId === "string" ? body.personId : "";
    if (!idPattern.test(personId) || personId === state.me.id) fail("Choose someone other than yourself.");
    if (!state.friends[personId] && !state.people[personId]) fail("Person not found.");
    const nickname = sanitizeNickname(body.nickname);
    state.nicknames ||= {};
    if (nickname) state.nicknames[personId] = nickname;
    else delete state.nicknames[personId];
    touchMeta();
    return { ok: true };
  }

  if (method === "POST" && route === "/api/chats/direct") {
    if (!state.friends[body.friendId]) fail("Friend not found.");
    return { chat: chatToView(ensureDirectChat(body.friendId)) };
  }

  if (method === "POST" && route === "/api/chats") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const memberIds = Array.isArray(body.memberIds) ? [...new Set(body.memberIds)] : [];
    if (name.length < 1 || name.length > 40) fail("Group name must be 1 to 40 characters.");
    if (memberIds.length < 1 || memberIds.length > 49) fail("Choose at least one friend for the group.");
    if (memberIds.some(id => !state.friends[id])) fail("Group chats can include your friends only.");
    const chat = { id: `g-${randomId(20)}`, name, isGroup: true, ownerId: state.me.id, members: [state.me.id, ...memberIds], messages: [], invites: [...memberIds], createdAt: Date.now(), rev: 0 };
    if (body.avatar) {
      const groupAvatar = sanitizeAvatar(body.avatar);
      if (!groupAvatar) fail("Group picture must be a small PNG, JPEG, or WebP image.");
      chat.avatar = groupAvatar;
    }
    state.chats.push(chat);
    touchChat(chat);
    memberIds.forEach(id => {
      connectTo(id);
      sendTo(id, { t: "group", chat: groupPayload(chat) });
    });
    return { chat: chatToView(chat) };
  }

  const groupRoute = route.match(/^\/api\/chats\/([^/]+)\/group$/);
  if (method === "POST" && groupRoute) {
    const chat = state.chats.find(item => item.id === decodeURIComponent(groupRoute[1]) && item.isGroup);
    if (!chat) fail("Group not found.");
    const ownerId = chat.ownerId || chat.members[0];
    const action = body.action;
    if (action === "leave") {
      if (ownerId === state.me.id) fail("Transfer ownership before leaving the group.");
      if (!state.pendingGroupLeaves.some(leave => leave.chatId === chat.id && leave.ownerId === ownerId)) {
        state.pendingGroupLeaves.push({ chatId: chat.id, ownerId });
        touchMeta();
      }
      connectTo(ownerId);
      sendTo(ownerId, { t: "group-leave", chatId: chat.id });
      removeChatLocal(chat);
      return { ok: true };
    }
    if (ownerId !== state.me.id) fail("Only the group owner can do that.");
    const previousMembers = [...chat.members];
    if (action === "delete") {
      const pending = previousMembers.filter(id => id !== state.me.id);
      if (pending.length) {
        state.pendingGroupDeletes.push({ id: chat.id, pending });
        touchMeta();
      }
      pending.forEach(id => {
        connectTo(id);
        sendTo(id, { t: "group-delete", chatId: chat.id });
      });
      removeChatLocal(chat);
      return { ok: true };
    }
    if (action === "avatar") {
      if (body.avatar === null) {
        delete chat.avatar;
      } else {
        const groupAvatar = sanitizeAvatar(body.avatar);
        if (!groupAvatar) fail("Group picture must be a small PNG, JPEG, or WebP image.");
        chat.avatar = groupAvatar;
      }
      broadcastGroupUpdate(chat, previousMembers);
      return { ok: true };
    }
    const memberId = typeof body.memberId === "string" ? body.memberId : "";
    if (!chat.members.includes(memberId) || memberId === state.me.id) fail("Choose another group member.");
    if (action === "transfer") {
      chat.ownerId = memberId;
    } else if (action === "remove") {
      chat.members = chat.members.filter(id => id !== memberId);
      chat.invites = (chat.invites || []).filter(id => id !== memberId);
    } else {
      fail("That group action is not available.");
    }
    broadcastGroupUpdate(chat, previousMembers);
    return { ok: true };
  }

  const messageRoute = route.match(/^\/api\/chats\/([^/]+)\/messages$/);
  if (method === "POST" && messageRoute) {
    const chat = state.chats.find(item => item.id === decodeURIComponent(messageRoute[1]));
    if (!chat) fail("Chat not found.");
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length > 4000) fail("Messages can be at most 4,000 characters.");
    let image = null;
    if (body.gifUrl !== undefined) {
      image = typeof body.gifUrl === "string" && tenorUrlPattern.test(body.gifUrl) ? sanitizeImage({ url: body.gifUrl }) : fail("That GIF link is not allowed.");
    } else if (body.gifId !== undefined) {
      image = libraryGifs().find(item => item.id === body.gifId) || fail("GIF not found.");
    } else if (body.image !== undefined) {
      image = sanitizeImage({ url: body.image }) || fail("Images must be PNG, JPEG, GIF, or WebP and under 3 MB.");
    }
    let file = null;
    if (body.file !== undefined) {
      if (image) fail("Send a file on its own, without an image.");
      file = sanitizeFile(body.file) || fail("Files must be under 5 MB.");
    }
    let replyTo = null;
    if (body.replyTo !== undefined && body.replyTo !== null) {
      if (typeof body.replyTo !== "string" || !chat.messages.some(item => item.id === body.replyTo)) fail("The message you are replying to no longer exists.");
      replyTo = body.replyTo;
    }
    if (!text && !image && !file) fail("Messages must be 1 to 4,000 characters.");
    sendMessageLocal(chat, text, image ? { id: image.id, url: image.url, type: image.type } : undefined, file || undefined, replyTo || undefined);
    return { ok: true };
  }

  const deleteMessageRoute = route.match(/^\/api\/chats\/([^/]+)\/messages\/([^/]+)$/);
  if (method === "DELETE" && deleteMessageRoute) {
    const chat = state.chats.find(item => item.id === decodeURIComponent(deleteMessageRoute[1]));
    if (!chat) fail("Chat not found.");
    const message = chat.messages.find(item => item.id === decodeURIComponent(deleteMessageRoute[2]));
    if (!message || message.sender !== state.me.id) fail("You can only delete your own messages.");
    chat.messages = chat.messages.filter(item => item !== message);
    rememberDeletedMessage(chat, message.id);
    touchChat(chat);
    chat.members.filter(id => id !== state.me.id).forEach(id => sendTo(id, { t: "msg-delete", chatId: chat.id, msgId: message.id }));
    return { ok: true };
  }

  if (method === "GET" && route === "/api/gifs") {
    const tab = url.searchParams.get("tab");
    if (tab === "favorites") {
      const library = new Map(libraryGifs().map(image => [image.id, image]));
      return {
        configured: true,
        gifs: state.favoriteGifs.map(key => tenorUrlPattern.test(key)
          ? { key, src: key, send: { gifUrl: key }, favorite: true }
          : (library.has(key) ? gifItem(library.get(key)) : null)).filter(Boolean)
      };
    }
    if (tab === "library") return { configured: true, gifs: libraryGifs().map(gifItem) };
    return giphyGifs((url.searchParams.get("q") || "").trim().slice(0, 60));
  }

  if (method === "POST" && route === "/api/gifs") {
    if (state.gifs.length >= 100) fail("Your GIF library is full.");
    const image = sanitizeImage({ url: body.image });
    if (!image || image.type !== "image/gif" || tenorUrlPattern.test(image.url)) fail("Images must be GIF.");
    state.gifs.push(image);
    touchMeta();
    return { ok: true };
  }

  if (method === "POST" && route === "/api/gifs/favorite") {
    const key = typeof body.id === "string" ? body.id : "";
    if (!tenorUrlPattern.test(key) && !libraryGifs().some(image => image.id === key)) fail("GIF not found.");
    state.favoriteGifs = state.favoriteGifs.filter(item => item !== key);
    if (body.favorite === true) state.favoriteGifs.push(key);
    touchMeta();
    return { ok: true };
  }

  fail("That action is not available.");
}

// ---------- profile lifecycle, backup, storage info ----------
const accountsKey = "discard-accounts";
const officialDb = "discard-p2p-official";
const badLogin = () => new Error("Incorrect username or password.");

function readAccounts() {
  try {
    const list = JSON.parse(localStorage.getItem(accountsKey) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeAccounts(list) {
  localStorage.setItem(accountsKey, JSON.stringify(list));
}

async function hashPassword(password, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return toBase64(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" }, base, 256));
}

function lockAccount(db) {
  if (!navigator.locks) return Promise.resolve(true);
  return new Promise(resolve => {
    navigator.locks.request(`discard-${db}`, { ifAvailable: true }, lock => {
      resolve(Boolean(lock));
      return lock ? new Promise(() => {}) : undefined;
    });
  });
}

async function enterApp() {
  currentUser = accountUser();
  refreshStorageLimit();
  startPeer();
  applyPreferences({ ...defaultPreferences, ...currentUser.preferences });
  await openChatView();
}

async function signIn(username, password, backupFile) {
  const key = username.toLowerCase();
  const official = key === OFFICIAL_USERNAME.toLowerCase();
  let db = officialDb;
  if (official) {
    try { await unlockOfficial(password); } catch { throw badLogin(); }
  } else {
    const account = readAccounts().find(item => item.key === key);
    if (!account || await hashPassword(password, fromBase64(account.salt)) !== account.hash) throw badLogin();
    db = account.db;
  }
  if (backupFile && !official) throw new Error("Restoring a backup while signing in only works for the official account. Use Create account for other backups.");
  const imported = backupFile ? cleanImported(JSON.parse(await backupFile.text()), true) : null;
  if (!await lockAccount(db)) throw new Error("This account is already open in another tab.");
  idb.use(db);
  if (imported) {
    const { chats, ...meta } = imported;
    const puts = { meta };
    chats.forEach(chat => { puts[`chat:${chat.id}`] = chat; });
    await idb.write(puts, []);
  }
  state = await loadState();
  if (!state) {
    if (!official) throw new Error("This account's saved data was not found on this computer.");
    state = defaultState({ id: OFFICIAL_ID, username: OFFICIAL_USERNAME, displayName: "Discard Official", avatar: BRAND_IMAGE, official: true, preferences: { ...defaultPreferences }, createdAt: Date.now() });
    touchMeta();
    await flushSave();
  }
  await enterApp();
}

async function signUp(username, password, displayName, backupFile) {
  const imported = backupFile ? cleanImported(JSON.parse(await backupFile.text())) : null;
  if (imported) username = imported.me.username;
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) throw new Error("Use 3 to 24 letters, numbers, or underscores for your username.");
  if (looksOfficial(username) || looksOfficial(displayName)) throw new Error("That name is reserved.");
  const key = username.toLowerCase();
  if (readAccounts().some(item => item.key === key)) throw new Error("That username is already taken on this computer.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  const db = `discard-p2p-${randomId(12)}`;
  idb.use(db);
  await lockAccount(db);
  if (imported) {
    const { chats, ...meta } = imported;
    const puts = { meta };
    chats.forEach(chat => { puts[`chat:${chat.id}`] = chat; });
    await idb.write(puts, []);
    state = await loadState();
  } else {
    state = defaultState({ id: `dsc-${randomId(6)}`, username, displayName: displayName || username, avatar: null, preferences: { ...defaultPreferences }, createdAt: Date.now() });
    touchMeta();
    await flushSave();
  }
  writeAccounts([...readAccounts(), { key, username, db, salt: toBase64(salt), hash }]);
  await enterApp();
}

function formatBytes(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function storageSummary() {
  const used = totalMessageBytes();
  return `Saved on this computer: ${formatBytes(used)} of messages (limit ${formatBytes(storageLimit)}). Oldest messages are removed automatically if space runs low.${storageNotice ? ` ${storageNotice}` : ""}`;
}

function exportBackup() {
  const { chats, ...meta } = state;
  const blob = new Blob([JSON.stringify({ format: "discard-backup", version: 1, meta, chats })], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `discard-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function cleanImported(raw, official = false) {
  const meta = raw?.meta;
  const me = official ? { ...officialProfile, official: true } : sanitizeProfile(meta?.me, meta?.me?.id);
  const isOfficialBackup = meta?.me?.id === OFFICIAL_ID;
  if (raw?.format !== "discard-backup" || !me || isOfficialBackup !== official || !idPattern.test(me.id)) throw new Error(official ? "That is not a Discard Official backup file." : "That is not a valid Discard backup file.");
  const profiles = source => Object.fromEntries(Object.entries(source || {}).filter(([id]) => idPattern.test(id))
    .map(([id, value]) => [id, sanitizeProfile(value, id)]).filter(([, value]) => value));
  const friends = profiles(meta.friends);
  const people = { ...profiles(meta.people), ...friends };
  const imported = defaultState({ ...me, preferences: { ...defaultPreferences, ...(meta.me.preferences && typeof meta.me.preferences === "object" ? meta.me.preferences : {}) }, createdAt: Date.now() });
  imported.friends = friends;
  imported.people = people;
  imported.nicknames = Object.fromEntries(Object.entries(meta.nicknames && typeof meta.nicknames === "object" ? meta.nicknames : {})
    .filter(([id, value]) => idPattern.test(id) && id !== me.id && sanitizeNickname(value)).map(([id, value]) => [id, sanitizeNickname(value)]));
  imported.requests = (Array.isArray(meta.requests) ? meta.requests : []).filter(item => idPattern.test(item?.id) && ["incoming", "outgoing"].includes(item.direction))
    .map(item => ({ id: item.id, direction: item.direction, user: sanitizeProfile(item.user, item.id) || { id: item.id, username: "pending", displayName: "Friend", avatar: null } }));
  imported.gifs = (Array.isArray(meta.gifs) ? meta.gifs : []).map(sanitizeImage).filter(image => image && image.type === "image/gif" && !tenorUrlPattern.test(image.url));
  imported.favoriteGifs = (Array.isArray(meta.favoriteGifs) ? meta.favoriteGifs : []).filter(key => typeof key === "string" && key.length < 300);
  imported.tenorKey = typeof meta.tenorKey === "string" && /^[\w-]{10,80}$/.test(meta.tenorKey) ? meta.tenorKey : "";
  imported.pendingGroupDeletes = (Array.isArray(meta.pendingGroupDeletes) ? meta.pendingGroupDeletes : [])
    .filter(item => typeof item?.id === "string" && safeIdPattern.test(item.id) && Array.isArray(item.pending))
    .map(item => ({ id: item.id, pending: [...new Set(item.pending.filter(id => idPattern.test(id) && id !== me.id))].slice(0, 50) }))
    .filter(item => item.pending.length);
  imported.pendingFriendRemovals = (Array.isArray(meta.pendingFriendRemovals) ? meta.pendingFriendRemovals : [])
    .filter(item => idPattern.test(item?.id) && item.id !== me.id && safeIdPattern.test(item.removalId || ""))
    .map(item => ({ id: item.id, removalId: item.removalId }));
  imported.pendingGroupLeaves = (Array.isArray(meta.pendingGroupLeaves) ? meta.pendingGroupLeaves : [])
    .filter(item => typeof item?.chatId === "string" && safeIdPattern.test(item.chatId) && idPattern.test(item.ownerId) && item.ownerId !== me.id)
    .map(item => ({ chatId: item.chatId, ownerId: item.ownerId }));
  imported.chats = (Array.isArray(raw.chats) ? raw.chats : []).filter(chat => typeof chat?.id === "string" && safeIdPattern.test(chat.id.replace(/:/g, "-")) && Array.isArray(chat.members))
    .map(chat => ({
      id: chat.id,
      name: typeof chat.name === "string" ? chat.name.slice(0, 40) : "",
      isGroup: Boolean(chat.isGroup),
      members: chat.members.filter(id => idPattern.test(id)),
      ...(chat.isGroup && sanitizeAvatar(chat.avatar) ? { avatar: chat.avatar } : {}),
      ...(chat.isGroup && idPattern.test(chat.ownerId) && chat.members.includes(chat.ownerId)
        ? { ownerId: chat.ownerId }
        : {}),
      ...(Array.isArray(chat.pendingGroupUpdateIds)
        ? { pendingGroupUpdateIds: [...new Set(chat.pendingGroupUpdateIds.filter(id => idPattern.test(id) && id !== me.id))].slice(0, 50) }
        : {}),
      ...(safeIdPattern.test(chat.pendingGroupUpdateId || "") ? { pendingGroupUpdateId: chat.pendingGroupUpdateId } : {}),
      ...(safeIdPattern.test(chat.lastGroupUpdateId || "") ? { lastGroupUpdateId: chat.lastGroupUpdateId } : {}),
      ...(idPattern.test(chat.lastGroupUpdateSender || "") ? { lastGroupUpdateSender: chat.lastGroupUpdateSender } : {}),
      invites: [],
      createdAt: Number(chat.createdAt) || Date.now(),
      rev: 0,
      deletedMessageIds: Array.isArray(chat.deletedMessageIds)
        ? chat.deletedMessageIds.filter(id => typeof id === "string" && safeIdPattern.test(id)).slice(-2000)
        : [],
      messages: (Array.isArray(chat.messages) ? chat.messages : []).filter(message => typeof message?.id === "string" && safeIdPattern.test(message.id) && idPattern.test(message.sender)).map(message => {
        const image = message.image ? sanitizeImage(message.image) : null;
        const file = message.file ? sanitizeFile(message.file) : null;
        return {
          id: message.id,
          sender: message.sender,
          text: typeof message.text === "string" ? message.text.slice(0, 4000) : "",
          ...(image ? { image } : {}),
          ...(file ? { file } : {}),
          ...(safeIdPattern.test(message.replyTo || "") ? { replyTo: message.replyTo } : {}),
          createdAt: Number(message.createdAt) || Date.now(),
          pending: Array.isArray(message.pending) ? message.pending.filter(id => idPattern.test(id)) : []
        };
      })
    })).filter(chat => chat.members.includes(me.id));
  return imported;
}

function setAvatar(element, name, url) {
  element.querySelectorAll(":scope > :not(.status-dot)").forEach(child => child.remove());
  element.classList.toggle("has-img", Boolean(url));
  element.style.backgroundImage = url ? `url("${url}")` : "";
  element.style.backgroundSize = url ? "cover" : "";
  element.style.backgroundPosition = url ? "center" : "";
  element.style.backgroundRepeat = url ? "no-repeat" : "";
  element.firstChild?.nodeType === Node.TEXT_NODE && element.firstChild.remove();
  element.prepend(document.createTextNode(url ? "" : name.charAt(0).toUpperCase()));
}

function handleSpan(username) {
  const handle = document.createElement("span");
  handle.className = "handle";
  handle.textContent = `@${username}`;
  return handle;
}

function renderProfile() {
  document.querySelector("#userHandle").textContent = `@${currentUser.username}`;
  document.querySelector("#myCode").value = currentUser.id.replace(/^dsc-/, "");
  const name = currentUser.displayName || currentUser.username;
  document.querySelector("#userName").textContent = name;
  setAvatar(document.querySelector("#userAvatar"), name, currentUser.avatar);
  setAvatar(document.querySelector("#profileAvatar"), name, currentUser.avatar);
}

let authMode = "signin";

function setAuthMode(next) {
  authMode = next;
  const creating = next === "signup";
  document.querySelectorAll("[data-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === next)));
  document.querySelectorAll(".signup-only").forEach(field => field.classList.toggle("hidden", !creating));
  authTitle.textContent = creating ? "Create your account" : "Welcome back";
  authSubtitle.textContent = creating ? "Choose a username and password. They are saved on this computer only." : "Sign in to your Discard account.";
  authSubmit.textContent = creating ? "Create account" : "Sign in";
  document.querySelector("#password").autocomplete = creating ? "new-password" : "current-password";
  authMessage.textContent = "";
}

document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => setAuthMode(button.dataset.mode)));

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  authMessage.textContent = "";
  const username = usernameInput.value.trim();
  const password = document.querySelector("#password").value;
  const backupFile = document.querySelector("#importFile").files[0] || null;
  if (authMode === "signup") {
    if (!backupFile && !/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      authMessage.textContent = "Use 3 to 24 letters, numbers, or underscores for your username.";
      return;
    }
    if (password.length < 8) {
      authMessage.textContent = "Your password must be at least 8 characters.";
      return;
    }
    if (password !== document.querySelector("#confirmPassword").value) {
      authMessage.textContent = "The two passwords do not match.";
      return;
    }
  } else if (!username || !password) {
    authMessage.textContent = "Enter your username and password.";
    return;
  }
  authSubmit.disabled = true;
  authMessage.textContent = authMode === "signup" ? "Creating your account..." : "Signing in...";
  try {
    if (authMode === "signup") await signUp(username, password, document.querySelector("#displayName").value.trim().slice(0, 32), backupFile);
    else await signIn(username, password, backupFile);
    authForm.reset();
    authMessage.textContent = "";
  } catch (error) {
    state = null;
    authMessage.textContent = error.message || "Could not open your account on this computer.";
  } finally {
    authSubmit.disabled = false;
  }
});

async function openChatView() {
  authView.classList.add("hidden");
  chatView.classList.remove("hidden");
  loadVersion();
  renderProfile();
  displayNameInput.value = currentUser.displayName || currentUser.username;
  applyPreferences(currentUser.preferences);
  await refreshSnapshot();
}

async function refreshSnapshot() {
  if (refreshing || !currentUser) return;
  refreshing = true;
  try {
    snapshot = await api("/api/snapshot");
    const profileChanged = currentUser.displayName !== snapshot.user.displayName || currentUser.avatar !== snapshot.user.avatar;
    currentUser.displayName = snapshot.user.displayName;
    currentUser.avatar = snapshot.user.avatar;
    if (profileChanged) renderProfile();
    if (!snapshot.chats.some(chat => chat.id === activeChatId)) activeChatId = null;
    const activeChat = snapshot.chats.find(chat => chat.id === activeChatId);
    const next = {
      list: JSON.stringify(snapshot.chats.map(chat => [chat.id, chat.name, chat.avatar, chat.online, chat.rev, chat.messages.length])),
      conversation: JSON.stringify([activeChatId, activeChat && [activeChat.rev, activeChat.name, activeChat.avatar, activeChat.online, activeChat.ownerId, activeChat.members.map(member => [member.id, member.displayName, member.username, member.avatar?.length || 0])]]),
      friends: JSON.stringify([snapshot.friends, snapshot.requests, snapshot.user.id])
    };
    if (next.list !== renderedKeys.list) renderChatList();
    if (next.conversation !== renderedKeys.conversation) renderConversation();
    if (next.friends !== renderedKeys.friends) renderFriends();
    renderedKeys = next;
  } catch (error) {
    if (error.message === "Please sign in again.") showAuth();
  } finally {
    refreshing = false;
  }
}

function showAuth() {
  currentUser = null;
  activeChatId = null;
  chatView.classList.add("hidden");
  authView.classList.remove("hidden");
}

function chatLastMessage(chat) {
  return chat.messages[chat.messages.length - 1];
}

function messagePreview(message) {
  return message.text || (message.file ? `📎 ${message.file.name}` : "") || (message.image ? "📷 Image" : "");
}

let replyingTo = null;
const replyBar = document.querySelector("#replyBar");

function replyBody() {
  return replyingTo && replyingTo.chatId === activeChatId ? { replyTo: replyingTo.id } : {};
}

function clearReply() {
  replyingTo = null;
  replyBar.classList.add("hidden");
}

function startReply(chat, message) {
  replyingTo = { id: message.id, chatId: chat.id };
  const sender = message.sender === currentUser.id ? "yourself" : (chat.members.find(member => member.id === message.sender)?.displayName || "Former member");
  replyBar.querySelector(".reply-bar-text").textContent = `Replying to ${sender}: ${messagePreview(message).slice(0, 80)}`;
  replyBar.classList.remove("hidden");
  messageInput.focus();
}

document.querySelector("#replyCancel").addEventListener("click", clearReply);

async function downloadFile(file) {
  try {
    const blob = await (await fetch(file.data)).blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([blob], { type: "application/octet-stream" }));
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  } catch {
    alert("Could not download that file.");
  }
}

const profileModal = document.querySelector("#profileModal");
profileModal.addEventListener("click", event => {
  if (event.target === profileModal) profileModal.classList.add("hidden");
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") profileModal.classList.add("hidden");
});

function openProfile(person) {
  if (!person || !person.id) return;
  const card = document.querySelector("#profileCard");
  const friend = snapshot.friends.find(item => item.id === person.id);
  const info = friend || person;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  setAvatar(avatar, info.displayName, info.avatar);
  const name = document.createElement("h3");
  name.textContent = info.displayName + (person.id === currentUser.id ? " (you)" : "");
  const handle = document.createElement("div");
  handle.className = "profile-sub";
  handle.textContent = info.username && info.username !== "unknown" ? `@${info.username}` : "";
  const status = document.createElement("div");
  status.className = "profile-sub";
  status.textContent = person.id === currentUser.id ? "This is you" : friend ? (friend.online ? "Friend · Online" : "Friend · Offline") : "Not in your friends list";
  const real = document.createElement("div");
  real.className = "profile-sub";
  real.textContent = info.realName ? `Display name: ${info.realName}` : "";
  const nicknameBox = document.createElement("div");
  nicknameBox.className = "nickname-edit";
  if (person.id !== currentUser.id) {
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 32;
    input.placeholder = "Nickname (only you see it)";
    input.value = info.realName ? info.displayName : "";
    input.setAttribute("aria-label", "Nickname");
    const save = document.createElement("button");
    save.type = "button";
    save.className = "profile-btn";
    save.textContent = "Save nickname";
    save.addEventListener("click", async () => {
      try {
        await api("/api/nickname", { method: "POST", body: { personId: person.id, nickname: input.value } });
        profileModal.classList.add("hidden");
        renderedKeys = {};
        await refreshSnapshot();
      } catch (error) {
        friendMessage.textContent = error.message;
      }
    });
    nicknameBox.append(input, save);
  }
  const actions = document.createElement("div");
  actions.className = "profile-actions";
  if (friend) {
    const message = document.createElement("button");
    message.type = "button";
    message.className = "profile-btn primary";
    message.textContent = "Message";
    message.addEventListener("click", async () => {
      try {
        const result = await api("/api/chats/direct", { method: "POST", body: { friendId: friend.id } });
        activeChatId = result.chat.id;
        profileModal.classList.add("hidden");
        friendsPanel.classList.add("hidden");
        await refreshSnapshot();
      } catch (error) {
        friendMessage.textContent = error.message;
      }
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "profile-btn";
    remove.textContent = "Unadd";
    remove.addEventListener("click", async () => {
      if (!confirm(`Remove ${friend.displayName} from both friends lists? This deletes your direct chat history here and on their device when both of you are online again.`)) return;
      try {
        await api("/api/friends/remove", { method: "POST", body: { friendId: friend.id } });
        profileModal.classList.add("hidden");
        await refreshSnapshot();
      } catch (error) {
        friendMessage.textContent = error.message;
      }
    });
    actions.append(message, remove);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.className = "profile-btn";
  close.textContent = "Close";
  close.addEventListener("click", () => profileModal.classList.add("hidden"));
  actions.append(close);
  card.replaceChildren(avatar, name, handle, real, status, nicknameBox, actions);
  profileModal.classList.remove("hidden");
}

function directPerson(chat) {
  return chat && !chat.isGroup ? chat.members.find(member => member.id !== currentUser.id) : null;
}

function renderChatList() {
  const filter = document.querySelector("#chatSearch").value.trim().toLowerCase();
  const chats = snapshot.chats
    .filter(chat => chat.name.toLowerCase().includes(filter))
    .sort((first, second) => (chatLastMessage(second)?.createdAt || 0) - (chatLastMessage(first)?.createdAt || 0));
  chatList.replaceChildren();
  const pending = snapshot.requests.filter(request => request.direction === "outgoing"
    && (request.user.displayName || request.user.username || "").toLowerCase().includes(filter));
  pending.forEach(request => {
    const item = document.createElement("div");
    item.className = "chat-item";
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    const name = request.id === OFFICIAL_ID ? officialProfile.displayName : (request.user.displayName || "Friend request");
    setAvatar(avatar, name, request.user.avatar);
    const summary = document.createElement("span");
    summary.className = "chat-summary";
    const title = document.createElement("span");
    title.className = "chat-title";
    title.textContent = name;
    const preview = document.createElement("span");
    preview.className = "chat-preview";
    preview.textContent = "Pending - waiting for them to come online";
    summary.append(title, preview);
    item.append(avatar, summary);
    chatList.append(item);
  });
  if (!chats.length && !pending.length) {
    const empty = document.createElement("div");
    empty.className = "empty-list";
    empty.textContent = filter ? "No chats match your search." : "Add a friend or start a group chat.";
    chatList.append(empty);
    return;
  }

  chats.forEach(chat => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chat-item${chat.id === activeChatId ? " active" : ""}`;
    button.setAttribute("aria-label", `Open chat ${chat.name}`);
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    setAvatar(avatar, chat.name, chat.avatar);
    if (!chat.isGroup) {
      const dot = document.createElement("span");
      dot.className = `status-dot${chat.online ? " online" : ""}`;
      avatar.append(dot);
    }
    const summary = document.createElement("span");
    summary.className = "chat-summary";
    const titleRow = document.createElement("span");
    titleRow.className = "chat-title-row";
    const title = document.createElement("span");
    title.className = "chat-title";
    title.textContent = chat.name;
    const time = document.createElement("span");
    time.className = "chat-time";
    time.textContent = chatLastMessage(chat) ? formatTime(chatLastMessage(chat).createdAt) : "";
    const preview = document.createElement("span");
    preview.className = "chat-preview";
    preview.textContent = (chatLastMessage(chat) && messagePreview(chatLastMessage(chat))) || (chat.isGroup ? "Group chat" : "Start a conversation");
    titleRow.append(title, time);
    summary.append(titleRow, preview);
    button.append(avatar, summary);
    if (!chat.isGroup) {
      avatar.classList.add("clickable");
      avatar.title = "View profile";
      avatar.addEventListener("click", event => {
        event.stopPropagation();
        openProfile(directPerson(chat));
      });
    }
    button.addEventListener("click", () => {
      if (activeChatId !== chat.id) { clearReply(); setPlusMenu(false); }
      activeChatId = chat.id;
      renderChatList();
      renderConversation();
    });
    chatList.append(button);
  });
}

function renderConversation() {
  const chat = snapshot.chats.find(item => item.id === activeChatId);
  const header = document.querySelector("#conversationHeader");
  const composer = document.querySelector("#composerWrap");
  const welcome = document.querySelector("#welcomeEmpty");
  messageArea.classList.toggle("no-anim", chat?.id === renderedChatId);
  renderedChatId = chat?.id || null;
  if (replyingTo && replyingTo.chatId !== renderedChatId) clearReply();
  if (!chat) {
    groupManagement.classList.add("hidden");
    header.classList.add("hidden");
    messageArea.classList.add("hidden");
    composer.classList.add("hidden");
    welcome.classList.remove("hidden");
    return;
  }

  welcome.classList.add("hidden");
  header.classList.remove("hidden");
  messageArea.classList.remove("hidden");
  composer.classList.remove("hidden");
  document.querySelector("#conversationTitle").textContent = chat.name;
  setAvatar(document.querySelector("#conversationAvatar"), chat.name, chat.avatar);
  const headerTargets = [document.querySelector("#conversationAvatar"), document.querySelector("#conversationTitle")];
  headerTargets.forEach(element => {
    element.classList.toggle("clickable", !chat.isGroup);
    element.onclick = chat.isGroup ? null : () => openProfile(directPerson(chat));
  });
  document.querySelector("#conversationStatus").textContent = chat.isGroup ? `${chat.members.length} members` : `@${chat.username} · ${chat.online ? "Online" : "Offline"}`;
  conversationActions.replaceChildren();
  if (chat.isGroup) {
    const manage = document.createElement("button");
    manage.type = "button";
    manage.textContent = "Manage group";
    manage.setAttribute("aria-expanded", String(!groupManagement.classList.contains("hidden")));
    manage.addEventListener("click", () => {
      groupManagement.classList.toggle("hidden");
      manage.setAttribute("aria-expanded", String(!groupManagement.classList.contains("hidden")));
      renderGroupManagement(chat);
    });
    conversationActions.append(manage);
    renderGroupManagement(chat);
  } else {
    groupManagement.classList.add("hidden");
  }
  const closeChat = document.createElement("button");
  closeChat.type = "button";
  closeChat.className = "close-chat";
  closeChat.textContent = "×";
  closeChat.title = "Close chat";
  closeChat.setAttribute("aria-label", "Close chat");
  closeChat.addEventListener("click", () => {
    clearReply();
    activeChatId = null;
    renderChatList();
    renderConversation();
  });
  conversationActions.append(closeChat);
  messageArea.replaceChildren();
  const divider = document.createElement("div");
  divider.className = "date-divider";
  divider.textContent = chat.isGroup ? `GROUP CHAT · ${chat.members.length} PEOPLE` : "DIRECT MESSAGE";
  messageArea.append(divider);

  const byId = new Map(chat.messages.map(item => [item.id, item]));
  chat.messages.slice(-400).forEach(message => {
    const mine = message.sender === currentUser.id;
    const senderInfo = chat.members.find(member => member.id === message.sender);
    const row = document.createElement("div");
    row.className = `message${mine ? " mine" : ""}`;
    const senderName = mine ? "You" : (senderInfo?.displayName || "Former member");
    const avatar = document.createElement("span");
    avatar.className = "avatar message-avatar";
    setAvatar(avatar, mine ? (currentUser.displayName || currentUser.username) : senderName, mine ? currentUser.avatar : senderInfo?.avatar);
    if (mine || senderInfo) {
      avatar.classList.add("clickable");
      avatar.title = "View profile";
      avatar.addEventListener("click", () => openProfile(mine ? { id: currentUser.id, ...currentUser } : senderInfo));
    }
    const body = document.createElement("div");
    body.className = "message-body";
    const head = document.createElement("div");
    head.className = "message-head";
    const nameLabel = document.createElement("span");
    nameLabel.className = "message-sender";
    nameLabel.textContent = senderName;
    head.append(nameLabel);
    const handleName = mine ? currentUser.username : senderInfo?.username;
    if (handleName && handleName !== "unknown") head.append(handleSpan(handleName));
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    if (message.replyTo) {
      const original = byId.get(message.replyTo);
      const quote = document.createElement("div");
      quote.className = "reply-quote";
      const quoteName = document.createElement("strong");
      const quoteText = document.createElement("span");
      if (original) {
        quoteName.textContent = original.sender === currentUser.id ? "You" : (chat.members.find(member => member.id === original.sender)?.displayName || "Former member");
        quoteText.textContent = messagePreview(original);
      } else {
        quoteName.textContent = "Reply";
        quoteText.textContent = "Original message is no longer available";
      }
      quote.append(quoteName, quoteText);
      bubble.append(quote);
    }
    if (message.image) {
      bubble.classList.add("has-image");
      const picture = document.createElement("img");
      picture.className = "message-image";
      picture.alt = "Shared image";
      picture.loading = "lazy";
      picture.src = message.image.url;
      picture.addEventListener("click", () => openLightbox(message.image.url));
      bubble.append(picture);
    }
    if (message.file) {
      bubble.classList.add("has-image");
      const card = document.createElement("button");
      card.type = "button";
      card.className = "file-card";
      card.title = "Download file";
      const icon = document.createElement("span");
      icon.className = "file-icon";
      icon.textContent = "📎";
      const fileInfo = document.createElement("span");
      const fileName = document.createElement("strong");
      fileName.textContent = message.file.name;
      const fileSize = document.createElement("small");
      fileSize.textContent = formatBytes(message.file.size);
      fileInfo.append(fileName, fileSize);
      card.append(icon, fileInfo);
      card.addEventListener("click", () => downloadFile(message.file));
      bubble.append(card);
    }
    if (message.text) {
      const text = document.createElement("span");
      text.textContent = message.text;
      bubble.append(text);
    }
    const meta = document.createElement("div");
    meta.className = "message-meta";
    const recipientIds = chat.members.filter(member => member.id !== currentUser.id).map(member => member.id);
    const recipientCount = recipientIds.length;
    const pendingIds = new Set(message.pending || []);
    const pendingCount = recipientIds.filter(id => pendingIds.has(id)).length;
    const deliveryStatus = !mine || !recipientCount
      ? ""
      : pendingCount
        ? ` · ${recipientCount - pendingCount}/${recipientCount} delivered · waiting for ${pendingCount}`
        : " · sent to everyone";
    meta.textContent = `${formatTime(message.createdAt)}${deliveryStatus}`;
    const replyButton = document.createElement("button");
    replyButton.type = "button";
    replyButton.textContent = "Reply";
    replyButton.setAttribute("aria-label", "Reply to this message");
    replyButton.addEventListener("click", () => startReply(chat, message));
    meta.append(replyButton);
    if (mine) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.setAttribute("aria-label", "Delete your message");
      deleteButton.addEventListener("click", async () => {
        try {
          await api(`/api/chats/${encodeURIComponent(chat.id)}/messages/${encodeURIComponent(message.id)}`, { method: "DELETE" });
          if (replyingTo?.id === message.id) clearReply();
          await refreshSnapshot();
        } catch (error) {
          friendMessage.textContent = error.message;
        }
      });
      meta.append(deleteButton);
    }
    body.append(head, bubble, meta);
    row.append(avatar, body);
    messageArea.append(row);
  });
  messageArea.scrollTop = messageArea.scrollHeight;
}

function renderGroupManagement(chat) {
  groupMemberList.replaceChildren();
  const ownerId = chat.ownerId || chat.members[0]?.id;
  const isOwner = ownerId === currentUser.id;
  chat.members.forEach(member => {
    const row = document.createElement("div");
    row.className = "group-member";
    const label = document.createElement("span");
    label.className = "group-member-name clickable";
    label.title = "View profile";
    label.addEventListener("click", () => openProfile(member));
    label.textContent = `${member.displayName}${member.id === currentUser.id ? " (you)" : ""}${member.id === ownerId ? " · Owner" : ""}`;
    row.append(label);
    if (isOwner && member.id !== currentUser.id) {
      const actions = document.createElement("span");
      actions.className = "group-member-actions";
      const transfer = document.createElement("button");
      transfer.type = "button";
      transfer.textContent = "Make owner";
      transfer.addEventListener("click", async () => {
        if (!confirm(`Transfer group ownership to ${member.displayName}?`)) return;
        try {
          await api(`/api/chats/${encodeURIComponent(chat.id)}/group`, { method: "POST", body: { action: "transfer", memberId: member.id } });
          await refreshSnapshot();
        } catch (error) {
          friendMessage.textContent = error.message;
        }
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger";
      remove.textContent = "Remove";
      remove.addEventListener("click", async () => {
        if (!confirm(`Remove ${member.displayName} from ${chat.name}?`)) return;
        try {
          await api(`/api/chats/${encodeURIComponent(chat.id)}/group`, { method: "POST", body: { action: "remove", memberId: member.id } });
          await refreshSnapshot();
        } catch (error) {
          friendMessage.textContent = error.message;
        }
      });
      actions.append(transfer, remove);
      row.append(actions);
    }
    groupMemberList.append(row);
  });
  document.querySelector("#groupAvatarRow").classList.toggle("hidden", !isOwner);
  document.querySelector("#groupDeleteButton").classList.toggle("hidden", !isOwner);
  document.querySelector("#groupLeaveButton").classList.toggle("hidden", isOwner);
}

function openLightbox(url) {
  const box = document.querySelector("#lightbox");
  box.querySelector("img").src = url;
  box.classList.remove("hidden");
}

document.querySelector("#lightbox").addEventListener("click", event => {
  event.currentTarget.classList.add("hidden");
  event.currentTarget.querySelector("img").removeAttribute("src");
});

function addSectionTitle(container, text) {
  const heading = document.createElement("div");
  heading.className = "request-title";
  heading.textContent = text;
  container.append(heading);
}

function renderFriends() {
  requestList.replaceChildren();
  const incoming = snapshot.requests.filter(request => request.direction === "incoming");
  const outgoing = snapshot.requests.filter(request => request.direction === "outgoing");
  if (incoming.length || outgoing.length) {
    addSectionTitle(requestList, "Friend requests");
    incoming.forEach(request => {
      const row = document.createElement("div");
      row.className = "social-item";
      const name = document.createElement("span");
      name.className = "social-name";
      name.textContent = request.user.displayName;
      name.append(handleSpan(request.user.username));
      const actions = document.createElement("span");
      actions.className = "request-actions";
      for (const [label, accept] of [["Accept", true], ["Decline", false]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", async () => {
          try {
            await api("/api/friends/respond", { method: "POST", body: { requestId: request.id, accept } });
            await refreshSnapshot();
          } catch (error) {
            friendMessage.textContent = error.message;
          }
        });
        actions.append(button);
      }
      row.append(name, actions);
      requestList.append(row);
    });
    outgoing.forEach(request => {
      const row = document.createElement("div");
      row.className = "social-item social-name";
      row.textContent = `Waiting for ${request.user.displayName} `;
      row.append(handleSpan(request.user.username));
      requestList.append(row);
    });
  }

  friendsList.replaceChildren();
  if (!snapshot.friends.length) {
    const empty = document.createElement("div");
    empty.className = "empty-list";
    empty.textContent = "No friends yet. Add someone with their friend code.";
    friendsList.append(empty);
    return;
  }
  addSectionTitle(friendsList, "Your friends");
  snapshot.friends.forEach(friend => {
    const row = document.createElement("div");
    row.className = "social-item";
    const name = document.createElement("span");
    name.className = "social-name";
    name.textContent = friend.displayName;
    name.append(handleSpan(friend.username));
    const dot = document.createElement("span");
    dot.className = `status-dot${friend.online ? " online" : ""}`;
    const label = document.createElement("span");
    label.className = "social-label";
    label.title = friend.online ? "Online" : "Offline";
    label.classList.add("clickable");
    label.addEventListener("click", () => openProfile(friend));
    label.append(dot, name);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Message";
    button.addEventListener("click", async () => {
      try {
        const result = await api("/api/chats/direct", { method: "POST", body: { friendId: friend.id } });
        activeChatId = result.chat.id;
        friendsPanel.classList.add("hidden");
        await refreshSnapshot();
      } catch (error) {
        friendMessage.textContent = error.message;
      }
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Unadd";
    remove.addEventListener("click", async () => {
      if (!confirm(`Remove ${friend.displayName} from both friends lists? This deletes your direct chat history here and on their device when both of you are online again.`)) return;
      try {
        await api("/api/friends/remove", { method: "POST", body: { friendId: friend.id } });
        await refreshSnapshot();
      } catch (error) {
        friendMessage.textContent = error.message;
      }
    });
    row.append(label, button, remove);
    friendsList.append(row);
  });
}

function renderMemberChoices() {
  memberChoices.replaceChildren();
  if (!snapshot.friends.length) {
    const empty = document.createElement("div");
    empty.className = "empty-list";
    empty.textContent = "Add friends before making a group.";
    memberChoices.append(empty);
    return;
  }
  snapshot.friends.forEach(friend => {
    const label = document.createElement("label");
    label.className = "member-choice";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "memberId";
    checkbox.value = friend.id;
    const name = document.createElement("span");
    name.textContent = friend.displayName;
    name.append(handleSpan(friend.username));
    label.append(checkbox, name);
    memberChoices.append(label);
  });
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

const themeAccents = { meadow: "#245c48", dark: "#4f9d7f", midnight: "#83c9a3", rose: "#9c506f", ocean: "#277985", contrast: "#111111" };
function cursorSvg(style, color, size) {
  const outline = backgroundLuminance(color) > 0.55 ? "#1b1b1b" : "#ffffff";
  const paint = `fill='${color}' stroke='${outline}' stroke-width='1.6' stroke-linejoin='round'`;
  const shapes = {
    sparkle: `<path ${paint} d='M16 1l3.2 10.1L29 8l-6.1 9L32 22l-10.5.2L20 32l-5.7-8.8L5 29l3.2-10L0 14l10.5-.1z'/>`,
    heart: `<path ${paint} d='M16 29S2 20 2 10a7 7 0 0 1 14-1 7 7 0 0 1 14 1c0 10-14 19-14 19z'/>`,
    diamond: `<path ${paint} d='M16 1 31 16 16 31 1 16z'/>`,
    star: `<path ${paint} d='M16 2l4.2 9.6 10.3 1-7.8 6.9 2.3 10.2L16 24.4 7 29.7l2.3-10.2L1.5 12.6l10.3-1z'/>`,
    arrow: `<path ${paint} d='M4 3v23l6-5.5 4.5 9 4-2-4.5-9H23z'/>`,
    ring: `<circle cx='16' cy='16' r='10' fill='none' stroke='${outline}' stroke-width='5.5'/><circle cx='16' cy='16' r='10' fill='none' stroke='${color}' stroke-width='3'/><circle cx='16' cy='16' r='2.6' ${paint}/>`,
    dot: `<circle cx='16' cy='16' r='8' ${paint}/>`,
    paw: `<g ${paint}><ellipse cx='16' cy='21' rx='7.5' ry='6'/><ellipse cx='6.5' cy='13' rx='3' ry='4'/><ellipse cx='12.5' cy='7' rx='3' ry='4.2'/><ellipse cx='19.5' cy='7' rx='3' ry='4.2'/><ellipse cx='25.5' cy='13' rx='3' ry='4'/></g>`
  };
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 32 32'>${shapes[style] || shapes.sparkle}</svg>`;
}
const particleGlyphs = {
  sparkle: ["✦", "✧", "✳"], heart: ["♥", "♡"], bubble: ["○", "◦", "●"], leaf: ["❧", "✿"],
  star: ["★", "☆", "✯"], confetti: ["■", "▰", "●", "▲"], snow: ["❄", "❅", "❆"], music: ["♪", "♫", "♬"], flame: ["✹", "✺", "•"]
};
const particlePhysics = { leaf: { fall: 40, spin: 220 }, snow: { fall: 50, spin: 120 }, confetti: { fall: 45, spin: 300 }, flame: { fall: -30, spin: 40 }, bubble: { fall: -35, spin: 0 }, music: { fall: -25, spin: 30 } };

function applyPreferences(input) {
  const themes = ["meadow", "dark", "midnight", "rose", "ocean", "contrast", "custom"];
  const preferences = {
    ...defaultPreferences,
    ...input,
    theme: themes.includes(input.theme) ? input.theme : defaultPreferences.theme,
    accent: typeof input.accent === "string" && /^#[0-9a-f]{6}$/i.test(input.accent) ? input.accent : defaultPreferences.accent,
    ...sanitizeBackgroundPreferences(input, defaultPreferences),
    ...sanitizeEffectPreferences({ ...defaultPreferences, ...input }, defaultPreferences)
  };
  const rootElement = document.documentElement;
  rootElement.dataset.theme = preferences.theme;
  const customBackground = preferences.theme === "custom";
  const pageBackground = buildBackground(preferences);
  const speeds = { slow: "46s", medium: "24s", fast: "10s" };
  const animated = customBackground && preferences.backgroundAnimated && preferences.backgroundStyle !== "solid";
  rootElement.style.setProperty("--paper", customBackground ? preferences.backgroundColor : "");
  rootElement.style.setProperty("--page-background", customBackground ? pageBackground : "");
  rootElement.style.setProperty("--preview-bg", pageBackground);
  rootElement.style.setProperty("--bg-speed", speeds[preferences.backgroundSpeed]);
  rootElement.style.setProperty("--panel-alpha", `${preferences.panelOpacity}%`);
  rootElement.style.setProperty("--panel-alpha-n", String(preferences.panelOpacity));
  rootElement.style.setProperty("--panel-blur", `${preferences.panelBlur}px`);
  rootElement.dataset.bgAnim = animated ? "on" : "off";
  // Clear the override first so the theme's own --line is read, then blend it toward the text color.
  rootElement.style.removeProperty("--line");
  const themeLine = getComputedStyle(rootElement).getPropertyValue("--line").trim();
  if (preferences.borderStrength > 0 && themeLine) {
    rootElement.style.setProperty("--line", `color-mix(in srgb, ${themeLine}, var(--ink) ${preferences.borderStrength}%)`);
  }
  document.querySelector("#borderStrengthOut").textContent = `${preferences.borderStrength}%`;
  const usedColors = [preferences.backgroundColor];
  if (preferences.backgroundStyle !== "solid") usedColors.push(preferences.backgroundEndColor);
  if (preferences.backgroundStyle === "mesh" || (preferences.backgroundMidEnabled && preferences.backgroundStyle !== "solid")) usedColors.push(preferences.backgroundMidColor);
  const tone = usedColors.reduce((sum, color) => sum + backgroundLuminance(color), 0) / usedColors.length;
  rootElement.dataset.customTone = preferences.backgroundTone === "auto" ? (tone < 0.32 ? "dark" : "light") : (preferences.backgroundTone === "dark" ? "dark" : "light");
  rootElement.dataset.cursor = preferences.cursorEnabled ? "on" : "off";
  rootElement.dataset.compact = preferences.compact ? "on" : "off";
  rootElement.dataset.fontSize = preferences.fontSize;
  rootElement.dataset.bubbles = preferences.bubbleShape;
  rootElement.style.setProperty("--accent", preferences.accent);
  rootElement.style.setProperty("--accent-ink", backgroundLuminance(preferences.accent) > 0.35 ? "#111513" : "#ffffff");
  const cursorColor = preferences.cursorColorMode === "custom" ? preferences.cursorColor : preferences.accent;
  const cursor = btoa(cursorSvg(preferences.cursorStyle, cursorColor, preferences.cursorSize));
  const hotspot = preferences.cursorStyle === "arrow" ? Math.round(preferences.cursorSize * 0.12) : Math.round(preferences.cursorSize / 2);
  rootElement.style.setProperty("--custom-cursor", `url("data:image/svg+xml;base64,${cursor}") ${hotspot} ${hotspot}, pointer`);
  document.querySelectorAll("[data-cursor-row]").forEach(row => { row.hidden = !preferences.cursorEnabled; });
  document.querySelectorAll("[data-particle-row]").forEach(row => { row.hidden = !preferences.particlesEnabled; });
  document.querySelectorAll("[data-cursor-color-row]").forEach(row => { row.hidden = preferences.cursorColorMode !== "custom"; });
  document.querySelectorAll("[data-particle-color-row]").forEach(row => { row.hidden = preferences.particleColorMode !== "custom"; });
  document.querySelector("#cursorSizeOut").textContent = `${preferences.cursorSize}px`;
  document.querySelector("#particleCountOut").textContent = String(preferences.particleCount);
  document.querySelector("#particleSizeOut").textContent = `${preferences.particleSize}px`;
  for (const [key, control] of Object.entries(settingControls)) control.value = typeof preferences[key] === "boolean" ? "on" : preferences[key];
  settingControls.cursorEnabled.checked = preferences.cursorEnabled;
  settingControls.particlesEnabled.checked = preferences.particlesEnabled;
  settingControls.particleTrail.checked = preferences.particleTrail;
  settingControls.compact.checked = preferences.compact;
  settingControls.tabDisguise.checked = preferences.tabDisguise;
  document.querySelector("#customThemeControls").classList.toggle("hidden", !customBackground);
  const gradient = preferences.backgroundStyle !== "solid";
  document.querySelectorAll("#customThemeControls [data-gradient-row]").forEach(row => { row.hidden = !gradient; });
  document.querySelectorAll("#customThemeControls [data-angle-row]").forEach(row => { row.hidden = !["linear", "conic"].includes(preferences.backgroundStyle); });
  document.querySelector("#backgroundAngleOut").textContent = `${preferences.backgroundAngle}°`;
  document.querySelector("#panelOpacityOut").textContent = `${preferences.panelOpacity}%`;
  document.querySelector("#panelBlurOut").textContent = `${preferences.panelBlur}px`;
  settingControls.backgroundMidEnabled.checked = preferences.backgroundMidEnabled;
  settingControls.backgroundAnimated.checked = preferences.backgroundAnimated;
  document.querySelectorAll("#themePresets .theme-preset").forEach(button => {
    const preset = themePresets[Number(button.dataset.index)];
    button.classList.toggle("active", presetPreferences(preset).backgroundColor === preferences.backgroundColor && presetPreferences(preset).backgroundEndColor === preferences.backgroundEndColor && presetPreferences(preset).backgroundStyle === preferences.backgroundStyle);
  });
  applyTabDisguise(preferences.tabDisguise);
}

function currentPreferences() {
  return {
    theme: settingControls.theme.value,
    accent: settingControls.accent.value,
    cursorEnabled: settingControls.cursorEnabled.checked,
    cursorStyle: settingControls.cursorStyle.value,
    particlesEnabled: settingControls.particlesEnabled.checked,
    particleStyle: settingControls.particleStyle.value,
    cursorColorMode: settingControls.cursorColorMode.value,
    cursorColor: settingControls.cursorColor.value,
    cursorSize: Number(settingControls.cursorSize.value),
    particleColorMode: settingControls.particleColorMode.value,
    particleColor: settingControls.particleColor.value,
    particleCount: Number(settingControls.particleCount.value),
    particleSize: Number(settingControls.particleSize.value),
    particleTrail: settingControls.particleTrail.checked,
    fontSize: settingControls.fontSize.value,
    bubbleShape: settingControls.bubbleShape.value,
    compact: settingControls.compact.checked,
    tabDisguise: settingControls.tabDisguise.checked,
    backgroundStyle: settingControls.backgroundStyle.value,
    backgroundColor: settingControls.backgroundColor.value,
    backgroundEndColor: settingControls.backgroundEndColor.value,
    backgroundMidColor: settingControls.backgroundMidColor.value,
    backgroundMidEnabled: settingControls.backgroundMidEnabled.checked,
    backgroundAngle: Number(settingControls.backgroundAngle.value),
    backgroundAnimated: settingControls.backgroundAnimated.checked,
    backgroundSpeed: settingControls.backgroundSpeed.value,
    backgroundTone: settingControls.backgroundTone.value,
    panelOpacity: Number(settingControls.panelOpacity.value),
    panelBlur: Number(settingControls.panelBlur.value),
    borderStrength: Number(settingControls.borderStrength.value)
  };
}

function savePreferences() {
  const preferences = currentPreferences();
  currentUser.preferences = preferences;
  applyPreferences(preferences);
  settingsStatus.textContent = "Saving...";
  window.clearTimeout(preferenceSaveTimer);
  preferenceSaveTimer = window.setTimeout(async () => {
    try {
      const result = await api("/api/preferences", { method: "PATCH", body: { preferences } });
      currentUser.preferences = result.preferences;
      settingsStatus.textContent = "Saved to your account";
    } catch (error) {
      settingsStatus.textContent = error.message;
    }
  }, 250);
}

function presetPreferences(preset) {
  return {
    backgroundStyle: preset.style,
    backgroundColor: preset.c1,
    backgroundEndColor: preset.c2 || preset.c1,
    backgroundMidColor: preset.mid || defaultPreferences.backgroundMidColor,
    backgroundMidEnabled: Boolean(preset.midOn),
    backgroundAngle: preset.angle ?? 135,
    backgroundAnimated: Boolean(preset.animated)
  };
}

function pushThemeChange(changes, note) {
  const next = { ...currentPreferences(), theme: "custom", ...changes };
  const clean = { ...next, ...sanitizeBackgroundPreferences(next, defaultPreferences) };
  if (typeof changes.accent === "string") clean.accent = changes.accent;
  for (const [key, control] of Object.entries(settingControls)) {
    if (key in clean && control.type !== "checkbox") control.value = clean[key];
    else if (key in clean) control.checked = Boolean(clean[key]);
  }
  savePreferences();
  if (note) document.querySelector("#themeNote").textContent = note;
}

function buildThemePresets() {
  const container = document.querySelector("#themePresets");
  themePresets.forEach((preset, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-preset";
    button.dataset.index = String(index);
    button.title = `${preset.name} theme`;
    button.setAttribute("role", "listitem");
    button.style.background = buildBackground({ ...defaultPreferences, ...presetPreferences(preset) });
    button.innerHTML = `<span>${preset.name}</span>`;
    button.addEventListener("click", () => pushThemeChange({ ...presetPreferences(preset), accent: preset.accent }, `${preset.name} applied.`));
    container.append(button);
  });
}
buildThemePresets();

const themeCodePrefix = "dsc-theme:";
const themeCodeKeys = ["accent", "backgroundStyle", "backgroundColor", "backgroundEndColor", "backgroundMidColor", "backgroundMidEnabled", "backgroundAngle", "backgroundAnimated", "backgroundSpeed", "backgroundTone", "panelOpacity", "panelBlur", "borderStrength"];
const shortThemeKey = "dsc-short-themes";
const builtInThemes = {
  "586500": { accent: "#5865f2", backgroundStyle: "linear", backgroundColor: "#0b0d2e", backgroundEndColor: "#2b2f8f", backgroundAngle: 160, backgroundTone: "dark", panelOpacity: 70, panelBlur: 14, borderStrength: 40 }
};

function shortThemes() {
  try { return JSON.parse(localStorage.getItem(shortThemeKey) || "{}"); } catch { return {}; }
}

function makeShortCode(data) {
  const saved = shortThemes();
  const json = JSON.stringify(data);
  const existing = Object.keys(saved).find(key => JSON.stringify(saved[key]) === json);
  if (existing) return existing;
  let code;
  do code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)); while (saved[code] || builtInThemes[code]);
  saved[code] = data;
  try { localStorage.setItem(shortThemeKey, JSON.stringify(saved)); } catch {}
  return code;
}

function randomPalette() {
  const hue = Math.floor(Math.random() * 360);
  const toHex = (h, s, l) => {
    const a = s * Math.min(l, 1 - l);
    const channel = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
  };
  const dark = Math.random() < 0.5;
  const l = dark ? 0.16 : 0.88;
  const spread = 30 + Math.random() * 60;
  return {
    backgroundColor: toHex(hue, 0.55, l),
    backgroundEndColor: toHex((hue + spread) % 360, 0.6, dark ? 0.26 : 0.8),
    backgroundMidColor: toHex((hue + spread * 2) % 360, 0.65, dark ? 0.34 : 0.84),
    accent: toHex((hue + 180) % 360, 0.6, dark ? 0.72 : 0.34)
  };
}

document.querySelector("#themeShuffle").addEventListener("click", () => {
  const style = backgroundStyles[1 + Math.floor(Math.random() * (backgroundStyles.length - 1))];
  pushThemeChange({ ...randomPalette(), backgroundStyle: style, backgroundAngle: Math.floor(Math.random() * 72) * 5, backgroundMidEnabled: Math.random() < 0.5 }, "Shuffled. Press again for another.");
});
document.querySelector("#themeSwap").addEventListener("click", () => {
  const now = currentPreferences();
  pushThemeChange({ backgroundColor: now.backgroundEndColor, backgroundEndColor: now.backgroundColor }, "Colors swapped.");
});
document.querySelector("#themeReset").addEventListener("click", () => {
  pushThemeChange({ ...Object.fromEntries(Object.entries(defaultPreferences).filter(([key]) => key.startsWith("background") || key.startsWith("panel"))), accent: themeAccents.meadow }, "Custom theme reset.");
});
document.querySelector("#themeCopy").addEventListener("click", async () => {
  const now = currentPreferences();
  const data = Object.fromEntries(themeCodeKeys.map(key => [key, now[key]]));
  const code = makeShortCode(data);
  try {
    await navigator.clipboard.writeText(code);
    document.querySelector("#themeNote").textContent = `Theme code ${code} copied. Short codes work in this browser; long codes (dsc-theme:...) still paste anywhere.`;
  } catch {
    window.prompt("Copy your theme code:", code);
  }
});
document.querySelector("#themePaste").addEventListener("click", () => {
  const code = window.prompt("Paste a theme code:");
  if (!code) return;
  try {
    const trimmed = code.trim();
    let data;
    if (/^\d{6}$/.test(trimmed)) {
      data = builtInThemes[trimmed] || shortThemes()[trimmed];
      if (!data) throw new Error("unknown code");
    } else {
      if (!trimmed.startsWith(themeCodePrefix)) throw new Error("bad prefix");
      data = JSON.parse(atob(trimmed.slice(themeCodePrefix.length)));
    }
    const changes = { ...sanitizeBackgroundPreferences(data, defaultPreferences) };
    if (typeof data.accent === "string" && /^#[0-9a-f]{6}$/i.test(data.accent)) changes.accent = data.accent;
    pushThemeChange(changes, "Theme code applied.");
  } catch {
    document.querySelector("#themeNote").textContent = "That doesn't look like a valid theme code.";
  }
});

["backgroundColor", "backgroundEndColor", "backgroundMidColor", "backgroundAngle", "panelOpacity", "panelBlur", "borderStrength", "cursorColor", "cursorSize", "particleColor", "particleCount", "particleSize"].forEach(key => {
  settingControls[key].addEventListener("input", () => savePreferences());
});

Object.values(settingControls).forEach(control => control.addEventListener("change", event => {
  if (event.currentTarget === settingControls.theme) {
    settingControls.accent.value = themeAccents[settingControls.theme.value] || themeAccents.meadow;
  }
  savePreferences();
}));

document.querySelector("#settingsToggle").addEventListener("click", () => {
  friendsPanel.classList.add("hidden");
  newChatForm.classList.add("hidden");
  settingsPanel.classList.toggle("hidden");
  if (!settingsPanel.classList.contains("hidden") && currentUser?.preferences) applyPreferences(currentUser.preferences);
});

document.querySelector("#settingsClose").addEventListener("click", () => settingsPanel.classList.add("hidden"));

function particleColor(prefs, index) {
  if (prefs.particleColorMode === "rainbow") return `hsl(${(index * 67 + Math.random() * 40) % 360} 85% 60%)`;
  return prefs.particleColorMode === "custom" ? prefs.particleColor : "var(--accent)";
}

function spawnParticles(x, y, count, spread = 1) {
  const prefs = { ...defaultPreferences, ...currentUser.preferences };
  const glyphs = particleGlyphs[prefs.particleStyle] || particleGlyphs.sparkle;
  const physics = particlePhysics[prefs.particleStyle] || { fall: 0, spin: 100 };
  const layer = document.createElement("div");
  layer.className = "click-particle-layer";
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement("span");
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.6;
    const distance = (22 + Math.random() * 34) * spread;
    particle.className = "click-particle";
    particle.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    particle.style.setProperty("--x", `${x}px`);
    particle.style.setProperty("--y", `${y}px`);
    particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--fall", `${physics.fall * (0.6 + Math.random() * 0.8)}px`);
    particle.style.setProperty("--rot", `${(Math.random() < 0.5 ? -1 : 1) * physics.spin * (0.5 + Math.random())}deg`);
    particle.style.setProperty("--dur", `${0.55 + Math.random() * 0.45}s`);
    particle.style.fontSize = `${Math.round(prefs.particleSize * (0.7 + Math.random() * 0.6))}px`;
    particle.style.color = particleColor(prefs, index);
    layer.append(particle);
  }
  document.body.append(layer);
  window.setTimeout(() => layer.remove(), 1200);
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
document.addEventListener("click", event => {
  if (!currentUser?.preferences?.particlesEnabled || reducedMotion.matches) return;
  if (event.target.closest("input, textarea, select, .click-particle-layer")) return;
  spawnParticles(event.clientX, event.clientY, currentUser.preferences.particleCount ?? defaultPreferences.particleCount);
}, { passive: true });

let lastTrail = 0;
document.addEventListener("pointermove", event => {
  const prefs = currentUser?.preferences;
  if (!prefs?.particlesEnabled || !prefs.particleTrail || reducedMotion.matches || event.pointerType === "touch") return;
  const now = performance.now();
  if (now - lastTrail < 55) return;
  lastTrail = now;
  spawnParticles(event.clientX, event.clientY, 1, 0.45);
}, { passive: true });

document.querySelector("#friendsToggle").addEventListener("click", () => {
  newChatForm.classList.add("hidden");
  friendsPanel.classList.toggle("hidden");
  if (!friendsPanel.classList.contains("hidden")) friendUsername.focus();
});

document.querySelector("#newChatButton").addEventListener("click", () => {
  friendsPanel.classList.add("hidden");
  const opening = newChatForm.classList.contains("hidden");
  newChatForm.classList.toggle("hidden");
  if (opening) {
    renderMemberChoices();
    newChatName.focus();
  }
});

document.querySelector("#groupManagementClose").addEventListener("click", () => {
  groupManagement.classList.add("hidden");
  conversationActions.querySelector("button")?.setAttribute("aria-expanded", "false");
});
async function setGroupAvatar(avatar) {
  const chat = snapshot.chats.find(item => item.id === activeChatId && item.isGroup);
  if (!chat) return;
  try {
    await api(`/api/chats/${encodeURIComponent(chat.id)}/group`, { method: "POST", body: { action: "avatar", avatar } });
    await refreshSnapshot();
  } catch (error) {
    alert(error.message);
  }
}
document.querySelector("#groupAvatarFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    await setGroupAvatar(await resizeImage(file));
  } catch (error) {
    alert(error.message);
  }
});
document.querySelector("#groupAvatarRemove").addEventListener("click", () => setGroupAvatar(null));
document.querySelector("#groupDeleteButton").addEventListener("click", async () => {
  const chat = snapshot.chats.find(item => item.id === activeChatId && item.isGroup);
  if (!chat || !confirm(`Delete ${chat.name} for you and notify members who are online?`)) return;
  try {
    await api(`/api/chats/${encodeURIComponent(chat.id)}/group`, { method: "POST", body: { action: "delete" } });
    groupManagement.classList.add("hidden");
    activeChatId = null;
    await refreshSnapshot();
  } catch (error) {
    friendMessage.textContent = error.message;
  }
});
document.querySelector("#groupLeaveButton").addEventListener("click", async () => {
  const chat = snapshot.chats.find(item => item.id === activeChatId && item.isGroup);
  if (!chat || !confirm(`Leave ${chat.name}?`)) return;
  try {
    await api(`/api/chats/${encodeURIComponent(chat.id)}/group`, { method: "POST", body: { action: "leave" } });
    groupManagement.classList.add("hidden");
    activeChatId = null;
    await refreshSnapshot();
  } catch (error) {
    friendMessage.textContent = error.message;
  }
});

friendForm.addEventListener("submit", async event => {
  event.preventDefault();
  friendMessage.textContent = "";
  try {
    await api("/api/friends/request", { method: "POST", body: { username: friendUsername.value.trim() } });
    friendUsername.value = "";
    friendMessage.textContent = "Friend request sent.";
    await refreshSnapshot();
  } catch (error) {
    friendMessage.textContent = error.message;
  }
});

let newGroupAvatar = null;
const newGroupAvatarLabel = document.querySelector("#newGroupAvatarLabel");
document.querySelector("#newGroupAvatarFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    newGroupAvatar = await resizeImage(file);
    newGroupAvatarLabel.textContent = `Picture: ${file.name.slice(0, 30)}`;
  } catch (error) {
    friendMessage.textContent = error.message;
  }
});

newChatForm.addEventListener("submit", async event => {
  event.preventDefault();
  const name = newChatName.value.trim();
  const memberIds = [...memberChoices.querySelectorAll("input[name=memberId]:checked")].map(input => input.value);
  try {
    const result = await api("/api/chats", { method: "POST", body: { name, memberIds, ...(newGroupAvatar ? { avatar: newGroupAvatar } : {}) } });
    activeChatId = result.chat.id;
    newChatName.value = "";
    newGroupAvatar = null;
    newGroupAvatarLabel.textContent = "Group picture (optional)";
    newChatForm.classList.add("hidden");
    await refreshSnapshot();
    messageInput.focus();
  } catch (error) {
    friendMessage.textContent = error.message;
    friendsPanel.classList.remove("hidden");
    newChatForm.classList.add("hidden");
  }
});

messageForm.addEventListener("submit", async event => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !activeChatId) return;
  try {
    await api(`/api/chats/${encodeURIComponent(activeChatId)}/messages`, { method: "POST", body: { text, ...replyBody() } });
    messageInput.value = "";
    clearReply();
    await refreshSnapshot();
    messageInput.focus();
  } catch (error) {
    friendMessage.textContent = error.message;
  }
});

document.querySelector("#chatSearch").addEventListener("input", renderChatList);
document.querySelector("#signOutButton").addEventListener("click", async () => {
  window.clearTimeout(saveTimer);
  await flushSave();
  location.reload();
});

document.querySelector("#deleteAccount").addEventListener("click", async () => {
  if (!confirm("Delete this account, its friends and all its messages from this computer? This cannot be undone. Export a backup first if you want to keep them.")) return;
  window.clearTimeout(saveTimer);
  dirty.clear();
  const db = idb.name;
  state = null;
  await idb.clear();
  writeAccounts(readAccounts().filter(account => account.db !== db));
  location.reload();
});

document.querySelector("#copyCode").addEventListener("click", async () => {
  const input = document.querySelector("#myCode");
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    input.select();
    document.execCommand("copy");
  }
  friendMessage.textContent = "Friend code copied. Send it to your friend.";
});

document.querySelector("#exportButton").addEventListener("click", exportBackup);
document.querySelector("#settingsToggle").addEventListener("click", () => {
  document.querySelector("#storageInfo").textContent = state ? storageSummary() : "";
});

document.querySelector("#addOfficial").addEventListener("click", async () => {
  try {
    await api("/api/friends/request", { method: "POST", body: { username: OFFICIAL_ID } });
    friendMessage.textContent = "Request sent. Discard Official accepts when it is online.";
    await refreshSnapshot();
  } catch (error) {
    friendMessage.textContent = error.message;
  }
});

window.setInterval(() => {
  if (!document.hidden) refreshSnapshot();
}, 2500);


async function saveProfile(changes, doneMessage) {
  try {
    const result = await api("/api/profile", { method: "PATCH", body: changes });
    currentUser.displayName = result.user.displayName;
    currentUser.avatar = result.user.avatar;
    renderProfile();
    settingsStatus.textContent = doneMessage;
    await refreshSnapshot();
  } catch (error) {
    settingsStatus.textContent = error.message;
  }
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const side = Math.min(image.width, image.height);
      canvas.getContext("2d").drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("That file is not a readable image.")); };
    image.src = objectUrl;
  });
}

document.querySelector("#profileSave").addEventListener("click", () => saveProfile({ displayName: displayNameInput.value }, "Name saved"));
document.querySelector("#avatarRemove").addEventListener("click", () => saveProfile({ avatar: null }, "Picture removed"));
document.querySelector("#avatarFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    await saveProfile({ avatar: await resizeImage(file) }, "Picture updated");
  } catch (error) {
    settingsStatus.textContent = error.message;
  }
});

const maxImageBytes = 3 * 1024 * 1024;

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(blob);
  });
}

async function prepareImage(file) {
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) throw new Error("Choose a PNG, JPEG, GIF, or WebP image.");
  if (file.type === "image/gif") {
    if (file.size > maxImageBytes) throw new Error("GIFs must be under 3 MB.");
    return readAsDataUrl(file);
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("That file is not a readable image."));
      element.src = objectUrl;
    });
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/webp", 0.85);
    return dataUrl.startsWith("data:image/webp") ? dataUrl : canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function sendImage(file) {
  if (!file || !activeChatId) return;
  try {
    friendMessage.textContent = "";
    const image = await prepareImage(file);
    await api(`/api/chats/${encodeURIComponent(activeChatId)}/messages`, { method: "POST", body: { text: messageInput.value.trim(), image, ...replyBody() } });
    messageInput.value = "";
    clearReply();
    await refreshSnapshot();
  } catch (error) {
    alert(error.message);
  }
}

async function sendFile(file) {
  if (!file || !activeChatId) return;
  try {
    friendMessage.textContent = "";
    if (file.size > maxFileBytes) throw new Error(`Files must be under ${formatBytes(maxFileBytes)}.`);
    const dataUrl = await readAsDataUrl(file);
    const data = `data:application/octet-stream;base64,${dataUrl.slice(dataUrl.indexOf(",") + 1)}`;
    const payload = { name: file.name, type: file.type, size: file.size, data };
    await api(`/api/chats/${encodeURIComponent(activeChatId)}/messages`, { method: "POST", body: { text: messageInput.value.trim(), file: payload, ...replyBody() } });
    messageInput.value = "";
    clearReply();
    await refreshSnapshot();
  } catch (error) {
    alert(error.message);
  }
}

const sendAttachment = file => (/^image\/(png|jpeg|gif|webp)$/.test(file?.type) ? sendImage(file) : sendFile(file));

const plusMenu = document.querySelector("#plusMenu");
const plusToggle = document.querySelector("#plusToggle");
function setPlusMenu(open) {
  plusMenu.classList.toggle("hidden", !open);
  plusToggle.setAttribute("aria-expanded", String(open));
}
plusToggle.addEventListener("click", event => {
  event.stopPropagation();
  setPlusMenu(plusMenu.classList.contains("hidden"));
});
document.addEventListener("click", event => { if (!event.target.closest("#plusMenu")) setPlusMenu(false); });
document.addEventListener("keydown", event => { if (event.key === "Escape") setPlusMenu(false); });
document.querySelector("#plusGame").addEventListener("click", () => {
  setPlusMenu(false);
  const chat = state?.chats.find(item => item.id === activeChatId);
  if (chat) startGameInvite(chat);
});
document.querySelector("#plusImpostor").addEventListener("click", () => {
  setPlusMenu(false);
  const chat = state?.chats.find(item => item.id === activeChatId);
  if (chat) startImpostorInvite(chat);
});
document.querySelector("#plusSketch").addEventListener("click", () => {
  setPlusMenu(false);
  const chat = state?.chats.find(item => item.id === activeChatId);
  if (chat) startSketchInvite(chat);
});
document.querySelector("#plusFile").addEventListener("click", () => {
  setPlusMenu(false);
  document.querySelector("#imageFile").click();
});

document.querySelector("#imageFile").addEventListener("change", event => {
  const file = event.target.files[0];
  event.target.value = "";
  sendAttachment(file);
});
messageInput.addEventListener("paste", event => {
  const file = [...(event.clipboardData?.files || [])][0];
  if (file) {
    event.preventDefault();
    sendAttachment(file);
  }
});
document.querySelector("#composerWrap").addEventListener("dragover", event => event.preventDefault());
document.querySelector("#composerWrap").addEventListener("drop", event => {
  const file = event.dataTransfer.files[0];
  if (file) {
    event.preventDefault();
    sendAttachment(file);
  }
});

const gifPanel = document.querySelector("#gifPanel");
const gifGrid = document.querySelector("#gifGrid");
const gifStatus = document.querySelector("#gifStatus");
const gifSearch = document.querySelector("#gifSearch");
let gifTab = "trending";
let gifSearchTimer = null;
let gifRequest = 0;

function gifMessage(text) {
  gifGrid.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "gif-empty";
  empty.textContent = text;
  gifGrid.append(empty);
}

function renderGifs(items) {
  gifGrid.replaceChildren();
  items.forEach(gif => {
    const cell = document.createElement("div");
    cell.className = "gif-cell";
    const picture = document.createElement("img");
    picture.src = gif.src;
    picture.alt = "GIF";
    picture.loading = "lazy";
    picture.title = "Send this GIF";
    picture.addEventListener("click", async () => {
      if (!activeChatId) return;
      try {
        await api(`/api/chats/${encodeURIComponent(activeChatId)}/messages`, { method: "POST", body: gif.send });
        gifPanel.classList.add("hidden");
        await refreshSnapshot();
      } catch (error) {
        gifStatus.textContent = error.message;
      }
    });
    const star = document.createElement("button");
    star.type = "button";
    star.className = `gif-star${gif.favorite ? " on" : ""}`;
    star.textContent = gif.favorite ? "★" : "☆";
    star.setAttribute("aria-label", gif.favorite ? "Remove from favorites" : "Add to favorites");
    star.addEventListener("click", async () => {
      try {
        await api("/api/gifs/favorite", { method: "POST", body: { id: gif.key, favorite: !gif.favorite } });
        gif.favorite = !gif.favorite;
        if (gifTab === "favorites" && !gif.favorite) cell.remove();
        star.className = `gif-star${gif.favorite ? " on" : ""}`;
        star.textContent = gif.favorite ? "★" : "☆";
        if (gifTab === "favorites" && !gifGrid.children.length) gifMessage("No favorites yet. Star a GIF to save it here.");
      } catch (error) {
        gifStatus.textContent = error.message;
      }
    });
    cell.append(picture, star);
    gifGrid.append(cell);
  });
}

async function loadGifs() {
  const request = ++gifRequest;
  const query = gifSearch.value.trim();
  gifStatus.textContent = "";
  gifMessage("Loading...");
  try {
    const url = gifTab === "trending" ? `/api/gifs?tab=trending&q=${encodeURIComponent(query)}` : `/api/gifs?tab=${gifTab}`;
    const result = await api(url);
    if (request !== gifRequest) return;
    if (!result.gifs.length) gifMessage(gifTab === "favorites" ? "No favorites yet. Star a GIF to save it here." : "No GIFs found.");
    else renderGifs(result.gifs);
  } catch (error) {
    if (request === gifRequest) gifMessage(error.message);
  }
}

function setGifTab(tab) {
  gifTab = tab;
  document.querySelectorAll("[data-gif-tab]").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.gifTab === tab)));
  gifSearch.placeholder = tab === "trending" ? "Search GIPHY" : "Search is for the Trending tab";
  gifSearch.disabled = tab !== "trending";
  loadGifs();
}

document.querySelector("#gifToggle").addEventListener("click", () => {
  gifPanel.classList.toggle("hidden");
  if (!gifPanel.classList.contains("hidden")) setGifTab(gifTab);
});

document.querySelectorAll("[data-gif-tab]").forEach(button => button.addEventListener("click", () => setGifTab(button.dataset.gifTab)));

gifSearch.addEventListener("input", () => {
  window.clearTimeout(gifSearchTimer);
  gifSearchTimer = window.setTimeout(loadGifs, 350);
});

document.querySelector("#gifUpload").addEventListener("change", async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.type !== "image/gif") throw new Error("Choose a GIF file.");
    if (file.size > maxImageBytes) throw new Error("GIFs must be under 3 MB.");
    await api("/api/gifs", { method: "POST", body: { image: await readAsDataUrl(file) } });
    setGifTab("library");
    gifStatus.textContent = "GIF added.";
  } catch (error) {
    gifStatus.textContent = error.message;
  }
});

function loadVersion() {
  api("/api/version").then(result => {
    document.querySelector("#versionNote").textContent = `Version ${result.version}`;
  }).catch(() => {});
}
