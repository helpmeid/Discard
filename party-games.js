"use strict";

const partyModal = document.querySelector("#partyGameModal");
const partyCard = document.querySelector("#partyGameCard");
const partyDrawingPattern = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const partyMaxPlayers = 8;
const partyMaxRounds = 12;
const partyMaxDrawingChars = 220000;
let partyGame = null;
const declinedPartyGames = new Set();
let partyLastRetry = 0;

const partyWords = {
  mixed: ["avocado", "backpack", "balloon", "bicycle", "cactus", "campfire", "carousel", "chameleon", "compass", "cupcake", "dragon", "fireworks", "fountain", "haunted house", "hot air balloon", "jellyfish", "lighthouse", "mermaid", "moon", "octopus", "popcorn", "rainbow", "robot", "roller coaster", "sandcastle", "spaceship", "sunglasses", "telescope", "treasure chest", "volcano"],
  animals: ["alligator", "butterfly", "camel", "chameleon", "crab", "dolphin", "elephant", "flamingo", "hedgehog", "kangaroo", "octopus", "owl", "peacock", "penguin", "seahorse", "sloth", "snail", "turtle", "whale", "zebra"],
  food: ["avocado", "banana split", "birthday cake", "burrito", "cheese", "cherries", "corn on the cob", "cupcake", "donut", "french fries", "ice cream", "lemonade", "noodles", "pancakes", "popcorn", "pretzel", "sushi", "taco", "watermelon", "waffle"],
  places: ["aquarium", "beach", "castle", "city park", "desert island", "farm", "forest", "haunted house", "island", "jungle", "lighthouse", "museum", "pyramid", "rainforest", "school", "space station", "train station", "underwater cave", "volcano", "waterfall"]
};
const partyCategories = ["mixed", "animals", "food", "places"];

