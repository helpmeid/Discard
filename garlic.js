// Garlic Fone: a peer-to-peer telephone-pictionary game played from a chat.
// The player who sends the invite is the host and keeps the game state; everyone else only talks to the host.
// Uses helpers from app.js (sendTo, connectTo, chatForSender, personOf, setAvatar, ...).

const gameModal = document.querySelector("#gameModal");
const gameCard = document.querySelector("#gameCard");
const drawingPattern = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const maxDrawingChars = 400000;
const maxGamePlayers = 8;
const maxGameRounds = 12;
const declinedGames = new Set();
let game = null;

const gameSeconds = { write: 40, draw: 90, describe: 45 };
const timePresets = { Quick: { write: 20, draw: 45, describe: 25 }, Normal: gameSeconds, Relaxed: { write: 90, draw: 180, describe: 90 }, "No limit": { write: 0, draw: 0, describe: 0 } };

// 0 means no time limit; otherwise 10 to 600 seconds.
const cleanSeconds = (value, fallback) => (Number.isFinite(value) ? (value <= 0 ? 0 : Math.min(Math.max(Math.round(value), 10), 600)) : fallback);
// rounds: 0 means one round per player; otherwise 2 to maxGameRounds.
const cleanRounds = value => (Number.isFinite(value) && value >= 1 ? Math.min(Math.max(Math.round(value), 2), maxGameRounds) : 0);
const cleanSettings = input => ({
  ...Object.fromEntries(Object.keys(gameSeconds).map(kind => [kind, cleanSeconds(input?.[kind], gameSeconds[kind])])),
  rounds: cleanRounds(input?.rounds)
});
const totalRounds = () => game.settings?.rounds || game.players.length;
const secondsFor = kind => game.settings?.[kind] ?? gameSeconds[kind];
const timeLabel = seconds => (seconds ? `${seconds}s` : "no limit");
const gameKinds = { write: "wrote the starting phrase", draw: "drew it", describe: "described the drawing" };
const kindForRound = round => (round === 0 ? "write" : round % 2 ? "draw" : "describe");
const gameTextOf = value => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 120) : "");
const gameDrawingOf = value => (typeof value === "string" && value.length <= maxDrawingChars && drawingPattern.test(value) ? value : null);
const gameName = id => (id === state.me.id ? "You" : viewPerson(id).displayName);

function gameSend(id, payload) {
  connectTo(id);
  return sendTo(id, payload);
}

function gameElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function gameButton(label, onClick, className = "profile-btn") {
  const button = gameElement("button", className, label);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

function closeGameModal() {
  gameModal.classList.add("hidden");
}

function endGameLocal() {
  game = null;
  closeGameModal();
}

const gameInProgress = () => Boolean(game) && (game.phase === "task" || game.phase === "wait");

// The browser asks for confirmation whenever the tab is closed or reloaded.
window.addEventListener("beforeunload", event => {
  event.preventDefault();
  event.returnValue = "";
});

function leaveGame() {
  if (!game) return closeGameModal();
  // Only ask once the game has actually started; leaving a lobby or a finished game is free.
  if (gameInProgress() && !confirm(game.hostId === state.me.id ? "Leave Garlic Fone? This ends the game for everyone." : "Leave Garlic Fone? You will drop out of the game.")) return;
  if (game.hostId === state.me.id) {
    game.players.filter(id => id !== state.me.id).forEach(id => gameSend(id, { t: "game-end", gameId: game.id }));
  } else if (game.phase === "invited") {
    declinedGames.add(game.id);
  } else if (game.phase !== "ended") {
    gameSend(game.hostId, { t: "game-leave", gameId: game.id });
  }
  endGameLocal();
}

function startGameInvite(chat) {
  if (game) {
    gameModal.classList.remove("hidden");
    renderGame();
    return;
  }
  game = { id: randomId(14), chatId: chat.id, hostId: state.me.id, players: [state.me.id], phase: "lobby", settings: { ...gameSeconds, rounds: 0 }, left: new Set(), submitted: new Set(), books: {} };
  inviteMissing();
  gameModal.classList.remove("hidden");
  renderGame();
}

function gameChat() {
  return state.chats.find(chat => chat.id === game?.chatId);
}

function inviteMissing() {
  const chat = gameChat();
  if (!chat) return;
  chat.members.filter(id => id !== state.me.id && !game.players.includes(id)).forEach(id => {
    gameSend(id, { t: "game-invite", gameId: game.id, chatId: chat.id });
  });
}

function broadcastLobby() {
  game.players.filter(id => id !== state.me.id).forEach(id => gameSend(id, { t: "game-lobby", gameId: game.id, players: game.players, settings: game.settings }));
}

function hostStart() {
  if (!game || game.hostId !== state.me.id || game.phase !== "lobby" || game.players.length < 2) return;
  game.books = Object.fromEntries(game.players.map(id => [id, []]));
  game.round = 0;
  game.phase = "task";
  sendRound();
}

// The host sits in "wait" after submitting its own entry while the round is still running.
const roundRunning = () => game.phase === "task" || game.phase === "wait";
const bookOwnerFor = (index, round) => game.players[(index - round + game.players.length * 2) % game.players.length];

function lastEntry(ownerId) {
  return game.books[ownerId].at(-1) || null;
}

function sendRound() {
  game.submitted = new Set();
  const limit = secondsFor(kindForRound(game.round));
  game.hostDeadline = limit ? Date.now() + limit * 1000 + 8000 : null;
  game.players.forEach((id, index) => {
    if (game.left.has(id)) {
      recordEntry(id, game.round, null);
      return;
    }
    if (id === state.me.id) {
      setTask(game.round, lastEntry(bookOwnerFor(index, game.round)));
    } else {
      sendTask(id, index);
    }
  });
  gameProgressUpdate();
  checkRoundDone();
}

function sendTask(id, index) {
  const previous = game.round === 0 ? null : lastEntry(bookOwnerFor(index, game.round));
  gameSend(id, { t: "game-task", gameId: game.id, round: game.round, kind: kindForRound(game.round), seconds: secondsFor(kindForRound(game.round)), prompt: previous ? previous.content : null });
}

function recordEntry(playerId, round, content) {
  if (game.submitted.has(playerId)) return;
  const index = game.players.indexOf(playerId);
  const kind = kindForRound(round);
  const clean = kind === "draw" ? gameDrawingOf(content) : gameTextOf(content);
  game.books[bookOwnerFor(index, round)].push({ author: playerId, kind, content: clean || null });
  game.submitted.add(playerId);
}

function checkRoundDone() {
  if (!roundRunning() || game.submitted.size < game.players.length) return;
  game.round += 1;
  if (game.round >= totalRounds()) {
    game.phase = "reveal";
    game.reveal = game.players.map(owner => ({ owner, entries: game.books[owner] }));
    game.view = { book: 0, step: 0 };
    game.players.filter(id => id !== state.me.id).forEach(id => gameSend(id, { t: "game-reveal", gameId: game.id, books: game.reveal }));
    renderGame();
  } else {
    sendRound();
    if (game.phase === "task") renderGame();
  }
}

function hostSkipWaiting() {
  if (!game || game.hostId !== state.me.id || !roundRunning()) return;
  game.players.forEach(id => { if (!game.submitted.has(id)) recordEntry(id, game.round, null); });
  checkRoundDone();
}

function setTask(round, previous) {
  const seconds = secondsFor(kindForRound(round));
  game.task = { round, kind: kindForRound(round), seconds, endsAt: seconds ? Date.now() + seconds * 1000 : null, prompt: round === 0 ? null : previous?.content ?? null };
  game.phase = "task";
  gameModal.classList.remove("hidden");
  renderGame();
}

function submitTask(content) {
  if (!game?.task || game.phase !== "task") return;
  const round = game.task.round;
  game.phase = "wait";
  if (game.hostId === state.me.id) {
    recordEntry(state.me.id, round, content);
    renderGame();
    checkRoundDone();
  } else {
    gameSend(game.hostId, { t: "game-submit", gameId: game.id, round, content });
    renderGame();
  }
}

function gameProgressUpdate() {
  const label = document.querySelector("#gameProgress");
  if (label && game?.hostId === state.me.id) label.textContent = `${game.submitted.size}/${game.players.length} done`;
}

// Receives game messages from app.js; returns true when the message type belongs to the game.
function garlicHandle(from, data) {
  switch (data.t) {
    case "game-invite": {
      const chat = chatForSender(from, data.chatId);
      if (!chat || !chat.isGroup && !state.friends[from] || typeof data.gameId !== "string" || !safeIdPattern.test(data.gameId)) return true;
      if (game || declinedGames.has(data.gameId)) return true;
      game = { id: data.gameId, chatId: chat.id, hostId: from, players: [], phase: "invited" };
      gameModal.classList.remove("hidden");
      renderGame();
      return true;
    }
    case "game-join": {
      if (!game || game.hostId !== state.me.id || game.id !== data.gameId || game.phase !== "lobby") return true;
      const chat = gameChat();
      if (!chat?.members.includes(from) || game.players.includes(from) || game.players.length >= maxGamePlayers) return true;
      game.players.push(from);
      broadcastLobby();
      renderGame();
      return true;
    }
    case "game-leave": {
      if (!game || game.hostId !== state.me.id || game.id !== data.gameId || !game.players.includes(from)) return true;
      if (game.phase === "lobby") {
        game.players = game.players.filter(id => id !== from);
        broadcastLobby();
        renderGame();
      } else if (game.phase === "task" || game.phase === "wait") {
        game.left.add(from);
        recordEntry(from, game.round, null);
        gameProgressUpdate();
        checkRoundDone();
      }
      return true;
    }
    case "game-lobby": {
      if (!game || game.hostId !== from || game.id !== data.gameId || !["lobby", "invited"].includes(game.phase)) return true;
      if (!Array.isArray(data.players) || data.players.length > maxGamePlayers || !data.players.every(id => idPattern.test(id))) return true;
      game.players = [...new Set(data.players)];
      if (game.phase === "lobby" && game.players.includes(state.me.id)) game.confirmed = true;
      game.settings = cleanSettings(data.settings);
      if (game.phase === "lobby") renderGame();
      return true;
    }
    case "game-task": {
      if (!game || game.hostId !== from || game.id !== data.gameId || !["lobby", "task", "wait"].includes(game.phase)) return true;
      const round = Number.isInteger(data.round) ? data.round : -1;
      if (round < 0 || round >= maxGameRounds || (game.task && round <= game.task.round)) return true;
      const kind = kindForRound(round);
      const prompt = kind === "draw" ? gameTextOf(data.prompt) : kind === "describe" ? gameDrawingOf(data.prompt) : null;
      const seconds = cleanSeconds(data.seconds, gameSeconds[kind]);
      game.task = { round, kind, seconds, endsAt: seconds ? Date.now() + seconds * 1000 : null, prompt: prompt || null };
      game.phase = "task";
      gameModal.classList.remove("hidden");
      renderGame();
      return true;
    }
    case "game-submit": {
      if (!game || game.hostId !== state.me.id || game.id !== data.gameId || !roundRunning() || data.round !== game.round) return true;
      if (!game.players.includes(from) || game.submitted.has(from)) return true;
      recordEntry(from, game.round, data.content);
      gameProgressUpdate();
      checkRoundDone();
      return true;
    }
    case "game-reveal": {
      if (!game || game.hostId !== from || game.id !== data.gameId || game.phase === "reveal" || !Array.isArray(data.books) || data.books.length > maxGamePlayers) return true;
      const books = data.books.map(book => {
        if (!idPattern.test(book?.owner) || !Array.isArray(book.entries) || book.entries.length > maxGameRounds) return null;
        const entries = book.entries.map((entry, index) => idPattern.test(entry?.author) ? {
          author: entry.author,
          kind: kindForRound(index),
          content: kindForRound(index) === "draw" ? gameDrawingOf(entry.content) : gameTextOf(entry.content) || null
        } : null);
        return entries.includes(null) ? null : { owner: book.owner, entries };
      });
      if (!books.length || books.includes(null)) return true;
      game.reveal = books;
      game.view = { book: 0, step: 0 };
      game.phase = "reveal";
      gameModal.classList.remove("hidden");
      renderGame();
      return true;
    }
    case "game-end": {
      if (!game || game.hostId !== from || game.id !== data.gameId) return true;
      game.phase = "ended";
      renderGame();
      return true;
    }
    default:
      return false;
  }
}

// Late joiners and flaky connections: the host keeps re-sending invites and the current task.
window.setInterval(() => {
  if (!state || !game) return;
  // A join that was sent before the connection opened is retried until the host confirms it.
  if (game.hostId !== state.me.id) {
    if (game.phase === "lobby" && !game.confirmed) gameSend(game.hostId, { t: "game-join", gameId: game.id });
    return;
  }
  if (game.phase === "lobby") inviteMissing();
  if (roundRunning()) {
    game.players.forEach((id, index) => {
      if (id !== state.me.id && !game.submitted.has(id)) sendTask(id, index);
    });
  }
}, 3000);

function playerChips(parent) {
  const row = gameElement("div", "game-players");
  game.players.forEach(id => {
    const chip = gameElement("span", "game-chip");
    const avatar = gameElement("span", "avatar");
    const person = id === state.me.id ? myProfile() : viewPerson(id);
    setAvatar(avatar, person.displayName, person.avatar);
    chip.append(avatar, gameElement("span", "", `${gameName(id)}${id === game.hostId ? " 👑" : ""}`));
    row.append(chip);
  });
  parent.append(row);
}

function stepBar(current, total, label) {
  const wrap = gameElement("div");
  const caption = gameElement("div", "game-step-label");
  caption.append(gameElement("span", "", label), gameElement("span", "", `${Math.min(current + 1, total)} / ${total}`));
  const bar = gameElement("div", "game-steps");
  for (let index = 0; index < total; index += 1) bar.append(gameElement("span", `game-step${index < current ? " done" : index === current ? " current" : ""}`));
  wrap.append(caption, bar);
  return wrap;
}

function timerBar() {
  const wrap = gameElement("div", "game-timer");
  wrap.id = "gameTimer";
  const clock = gameElement("div", "game-clock", "0:00");
  clock.id = "gameClock";
  const track = gameElement("div", "game-timer-track");
  const fill = gameElement("div", "game-timer-fill");
  fill.id = "gameTimerFill";
  track.append(fill);
  wrap.append(clock, track);
  return wrap;
}

function tickTimer() {
  if (!state || !game) return;
  const now = Date.now();
  if (game.phase === "task" && game.task && !game.task.endsAt) {
    const clock = document.querySelector("#gameClock");
    if (clock) {
      clock.textContent = "∞";
      document.querySelector("#gameTimerFill").style.width = "100%";
    }
  }
  if (game.phase === "task" && game.task?.endsAt) {
    const left = Math.max(0, game.task.endsAt - now);
    const seconds = Math.ceil(left / 1000);
    const clock = document.querySelector("#gameClock");
    if (clock) {
      clock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      document.querySelector("#gameTimerFill").style.width = `${(left / (game.task.seconds * 1000)) * 100}%`;
      document.querySelector("#gameTimer").classList.toggle("urgent", seconds <= 10);
    }
    if (left <= 0) submitTask(game.collect ? game.collect() : null);
  }
  if (game?.hostId === state.me.id && game.hostDeadline && roundRunning() && now > game.hostDeadline) hostSkipWaiting();
}
window.setInterval(tickTimer, 250);

function timeSettings(editable) {
  const box = gameElement("div", "game-settings");
  box.append(gameElement("div", "game-step-label", "Game settings"));
  if (!editable) {
    box.append(gameElement("p", "game-hint", `Rounds: ${totalRounds()} · Write: ${timeLabel(secondsFor("write"))} · Draw: ${timeLabel(secondsFor("draw"))} · Describe: ${timeLabel(secondsFor("describe"))}`));
    return box;
  }
  const presets = gameElement("div", "game-presets");
  const rows = gameElement("div", "game-setting-rows");
  const inputs = {};
  const apply = settings => {
    game.settings = cleanSettings({ ...game.settings, ...settings });
    Object.entries(inputs).forEach(([kind, input]) => { input.value = String(game.settings[kind]); });
    roundsInput.value = String(game.settings.rounds);
    roundsHint.textContent = roundsText();
    broadcastLobby();
  };
  const roundsText = () => `${totalRounds()} rounds${game.settings.rounds ? "" : " (one per player)"}`;
  Object.entries(timePresets).forEach(([name, values]) => presets.append(gameButton(name, () => apply(values))));
  const roundsRow = gameElement("label", "game-setting-row");
  const roundsInput = gameElement("input", "game-number");
  roundsInput.type = "number";
  roundsInput.min = "0";
  roundsInput.max = String(maxGameRounds);
  roundsInput.value = String(game.settings.rounds);
  roundsInput.setAttribute("aria-label", "Number of rounds");
  roundsInput.addEventListener("change", () => apply({ rounds: Number(roundsInput.value) }));
  const roundsHint = gameElement("span", "game-hint", roundsText());
  roundsRow.append(gameElement("span", "", "Rounds"), roundsInput, roundsHint);
  rows.append(roundsRow);
  [["write", "Write"], ["draw", "Draw"], ["describe", "Describe"]].forEach(([kind, label]) => {
    const row = gameElement("label", "game-setting-row");
    const input = gameElement("input", "game-number");
    input.type = "number";
    input.min = "0";
    input.max = "600";
    input.step = "5";
    input.value = String(secondsFor(kind));
    input.setAttribute("aria-label", `${label} time in seconds`);
    input.addEventListener("change", () => apply({ ...game.settings, [kind]: Number(input.value) }));
    inputs[kind] = input;
    row.append(gameElement("span", "", label), input, gameElement("span", "game-hint", "seconds"));
    rows.append(row);
  });
  box.append(presets, rows, gameElement("p", "game-hint", `Time: 0 means no limit, otherwise 10 to 600 seconds. Rounds: 0 means one per player, or 2 to ${maxGameRounds}. With more rounds than players, chains come back around to people who already saw them.`));
  return box;
}

function gameHeader(subtitle) {
  const head = gameElement("div", "game-head");
  const titles = gameElement("div");
  titles.style.flex = "1";
  titles.append(gameElement("h3", "game-head-title", "Garlic Fone"), gameElement("div", "game-head-sub", subtitle));
  head.append(gameElement("span", "game-logo", "🧄"), titles);
  return head;
}

function renderGame() {
  if (!game) return closeGameModal();
  const isHost = game.hostId === state.me.id;
  const body = gameElement("div", "game-body");
  const actions = gameElement("div", "game-actions");
  let subtitle = "Telephone pictionary";
  game.collect = null;
  if (game.phase === "invited") {
    body.classList.add("game-center");
    body.append(gameElement("div", "game-big", "📞"), gameElement("p", "game-text", `${gameName(game.hostId)} invited you to play!`),
      gameElement("p", "game-hint", "Write a phrase, then draw and describe what you get from other players. The chain gets sillier every round."));
    actions.append(gameButton("Join game", () => {
      game.phase = "lobby";
      game.players = [game.hostId, state.me.id];
      gameSend(game.hostId, { t: "game-join", gameId: game.id });
      renderGame();
    }, "profile-btn primary"), gameButton("Decline", () => {
      declinedGames.add(game.id);
      endGameLocal();
    }));
  } else if (game.phase === "lobby") {
    subtitle = `Lobby · ${game.players.length} / ${maxGamePlayers} players`;
    body.classList.add("game-center");
    body.append(gameElement("p", "game-text", isHost ? "Waiting for friends to join..." : "Waiting for the host to start..."),
      gameElement("p", "game-hint", "You need at least 2 players."));
    playerChips(body);
    body.append(timeSettings(isHost));
    if (isHost) {
      const start = gameButton("Start game", hostStart, "profile-btn primary");
      start.disabled = game.players.length < 2;
      actions.append(start);
    }
    actions.append(gameButton(isHost ? "Cancel game" : "Leave", leaveGame));
  } else if (game.phase === "task") {
    subtitle = ({ write: "Write a phrase", draw: "Draw it!", describe: "Describe it!" })[game.task.kind];
    renderTask(body, actions);
  } else if (game.phase === "wait") {
    subtitle = "Waiting for everyone";
    body.classList.add("game-center");
    body.append(stepBar(game.hostId === state.me.id ? game.round : game.task.round, totalRounds(), "Round"),
      gameElement("div", "game-big", "⏳"), gameElement("p", "game-text", "Nice! Waiting for everyone else..."));
    if (isHost) {
      const progress = gameElement("p", "game-hint");
      progress.id = "gameProgress";
      body.append(progress);
      actions.append(gameButton("Skip waiting", hostSkipWaiting));
    }
    actions.append(gameButton("Leave", leaveGame));
    queueMicrotask(gameProgressUpdate);
  } else if (game.phase === "reveal") {
    subtitle = "The big reveal";
    renderReveal(body, actions);
  } else {
    body.classList.add("game-center");
    body.append(gameElement("div", "game-big", "👋"), gameElement("p", "game-text", "The host ended the game."));
    actions.append(gameButton("Close", endGameLocal));
  }
  body.append(actions);
  gameCard.replaceChildren(gameHeader(subtitle), body);
}

function renderTask(body, actions) {
  const { kind, prompt, round } = game.task;
  body.append(stepBar(round, totalRounds(), `Round ${round + 1}`), timerBar());
  if (game.hostId === state.me.id) {
    const progress = gameElement("span", "game-hint");
    progress.id = "gameProgress";
    actions.append(progress, gameButton("Skip waiting", hostSkipWaiting));
    queueMicrotask(gameProgressUpdate);
  }
  const textTask = placeholder => {
    const input = gameElement("input", "game-input");
    input.maxLength = 120;
    input.placeholder = placeholder;
    input.addEventListener("keydown", event => { if (event.key === "Enter") submitTask(input.value || fallbackText); });
    body.append(input);
    game.collect = () => input.value;
    actions.prepend(gameButton("Done", () => submitTask(input.value || fallbackText), "profile-btn primary"));
    queueMicrotask(() => input.focus());
  };
  if (kind === "write") {
    body.append(gameElement("p", "game-text", "Write a silly phrase for someone to draw"));
    textTask("A cat riding a skateboard...");
  } else if (kind === "draw") {
    body.append(gameElement("p", "game-text", "Draw this:"), gameElement("div", "game-prompt", prompt || "(They skipped, draw anything!)"));
    const pad = buildDrawingPad();
    body.append(pad.element);
    game.collect = pad.export;
    actions.prepend(gameButton("Done", () => submitTask(pad.export()), "profile-btn primary"));
  } else {
    body.append(gameElement("p", "game-text", "What is this a drawing of?"));
    if (prompt) {
      const image = gameElement("img", "game-drawing");
      image.alt = "Drawing to describe";
      image.src = prompt;
      body.append(image);
    } else {
      body.append(gameElement("div", "game-prompt", "(They skipped, make something up!)"));
    }
    textTask("What is happening here?");
  }
  tickTimer();
}

const fallbackText = "A mysterious blob";

function buildDrawingPad() {
  const element = gameElement("div", "game-pad");
  const canvas = gameElement("canvas", "game-canvas");
  canvas.width = 480;
  canvas.height = 320;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineCap = "round";
  context.lineJoin = "round";
  let color = "#222222";
  let size = 5;
  let erasing = false;
  let filling = false;
  let opacity = 1;
  let drawing = false;
  let path = [];
  let base = null;
  let touched = false;
  const undoStack = [];
  const redoStack = [];
  const grab = () => context.getImageData(0, 0, canvas.width, canvas.height);
  const checkpoint = () => {
    undoStack.push(grab());
    if (undoStack.length > 40) undoStack.shift();
    redoStack.length = 0;
  };
  const undo = () => {
    if (!undoStack.length) return;
    redoStack.push(grab());
    context.putImageData(undoStack.pop(), 0, 0);
  };
  const redo = () => {
    if (!redoStack.length) return;
    undoStack.push(grab());
    context.putImageData(redoStack.pop(), 0, 0);
  };
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  };
  // The whole stroke is redrawn over a snapshot so overlapping segments don't stack up opacity.
  const paintPath = () => {
    context.putImageData(base, 0, 0);
    context.globalAlpha = erasing ? 1 : opacity;
    context.strokeStyle = erasing ? "#ffffff" : color;
    context.lineWidth = erasing ? size * 2 : size;
    context.beginPath();
    context.moveTo(path[0].x, path[0].y);
    path.slice(1).forEach(item => context.lineTo(item.x, item.y));
    context.stroke();
    context.globalAlpha = 1;
  };
  const floodFill = (startX, startY) => {
    const { width, height } = canvas;
    const image = grab();
    const data = image.data;
    const x0 = Math.floor(startX);
    const y0 = Math.floor(startY);
    if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return;
    const seed = (y0 * width + x0) * 4;
    const target = [data[seed], data[seed + 1], data[seed + 2]];
    const rgb = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
    const tolerance = 48;
    const matches = offset => Math.abs(data[offset] - target[0]) + Math.abs(data[offset + 1] - target[1]) + Math.abs(data[offset + 2] - target[2]) <= tolerance;
    const visited = new Uint8Array(width * height);
    const stack = [[x0, y0]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= width || y >= height || visited[y * width + x] || !matches((y * width + x) * 4)) continue;
      visited[y * width + x] = 1;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    for (let index = 0; index < visited.length; index += 1) {
      if (!visited[index]) continue;
      const offset = index * 4;
      for (let channel = 0; channel < 3; channel += 1) data[offset + channel] = Math.round(data[offset + channel] * (1 - opacity) + rgb[channel] * opacity);
    }
    context.putImageData(image, 0, 0);
  };
  canvas.addEventListener("pointerdown", event => {
    event.preventDefault();
    checkpoint();
    touched = true;
    const start = point(event);
    if (filling) {
      floodFill(start.x, start.y);
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    drawing = true;
    base = grab();
    path = [start, { x: start.x + 0.01, y: start.y }];
    paintPath();
  });
  canvas.addEventListener("pointermove", event => {
    if (!drawing) return;
    path.push(point(event));
    paintPath();
  });
  const stop = () => { drawing = false; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);

  // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z (or Ctrl+Y) redoes; removed once the pad leaves the page.
  const onKey = event => {
    if (!canvas.isConnected) {
      document.removeEventListener("keydown", onKey);
      return;
    }
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) undo();
    else if ((key === "z" && event.shiftKey) || key === "y") redo();
    else return;
    event.preventDefault();
  };
  document.addEventListener("keydown", onKey);

  const tools = gameElement("div", "game-tools");
  const swatches = [];
  ["#222222", "#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#6d4c41"].forEach((value, index) => {
    const swatch = gameElement("button", `game-swatch${index === 0 ? " active" : ""}`);
    swatch.type = "button";
    swatch.style.background = value;
    swatch.setAttribute("aria-label", `Color ${value}`);
    swatch.addEventListener("click", () => {
      color = value;
      if (erasing) setMode("erase");
      swatches.forEach(item => item.classList.toggle("active", item === swatch));
    });
    swatches.push(swatch);
    tools.append(swatch);
  });
  const setMode = mode => {
    erasing = mode === "erase" && !erasing;
    filling = mode === "fill" && !filling;
    eraser.classList.toggle("active", erasing);
    fillButton.classList.toggle("active", filling);
    canvas.style.cursor = filling ? "cell" : "crosshair";
  };
  const eraser = gameButton("Eraser", () => setMode("erase"));
  const fillButton = gameButton("🪣 Fill", () => setMode("fill"));
  fillButton.title = "Click an area to fill it with the chosen color";
  const opacityInput = gameElement("input");
  opacityInput.type = "range";
  opacityInput.min = "10";
  opacityInput.max = "100";
  opacityInput.value = "100";
  opacityInput.setAttribute("aria-label", "Opacity");
  opacityInput.title = "Opacity";
  opacityInput.addEventListener("input", () => { opacity = Number(opacityInput.value) / 100; opacityLabel.textContent = `${opacityInput.value}%`; });
  const opacityLabel = gameElement("span", "game-hint", "100%");
  const sizeInput = gameElement("input");
  sizeInput.type = "range";
  sizeInput.min = "2";
  sizeInput.max = "28";
  sizeInput.value = String(size);
  sizeInput.setAttribute("aria-label", "Brush size");
  sizeInput.addEventListener("input", () => { size = Number(sizeInput.value); });
  const undoButton = gameButton("↶ Undo", undo);
  undoButton.title = "Ctrl+Z";
  const redoButton = gameButton("↷ Redo", redo);
  redoButton.title = "Ctrl+Shift+Z";
  tools.append(fillButton, eraser, gameElement("span", "game-hint", "Size"), sizeInput, gameElement("span", "game-hint", "Opacity"), opacityInput, opacityLabel, undoButton, redoButton, gameButton("Clear", () => {
    checkpoint();
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }));
  const hint = gameElement("div", "game-hint game-center");
  hint.append("Shortcuts: ", gameElement("span", "game-kbd", "Ctrl+Z"), " undo · ", gameElement("span", "game-kbd", "Ctrl+Shift+Z"), " redo");
  element.append(canvas, tools, hint);
  return {
    element,
    export() {
      if (!touched) return null;
      let quality = 0.8;
      let data = canvas.toDataURL("image/jpeg", quality);
      while (data.length > maxDrawingChars && quality > 0.3) {
        quality -= 0.15;
        data = canvas.toDataURL("image/jpeg", quality);
      }
      return data.length <= maxDrawingChars ? data : null;
    }
  };
}

