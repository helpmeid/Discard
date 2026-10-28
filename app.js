"use strict";

const authView = document.querySelector("#authView");
const chatView = document.querySelector("#chatView");
const authForm = document.querySelector("#authForm");
const authMessage = document.querySelector("#authMessage");
const authTitle = document.querySelector("#authTitle");
const authSubtitle = document.querySelector("#authSubtitle");
const authSubmit = document.querySelector("#authSubmit");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
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

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The server could not complete that request.");
  return result;
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
  const name = currentUser.displayName || currentUser.username;
  document.querySelector("#userName").textContent = name;
  setAvatar(document.querySelector("#userAvatar"), name, currentUser.avatar);
  setAvatar(document.querySelector("#profileAvatar"), name, currentUser.avatar);
}

function setMode(nextMode) {
  mode = nextMode;
  document.querySelectorAll("[data-mode]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  });
  const creating = mode === "signup";
  authTitle.textContent = creating ? "Create your account" : "Welcome back";
  authSubtitle.textContent = creating ? "Choose a username and password to get started." : "Sign in to pick up where you left off.";
  authSubmit.textContent = creating ? "Create account" : "Sign in";
  passwordInput.autocomplete = creating ? "new-password" : "current-password";
  authMessage.textContent = "";
}

document.querySelectorAll("[data-mode]").forEach(button => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  authMessage.textContent = "";
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    authMessage.textContent = "Use 3 to 24 letters, numbers, or underscores for your username.";
    return;
  }
  if (password.length < 8) {
    authMessage.textContent = "Your password must be at least 8 characters.";
    return;
  }
  authSubmit.disabled = true;
  authSubmit.textContent = mode === "signup" ? "Creating..." : "Signing in...";
  try {
    const result = await api(`/api/${mode === "signup" ? "signup" : "login"}`, {
      method: "POST",
      body: { username, password }
    });
    currentUser = result.user;
    passwordInput.value = "";
    authForm.reset();
    await openChatView();
  } catch (error) {
    authMessage.textContent = error.message;
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent = mode === "signup" ? "Create account" : "Sign in";
  }
});

async function openChatView() {
  authView.classList.add("hidden");
  chatView.classList.remove("hidden");
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
      list: JSON.stringify(snapshot.chats.map(chat => [chat.id, chat.name, chat.avatar, chat.online, chat.messages.at(-1)])),
      conversation: JSON.stringify([activeChatId, activeChat]),
      friends: JSON.stringify([snapshot.friends, snapshot.requests])
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
  authMessage.textContent = "Your saved session expired. Please sign in again.";
  setMode("signin");
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
  if (!chats.length) {
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

  chat.messages.forEach(message => {
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
      picture.src = message.image.url || `/api/uploads/${message.image.id}`;
      picture.addEventListener("click", () => window.open(picture.src, "_blank", "noopener"));
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
    meta.textContent = `${message.sender === currentUser.id ? "You" : sender}${message.sender !== currentUser.id && senderHandle ? ` (@${senderHandle})` : ""} · ${formatTime(message.createdAt)}`;
    row.append(bubble, meta);
    messageArea.append(row);
  });
  messageArea.scrollTop = messageArea.scrollHeight;
}

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
    empty.textContent = "No friends yet. Add someone by username.";
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
  try {
    await api("/api/logout", { method: "POST" });
  } finally {
    chatView.classList.add("hidden");
    authView.classList.remove("hidden");
    authForm.reset();
    setMode("signin");
    currentUser = null;
    activeChatId = null;
    settingsPanel.classList.add("hidden");
  }
});

async function restoreSession() {
  try {
    const result = await api("/api/me");
    currentUser = result.user;
    applyPreferences({ ...defaultPreferences, ...(currentUser.preferences || {}) });
    await openChatView();
  } catch {
    authView.classList.remove("hidden");
    chatView.classList.add("hidden");
  }
}

window.setInterval(() => {
  if (!document.hidden) refreshSnapshot();
}, 2500);

restoreSession();
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

const maxImageBytes = 4 * 1024 * 1024;

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
    if (file.size > maxImageBytes) throw new Error("GIFs must be under 4 MB.");
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
      gifMessage("Tenor search is not set up yet. Add your Tenor API key to the server (see the note below). Your own and built-in GIFs are in My GIFs.");
      return;
    }
    if (!result.gifs.length) gifMessage(gifTab === "favorites" ? "No favorites yet. Star a GIF to save it here." : "No GIFs found.");
    else renderGifs(result.gifs);
  } catch (error) {
    if (request === gifRequest) gifMessage(error.message);
  }
}

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
    if (file.size > maxImageBytes) throw new Error("GIFs must be under 4 MB.");
    await api("/api/gifs", { method: "POST", body: { image: await readAsDataUrl(file) } });
    setGifTab("library");
    gifStatus.textContent = "GIF added.";
  } catch (error) {
    gifStatus.textContent = error.message;
  }
});

api("/api/version").then(result => {
  document.querySelector("#versionNote").textContent = `Version ${result.version}`;
}).catch(() => {});
