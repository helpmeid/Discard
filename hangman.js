"use strict";

// Hangman: a peer-to-peer word game played from a chat. Each round one player secretly sets a word and everyone else
// guesses letters (or the whole word) together; six wrong guesses lose the round. The setter rotates every round.
// The host's browser runs the game and sees the word. Uses helpers from app.js and garlic.js.

const hangModal = document.querySelector("#hangModal");
const hangCard = document.querySelector("#hangCard");
const hangMaxPlayers = 8;
const hangMaxWrong = 6;
const hangMaxRounds = 12;
const hangSettingSeconds = 90;
const hangRevealSeconds = 7;
const hangWordPattern = /^[a-z]+(?: [a-z]+)*$/;
const declinedHangGames = new Set();
let hang = null;
let hangLastRetry = 0;

const hangName = id => (id === state.me.id ? "You" : viewPerson(id).displayName);
const hangHost = () => hang?.hostId === state.me.id;
const hangRounds = () => hang.rounds || hang.players.length;
const cleanHangPlayers = players => (Array.isArray(players) && players.length <= hangMaxPlayers
  ? [...new Set(players.filter(id => idPattern.test(id)))]
  : null);
const cleanHangWord = value => {
  const word = typeof value === "string" ? value.toLowerCase().replace(/\s+/g, " ").trim() : "";
  return word.length >= 3 && word.length <= 24 && hangWordPattern.test(word) ? word : null;
};

function hangSend(id, payload) {
  connectTo(id);
  return sendTo(id, payload);
}

function hangClose() {
  hangModal.classList.add("hidden");
  hangModal.classList.remove("fullscreen", "collapsed");
}

function hangEndLocal() {
  hang = null;
  hangClose();
}

function hangChat() {
  return state.chats.find(chat => chat.id === hang?.chatId);
}

function hangBroadcast(payload) {
  hang.players.filter(id => id !== state.me.id).forEach(id => hangSend(id, payload));
}

function hangInviteMissing() {
  const chat = hangChat();
  if (!chat) return;
  chat.members.filter(id => id !== state.me.id && !hang.players.includes(id)).forEach(id => {
    hangSend(id, { t: "hang-invite", gameId: hang.id, chatId: chat.id });
  });
}

function startHangmanInvite(chat) {
  if (hang) {
    hangModal.classList.remove("hidden");
    renderHang();
    return;
  }
  hang = { id: randomId(16), chatId: chat.id, hostId: state.me.id, players: [state.me.id], phase: "lobby", rounds: 0 };
  hangInviteMissing();
  hangModal.classList.remove("hidden");
  renderHang();
}

function hangLobbyBroadcast() {
  hangBroadcast({ t: "hang-lobby", gameId: hang.id, players: hang.players, rounds: hang.rounds });
}

function hangLeave() {
  if (!hang) return hangClose();
  const active = ["setting", "guess", "round-end"].includes(hang.phase);
  if (active && !confirm(hangHost() ? "Leave Hangman? This ends the game for everyone." : "Leave Hangman? You will drop out of the game.")) return;
  if (hangHost()) hangBroadcast({ t: "hang-end", gameId: hang.id });
  else if (hang.phase === "invited") declinedHangGames.add(hang.id);
  else hangSend(hang.hostId, { t: "hang-leave", gameId: hang.id });
  hangEndLocal();
}

// ---- host game logic ----

function hangMasked() {
  return [...hang.secret].map(letter => (letter === " " || hang.guessed.includes(letter) ? letter : "_"));
}

// Shares the public state with everyone; the secret word is only included once a round is over.
function hangPublish() {
  const over = hang.phase === "round-end" || hang.phase === "finished";
  const payload = {
    t: "hang-state", gameId: hang.id, phase: hang.phase, players: hang.players, round: hang.round, rounds: hangRounds(),
    setter: hang.setter, hint: hang.hint || "", guessed: hang.guessed, wrong: hang.wrong, scores: hang.scores, msg: hang.msg || "",
    masked: hang.secret ? hangMasked() : [], word: over ? hang.secret : ""
  };
  hangBroadcast(payload);
  hang.masked = payload.masked;
  hang.word = payload.word;
  hang.total = payload.rounds;
  renderHang();
}

