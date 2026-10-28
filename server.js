"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
const dataDirectory = path.join(root, "data");
const dataFile = path.join(dataDirectory, "discard.json");
const port = Number(process.env.PORT || 8000);
const sessionLifetime = 30 * 24 * 60 * 60 * 1000;
const appVersion = "1.0.0";
const maxBodySize = 1024 * 1024;
const maxImageBytes = 4 * 1024 * 1024;
const maxImageBody = Math.ceil(maxImageBytes * 4 / 3) + 4096;
const uploadDirectory = path.join(dataDirectory, "uploads");
const imageTypes = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
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

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function loadData() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { users: [], sessions: [], friendRequests: [], chats: [] };
  }
}

const data = loadData();

function saveData() {
  const temporaryFile = `${dataFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(temporaryFile, dataFile);
  try {
    fs.chmodSync(dataFile, 0o600);
  } catch {}
}

function sendJson(response, status, value, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  response.end(JSON.stringify(value));
}

function readBody(request, limit = maxBodySize) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", chunk => {
      raw += chunk;
      if (raw.length > limit) {
        reject(new HttpError(413, "Request is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new HttpError(400, "Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function cookieValue(request, name) {
  const cookie = (request.headers.cookie || "").split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function getSession(request, url) {
  const bearer = (request.headers.authorization || "").match(/^Bearer (\S+)$/);
  const token = bearer?.[1] || url?.searchParams.get("t") || cookieValue(request, "discard_session");
  if (!token) return null;
  const session = data.sessions.find(item => item.token === token && item.expiresAt > Date.now());
  return session ? data.users.find(user => user.id === session.userId) || null : null;
}

const lastSeen = new Map();
const onlineWindow = 20000;

function requireUser(request, url) {
  const user = getSession(request, url);
  if (!user) throw new HttpError(401, "Please sign in again.");
  lastSeen.set(user.id, Date.now());
  return user;
}

function publicUser(user) {
  return { id: user.id, username: user.username, displayName: user.displayName || user.username, avatar: user.avatar || null };
}

function accountUser(user) {
  return { ...publicUser(user), preferences: { ...defaultPreferences, ...(user.preferences || {}) } };
}

function setSession(response, user) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + sessionLifetime;
  data.sessions = data.sessions.filter(session => session.expiresAt > Date.now() && session.userId !== user.id);
  data.sessions.push({ token, userId: user.id, expiresAt });
  saveData();
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  response.discardToken = token;
  response.setHeader("Set-Cookie", `discard_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(sessionLifetime / 1000)}${secure}`);
}

function normalizeUsername(username) {
  return typeof username === "string" ? username.trim().toLowerCase() : "";
}

function findUser(id) {
  return data.users.find(user => user.id === id);
}

function areFriends(firstId, secondId) {
  const firstUser = findUser(firstId);
  return Boolean(firstUser && firstUser.friends.includes(secondId));
}

function serializeChat(chat, viewerId) {
  const participants = chat.members.map(findUser).filter(Boolean).map(publicUser);
  const otherParticipants = participants.filter(user => user.id !== viewerId);
  return {
    id: chat.id,
    name: chat.isGroup ? chat.name : (otherParticipants[0]?.displayName || "Direct chat"),
    avatar: chat.isGroup ? null : (otherParticipants[0]?.avatar || null),
    username: chat.isGroup ? null : (otherParticipants[0]?.username || null),
    isGroup: chat.isGroup,
    online: chat.isGroup ? null : Date.now() - (lastSeen.get(otherParticipants[0]?.id) || 0) < onlineWindow,
    members: participants,
    messages: chat.messages
  };
}

function snapshotFor(user) {
  return {
    user: accountUser(user),
    friends: user.friends.map(findUser).filter(Boolean).map(friend => ({ ...publicUser(friend), online: Date.now() - (lastSeen.get(friend.id) || 0) < onlineWindow })),
    requests: data.friendRequests
      .filter(request => request.to === user.id || request.from === user.id)
      .map(request => ({
        id: request.id,
        direction: request.to === user.id ? "incoming" : "outgoing",
        user: publicUser(findUser(request.to === user.id ? request.from : request.to))
      })),
    chats: data.chats.filter(chat => chat.members.includes(user.id)).map(chat => serializeChat(chat, user.id))
  };
}

function createChat(members, name, isGroup) {
  const chat = { id: crypto.randomUUID(), name, isGroup, members, createdAt: Date.now(), messages: [] };
  data.chats.push(chat);
  saveData();
  return chat;
}

function addFriend(firstId, secondId) {
  const firstUser = findUser(firstId);
  const secondUser = findUser(secondId);
  if (!firstUser || !secondUser) return;
  if (!firstUser.friends.includes(secondId)) firstUser.friends.push(secondId);
  if (!secondUser.friends.includes(firstId)) secondUser.friends.push(firstId);
}

function storeImage(dataUrl, allowedTypes = Object.keys(imageTypes)) {
  const match = typeof dataUrl === "string" ? dataUrl.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!match || !allowedTypes.includes(match[1])) throw new HttpError(400, `Images must be ${allowedTypes.map(type => type.slice(6).toUpperCase()).join(", ")}.`);
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > maxImageBytes) throw new HttpError(400, "Images must be under 4 MB.");
  const image = { id: crypto.randomUUID(), type: match[1] };
  fs.mkdirSync(uploadDirectory, { recursive: true });
  fs.writeFileSync(path.join(uploadDirectory, `${image.id}.${imageTypes[image.type]}`), buffer);
  return image;
}

const builtinDirectory = path.join(root, "assets", "gifs");
const builtinGifs = fs.existsSync(builtinDirectory)
  ? fs.readdirSync(builtinDirectory).filter(name => /^[a-f0-9-]{36}\.gif$/i.test(name)).map(name => ({ id: name.slice(0, 36), type: "image/gif", builtin: true }))
  : [];
const tenorKey = process.env.TENOR_API_KEY || (fs.existsSync(path.join(dataDirectory, "tenor_key.txt")) ? fs.readFileSync(path.join(dataDirectory, "tenor_key.txt"), "utf8").trim() : "");
const tenorUrlPattern = /^https:\/\/media\d*\.tenor\.com\/[\w\-/.%~]+$/;

function findAccessibleImage(user, id) {
  const own = (user.gifs || []).find(item => item.id === id) || builtinGifs.find(item => item.id === id);
  if (own) return own;
  return data.chats.filter(chat => chat.members.includes(user.id)).flatMap(chat => chat.messages).find(item => item.image?.id === id)?.image || null;
}

function localGifItems(user) {
  const favorites = new Set(user.favoriteGifs || []);
  const seen = new Set();
  const list = [];
  const add = image => {
    if (!image?.id || image.type !== "image/gif" || seen.has(image.id)) return;
    seen.add(image.id);
    list.push({ key: image.id, src: `/api/uploads/${image.id}`, send: { gifId: image.id }, favorite: favorites.has(image.id) });
  };
  [...(user.gifs || [])].reverse().forEach(add);
  data.chats.filter(chat => chat.members.includes(user.id)).flatMap(chat => chat.messages).reverse().forEach(message => add(message.image));
  builtinGifs.forEach(add);
  return list;
}

function favoriteGifItems(user) {
  const local = new Map(localGifItems(user).map(item => [item.key, item]));
  return (user.favoriteGifs || []).map(key => tenorUrlPattern.test(key)
    ? { key, src: key, send: { gifUrl: key }, favorite: true }
    : local.get(key)).filter(Boolean);
}

async function tenorGifs(user, query) {
  if (!tenorKey) return { configured: false, gifs: [] };
  const favorites = new Set(user.favoriteGifs || []);
  const params = new URLSearchParams({ key: tenorKey, client_key: "discard", limit: "30", media_filter: "gif,tinygif", contentfilter: "medium" });
  if (query) params.set("q", query);
  const upstream = await fetch(`https://tenor.googleapis.com/v2/${query ? "search" : "featured"}?${params}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!upstream?.ok) throw new HttpError(502, "Could not reach Tenor. Check your API key and connection.");
  const result = await upstream.json().catch(() => ({}));
  const gifs = (result.results || []).map(item => {
    const full = item.media_formats?.gif?.url;
    const preview = item.media_formats?.tinygif?.url || full;
    return tenorUrlPattern.test(full || "") && tenorUrlPattern.test(preview || "") ? { key: full, src: preview, send: { gifUrl: full }, favorite: favorites.has(full) } : null;
  }).filter(Boolean);
  return { configured: true, gifs };
}

