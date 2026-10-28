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
  fontSize: document.querySelector("#fontSizePreference"),
  bubbleShape: document.querySelector("#bubblePreference"),
  compact: document.querySelector("#compactPreference")
};
const defaultPreferences = {
  theme: "meadow",
  accent: "#245c48",
  cursorEnabled: false,
  cursorStyle: "sparkle",
  particlesEnabled: true,
  particleStyle: "sparkle",
  fontSize: "regular",
  bubbleShape: "soft",
  compact: false
};

let mode = "signin";
let currentUser = null;
let snapshot = { friends: [], requests: [], chats: [], user: null };
let activeChatId = null;
let refreshing = false;
let renderedKeys = {};
let renderedChatId = null;
let preferenceSaveTimer = null;

const APP_VERSION = "2.0.1";
document.querySelectorAll(".brand-mark").forEach(image => { image.src = BRAND_IMAGE; });
const tabIcon = document.createElement("link");
tabIcon.rel = "icon";
tabIcon.href = BRAND_IMAGE;
document.head.append(tabIcon);

const idPattern = /^dsc-[a-z0-9]{16}$/;
const safeIdPattern = /^[\w-]{1,64}$/;
const avatarPattern = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const imageUrlPattern = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
const tenorUrlPattern = /^https:\/\/media\d*\.tenor\.com\/[\w\-/.%~]+$/;
const maxWireImageChars = 4.5 * 1024 * 1024;

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
  return 200 + (message.text?.length || 0) + (message.image?.url?.length || 0);
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
  return { me, friends: {}, people: {}, requests: [], gifs: [], favoriteGifs: [], tenorKey: "", chats: [] };
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

function myProfile() {
  const { id, username, displayName, avatar } = state.me;
  return { id, username, displayName, avatar };
}

function personOf(id) {
  if (id === OFFICIAL_ID && !isOfficialSelf()) return officialProfile;
  if (id === state.me.id) return myProfile();
  return state.people[id] || { id, username: "unknown", displayName: "Former member", avatar: null };
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
  const other = otherId ? personOf(otherId) : null;
  return {
    id: chat.id,
    name: chat.isGroup ? chat.name : other.displayName,
    avatar: other?.avatar || null,
    username: other?.username || null,
    isGroup: chat.isGroup,
    online: otherId ? isOnline(otherId) : null,
    members: chat.members.map(personOf),
    messages: chat.messages,
    rev: chat.rev || 0
  };
}