function renderReveal(body, actions) {
  const { book: bookIndex, step } = game.view;
  const book = game.reveal[bookIndex];
  const lastStep = book.entries.length - 1;
  body.append(stepBar(bookIndex, game.reveal.length, "Chain"));
  body.append(gameElement("p", "game-text", `${gameName(book.owner) === "You" ? "Your" : `${gameName(book.owner)}'s`} chain`));
  const list = gameElement("div", "game-chain");
  book.entries.slice(0, step + 1).forEach(entry => {
    const item = gameElement("div", "game-entry");
    item.append(gameElement("div", "game-entry-who", `${gameName(entry.author)} ${gameKinds[entry.kind]}`));
    if (entry.kind === "draw") {
      if (entry.content) {
        const image = gameElement("img", "game-drawing");
        image.alt = "Drawing";
        image.src = entry.content;
        item.append(image);
      } else {
        item.append(gameElement("div", "game-prompt", "(no drawing)"));
      }
    } else {
      item.append(gameElement("div", "game-prompt", entry.content || "(skipped)"));
    }
    list.append(item);
  });
  body.append(list);
  const atEnd = step >= lastStep;
  const lastBook = bookIndex >= game.reveal.length - 1;
  actions.append(gameButton(atEnd ? (lastBook ? "Finish" : "Next chain") : "Next", () => {
    if (!atEnd) game.view.step += 1;
    else if (!lastBook) game.view = { book: bookIndex + 1, step: 0 };
    else return endGameLocal();
    renderGame();
    gameCard.scrollTop = gameCard.scrollHeight;
  }, "profile-btn primary"), gameButton("Close", endGameLocal));
}

gameModal.addEventListener("click", event => {
  if (event.target === gameModal) closeGameModal();
});