async function handleApi(request, response, url) {
  const method = request.method;
  const pathname = url.pathname;
  const isMessagePost = method === "POST" && (pathname === "/api/gifs" || /^\/api\/chats\/[a-f0-9-]+\/messages$/i.test(pathname));
  const body = method === "POST" || method === "PATCH" ? await readBody(request, isMessagePost ? maxImageBody : maxBodySize) : {};

  if (method === "POST" && pathname === "/api/signup") {
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const usernameKey = normalizeUsername(username);
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) throw new HttpError(400, "Use 3 to 24 letters, numbers, or underscores for your username.");
    if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) throw new HttpError(400, "Password must be 8 to 128 characters.");
    if (data.users.some(user => user.usernameKey === usernameKey)) throw new HttpError(409, "That username is already taken.");
    const salt = crypto.randomBytes(16);
    const passwordHash = crypto.scryptSync(body.password, salt, 64).toString("hex");
    const user = { id: crypto.randomUUID(), username, usernameKey, salt: salt.toString("hex"), passwordHash, friends: [], preferences: { ...defaultPreferences } };
    data.users.push(user);
    setSession(response, user);
    return sendJson(response, 201, { user: accountUser(user), token: response.discardToken });
  }

  if (method === "POST" && pathname === "/api/login") {
    const user = data.users.find(item => item.usernameKey === normalizeUsername(body.username));
    if (!user || typeof body.password !== "string") throw new HttpError(401, "Username or password is incorrect.");
    const candidate = crypto.scryptSync(body.password, Buffer.from(user.salt, "hex"), 64);
    const expected = Buffer.from(user.passwordHash, "hex");
    if (candidate.length !== expected.length || !crypto.timingSafeEqual(candidate, expected)) throw new HttpError(401, "Username or password is incorrect.");
    setSession(response, user);
    return sendJson(response, 200, { user: accountUser(user), token: response.discardToken });
  }

  if (method === "POST" && pathname === "/api/logout") {
    const bearer = (request.headers.authorization || "").match(/^Bearer (\S+)$/);
    const token = bearer?.[1] || cookieValue(request, "discard_session");
    data.sessions = data.sessions.filter(session => session.token !== token);
    saveData();
    return sendJson(response, 200, { ok: true }, { "Set-Cookie": "discard_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
  }

  if (method === "GET" && pathname === "/api/version") return sendJson(response, 200, { version: appVersion });

  const user = requireUser(request, url);
  if (method === "GET" && pathname === "/api/me") return sendJson(response, 200, { user: accountUser(user) });
  if (method === "GET" && pathname === "/api/snapshot") return sendJson(response, 200, snapshotFor(user));
  if (method === "PATCH" && pathname === "/api/profile") {
    if (body.displayName !== undefined) {
      const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
      if (displayName.length > 32) throw new HttpError(400, "Display name can be at most 32 characters.");
      user.displayName = displayName || user.username;
    }
    if (body.avatar !== undefined) {
      if (body.avatar === null) delete user.avatar;
      else if (typeof body.avatar === "string" && body.avatar.length <= 300000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.avatar)) user.avatar = body.avatar;
      else throw new HttpError(400, "Profile picture must be a small PNG, JPEG, or WebP image.");
    }
    saveData();
    return sendJson(response, 200, { user: accountUser(user) });
  }
  if (method === "PATCH" && pathname === "/api/preferences") {
    const input = body.preferences && typeof body.preferences === "object" ? body.preferences : {};
    const themes = ["meadow", "dark", "midnight", "rose", "ocean", "contrast"];
    const cursorStyles = ["sparkle", "heart", "diamond"];
    const particleStyles = ["sparkle", "heart", "bubble", "leaf"];
    const fontSizes = ["small", "regular", "large"];
    const bubbleShapes = ["soft", "square"];
    const current = { ...defaultPreferences, ...(user.preferences || {}) };
    if (themes.includes(input.theme)) current.theme = input.theme;
    if (typeof input.accent === "string" && /^#[0-9a-f]{6}$/i.test(input.accent)) current.accent = input.accent;
    if (typeof input.cursorEnabled === "boolean") current.cursorEnabled = input.cursorEnabled;
    if (cursorStyles.includes(input.cursorStyle)) current.cursorStyle = input.cursorStyle;
    if (typeof input.particlesEnabled === "boolean") current.particlesEnabled = input.particlesEnabled;
    if (particleStyles.includes(input.particleStyle)) current.particleStyle = input.particleStyle;
    if (fontSizes.includes(input.fontSize)) current.fontSize = input.fontSize;
    if (bubbleShapes.includes(input.bubbleShape)) current.bubbleShape = input.bubbleShape;
    if (typeof input.compact === "boolean") current.compact = input.compact;
    user.preferences = current;
    saveData();
    return sendJson(response, 200, { preferences: current });
  }

  if (method === "POST" && pathname === "/api/friends/request") {
    const target = data.users.find(item => item.usernameKey === normalizeUsername(body.username));
    if (!target) throw new HttpError(404, "No account has that username.");
    if (target.id === user.id) throw new HttpError(400, "You cannot add yourself as a friend.");
    if (areFriends(user.id, target.id)) throw new HttpError(409, "You are already friends.");
    const pending = data.friendRequests.find(request => (request.from === user.id && request.to === target.id) || (request.from === target.id && request.to === user.id));
    if (pending) throw new HttpError(409, "A friend request is already pending.");
    data.friendRequests.push({ id: crypto.randomUUID(), from: user.id, to: target.id, createdAt: Date.now() });
    saveData();
    return sendJson(response, 201, { ok: true });
  }

  if (method === "POST" && pathname === "/api/friends/respond") {
    const requestIndex = data.friendRequests.findIndex(item => item.id === body.requestId && item.to === user.id);
    if (requestIndex < 0) throw new HttpError(404, "Friend request not found.");
    const [friendRequest] = data.friendRequests.splice(requestIndex, 1);
    if (body.accept === true) addFriend(friendRequest.from, friendRequest.to);
    saveData();
    return sendJson(response, 200, { ok: true });
  }

  if (method === "POST" && pathname === "/api/chats/direct") {
    const friend = findUser(body.friendId);
    if (!friend || !areFriends(user.id, friend.id)) throw new HttpError(403, "You can only message an accepted friend.");
    let chat = data.chats.find(item => !item.isGroup && item.members.length === 2 && item.members.includes(user.id) && item.members.includes(friend.id));
    if (!chat) chat = createChat([user.id, friend.id], "", false);
    return sendJson(response, 200, { chat: serializeChat(chat, user.id) });
  }

  if (method === "POST" && pathname === "/api/chats") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const memberIds = Array.isArray(body.memberIds) ? [...new Set(body.memberIds)] : [];
    if (name.length < 1 || name.length > 40) throw new HttpError(400, "Group name must be 1 to 40 characters.");
    if (memberIds.length < 1 || memberIds.length > 49) throw new HttpError(400, "Choose at least one friend for the group.");
    if (memberIds.some(id => !areFriends(user.id, id))) throw new HttpError(403, "Group chats can include your friends only.");
    const chat = createChat([user.id, ...memberIds], name, true);
    return sendJson(response, 201, { chat: serializeChat(chat, user.id) });
  }

  if (method === "GET" && pathname === "/api/gifs") {
    const tab = url.searchParams.get("tab");
    if (tab === "favorites") return sendJson(response, 200, { configured: Boolean(tenorKey), gifs: favoriteGifItems(user) });
    if (tab === "library") return sendJson(response, 200, { configured: Boolean(tenorKey), gifs: localGifItems(user) });
    return sendJson(response, 200, await tenorGifs(user, (url.searchParams.get("q") || "").trim().slice(0, 60)));
  }
  if (method === "POST" && pathname === "/api/gifs") {
    if ((user.gifs || []).length >= 100) throw new HttpError(400, "Your GIF library is full.");
    const image = storeImage(body.image, ["image/gif"]);
    user.gifs = [...(user.gifs || []), image];
    saveData();
    return sendJson(response, 201, { ok: true });
  }
  if (method === "POST" && pathname === "/api/gifs/favorite") {
    const key = typeof body.id === "string" ? body.id : "";
    const valid = tenorUrlPattern.test(key) || findAccessibleImage(user, key)?.type === "image/gif";
    if (!valid) throw new HttpError(404, "GIF not found.");
    const favorites = new Set(user.favoriteGifs || []);
    if (body.favorite === true) favorites.add(key);
    else favorites.delete(key);
    user.favoriteGifs = [...favorites];
    saveData();
    return sendJson(response, 200, { ok: true });
  }

  const uploadRoute = pathname.match(/^\/api\/uploads\/([a-f0-9-]{36})$/i);
  if (method === "GET" && uploadRoute) {
    const image = findAccessibleImage(user, uploadRoute[1]);
    if (!image) throw new HttpError(404, "Image not found.");
    const file = path.join(image.builtin ? builtinDirectory : uploadDirectory, `${image.id}.${imageTypes[image.type]}`);
    if (!fs.existsSync(file)) throw new HttpError(404, "Image not found.");
    response.writeHead(200, { "Content-Type": image.type, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
    return fs.createReadStream(file).pipe(response);
  }

  const messageRoute = pathname.match(/^\/api\/chats\/([a-f0-9-]+)\/messages$/i);
  if (method === "POST" && messageRoute) {
    const chat = data.chats.find(item => item.id === messageRoute[1] && item.members.includes(user.id));
    if (!chat) throw new HttpError(404, "Chat not found.");
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length > 4000) throw new HttpError(400, "Messages can be at most 4,000 characters.");
    let image;
    if (body.gifUrl !== undefined) {
      if (typeof body.gifUrl !== "string" || !tenorUrlPattern.test(body.gifUrl)) throw new HttpError(400, "That GIF link is not allowed.");
      image = { url: body.gifUrl, type: "image/gif" };
    } else if (body.gifId !== undefined) {
      const existing = typeof body.gifId === "string" ? findAccessibleImage(user, body.gifId) : null;
      if (!existing || existing.type !== "image/gif") throw new HttpError(404, "GIF not found.");
      image = { id: existing.id, type: existing.type };
    } else if (body.image !== undefined) {
      image = storeImage(body.image);
    }
    if (!text && !image) throw new HttpError(400, "Messages must be 1 to 4,000 characters.");
    chat.messages.push({ id: crypto.randomUUID(), sender: user.id, text, ...(image ? { image } : {}), createdAt: Date.now() });
    saveData();
    return sendJson(response, 201, { ok: true });
  }

  throw new HttpError(404, "API route not found.");
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function serveFile(request, response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, "Invalid URL path.");
  }
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(`${root}${path.sep}`)) throw new HttpError(403, "Forbidden.");
  if (!new Set(["index.html", "assets/image.png"]).has(path.relative(root, filePath))) throw new HttpError(404, "File not found.");
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    throw new HttpError(404, "File not found.");
  }
  if (!stats.isFile()) throw new HttpError(404, "File not found.");
  response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-cache" });
  if (request.method === "HEAD") return response.end();
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        return response.end();
      }
      if (request.method !== "GET" && request.method !== "POST" && request.method !== "PATCH") throw new HttpError(405, "Method not allowed.");
      await handleApi(request, response, url);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") throw new HttpError(405, "Method not allowed.");
    serveFile(request, response, url.pathname);
  } catch (error) {
    if (response.headersSent || response.destroyed) return response.destroy();
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error(error);
    sendJson(response, status, { error: error instanceof HttpError ? error.message : "Server error." });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Discard is running at http://localhost:${port}`);
});