function hangStartGame() {
  if (!hangHost() || hang.phase !== "lobby" || hang.players.length < 2) return;
  hang.total = hang.rounds || hang.players.length;
  hang.rounds = hang.total;
  hang.round = 0;
  hang.scores = Object.fromEntries(hang.players.map(id => [id, 0]));
  hangStartRound("The game begins!");
}

function hangStartRound(msg) {
  hang.setter = hang.players[hang.round % hang.players.length];
  hang.secret = "";
  hang.hint = "";
  hang.guessed = [];
  hang.wrong = 0;
  hang.phase = "setting";
  hang.settingEndsAt = Date.now() + hangSettingSeconds * 1000;
  hang.msg = msg || "";
  hangPublish();
}

function hangNextRound(msg = "") {
  hang.round += 1;
  if (hang.round >= hangRounds()) {
    hang.phase = "finished";
    hang.msg = msg;
    hangPublish();
    return;
  }
  hangStartRound(msg);
}

function hangSetWord(from, wordInput, hintInput) {
  if (!hangHost() || hang.phase !== "setting" || from !== hang.setter) return;
  const word = cleanHangWord(wordInput);
  if (!word) return;
  hang.secret = word;
  hang.hint = typeof hintInput === "string" ? hintInput.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  hang.phase = "guess";
  hang.msg = `${hangName(from)} picked a word with ${word.replace(/ /g, "").length} letters.`;
  hangPublish();
}

function hangFinishRound(won, by) {
  hang.phase = "round-end";
  hang.roundEndsAt = Date.now() + hangRevealSeconds * 1000;
  if (won) {
    hang.scores[by] = (hang.scores[by] || 0) + 3;
    hang.msg = `${hangName(by)} solved it! The word was "${hang.secret}".`;
  } else {
    hang.scores[hang.setter] = (hang.scores[hang.setter] || 0) + 2;
    hang.msg = `Out of guesses! The word was "${hang.secret}". ${hangName(hang.setter)} scores 2.`;
  }
  hangPublish();
}

function hangGuess(from, value) {
  if (!hangHost() || hang.phase !== "guess" || from === hang.setter || !hang.players.includes(from) || typeof value !== "string") return;
  const text = value.toLowerCase().replace(/\s+/g, " ").trim();
  if (/^[a-z]$/.test(text)) {
    if (hang.guessed.includes(text)) return;
    hang.guessed.push(text);
    const hits = [...hang.secret].filter(letter => letter === text).length;
    if (hits) {
      hang.scores[from] = (hang.scores[from] || 0) + hits;
      hang.msg = `${hangName(from)} found ${hits} × "${text.toUpperCase()}".`;
      if (!hangMasked().includes("_")) return hangFinishRound(true, from);
    } else {
      hang.wrong += 1;
      hang.msg = `${hangName(from)} guessed "${text.toUpperCase()}": not in the word.`;
      if (hang.wrong >= hangMaxWrong) return hangFinishRound(false);
    }
    return hangPublish();
  }
  if (!hangWordPattern.test(text) || text.length > 24) return;
  if (text === hang.secret) {
    [...hang.secret].forEach(letter => { if (letter !== " " && !hang.guessed.includes(letter)) hang.guessed.push(letter); });
    return hangFinishRound(true, from);
  }
  hang.wrong += 1;
  hang.msg = `${hangName(from)} guessed the word "${text}": wrong.`;
  if (hang.wrong >= hangMaxWrong) return hangFinishRound(false);
  hangPublish();
}

function hangHandleLeave(from) {
  if (!hangHost() || !hang.players.includes(from)) return;
  if (hang.phase === "lobby") {
    hang.players = hang.players.filter(id => id !== from);
    hangLobbyBroadcast();
    renderHang();
    return;
  }
  if (hang.phase === "finished") return;
  const wasSetter = from === hang.setter;
  const index = hang.players.indexOf(from);
  hang.players.splice(index, 1);
  delete hang.scores[from];
  if (hang.players.length < 2) {
    hang.phase = "finished";
    hang.msg = "Not enough players left.";
    return hangPublish();
  }
  if (wasSetter && (hang.phase === "setting" || hang.phase === "guess")) {
    hangStartRound(`${hangName(from)} left, so a new word is needed.`);
    return;
  }
  hang.msg = `${hangName(from)} left the game.`;
  hangPublish();
}

// ---- networking ----