function snapshotLocal() {
  Object.keys(state.friends).forEach(ensureDirectChat);
  return {
    user: accountUser(),
    friends: Object.values(state.friends).map(friend => ({ ...personOf(friend.id), online: isOnline(friend.id) })),
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
  state.chats.forEach(chat => chat.members.forEach(id => ids.add(id)));
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
  return { id: chat.id, name: chat.name, members: chat.members.map(personOf) };
}

function flushOutbox(id) {
  state.chats.filter(chat => chat.members.includes(id)).forEach(chat => {
    if (chat.isGroup && chat.invites?.includes(id)) sendTo(id, { t: "group", chat: groupPayload(chat) });
    chat.messages.filter(message => message.sender === state.me.id && message.pending?.includes(id)).forEach(message => {
      sendTo(id, { t: "msg", chatId: chat.id, msg: { id: message.id, text: message.text, image: message.image, createdAt: message.createdAt } });
    });
  });
}

function chatForSender(from, chatId) {
  if (typeof chatId !== "string") return null;
  if (chatId.startsWith("dm:")) return state.friends[from] && chatId === directChatId(from) ? ensureDirectChat(from) : null;
  const chat = state.chats.find(item => item.id === chatId && item.isGroup);
  return chat?.members.includes(from) ? chat : null;
}

function addFriend(id, profile) {
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
    case "group": {
      const info = data.chat;
      if (!state.friends[from] || !info || typeof info.id !== "string" || !safeIdPattern.test(info.id) || !info.id.startsWith("g-")) return;
      const existing = state.chats.find(item => item.id === info.id);
      if (!existing) {
        const name = typeof info.name === "string" ? info.name.trim().slice(0, 40) : "";
        const members = Array.isArray(info.members) ? info.members.slice(0, 50) : [];
        const profiles = members.map(member => idPattern.test(member?.id) ? sanitizeProfile(member, member.id) : null);
        if (!name || profiles.some(item => !item) || !profiles.some(item => item.id === state.me.id) || !profiles.some(item => item.id === from)) return;
        profiles.forEach(item => { if (item.id !== state.me.id && !state.people[item.id]) state.people[item.id] = item; });
        const chat = { id: info.id, name, isGroup: true, members: profiles.map(item => item.id), messages: [], invites: [], createdAt: Date.now(), rev: 0 };
        state.chats.push(chat);
        touchChat(chat);
        touchMeta();
      }
      sendTo(from, { t: "ack", chatId: info.id });
      break;
    }
    case "msg": {
      const chat = chatForSender(from, data.chatId);
      const msg = data.msg;
      if (!chat || !msg || typeof msg.id !== "string" || !safeIdPattern.test(msg.id)) return;
      const text = typeof msg.text === "string" ? msg.text.slice(0, 4000) : "";
      const image = msg.image ? sanitizeImage(msg.image) : null;
      if (!text.trim() && !image) return;
      if (!chat.messages.some(message => message.id === msg.id)) {
        const createdAt = Number.isFinite(msg.createdAt) ? Math.min(Math.max(msg.createdAt, 0), Date.now()) : Date.now();
        chat.messages.push({ id: msg.id, sender: from, text, ...(image ? { image } : {}), createdAt, pending: [] });
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

function sendMessageLocal(chat, text, image) {
  const recipients = chat.members.filter(id => id !== state.me.id);
  const message = { id: randomId(20), sender: state.me.id, text, ...(image ? { image } : {}), createdAt: Date.now(), pending: [...recipients] };
  chat.messages.push(message);
  touchChat(chat);
  recipients.forEach(id => {
    connectTo(id);
    sendTo(id, { t: "msg", chatId: chat.id, msg: { id: message.id, text, image, createdAt: message.createdAt } });
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

async function tenorGifs(query) {
  if (!state.tenorKey) return { configured: false, gifs: [] };
  const params = new URLSearchParams({ key: state.tenorKey, client_key: "discard", limit: "30", media_filter: "gif,tinygif", contentfilter: "medium" });
  if (query) params.set("q", query);
  const response = await fetch(`https://tenor.googleapis.com/v2/${query ? "search" : "featured"}?${params}`).catch(() => null);
  if (!response?.ok) fail("Could not reach Tenor. Check your API key and internet connection.");
  const result = await response.json().catch(() => ({}));
  const gifs = (result.results || []).map(item => {
    const full = item.media_formats?.gif?.url;
    const preview = item.media_formats?.tinygif?.url || full;
    return tenorUrlPattern.test(full || "") && tenorUrlPattern.test(preview || "")
      ? { key: full, src: preview, send: { gifUrl: full }, favorite: state.favoriteGifs.includes(full) }
      : null;
  }).filter(Boolean);
  return { configured: true, gifs };
}

function applyPreferencesLocal(input) {
  const themes = ["meadow", "dark", "midnight", "rose", "ocean", "contrast"];
  const current = { ...defaultPreferences, ...state.me.preferences };
  if (themes.includes(input.theme)) current.theme = input.theme;
  if (typeof input.accent === "string" && /^#[0-9a-f]{6}$/i.test(input.accent)) current.accent = input.accent;
  if (typeof input.cursorEnabled === "boolean") current.cursorEnabled = input.cursorEnabled;
  if (["sparkle", "heart", "diamond"].includes(input.cursorStyle)) current.cursorStyle = input.cursorStyle;
  if (typeof input.particlesEnabled === "boolean") current.particlesEnabled = input.particlesEnabled;
  if (["sparkle", "heart", "bubble", "leaf"].includes(input.particleStyle)) current.particleStyle = input.particleStyle;
  if (["small", "regular", "large"].includes(input.fontSize)) current.fontSize = input.fontSize;
  if (["soft", "square"].includes(input.bubbleShape)) current.bubbleShape = input.bubbleShape;
  if (typeof input.compact === "boolean") current.compact = input.compact;
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
    const code = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
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
    const chat = { id: `g-${randomId(20)}`, name, isGroup: true, members: [state.me.id, ...memberIds], messages: [], invites: [...memberIds], createdAt: Date.now(), rev: 0 };
    state.chats.push(chat);
    touchChat(chat);
    memberIds.forEach(id => {
      connectTo(id);
      sendTo(id, { t: "group", chat: groupPayload(chat) });
    });
    return { chat: chatToView(chat) };
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
    if (!text && !image) fail("Messages must be 1 to 4,000 characters.");
    sendMessageLocal(chat, text, image ? { id: image.id, url: image.url, type: image.type } : undefined);
    return { ok: true };
  }

  if (method === "GET" && route === "/api/gifs") {
    const tab = url.searchParams.get("tab");
    if (tab === "favorites") {
      const library = new Map(libraryGifs().map(image => [image.id, image]));
      return {
        configured: Boolean(state.tenorKey),
        gifs: state.favoriteGifs.map(key => tenorUrlPattern.test(key)
          ? { key, src: key, send: { gifUrl: key }, favorite: true }
          : (library.has(key) ? gifItem(library.get(key)) : null)).filter(Boolean)
      };
    }
    if (tab === "library") return { configured: Boolean(state.tenorKey), gifs: libraryGifs().map(gifItem) };
    return tenorGifs((url.searchParams.get("q") || "").trim().slice(0, 60));
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

  if (method === "POST" && route === "/api/gifs/key") {
    const key = typeof body.key === "string" ? body.key.trim() : "";
    if (!/^[\w-]{10,80}$/.test(key)) fail("That does not look like a Tenor API key.");
    state.tenorKey = key;
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

async function signIn(username, password) {
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
  if (!await lockAccount(db)) throw new Error("This account is already open in another tab.");
  idb.use(db);
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
    state = defaultState({ id: `dsc-${randomId(16)}`, username, displayName: displayName || username, avatar: null, preferences: { ...defaultPreferences }, createdAt: Date.now() });
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

function cleanImported(raw) {
  const meta = raw?.meta;
  const me = sanitizeProfile(meta?.me, meta?.me?.id);
  if (raw?.format !== "discard-backup" || !me || me.id === OFFICIAL_ID || !idPattern.test(me.id)) throw new Error("That is not a valid Discard backup file.");
  const profiles = source => Object.fromEntries(Object.entries(source || {}).filter(([id]) => idPattern.test(id))
    .map(([id, value]) => [id, sanitizeProfile(value, id)]).filter(([, value]) => value));
  const friends = profiles(meta.friends);
  const people = { ...profiles(meta.people), ...friends };
  const imported = defaultState({ ...me, preferences: { ...defaultPreferences, ...(meta.me.preferences && typeof meta.me.preferences === "object" ? meta.me.preferences : {}) }, createdAt: Date.now() });
  imported.friends = friends;
  imported.people = people;
  imported.requests = (Array.isArray(meta.requests) ? meta.requests : []).filter(item => idPattern.test(item?.id) && ["incoming", "outgoing"].includes(item.direction))
    .map(item => ({ id: item.id, direction: item.direction, user: sanitizeProfile(item.user, item.id) || { id: item.id, username: "pending", displayName: "Friend", avatar: null } }));
  imported.gifs = (Array.isArray(meta.gifs) ? meta.gifs : []).map(sanitizeImage).filter(image => image && image.type === "image/gif" && !tenorUrlPattern.test(image.url));
  imported.favoriteGifs = (Array.isArray(meta.favoriteGifs) ? meta.favoriteGifs : []).filter(key => typeof key === "string" && key.length < 300);
  imported.tenorKey = typeof meta.tenorKey === "string" && /^[\w-]{10,80}$/.test(meta.tenorKey) ? meta.tenorKey : "";
  imported.chats = (Array.isArray(raw.chats) ? raw.chats : []).filter(chat => typeof chat?.id === "string" && safeIdPattern.test(chat.id.replace(/:/g, "-")) && Array.isArray(chat.members))
    .map(chat => ({
      id: chat.id,
      name: typeof chat.name === "string" ? chat.name.slice(0, 40) : "",
      isGroup: Boolean(chat.isGroup),
      members: chat.members.filter(id => idPattern.test(id)),
      invites: [],
      createdAt: Number(chat.createdAt) || Date.now(),
      rev: 0,
      messages: (Array.isArray(chat.messages) ? chat.messages : []).filter(message => typeof message?.id === "string" && safeIdPattern.test(message.id) && idPattern.test(message.sender)).map(message => {
        const image = message.image ? sanitizeImage(message.image) : null;
        return {
          id: message.id,
          sender: message.sender,
          text: typeof message.text === "string" ? message.text.slice(0, 4000) : "",
          ...(image ? { image } : {}),
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
  document.querySelector("#myCode").value = currentUser.id;
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
    else await signIn(username, password);
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
      conversation: JSON.stringify([activeChatId, activeChat && [activeChat.rev, activeChat.name, activeChat.avatar, activeChat.online, activeChat.members.map(member => [member.displayName, member.username])]]),
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
    preview.textContent = chatLastMessage(chat)?.text || (chatLastMessage(chat)?.image ? "📷 Image" : null) || (chat.isGroup ? "Group chat" : "Start a conversation");
    titleRow.append(title, time);
    summary.append(titleRow, preview);
    button.append(avatar, summary);
    button.addEventListener("click", () => {
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
  if (!chat) {
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
  document.querySelector("#conversationStatus").textContent = chat.isGroup ? `${chat.members.length} members` : `@${chat.username} · ${chat.online ? "Online" : "Offline"}`;
  messageArea.replaceChildren();
  const divider = document.createElement("div");
  divider.className = "date-divider";
  divider.textContent = chat.isGroup ? `GROUP CHAT · ${chat.members.length} PEOPLE` : "DIRECT MESSAGE";
  messageArea.append(divider);

  chat.messages.slice(-400).forEach(message => {
    const row = document.createElement("div");
    row.className = `message${message.sender === currentUser.id ? " mine" : ""}`;
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
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
    if (message.text) {
      const text = document.createElement("span");
      text.textContent = message.text;
      bubble.append(text);
    }
    const sender = chat.members.find(member => member.id === message.sender)?.displayName || "Former member";
    const meta = document.createElement("div");
    meta.className = "message-meta";
    const senderHandle = chat.members.find(member => member.id === message.sender)?.username;
    meta.textContent = `${message.sender === currentUser.id ? "You" : sender}${message.sender !== currentUser.id && senderHandle ? ` (@${senderHandle})` : ""} · ${formatTime(message.createdAt)}${message.pending?.length ? " · sending..." : ""}`;
    row.append(bubble, meta);
    messageArea.append(row);
  });
  messageArea.scrollTop = messageArea.scrollHeight;
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
    row.append(label, button);
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
const cursorImages = {
  sparkle: "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path fill='#f2c94c' stroke='#202b28' stroke-width='1.5' d='M16 1l3.2 10.1L29 8l-6.1 9L32 22l-10.5.2L20 32l-5.7-8.8L5 29l3.2-10L0 14l10.5-.1z'/></svg>",
  heart: "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path fill='#e68191' stroke='#36272f' stroke-width='1.5' d='M16 29S2 20 2 10a7 7 0 0 1 14-1 7 7 0 0 1 14 1c0 10-14 19-14 19z'/></svg>",
  diamond: "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path fill='#7ebfd0' stroke='#203339' stroke-width='1.5' d='M16 1 31 16 16 31 1 16z'/></svg>"
};
const particleGlyphs = { sparkle: ["✦", "✧", "✳"], heart: ["♥", "♡"], bubble: ["○", "◦", "●"], leaf: ["❧", "✿"] };

function applyPreferences(input) {
  const preferences = { ...defaultPreferences, ...input };
  const rootElement = document.documentElement;
  rootElement.dataset.theme = preferences.theme;
  rootElement.dataset.cursor = preferences.cursorEnabled ? "on" : "off";
  rootElement.dataset.compact = preferences.compact ? "on" : "off";
  rootElement.dataset.fontSize = preferences.fontSize;
  rootElement.dataset.bubbles = preferences.bubbleShape;
  rootElement.style.setProperty("--accent", preferences.accent);
  const cursor = btoa(cursorImages[preferences.cursorStyle] || cursorImages.sparkle);
  rootElement.style.setProperty("--custom-cursor", `url("data:image/svg+xml;base64,${cursor}") 4 4, pointer`);
  for (const [key, control] of Object.entries(settingControls)) control.value = typeof preferences[key] === "boolean" ? "on" : preferences[key];
  settingControls.cursorEnabled.checked = preferences.cursorEnabled;
  settingControls.particlesEnabled.checked = preferences.particlesEnabled;
  settingControls.compact.checked = preferences.compact;
}

function currentPreferences() {
  return {
    theme: settingControls.theme.value,
    accent: settingControls.accent.value,
    cursorEnabled: settingControls.cursorEnabled.checked,
    cursorStyle: settingControls.cursorStyle.value,
    particlesEnabled: settingControls.particlesEnabled.checked,
    particleStyle: settingControls.particleStyle.value,
    fontSize: settingControls.fontSize.value,
    bubbleShape: settingControls.bubbleShape.value,
    compact: settingControls.compact.checked
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

document.addEventListener("click", event => {
  if (!currentUser?.preferences?.particlesEnabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (event.target.closest("input, textarea, select, .click-particle-layer")) return;
  const glyphs = particleGlyphs[currentUser.preferences.particleStyle] || particleGlyphs.sparkle;
  const layer = document.createElement("div");
  layer.className = "click-particle-layer";
  for (let index = 0; index < 5; index += 1) {
    const particle = document.createElement("span");
    const angle = (Math.PI * 2 * index) / 5;
    const distance = 20 + Math.random() * 24;
    particle.className = "click-particle";
    particle.textContent = glyphs[index % glyphs.length];
    particle.style.setProperty("--x", `${event.clientX}px`);
    particle.style.setProperty("--y", `${event.clientY}px`);
    particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    layer.append(particle);
  }
  document.body.append(layer);
  window.setTimeout(() => layer.remove(), 700);
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

newChatForm.addEventListener("submit", async event => {
  event.preventDefault();
  const name = newChatName.value.trim();
  const memberIds = [...memberChoices.querySelectorAll("input[name=memberId]:checked")].map(input => input.value);
  try {
    const result = await api("/api/chats", { method: "POST", body: { name, memberIds } });
    activeChatId = result.chat.id;
    newChatName.value = "";
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
    await api(`/api/chats/${encodeURIComponent(activeChatId)}/messages`, { method: "POST", body: { text } });
    messageInput.value = "";
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
    await api(`/api/chats/${encodeURIComponent(activeChatId)}/messages`, { method: "POST", body: { text: messageInput.value.trim(), image } });
    messageInput.value = "";
    await refreshSnapshot();
  } catch (error) {
    alert(error.message);
  }
}

document.querySelector("#imageFile").addEventListener("change", event => {
  const file = event.target.files[0];
  event.target.value = "";
  sendImage(file);
});
messageInput.addEventListener("paste", event => {
  const file = [...(event.clipboardData?.files || [])].find(item => item.type.startsWith("image/"));
  if (file) {
    event.preventDefault();
    sendImage(file);
  }
});
document.querySelector("#composerWrap").addEventListener("dragover", event => event.preventDefault());
document.querySelector("#composerWrap").addEventListener("drop", event => {
  const file = [...event.dataTransfer.files].find(item => item.type.startsWith("image/"));
  if (file) {
    event.preventDefault();
    sendImage(file);
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
    if (gifTab === "trending" && !result.configured) {
      gifMessage("Tenor search needs a free API key. Paste it below, or use the built-in GIFs in My GIFs.");
      document.querySelector("#tenorRow").classList.remove("hidden");
      return;
    }
    if (!result.gifs.length) gifMessage(gifTab === "favorites" ? "No favorites yet. Star a GIF to save it here." : "No GIFs found.");
    else renderGifs(result.gifs);
  } catch (error) {
    if (request === gifRequest) gifMessage(error.message);
  }
}

document.querySelector("#tenorSave").addEventListener("click", async () => {
  try {
    await api("/api/gifs/key", { method: "POST", body: { key: document.querySelector("#tenorKey").value } });
    document.querySelector("#tenorRow").classList.add("hidden");
    document.querySelector("#tenorKey").value = "";
    loadGifs();
  } catch (error) {
    gifStatus.textContent = error.message;
  }
});

function setGifTab(tab) {
  gifTab = tab;
  document.querySelectorAll("[data-gif-tab]").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.gifTab === tab)));
  gifSearch.placeholder = tab === "trending" ? "Search Tenor" : "Search is for the Trending tab";
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