function partyElement(tag, className = "", text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function partyButton(label, onClick, primary = false) {
  const button = partyElement("button", `profile-btn${primary ? " primary" : ""}`, label);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

function partySend(id, message) {
  connectTo(id);
  return sendTo(id, message);
}

function partyClose() {
  partyModal.classList.add("hidden");
}

function partyEndLocal() {
  partyGame = null;
  partyClose();
}

function partyTitle(kind) {
  return kind === "impostor" ? "Impostor" : "Sketch & Guess";
}

function partyIcon(kind) {
  return kind === "impostor" ? "🕵️" : "🎨";
}

function partyName(id) {
  return id === state.me.id ? "You" : viewPerson(id).displayName;
}

function partyHost() {
  return partyGame?.hostId === state.me.id;
}

function partyChat() {
  return state.chats.find(chat => chat.id === partyGame?.chatId);
}

function partyBroadcast(message, except = null) {
  partyGame.players.filter(id => id !== state.me.id && id !== except).forEach(id => partySend(id, message));
}

function partySetLobby(kind, chat) {
  if (partyGame) {
    partyModal.classList.remove("hidden");
    renderPartyGame();
    return;
  }
  partyGame = {
    id: randomId(16),
    chatId: chat.id,
    hostId: state.me.id,
    kind,
    players: [state.me.id],
    phase: "lobby",
    category: "mixed",
    rounds: 0
  };
  partyInviteMissing();
  partyModal.classList.remove("hidden");
  renderPartyGame();
}

function startImpostorInvite(chat) {
  partySetLobby("impostor", chat);
}

function startSketchInvite(chat) {
  partySetLobby("sketch", chat);
}

function partyInviteMissing() {
  const chat = partyChat();
  if (!chat) return;
  chat.members.filter(id => id !== state.me.id && !partyGame.players.includes(id)).forEach(id => {
    partySend(id, { t: "party-invite", gameId: partyGame.id, chatId: chat.id, kind: partyGame.kind });
  });
}

function partyLobbyBroadcast() {
  partyBroadcast({ t: "party-lobby", gameId: partyGame.id, kind: partyGame.kind, players: partyGame.players, category: partyGame.category, rounds: partyGame.rounds });
}

function partyLeave() {
  if (!partyGame) return partyClose();
  if (partyHost()) {
    partyBroadcast({ t: "party-end", gameId: partyGame.id });
  } else if (partyGame.phase === "invited") {
    partyGame.declined = true;
  } else {
    partySend(partyGame.hostId, { t: "party-leave", gameId: partyGame.id });
  }
  partyEndLocal();
}

function cleanPartyPlayers(players) {
  return Array.isArray(players) && players.length <= partyMaxPlayers
    ? [...new Set(players.filter(id => idPattern.test(id)))]
    : null;
}

function cleanPartyClues(clues, players) {
  if (!Array.isArray(clues) || clues.length > partyMaxPlayers) return null;
  const result = clues.map(item => typeof item?.text === "string" && players.includes(item.player) && item.text.length <= 60
    ? { player: item.player, text: item.text }
    : null);
  return result.includes(null) ? null : result;
}

function partyStartImpostor() {
  if (!partyHost() || partyGame.phase !== "lobby" || partyGame.players.length < 3) return;
  const words = partyWords[partyGame.category] || partyWords.mixed;
  const word = words[Math.floor(Math.random() * words.length)];
  const impostor = partyGame.players[Math.floor(Math.random() * partyGame.players.length)];
  partyGame.word = word;
  partyGame.impostor = impostor;
  partyGame.role = impostor === state.me.id ? "impostor" : "crew";
  partyGame.clues = [];
  partyGame.votes = [];
  partyGame.phase = "clues";
  partyGame.players.filter(id => id !== state.me.id).forEach(id => partySend(id, {
    t: "party-impostor-role", gameId: partyGame.id, role: id === impostor ? "impostor" : "crew", word: id === impostor ? "" : word
  }));
  partyBroadcast({ t: "party-impostor-state", gameId: partyGame.id, phase: partyGame.phase, category: partyGame.category, players: partyGame.players, clues: [], votes: [] });
  renderPartyGame();
}

function partySendImpostorState() {
  partyBroadcast({
    t: "party-impostor-state",
    gameId: partyGame.id,
    phase: partyGame.phase,
    category: partyGame.category,
    players: partyGame.players,
    clues: partyGame.clues || [],
    votes: partyGame.phase === "results" ? partyGame.votes : [],
    voted: (partyGame.votes || []).map(vote => vote.player)
  });
}

function partyAddClue(player, text) {
  if (!partyHost() || partyGame.phase !== "clues" || !partyGame.players.includes(player) || partyGame.clues.some(item => item.player === player)) return;
  const clue = typeof text === "string" ? text.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  if (!clue) return;
  partyGame.clues.push({ player, text: clue });
  if (partyGame.clues.length >= partyGame.players.length) partyGame.phase = "vote";
  partySendImpostorState();
  renderPartyGame();
}

function partyAddVote(player, target) {
  if (!partyHost() || partyGame.phase !== "vote" || !partyGame.players.includes(player) || !partyGame.players.includes(target)
    || target === player || partyGame.votes.some(item => item.player === player)) return;
  partyGame.votes.push({ player, target });
  if (partyGame.votes.length >= partyGame.players.length) partyFinishImpostor();
  else {
    partySendImpostorState();
    renderPartyGame();
  }
}

function partyFinishImpostor() {
  if (!partyHost() || partyGame.phase === "results") return;
  const tally = Object.fromEntries(partyGame.players.map(id => [id, 0]));
  partyGame.votes.forEach(vote => { tally[vote.target] = (tally[vote.target] || 0) + 1; });
  const highest = Math.max(0, ...Object.values(tally));
  const caught = tally[partyGame.impostor] === highest && highest > 0
    && Object.entries(tally).filter(([, count]) => count === highest).every(([id]) => id === partyGame.impostor);
  partyGame.phase = "results";
  partyGame.tally = tally;
  partyGame.caught = caught;
  partyBroadcast({
    t: "party-impostor-results",
    gameId: partyGame.id,
    word: partyGame.word,
    impostor: partyGame.impostor,
    votes: partyGame.votes,
    tally,
    caught
  });
  renderPartyGame();
}

function partySketchState() {
  return {
    t: "party-sketch-state",
    gameId: partyGame.id,
    phase: partyGame.phase,
    players: partyGame.players,
    round: partyGame.round,
    rounds: partyGame.rounds,
    category: partyGame.category,
    drawer: partyGame.drawer,
    startedAt: partyGame.startedAt,
    endsAt: partyGame.endsAt,
    hint: partyGame.hint || "",
    scores: partyGame.scores,
    drawing: partyGame.drawing || null,
    guesses: partyGame.guesses || []
  };
}

function partySketchBroadcast(except = null) {
  partyBroadcast(partySketchState(), except);
}

function partyStartSketch() {
  if (!partyHost() || partyGame.phase !== "lobby" || partyGame.players.length < 2) return;
  partyGame.scores = Object.fromEntries(partyGame.players.map(id => [id, 0]));
  partyGame.rounds = Math.min(Math.max(Number(partyGame.rounds) || partyGame.players.length, 1), partyMaxRounds);
  partyGame.round = 0;
  partyStartSketchRound();
}

function partyStartSketchRound() {
  if (!partyHost()) return;
  if (partyGame.round >= partyGame.rounds) {
    partyGame.phase = "finished";
    partyGameSketchBroadcast();
    renderPartyGame();
    return;
  }
  const drawer = partyGame.players[partyGame.round % partyGame.players.length];
  const words = partyWords[partyGame.category] || partyWords.mixed;
  partyGame.word = words[Math.floor(Math.random() * words.length)];
  partyGame.drawer = drawer;
  partyGame.phase = "draw";
  partyGame.startedAt = Date.now();
  partyGame.endsAt = partyGame.startedAt + 75000;
  partyGame.hint = "_ ".repeat(partyGame.word.length).trim();
  partyGame.drawing = null;
  partyGame.guesses = [];
  partyGame.guessTimes = {};
  partySketchBroadcast();
  if (drawer !== state.me.id) partySend(drawer, { t: "party-sketch-word", gameId: partyGame.id, word: partyGame.word });
  renderPartyGame();
}

function partyGameSketchBroadcast() {
  partySketchBroadcast();
}

function partyFinishSketchRound(winner = null) {
  if (!partyHost() || partyGame.phase !== "draw") return;
  if (winner) {
    const timeLeft = Math.max(0, partyGame.endsAt - Date.now());
    const points = Math.max(10, Math.ceil(timeLeft / 75000 * 100));
    partyGame.scores[winner] = (partyGame.scores[winner] || 0) + points;
    partyGame.scores[partyGame.drawer] = (partyGame.scores[partyGame.drawer] || 0) + 50;
  }
  partyGame.phase = "round-end";
  partyGame.winner = winner;
  partyGame.roundEndsAt = Date.now() + 4500;
  partyBroadcast({
    t: "party-sketch-round-end",
    gameId: partyGame.id,
    players: partyGame.players,
    round: partyGame.round,
    rounds: partyGame.rounds,
    drawer: partyGame.drawer,
    word: partyGame.word,
    winner,
    scores: partyGame.scores,
    drawing: partyGame.drawing || null
  });
  renderPartyGame();
}

function partyProcessGuess(player, value) {
  if (!partyHost() || partyGame.phase !== "draw" || player === partyGame.drawer || !partyGame.players.includes(player)) return;
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  if (!text) return;
  const now = Date.now();
  partyGame.guessTimes ||= {};
  if (now - (partyGame.guessTimes[player] || 0) < 700) return;
  partyGame.guessTimes[player] = now;
  const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  const correct = normalize(text) === normalize(partyGame.word);
  if (correct) {
    partyGame.guesses.push({ player, text: "Guessed it!", correct: true });
    partyFinishSketchRound(player);
    return;
  }
  partyGame.guesses.push({ player, text, correct: false });
  partyBroadcast({ t: "party-sketch-guess-update", gameId: partyGame.id, player, text, correct: false });
  partyAppendGuess(player, text);
}

function partyHandleDrawing(from, drawing) {
  if (!partyHost() || partyGame.phase !== "draw" || from !== partyGame.drawer || !partyGame.players.includes(from)
    || typeof drawing !== "string" || drawing.length > partyMaxDrawingChars || !partyDrawingPattern.test(drawing)) return;
  partyGame.drawing = drawing;
  partySketchBroadcast(from);
  partyRefreshSketch();
}

function partyHandleLeave(from) {
  if (!partyHost() || !partyGame.players.includes(from)) return;
  partyGame.players = partyGame.players.filter(id => id !== from);
  if (partyGame.kind === "impostor" && partyGame.phase !== "lobby" && from === partyGame.impostor) {
    partyGame.votes = partyGame.votes || [];
    partyFinishImpostor();
    return;
  }
  if (partyGame.kind === "impostor") {
    partyGame.clues = (partyGame.clues || []).filter(item => item.player !== from);
    partyGame.votes = (partyGame.votes || []).filter(item => item.player !== from);
    if (partyGame.phase === "clues" && partyGame.clues.length >= partyGame.players.length) partyGame.phase = "vote";
    if (partyGame.phase === "vote" && partyGame.votes.length >= partyGame.players.length) partyFinishImpostor();
    else {
      partySendImpostorState();
      renderPartyGame();
    }
    return;
  }
  if (partyGame.kind === "sketch" && partyGame.drawer === from && partyGame.phase === "draw") {
    partyFinishSketchRound();
    return;
  }
  partySketchBroadcast();
  renderPartyGame();
}

function partyGamesHandle(from, data) {
  switch (data.t) {
    case "party-invite": {
      const chat = chatForSender(from, data.chatId);
      if (!chat || (!chat.isGroup && !state.friends[from]) || !safeIdPattern.test(data.gameId || "")
        || !["impostor", "sketch"].includes(data.kind)) return true;
      if (declinedPartyGames.has(data.gameId)) return true;
      if (partyGame) {
        declinedPartyGames.add(data.gameId);
        return true;
      }
      partyGame = { id: data.gameId, chatId: chat.id, hostId: from, kind: data.kind, players: [], phase: "invited" };
      partyModal.classList.remove("hidden");
      renderPartyGame();
      return true;
    }
    case "party-join": {
      if (!partyGame || !partyHost() || partyGame.id !== data.gameId) return true;
      const chat = partyChat();
      if (partyGame.phase !== "lobby") {
        partySend(from, { t: "party-unavailable", gameId: partyGame.id, reason: "That game has already started." });
        return true;
      }
      if (!chat?.members.includes(from)) return true;
      if (partyGame.players.includes(from)) {
        partySend(from, { t: "party-lobby", gameId: partyGame.id, kind: partyGame.kind, players: partyGame.players, category: partyGame.category, rounds: partyGame.rounds });
        return true;
      }
      if (partyGame.players.length >= partyMaxPlayers) {
        partySend(from, { t: "party-unavailable", gameId: partyGame.id, reason: "This game is full." });
        return true;
      }
      partyGame.players.push(from);
      partyLobbyBroadcast();
      renderPartyGame();
      return true;
    }
    case "party-leave":
      if (!partyGame || !partyHost() || partyGame.id !== data.gameId) return true;
      partyHandleLeave(from);
      return true;
    case "party-unavailable":
      if (partyGame?.hostId === from && partyGame.id === data.gameId && partyGame.phase === "lobby") {
        partyGame.phase = "ended";
        partyGame.message = typeof data.reason === "string" ? data.reason.slice(0, 100) : "This game is unavailable.";
        renderPartyGame();
      }
      return true;
    case "party-lobby": {
      if (!partyGame || partyGame.hostId !== from || partyGame.id !== data.gameId || partyGame.phase !== "lobby") return true;
      const players = cleanPartyPlayers(data.players);
      if (!players || !players.includes(state.me.id) || !players.includes(from)) return true;
      partyGame.kind = data.kind === "sketch" ? "sketch" : "impostor";
      partyGame.players = players;
      partyGame.category = partyCategories.includes(data.category) ? data.category : "mixed";
      partyGame.rounds = Number.isInteger(data.rounds) ? Math.min(Math.max(data.rounds, 0), partyMaxRounds) : 0;
      partyGame.confirmed = true;
      renderPartyGame();
      return true;
    }
    case "party-impostor-role": {
      if (!partyGame || partyGame.kind !== "impostor" || partyGame.hostId !== from || partyGame.id !== data.gameId
        || !["crew", "impostor"].includes(data.role) || typeof data.word !== "string" || data.word.length > 40) return true;
      partyGame.role = data.role;
      partyGame.word = data.role === "crew" ? data.word : "";
      renderPartyGame();
      return true;
    }
    case "party-impostor-state": {
      if (!partyGame || partyGame.kind !== "impostor" || partyGame.hostId !== from || partyGame.id !== data.gameId
        || !["clues", "vote", "results"].includes(data.phase)) return true;
      const players = cleanPartyPlayers(data.players);
      const clues = players && cleanPartyClues(data.clues, players);
      if (!players || !players.includes(state.me.id) || !clues || !players.includes(from)) return true;
      partyGame.players = players;
      partyGame.phase = data.phase;
      partyGame.category = partyCategories.includes(data.category) ? data.category : "mixed";
      partyGame.clues = clues;
      partyGame.votes = Array.isArray(data.votes) ? data.votes.filter(vote => players.includes(vote?.player) && players.includes(vote?.target)) : [];
      partyGame.votedPlayers = Array.isArray(data.voted) ? data.voted.filter(id => players.includes(id)) : [];
      renderPartyGame();
      return true;
    }
    case "party-impostor-clue":
      if (partyGame?.id === data.gameId && partyHost()) partyAddClue(from, data.text);
      return true;
    case "party-impostor-vote":
      if (partyGame?.id === data.gameId && partyHost()) partyAddVote(from, data.target);
      return true;
    case "party-impostor-results": {
      if (!partyGame || partyGame.kind !== "impostor" || partyGame.hostId !== from || partyGame.id !== data.gameId
        || typeof data.word !== "string" || data.word.length > 40 || !idPattern.test(data.impostor) || typeof data.caught !== "boolean") return true;
      partyGame.phase = "results";
      partyGame.word = data.word;
      partyGame.impostor = data.impostor;
      partyGame.votes = Array.isArray(data.votes) ? data.votes.filter(vote => partyGame.players.includes(vote?.player) && partyGame.players.includes(vote?.target)) : [];
      partyGame.tally = data.tally && typeof data.tally === "object" ? data.tally : {};
      partyGame.caught = data.caught;
      renderPartyGame();
      return true;
    }
    case "party-sketch-word":
      if (partyGame?.kind === "sketch" && partyGame.hostId === from && partyGame.id === data.gameId && partyGame.drawer === state.me.id
        && typeof data.word === "string" && data.word.length <= 40) {
        partyGame.word = data.word;
        renderPartyGame();
      }
      return true;
    case "party-sketch-state": {
      if (!partyGame || partyGame.kind !== "sketch" || partyGame.hostId !== from || partyGame.id !== data.gameId
        || !["draw", "round-end", "finished"].includes(data.phase)) return true;
      const players = cleanPartyPlayers(data.players);
      if (!players || !players.includes(state.me.id) || !players.includes(from) || !idPattern.test(data.drawer || from)) return true;
      const continuingRound = partyGame.phase === "draw" && data.phase === "draw" && partyGame.round === data.round && partyGame.drawer === data.drawer;
      partyGame.phase = data.phase;
      partyGame.players = players;
      partyGame.round = Math.min(Math.max(Number(data.round) || 0, 0), partyMaxRounds);
      partyGame.rounds = Math.min(Math.max(Number(data.rounds) || 1, 1), partyMaxRounds);
      partyGame.category = partyCategories.includes(data.category) ? data.category : "mixed";
      partyGame.drawer = data.drawer;
      partyGame.startedAt = Number(data.startedAt) || Date.now();
      partyGame.endsAt = Number(data.endsAt) || null;
      partyGame.hint = typeof data.hint === "string" ? data.hint.slice(0, 80) : "";
      partyGame.scores = data.scores && typeof data.scores === "object" ? data.scores : {};
      partyGame.drawing = typeof data.drawing === "string" && data.drawing.length <= partyMaxDrawingChars && partyDrawingPattern.test(data.drawing) ? data.drawing : null;
      partyGame.guesses = Array.isArray(data.guesses) ? data.guesses.filter(item => idPattern.test(item?.player) && typeof item.text === "string").slice(-16) : [];
      if (partyGame.phase === "draw" && partyGame.drawer === state.me.id && partyGame.word === undefined) partyGame.word = "";
      if (continuingRound) partyRefreshSketch();
      else renderPartyGame();
      return true;
    }
    case "party-sketch-drawing":
      if (partyGame?.kind === "sketch" && partyHost() && partyGame.id === data.gameId) {
        partyHandleDrawing(from, data.drawing);
      }
      return true;
    case "party-sketch-guess":
      if (partyGame?.kind === "sketch" && partyGame.id === data.gameId && partyHost()) partyProcessGuess(from, data.text);
      return true;
    case "party-sketch-guess-update":
      if (partyGame?.kind === "sketch" && partyGame.hostId === from && partyGame.id === data.gameId && partyGame.phase === "draw"
        && idPattern.test(data.player) && typeof data.text === "string") {
        partyGame.guesses.push({ player: data.player, text: data.text.slice(0, 80), correct: false });
        partyAppendGuess(data.player, data.text.slice(0, 80));
      }
      return true;
    case "party-sketch-round-end":
      if (!partyGame || partyGame.kind !== "sketch" || partyGame.hostId !== from || partyGame.id !== data.gameId
        || !idPattern.test(data.drawer) || typeof data.word !== "string" || data.word.length > 40) return true;
      partyGame.phase = "round-end";
      partyGame.round = Math.min(Math.max(Number(data.round) || 0, 0), partyMaxRounds);
      partyGame.rounds = Math.min(Math.max(Number(data.rounds) || 1, 1), partyMaxRounds);
      partyGame.drawer = data.drawer;
      partyGame.word = data.word;
      partyGame.winner = idPattern.test(data.winner || "") ? data.winner : null;
      partyGame.scores = data.scores && typeof data.scores === "object" ? data.scores : {};
      partyGame.drawing = typeof data.drawing === "string" && data.drawing.length <= partyMaxDrawingChars && partyDrawingPattern.test(data.drawing) ? data.drawing : null;
      renderPartyGame();
      return true;
    case "party-end":
      if (partyGame?.hostId === from && partyGame.id === data.gameId) {
        partyGame.phase = "ended";
        renderPartyGame();
      }
      return true;
    default:
      return false;
  }
}

function partyHeader(subtitle) {
  const head = partyElement("div", `game-head party-head-${partyGame.kind}`);
  const titles = partyElement("div");
  titles.style.flex = "1";
  titles.append(partyElement("h3", "game-head-title", partyTitle(partyGame.kind)), partyElement("div", "game-head-sub", subtitle));
  head.append(partyElement("span", "game-logo", partyIcon(partyGame.kind)), titles);
  return head;
}

function partyPlayers(parent) {
  const row = partyElement("div", "game-players");
  partyGame.players.forEach(id => {
    const chip = partyElement("span", "game-chip");
    const avatar = partyElement("span", "avatar");
    const person = id === state.me.id ? myProfile() : viewPerson(id);
    setAvatar(avatar, person.displayName, person.avatar);
    chip.append(avatar, partyElement("span", "", `${partyName(id)}${id === partyGame.hostId ? " 👑" : ""}`));
    row.append(chip);
  });
  parent.append(row);
}

function partyCategoryPicker() {
  const label = partyElement("label", "party-setting-row");
  label.append(partyElement("span", "", "Word set"));
  const select = partyElement("select", "game-number");
  partyCategories.forEach(category => {
    const option = partyElement("option", "", category[0].toUpperCase() + category.slice(1));
    option.value = category;
    select.append(option);
  });
  select.value = partyGame.category;
  select.addEventListener("change", () => {
    partyGame.category = select.value;
    partyLobbyBroadcast();
  });
  label.append(select);
  return label;
}

function partyLobby(kind) {
  const body = partyElement("div", "game-body game-center");
  const host = partyHost();
  body.append(partyElement("div", "game-big", partyIcon(kind)), partyElement("p", "game-text", host ? "Invite your chat to play" : "Waiting for the host to start"));
  body.append(partyElement("p", "game-hint", kind === "impostor"
    ? "Everyone gets the same secret word except the impostor. Share clues, then vote to catch them. At least 3 players."
    : "Take turns drawing a secret word while everyone else guesses. The sketch and letter hints uncover gradually."));
  partyPlayers(body);
  if (host) {
    const settings = partyElement("div", "game-settings");
    settings.append(partyElement("div", "game-step-label", "Game settings"), partyCategoryPicker());
    if (kind === "sketch") {
      const row = partyElement("label", "party-setting-row");
      const rounds = partyElement("input", "game-number");
      rounds.type = "number";
      rounds.min = "0";
      rounds.max = String(partyMaxRounds);
      rounds.value = String(partyGame.rounds || partyGame.players.length);
      rounds.setAttribute("aria-label", "Number of rounds");
      rounds.addEventListener("change", () => {
        partyGame.rounds = Math.min(Math.max(Number(rounds.value) || partyGame.players.length, 1), partyMaxRounds);
        partyLobbyBroadcast();
      });
      row.append(partyElement("span", "", "Rounds"), rounds, partyElement("span", "game-hint", "0 = one per player"));
      settings.append(row);
      settings.append(partyElement("p", "game-hint", "Each round lasts up to 75 seconds. Earlier correct guesses earn more points."));
    }
    body.append(settings);
  } else if (!partyGame.confirmed) {
    body.append(partyElement("p", "game-hint", "Connecting to the host…"));
  }
  const actions = partyElement("div", "game-actions");
  if (host) {
    const start = partyButton("Start game", kind === "impostor" ? partyStartImpostor : partyStartSketch, true);
    start.disabled = partyGame.players.length < (kind === "impostor" ? 3 : 2);
    actions.append(start);
  }
  actions.append(partyButton(host ? "Cancel game" : "Leave", partyLeave));
  body.append(actions);
  return body;
}

function partyScoreboard(parent) {
  const scores = partyGame.scores || {};
  const board = partyElement("div", "party-scores");
  [...partyGame.players].sort((a, b) => (scores[b] || 0) - (scores[a] || 0)).forEach(id => {
    board.append(partyElement("span", "party-score", `${partyName(id)} · ${scores[id] || 0}`));
  });
  parent.append(board);
}

function partyImpostorView() {
  const body = partyElement("div", "game-body");
  const actions = partyElement("div", "game-actions");
  if (partyGame.phase === "clues") {
    const roleKnown = partyGame.role === "impostor" || (partyGame.role === "crew" && partyGame.word);
    body.classList.add("game-center");
    body.append(partyElement("p", "game-text", roleKnown
      ? partyGame.role === "impostor" ? "You are the impostor" : "Your secret word"
      : "Your secret role is on its way…"));
    if (partyGame.role === "crew" && partyGame.word) body.append(partyElement("div", "party-secret-word", partyGame.word));
    if (partyGame.role === "impostor") body.append(partyElement("p", "game-hint", `Category: ${partyGame.category}. Blend in without giving away that you don't know the word.`));
    const clues = partyElement("div", "party-clues");
    partyGame.players.forEach(id => {
      const clue = partyGame.clues.find(item => item.player === id);
      const row = partyElement("div", "party-clue");
      row.append(partyElement("strong", "", partyName(id)), partyElement("span", "", clue?.text || (id === state.me.id ? "Your clue is next" : "Thinking…")));
      clues.append(row);
    });
    body.append(clues);
    const already = partyGame.clues.some(item => item.player === state.me.id);
    if (!already && roleKnown) {
      const input = partyElement("input", "game-input");
      input.maxLength = 60;
      input.placeholder = "Give a subtle clue…";
      const submit = () => {
        if (!input.value.trim()) return;
        if (partyHost()) partyAddClue(state.me.id, input.value);
        else partySend(partyGame.hostId, { t: "party-impostor-clue", gameId: partyGame.id, text: input.value });
        input.disabled = true;
        input.value = "";
      };
      input.addEventListener("keydown", event => { if (event.key === "Enter") submit(); });
      body.append(input);
      actions.append(partyButton("Share clue", submit, true));
    }
    body.append(partyElement("p", "game-hint game-center", `${partyGame.clues.length} of ${partyGame.players.length} clues shared`));
    if (partyHost()) actions.append(partyButton("Skip to voting", () => {
      partyGame.phase = "vote";
      partySendImpostorState();
      renderPartyGame();
    }));
  } else if (partyGame.phase === "vote") {
    body.append(partyElement("p", "game-text game-center", "Who do you think is the impostor?"));
    partyGame.clues.forEach(clue => {
      const row = partyElement("div", "party-clue");
      row.append(partyElement("strong", "", partyName(clue.player)), partyElement("span", "", clue.text));
      body.append(row);
    });
    const voted = partyGame.votedPlayers?.includes(state.me.id) || (partyGame.votes || []).some(vote => vote.player === state.me.id);
    if (voted) {
      body.append(partyElement("p", "game-hint game-center", "Vote locked in. Waiting for the others…"));
    } else {
      const options = partyElement("div", "party-vote-grid");
      partyGame.players.filter(id => id !== state.me.id).forEach(id => {
        const vote = partyButton(partyName(id), () => {
          partyGame.votedPlayers = [...new Set([...(partyGame.votedPlayers || []), state.me.id])];
          if (partyHost()) partyAddVote(state.me.id, id);
          else partySend(partyGame.hostId, { t: "party-impostor-vote", gameId: partyGame.id, target: id });
          renderPartyGame();
        });
        options.append(vote);
      });
      body.append(options);
    }
    body.append(partyElement("p", "game-hint game-center", `${(partyGame.votes || []).length} of ${partyGame.players.length} votes in`));
    if (partyHost()) actions.append(partyButton("Reveal votes", partyFinishImpostor));
  } else if (partyGame.phase === "results") {
    body.classList.add("game-center");
    body.append(partyElement("div", "game-big", partyGame.caught ? "🎉" : "🫣"));
    body.append(partyElement("p", "game-text", partyGame.caught ? "The impostor was caught!" : "The impostor fooled the group!"));
    body.append(partyElement("div", "party-secret-word", partyGame.word));
    body.append(partyElement("p", "game-hint", `${partyName(partyGame.impostor)} was the impostor.`));
    const list = partyElement("div", "party-clues");
    partyGame.players.forEach(id => {
      const row = partyElement("div", "party-clue");
      row.append(partyElement("strong", "", partyName(id)), partyElement("span", "", `${partyGame.tally?.[id] || 0} vote${partyGame.tally?.[id] === 1 ? "" : "s"}`));
      list.append(row);
    });
    body.append(list);
  } else {
    body.classList.add("game-center");
    body.append(partyElement("div", "game-big", "👋"), partyElement("p", "game-text", partyGame.message || "The host ended the game."));
  }
  actions.append(partyButton(partyGame.phase === "results" || partyGame.phase === "ended" ? "Close" : "Leave", partyLeave));
  body.append(actions);
  return body;
}

function partyScoreLines(parent) {
  const guesses = partyElement("div", "party-guesses");
  guesses.id = "partyGuesses";
  (partyGame.guesses || []).slice(-8).forEach(item => {
    const label = item.correct ? "got it!" : item.text;
    guesses.append(partyElement("div", "party-guess", `${partyName(item.player)}: ${label}`));
  });
  parent.append(guesses);
}

function partyAppendGuess(player, text) {
  const list = document.querySelector("#partyGuesses");
  if (!list) return;
  list.append(partyElement("div", "party-guess", `${partyName(player)}: ${text}`));
  while (list.children.length > 8) list.firstElementChild.remove();
}

function partyDrawingPad() {
  let lastSent = 0;
  const pad = buildDrawingPad({
    className: "game-pad party-pad",
    canvasClass: "game-canvas party-canvas",
    width: 540,
    height: 360,
    initial: partyGame.drawing,
    onChange(canvas, force) {
      if (!force && Date.now() - lastSent < 1100) return;
      lastSent = Date.now();
      const data = canvas.toDataURL("image/jpeg", 0.58);
      if (data.length > partyMaxDrawingChars) return;
      partyGame.drawing = data;
      if (partyHost()) partyHandleDrawing(state.me.id, data);
      else partySend(partyGame.hostId, { t: "party-sketch-drawing", gameId: partyGame.id, drawing: data });
    }
  });
  return pad.element;
}

function partySketchView() {
  const body = partyElement("div", "game-body");
  const actions = partyElement("div", "game-actions");
  const isDrawer = partyGame.drawer === state.me.id;
  const secondsLeft = Math.max(0, Math.ceil(((partyGame.endsAt || Date.now()) - Date.now()) / 1000));
  body.append(partyElement("div", "game-step-label", `Round ${partyGame.round + 1} of ${partyGame.rounds}`));
  if (partyGame.phase === "draw") {
    const timer = partyElement("div", `game-timer party-sketch-timer${secondsLeft <= 10 ? " urgent" : ""}`);
    timer.append(partyElement("div", "game-clock", `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`));
    const track = partyElement("div", "game-timer-track");
    const fill = partyElement("div", "game-timer-fill");
    fill.style.width = `${Math.max(0, secondsLeft / 75 * 100)}%`;
    track.append(fill);
    timer.append(track);
    body.append(timer);
    if (isDrawer) {
      body.append(partyElement("p", "game-text game-center", partyGame.word ? `Draw: ${partyGame.word}` : "Getting your secret word…"));
      body.append(partyDrawingPad());
    } else {
      body.append(partyElement("p", "game-text game-center", `${partyName(partyGame.drawer)} is drawing`));
      const stage = partyElement("div", "party-reveal-stage");
      stage.id = "partyRevealStage";
      if (partyGame.drawing) {
        const image = partyElement("img", "party-reveal-image");
        image.id = "partyRevealImage";
        image.alt = "The sketch is gradually revealed";
        image.src = partyGame.drawing;
        stage.append(image);
      } else {
        stage.append(partyElement("span", "party-canvas-empty", "The sketch will appear here"));
      }
      body.append(stage);
      const wordHint = partyElement("p", "party-word-hint", `${partyGame.category} · ${partyGame.hint || ""}`);
      wordHint.id = "partyWordHint";
      body.append(wordHint);
      const form = partyElement("form", "party-guess-form");
      const input = partyElement("input", "game-input");
      input.maxLength = 80;
      input.placeholder = "What do you think it is?";
      input.setAttribute("aria-label", "Your guess");
      const submit = partyElement("button", "profile-btn primary", "Guess");
      submit.type = "submit";
      form.addEventListener("submit", event => {
        event.preventDefault();
        if (!input.value.trim()) return;
        if (partyHost()) partyProcessGuess(state.me.id, input.value);
        else partySend(partyGame.hostId, { t: "party-sketch-guess", gameId: partyGame.id, text: input.value });
        input.value = "";
        input.focus();
      });
      form.append(input, submit);
      body.append(form);
    }
    partyScoreLines(body);
  } else if (partyGame.phase === "round-end") {
    body.classList.add("game-center");
    body.append(partyElement("div", "game-big", partyGame.winner ? "🎉" : "⏰"));
    body.append(partyElement("p", "game-text", partyGame.winner ? `${partyName(partyGame.winner)} guessed it!` : "Time is up!"));
    body.append(partyElement("div", "party-secret-word", partyGame.word || ""));
    if (partyGame.drawing) {
      const image = partyElement("img", "party-drawing-reveal");
      image.alt = `Sketch of ${partyGame.word}`;
      image.src = partyGame.drawing;
      body.append(image);
    }
    partyScoreboard(body);
    if (partyHost()) actions.append(partyButton("Next round", () => {
      partyGame.round += 1;
      partyStartSketchRound();
    }, true));
    else actions.append(partyElement("span", "game-hint", "Next round starting…"));
  } else if (partyGame.phase === "finished") {
    body.classList.add("game-center");
    body.append(partyElement("div", "game-big", "🏆"), partyElement("p", "game-text", "Final scores"));
    partyScoreboard(body);
  } else {
    body.classList.add("game-center");
    body.append(partyElement("p", "game-text", partyGame.message || "The host ended the game."));
  }
  actions.append(partyButton(partyGame.phase === "finished" || partyGame.phase === "ended" ? "Close" : "Leave", partyLeave));
  body.append(actions);
  return body;
}

function partyRefreshSketch() {
  if (!partyGame || partyGame.kind !== "sketch" || partyGame.phase !== "draw") return;
  const timerWrap = document.querySelector(".party-sketch-timer");
  const timer = document.querySelector(".party-sketch-timer .game-clock");
  const fill = document.querySelector(".party-sketch-timer .game-timer-fill");
  const secondsLeft = Math.max(0, Math.ceil(((partyGame.endsAt || Date.now()) - Date.now()) / 1000));
  timerWrap?.classList.toggle("urgent", secondsLeft <= 10);
  if (timer) timer.textContent = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  if (fill) fill.style.width = `${Math.max(0, secondsLeft / 75 * 100)}%`;
  const wordHint = document.querySelector("#partyWordHint");
  if (wordHint) wordHint.textContent = `${partyGame.category} · ${partyGame.hint || ""}`;
  const stage = document.querySelector("#partyRevealStage");
  if (stage && partyGame.drawing) {
    let image = document.querySelector("#partyRevealImage");
    if (!image) {
      image = partyElement("img", "party-reveal-image");
      image.id = "partyRevealImage";
      image.alt = "The sketch is gradually revealed";
      stage.replaceChildren(image);
    }
    if (image.src !== partyGame.drawing) image.src = partyGame.drawing;
    const reveal = Math.min(100, Math.max(7, (Date.now() - partyGame.startedAt) / 60000 * 100));
    image.style.clipPath = `inset(0 ${100 - reveal}% 0 0)`;
  }
}

function renderPartyGame() {
  if (!partyGame) return partyClose();
  let subtitle = partyGame.phase === "lobby" ? `Lobby · ${partyGame.players.length} / ${partyMaxPlayers} players` : "A game with your chat";
  if (partyGame.kind === "impostor") {
    subtitle = ({ invited: "Social deduction", lobby: `Lobby · ${partyGame.players.length} / ${partyMaxPlayers} players`, clues: "Share a clue", vote: "Find the impostor", results: "The reveal", ended: "Game ended" })[partyGame.phase] || subtitle;
  } else {
    subtitle = ({ invited: "Draw, guess, uncover", lobby: `Lobby · ${partyGame.players.length} / ${partyMaxPlayers} players`, draw: "Draw and guess", "round-end": "Round reveal", finished: "Final scores", ended: "Game ended" })[partyGame.phase] || subtitle;
  }
  const body = partyGame.phase === "invited"
    ? partyInviteView()
    : partyGame.phase === "lobby"
      ? partyLobby(partyGame.kind)
      : partyGame.kind === "impostor"
        ? partyImpostorView()
        : partySketchView();
  partyCard.replaceChildren(partyHeader(subtitle), body);
}

function partyInviteView() {
  const body = partyElement("div", "game-body game-center");
  body.append(partyElement("div", "game-big", partyIcon(partyGame.kind)), partyElement("p", "game-text", `${partyName(partyGame.hostId)} invited you to play ${partyTitle(partyGame.kind)}!`));
  body.append(partyElement("p", "game-hint", partyGame.kind === "impostor"
    ? "Share clues, bluff your way through, then vote to find the impostor."
    : "Draw a secret word while the chat guesses as the sketch and letter hints reveal."));
  const actions = partyElement("div", "game-actions");
  actions.append(partyButton("Join game", () => {
    partyGame.phase = "lobby";
    partyGame.players = [partyGame.hostId, state.me.id];
    partySend(partyGame.hostId, { t: "party-join", gameId: partyGame.id });
    renderPartyGame();
  }, true), partyButton("Decline", () => {
    declinedPartyGames.add(partyGame.id);
    partyEndLocal();
  }));
  body.append(actions);
  return body;
}

partyModal.addEventListener("click", event => {
  if (event.target === partyModal) partyClose();
});

window.setInterval(() => {
  if (!state || !partyGame) return;
  const now = Date.now();
  if (partyGame.kind === "sketch" && partyGame.phase === "draw") partyRefreshSketch();
  if (!partyHost()) {
    if (partyGame.phase === "lobby" && !partyGame.confirmed && now - partyLastRetry >= 3000) {
      partyLastRetry = now;
      partySend(partyGame.hostId, { t: "party-join", gameId: partyGame.id });
    }
    return;
  }
  if (partyGame.phase === "lobby") {
    if (now - partyLastRetry >= 3000) {
      partyLastRetry = now;
      partyInviteMissing();
    }
    return;
  }
  if (partyGame.kind === "sketch" && partyGame.phase === "draw") {
    if (Date.now() >= partyGame.endsAt) {
      partyFinishSketchRound();
      return;
    }
    const elapsed = Date.now() - partyGame.startedAt;
    const count = Math.min(Math.max(0, partyGame.word.length - 1), Math.max(0, Math.floor(elapsed / 15000)));
    const hint = [...partyGame.word].map((letter, index) => index < count ? letter.toUpperCase() : "_").join(" ");
    if (hint !== partyGame.hint) {
      partyGame.hint = hint;
      partySketchBroadcast();
      const hintElement = document.querySelector("#partyWordHint");
      if (hintElement) hintElement.textContent = `${partyGame.category} · ${hint}`;
    }
  }
  if (partyGame.kind === "sketch" && partyGame.phase === "round-end" && Date.now() >= partyGame.roundEndsAt) {
    partyGame.round += 1;
    partyStartSketchRound();
  }
}, 500);