function hangHandle(from, data) {
  switch (data.t) {
    case "hang-invite": {
      const chat = chatForSender(from, data.chatId);
      if (!chat || (!chat.isGroup && !state.friends[from]) || !safeIdPattern.test(data.gameId || "")) return true;
      if (declinedHangGames.has(data.gameId)) return true;
      if (hang) {
        declinedHangGames.add(data.gameId);
        return true;
      }
      hang = { id: data.gameId, chatId: chat.id, hostId: from, players: [], phase: "invited", rounds: 0 };
      hangModal.classList.remove("hidden");
      renderHang();
      return true;
    }
    case "hang-join": {
      if (!hang || !hangHost() || hang.id !== data.gameId) return true;
      if (hang.phase !== "lobby") {
        hangSend(from, { t: "hang-unavailable", gameId: hang.id, reason: "That game has already started." });
        return true;
      }
      if (!hangChat()?.members.includes(from)) return true;
      if (!hang.players.includes(from)) {
        if (hang.players.length >= hangMaxPlayers) {
          hangSend(from, { t: "hang-unavailable", gameId: hang.id, reason: "This game is full." });
          return true;
        }
        hang.players.push(from);
        renderHang();
      }
      hangLobbyBroadcast();
      return true;
    }
    case "hang-leave":
      if (hang && hangHost() && hang.id === data.gameId) hangHandleLeave(from);
      return true;
    case "hang-unavailable":
      if (hang?.hostId === from && hang.id === data.gameId && hang.phase === "lobby") {
        hang.phase = "ended";
        hang.message = typeof data.reason === "string" ? data.reason.slice(0, 100) : "This game is unavailable.";
        renderHang();
      }
      return true;
    case "hang-lobby": {
      if (!hang || hang.hostId !== from || hang.id !== data.gameId || hang.phase !== "lobby") return true;
      const players = cleanHangPlayers(data.players);
      if (!players || !players.includes(state.me.id) || !players.includes(from)) return true;
      hang.players = players;
      hang.rounds = Number.isInteger(data.rounds) ? Math.min(Math.max(data.rounds, 0), hangMaxRounds) : 0;
      hang.confirmed = true;
      renderHang();
      return true;
    }
    case "hang-state": {
      if (!hang || hang.hostId !== from || hang.id !== data.gameId || hang.phase === "ended") return true;
      const players = cleanHangPlayers(data.players);
      if (!players || !players.includes(state.me.id) || !["setting", "guess", "round-end", "finished"].includes(data.phase)) return true;
      const letters = Array.isArray(data.guessed) && data.guessed.length <= 26 && data.guessed.every(letter => /^[a-z]$/.test(letter)) ? data.guessed : null;
      const masked = Array.isArray(data.masked) && data.masked.length <= 24 && data.masked.every(char => /^[a-z_ ]$/.test(char)) ? data.masked : null;
      if (!letters || !masked || !players.includes(data.setter) || !Number.isInteger(data.round) || !Number.isInteger(data.rounds)
        || !Number.isInteger(data.wrong) || data.wrong < 0 || data.wrong > hangMaxWrong || !data.scores || typeof data.scores !== "object") return true;
      Object.assign(hang, {
        phase: data.phase, players, round: data.round, total: Math.min(Math.max(data.rounds, 1), hangMaxRounds), setter: data.setter,
        hint: typeof data.hint === "string" ? data.hint.slice(0, 40) : "", guessed: letters, wrong: data.wrong, masked,
        scores: Object.fromEntries(players.map(id => [id, Number.isInteger(data.scores[id]) ? Math.min(Math.max(data.scores[id], 0), 9999) : 0])),
        msg: typeof data.msg === "string" ? data.msg.slice(0, 140) : "",
        word: typeof data.word === "string" && /^[a-z ]{0,24}$/.test(data.word) ? data.word : "", confirmed: true
      });
      if (data.phase === "setting") hang.myWord = "";
      renderHang();
      return true;
    }
    case "hang-word":
      if (hang && hangHost() && hang.id === data.gameId) hangSetWord(from, data.word, data.hint);
      return true;
    case "hang-guess":
      if (hang && hangHost() && hang.id === data.gameId) hangGuess(from, data.text);
      return true;
    case "hang-end":
      if (hang && hang.hostId === from && hang.id === data.gameId) {
        const endedId = hang.id;
        hang.phase = "ended";
        hang.message = "The host ended the game.";
        renderHang();
        window.setTimeout(() => { if (hang?.id === endedId && hang.phase === "ended") hangEndLocal(); }, 3000);
      }
      return true;
    default:
      return false;
  }
}

// ---- actions from the local player ----

function hangSubmitWord(word, hint) {
  const clean = cleanHangWord(word);
  if (!clean) return false;
  hang.myWord = clean;
  if (hangHost()) hangSetWord(state.me.id, clean, hint);
  else hangSend(hang.hostId, { t: "hang-word", gameId: hang.id, word: clean, hint });
  return true;
}

function hangSubmitGuess(text) {
  if (hangHost()) hangGuess(state.me.id, text);
  else hangSend(hang.hostId, { t: "hang-guess", gameId: hang.id, text });
}

// ---- rendering ----

function hangGallows(wrong) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 120 140");
  svg.setAttribute("class", "hang-gallows");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${wrong} of ${hangMaxWrong} wrong guesses`);
  const add = (tag, attrs) => {
    const node = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
    svg.append(node);
  };
  [[10, 130, 70, 130], [30, 130, 30, 10], [30, 10, 85, 10], [85, 10, 85, 28]].forEach(([x1, y1, x2, y2]) => add("line", { x1, y1, x2, y2, class: "hang-post" }));
  const parts = [
    () => add("circle", { cx: 85, cy: 38, r: 10, class: "hang-body" }),
    () => add("line", { x1: 85, y1: 48, x2: 85, y2: 88, class: "hang-body" }),
    () => add("line", { x1: 85, y1: 58, x2: 68, y2: 76, class: "hang-body" }),
    () => add("line", { x1: 85, y1: 58, x2: 102, y2: 76, class: "hang-body" }),
    () => add("line", { x1: 85, y1: 88, x2: 70, y2: 112, class: "hang-body" }),
    () => add("line", { x1: 85, y1: 88, x2: 100, y2: 112, class: "hang-body" })
  ];
  parts.slice(0, wrong).forEach(draw => draw());
  return svg;
}

function hangHeader(subtitle) {
  const head = gameElement("div", "game-head hang-head");
  const titles = gameElement("div");
  titles.style.flex = "1";
  titles.append(gameElement("h3", "game-head-title", "Hangman"), gameElement("div", "game-head-sub", subtitle));
  head.append(gameElement("span", "game-logo", "🔤"), titles, gameFullscreenButton(hangModal));
  return head;
}

function hangPlayerChips(parent, withScores) {
  const row = gameElement("div", "game-players");
  hang.players.forEach(id => {
    const chip = gameElement("span", "game-chip");
    const avatar = gameElement("span", "avatar");
    const person = id === state.me.id ? myProfile() : viewPerson(id);
    setAvatar(avatar, person.displayName, person.avatar);
    const extra = withScores && hang.scores ? ` · ${hang.scores[id] || 0}` : "";
    const role = withScores && hang.phase !== "finished" && id === hang.setter ? " ✍️" : "";
    chip.append(avatar, gameElement("span", "", `${hangName(id)}${id === hang.hostId ? " 👑" : ""}${role}${extra}`));
    row.append(chip);
  });
  parent.append(row);
}

function hangInviteView() {
  const body = gameElement("div", "game-body game-center");
  body.append(gameElement("div", "game-big", "🔤"), gameElement("p", "game-text", `${hangName(hang.hostId)} invited you to play Hangman!`),
    gameElement("p", "game-hint", "One player secretly picks a word each round and everyone else guesses it, letter by letter."));
  const actions = gameElement("div", "game-actions");
  actions.append(gameButton("Join game", () => {
    hang.phase = "lobby";
    hang.players = [hang.hostId, state.me.id];
    hangSend(hang.hostId, { t: "hang-join", gameId: hang.id });
    renderHang();
  }, "profile-btn primary"), gameButton("Decline", () => {
    declinedHangGames.add(hang.id);
    hangEndLocal();
  }));
  body.append(actions);
  return body;
}

function hangLobbyView() {
  const body = gameElement("div", "game-body game-center");
  const host = hangHost();
  body.append(gameElement("div", "game-big", "🔤"), gameElement("p", "game-text", host ? "Invite your chat to play" : "Waiting for the host to start"),
    gameElement("p", "game-hint", "Each round one player secretly picks a word (and an optional hint). Everyone else guesses; six wrong guesses lose the round. The word-picker changes every round. 2 to 8 players."));
  hangPlayerChips(body, false);
  const settings = gameElement("div", "game-settings");
  settings.append(gameElement("div", "game-step-label", "Game settings"));
  const row = gameElement("label", "party-setting-row");
  if (host) {
    const rounds = gameElement("input", "game-number");
    rounds.type = "number";
    rounds.min = "0";
    rounds.max = String(hangMaxRounds);
    rounds.value = String(hang.rounds);
    rounds.setAttribute("aria-label", "Number of rounds");
    rounds.addEventListener("change", () => {
      hang.rounds = Math.min(Math.max(Math.round(Number(rounds.value)) || 0, 0), hangMaxRounds);
      hangLobbyBroadcast();
      renderHang();
    });
    row.append(gameElement("span", "", "Rounds"), rounds, gameElement("span", "game-hint", "0 = one per player"));
  } else {
    row.append(gameElement("span", "", `Rounds: ${hang.rounds || "one per player"}`));
  }
  settings.append(row, gameElement("p", "game-hint", "Scoring: 1 point per letter you find, 3 for solving the word. If nobody solves it the word-picker gets 2."));
  body.append(settings);
  if (!host && !hang.confirmed) body.append(gameElement("p", "game-hint", "Connecting to the host…"));
  const actions = gameElement("div", "game-actions");
  if (host) {
    const start = gameButton("Start game", hangStartGame, "profile-btn primary");
    start.disabled = hang.players.length < 2;
    actions.append(start);
  }
  actions.append(gameButton(host ? "Cancel game" : "Leave", hangLeave));
  body.append(actions);
  return body;
}

function hangWordDisplay(letters) {
  const row = gameElement("div", "hang-word");
  letters.forEach(char => row.append(gameElement("span", char === " " ? "hang-gap" : `hang-letter${char === "_" ? "" : " shown"}`, char === "_" ? "" : char.toUpperCase())));
  return row;
}

function hangSettingView(body) {
  if (hang.setter !== state.me.id) {
    body.append(gameElement("p", "game-text", `${hangName(hang.setter)} is choosing a word…`),
      gameElement("p", "game-hint", "Get ready to guess!"));
    return;
  }
  body.append(gameElement("p", "game-text", "Pick a secret word for everyone to guess"));
  const word = gameElement("input", "game-number hang-input");
  word.type = "text";
  word.maxLength = 24;
  word.placeholder = "Secret word (letters and spaces)";
  word.autocomplete = "off";
  word.setAttribute("aria-label", "Secret word");
  const hint = gameElement("input", "game-number hang-input");
  hint.type = "text";
  hint.maxLength = 40;
  hint.placeholder = "Optional hint, e.g. an animal";
  hint.autocomplete = "off";
  hint.setAttribute("aria-label", "Hint");
  const note = gameElement("p", "game-hint", "3 to 24 letters, A to Z only. The host's screen can see the word.");
  const submit = () => {
    if (!hangSubmitWord(word.value, hint.value)) note.textContent = "Use 3 to 24 letters (A to Z) and spaces only.";
  };
  word.addEventListener("keydown", event => { if (event.key === "Enter") submit(); });
  const actions = gameElement("div", "game-actions");
  actions.append(gameButton("Start the round", submit, "profile-btn primary"));
  body.append(word, hint, note, actions);
}

function hangGuessView(body) {
  const mine = hang.setter === state.me.id;
  body.append(hangWordDisplay(hang.masked || []));
  if (hang.hint) body.append(gameElement("p", "game-hint", `Hint: ${hang.hint}`));
  if (mine) {
    body.append(gameElement("p", "game-text", `Your word: ${(hang.myWord || hang.secret || "").toUpperCase()}`),
      gameElement("p", "game-hint", "You picked this one, so sit back and watch."));
    return;
  }
  const keys = gameElement("div", "hang-keys");
  [..."abcdefghijklmnopqrstuvwxyz"].forEach(letter => {
    const used = hang.guessed.includes(letter);
    const hit = used && (hang.masked || []).includes(letter);
    const key = gameButton(letter.toUpperCase(), () => hangSubmitGuess(letter), `profile-btn hang-key${used ? (hit ? " hit" : " miss") : ""}`);
    key.disabled = used || hang.phase !== "guess";
    keys.append(key);
  });
  body.append(keys);
  const form = gameElement("form", "hang-solve");
  const input = gameElement("input", "game-number hang-input");
  input.type = "text";
  input.maxLength = 24;
  input.placeholder = "Guess the whole word";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Guess the whole word");
  const button = gameElement("button", "profile-btn", "Solve");
  button.type = "submit";
  form.append(input, button);
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!input.value.trim()) return;
    hangSubmitGuess(input.value);
    input.value = "";
  });
  body.append(form, gameElement("p", "game-hint", "A wrong whole-word guess counts as a wrong guess."));
}

function hangPlayView() {
  const body = gameElement("div", "game-body game-center");
  const finished = hang.phase === "finished";
  hangPlayerChips(body, true);
  if (finished) {
    body.append(gameElement("div", "game-big", "🏆"));
    const ranking = [...hang.players].sort((a, b) => (hang.scores[b] || 0) - (hang.scores[a] || 0));
    body.append(gameElement("p", "game-text", ranking.length ? `${hangName(ranking[0])} won with ${hang.scores[ranking[0]] || 0} points!` : "Game over"));
    if (hang.msg) body.append(gameElement("p", "game-hint", hang.msg));
  } else {
    const row = gameElement("div", "hang-top");
    row.append(hangGallows(hang.wrong || 0), (() => {
      const info = gameElement("div", "hang-info");
      info.append(gameElement("p", "game-hint", `Round ${hang.round + 1} of ${hang.total}`),
        gameElement("p", "game-text", `${hang.wrong} / ${hangMaxWrong} wrong`),
        gameElement("p", "game-hint", (hang.guessed || []).length ? `Guessed: ${hang.guessed.map(letter => letter.toUpperCase()).join(" ")}` : "No letters guessed yet"));
      return info;
    })());
    body.append(row);
    if (hang.phase === "setting") hangSettingView(body);
    else if (hang.phase === "guess") hangGuessView(body);
    else {
      body.append(hangWordDisplay([...(hang.word || "")]));
      body.append(gameElement("p", "game-hint", "Next round starting soon…"));
    }
    if (hang.msg && hang.phase !== "setting") body.append(gameElement("p", "game-hint", hang.msg));
  }
  const actions = gameElement("div", "game-actions");
  if (finished) actions.append(gameButton("Close", () => { if (hangHost()) hangBroadcast({ t: "hang-end", gameId: hang.id }); hangEndLocal(); }));
  else actions.append(gameButton("Leave game", hangLeave));
  body.append(actions);
  return body;
}

function renderHang() {
  if (!hang) return hangClose();
  autoFullscreenOnStart(hangModal, hang);
  const subtitle = ({
    invited: "Word guessing", lobby: `Lobby · ${hang.players.length} / ${hangMaxPlayers} players`, setting: "Choosing the word",
    guess: "Guess the word", "round-end": "Round over", finished: "Final scores", ended: "Game ended"
  })[hang.phase] || "Word guessing";
  let body;
  if (hang.phase === "invited") body = hangInviteView();
  else if (hang.phase === "lobby") body = hangLobbyView();
  else if (hang.phase === "ended") {
    body = gameElement("div", "game-body game-center");
    body.append(gameElement("p", "game-text", hang.message || "This game has ended."));
    const actions = gameElement("div", "game-actions");
    actions.append(gameButton("Close", hangEndLocal));
    body.append(actions);
  } else body = hangPlayView();
  hangCard.replaceChildren(hangHeader(subtitle), body);
}

setupGameWindow(hangModal, hangCard, "discard-game-corner");

window.setInterval(() => {
  if (!state || !hang) return;
  const now = Date.now();
  if (!hangHost()) {
    if (hang.phase === "lobby" && !hang.confirmed && now - hangLastRetry >= 3000) {
      hangLastRetry = now;
      hangSend(hang.hostId, { t: "hang-join", gameId: hang.id });
    }
    return;
  }
  if (hang.phase === "lobby" && now - hangLastRetry >= 3000) {
    hangLastRetry = now;
    hangInviteMissing();
  } else if (hang.phase === "setting" && now >= hang.settingEndsAt) {
    hang.msg = `${hangName(hang.setter)} took too long to pick a word.`;
    hangNextRound(hang.msg);
  } else if (hang.phase === "round-end" && now >= hang.roundEndsAt) {
    hangNextRound();
  }
}, 1000);
