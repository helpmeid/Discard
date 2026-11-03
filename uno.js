"use strict";

// Uno: a peer-to-peer card game played from a chat. The host keeps the deck and every hand and validates each move;
// players only ever receive their own hand plus how many cards everyone else holds.
// Uses helpers from app.js and garlic.js (sendTo, connectTo, chatForSender, setAvatar, gameElement, gameButton, ...).

const unoModal = document.querySelector("#unoModal");
const unoCard = document.querySelector("#unoCard");
const unoMaxPlayers = 8;
const unoColors = ["r", "y", "g", "b"];
const unoColorNames = { r: "Red", y: "Yellow", g: "Green", b: "Blue" };
const unoCardPattern = /^(?:[rygb](?:[0-9]|s|r|d)|w[wd])$/;
const declinedUnoGames = new Set();
let uno = null;
let unoPicking = null;
let unoLastRetry = 0;

function unoDeck() {
  const deck = [];
  unoColors.forEach(color => {
    deck.push(`${color}0`);
    for (let value = 1; value <= 9; value += 1) deck.push(`${color}${value}`, `${color}${value}`);
    ["s", "r", "d"].forEach(kind => deck.push(`${color}${kind}`, `${color}${kind}`));
  });
  for (let index = 0; index < 4; index += 1) deck.push("ww", "wd");
  return deck;
}

function unoShuffle(list) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [list[index], list[other]] = [list[other], list[index]];
  }
  return list;
}

const unoSymbol = card => (card === "wd" ? "+4" : card === "ww" ? "★" : ({ s: "⊘", r: "⇄", d: "+2" })[card[1]] || card[1]);
const unoName = id => (id === state.me.id ? "You" : viewPerson(id).displayName);
const unoHost = () => uno?.hostId === state.me.id;
const unoMyTurn = () => uno?.phase === "play" && uno.players[uno.turn] === state.me.id;

function unoSend(id, payload) {
  connectTo(id);
  return sendTo(id, payload);
}

function unoClose() {
  unoModal.classList.add("hidden");
  unoModal.classList.remove("fullscreen", "collapsed");
}

function unoEndLocal() {
  uno = null;
  unoPicking = null;
  unoClose();
}

function unoChat() {
  return state.chats.find(chat => chat.id === uno?.chatId);
}

function unoBroadcast(payload) {
  uno.players.filter(id => id !== state.me.id).forEach(id => unoSend(id, payload));
}

function unoInviteMissing() {
  const chat = unoChat();
  if (!chat) return;
  chat.members.filter(id => id !== state.me.id && !uno.players.includes(id)).forEach(id => {
    unoSend(id, { t: "uno-invite", gameId: uno.id, chatId: chat.id });
  });
}

function startUnoInvite(chat) {
  if (uno) {
    unoModal.classList.remove("hidden");
    renderUno();
    return;
  }
  uno = { id: randomId(16), chatId: chat.id, hostId: state.me.id, players: [state.me.id], phase: "lobby" };
  unoInviteMissing();
  unoModal.classList.remove("hidden");
  renderUno();
}

function unoLeave() {
  if (!uno) return unoClose();
  const active = uno.phase === "play";
  if (active && !confirm(unoHost() ? "Leave Uno? This ends the game for everyone." : "Leave Uno? You will drop out of the game.")) return;
  if (unoHost()) unoBroadcast({ t: "uno-end", gameId: uno.id });
  else if (uno.phase === "invited") declinedUnoGames.add(uno.id);
  else unoSend(uno.hostId, { t: "uno-leave", gameId: uno.id });
  unoEndLocal();
}

// ---- host game logic ----

function unoPlayable(card) {
  if (card[0] === "w") return true;
  return card[0] === uno.color || (uno.top[0] !== "w" && card[1] === uno.top[1]);
}

function unoTake(count) {
  const taken = [];
  while (taken.length < count) {
    if (!uno.pile.length) {
      const rest = uno.discard.splice(0, uno.discard.length - 1);
      if (!rest.length) break;
      uno.pile = unoShuffle(rest);
    }
    taken.push(uno.pile.pop());
  }
  return taken;
}

function unoAdvance(steps = 1) {
  const count = uno.players.length;
  uno.turn = (((uno.turn + uno.dir * steps) % count) + count) % count;
  uno.drew = null;
}

function unoStartGame() {
  if (!unoHost() || uno.phase !== "lobby" || uno.players.length < 2) return;
  uno.pile = unoShuffle(unoDeck());
  uno.hands = {};
  uno.players.forEach(id => { uno.hands[id] = unoTake(7); });
  // The first face-up card must be a plain number so the opening turn has no special effect.
  let first = unoTake(1)[0];
  while (!/^[rygb][0-9]$/.test(first)) {
    uno.pile.unshift(first);
    first = unoTake(1)[0];
  }
  uno.discard = [first];
  uno.top = first;
  uno.color = first[0];
  uno.dir = 1;
  uno.turn = 0;
  uno.drew = null;
  uno.winner = null;
  uno.phase = "play";
  uno.msg = "Game started.";
  unoPublish();
}

// Sends each player their own view and refreshes the host's.
function unoPublish() {
  uno.counts = Object.fromEntries(uno.players.map(id => [id, uno.hands[id].length]));
  uno.hand = uno.hands[state.me.id] || [];
  uno.players.filter(id => id !== state.me.id).forEach(id => unoSend(id, {
    t: "uno-state", gameId: uno.id, phase: uno.phase, players: uno.players, counts: uno.counts, hand: uno.hands[id],
    top: uno.top, color: uno.color, dir: uno.dir, turn: uno.turn, drew: uno.players[uno.turn] === id ? uno.drew : null, winner: uno.winner, msg: uno.msg
  }));
  renderUno();
}

function unoHostPlay(player, card, color) {
  if (uno.phase !== "play" || uno.players[uno.turn] !== player) return;
  const hand = uno.hands[player];
  const index = hand.indexOf(card);
  if (index < 0 || (uno.drew && uno.drew !== card) || !unoPlayable(card)) return;
  if (card[0] === "w" && !unoColors.includes(color)) return;
  hand.splice(index, 1);
  uno.discard.push(card);
  uno.top = card;
  uno.color = card[0] === "w" ? color : card[0];
  const who = unoName(player);
  let msg = `${who} played ${card[0] === "w" ? `a wild (${unoColorNames[uno.color]})` : `${unoColorNames[card[0]]} ${unoSymbol(card)}`}.`;
  if (!hand.length) {
    uno.phase = "finished";
    uno.winner = player;
    uno.msg = `${who} won the game! 🎉`;
    unoPublish();
    return;
  }
  if (hand.length === 1) msg += ` ${who}: UNO!`;
  const next = () => uno.players[(((uno.turn + uno.dir) % uno.players.length) + uno.players.length) % uno.players.length];
  if (card[1] === "r" && card[0] !== "w") {
    uno.dir *= -1;
    // With two players a reverse works like a skip.
    if (uno.players.length === 2) {
      unoAdvance(2);
    } else {
      unoAdvance();
    }
  } else if (card[1] === "s") {
    msg += ` ${unoName(next())} is skipped.`;
    unoAdvance(2);
  } else if (card[1] === "d" || card === "wd") {
    const victim = next();
    const count = card === "wd" ? 4 : 2;
    uno.hands[victim].push(...unoTake(count));
    msg += ` ${unoName(victim)} draws ${count} and is skipped.`;
    unoAdvance(2);
  } else {
    unoAdvance();
  }
  uno.msg = msg;
  unoPublish();
}

function unoHostDraw(player) {
  if (uno.phase !== "play" || uno.players[uno.turn] !== player || uno.drew) return;
  const [card] = unoTake(1);
  const who = unoName(player);
  if (!card) {
    uno.msg = `${who} could not draw and passes.`;
    unoAdvance();
  } else {
    uno.hands[player].push(card);
    if (unoPlayable(card)) {
      uno.drew = card;
      uno.msg = `${who} drew a card.`;
    } else {
      uno.msg = `${who} drew a card and passes.`;
      unoAdvance();
    }
  }
  unoPublish();
}

function unoHostPass(player) {
  if (uno.phase !== "play" || uno.players[uno.turn] !== player || !uno.drew) return;
  uno.msg = `${unoName(player)} passes.`;
  unoAdvance();
  unoPublish();
}

function unoHandleLeave(from) {
  if (!unoHost() || !uno.players.includes(from)) return;
  if (uno.phase === "lobby") {
    uno.players = uno.players.filter(id => id !== from);
    unoBroadcast({ t: "uno-lobby", gameId: uno.id, players: uno.players });
    renderUno();
    return;
  }
  if (uno.phase !== "play") return;
  const index = uno.players.indexOf(from);
  const wasTurn = index === uno.turn;
  uno.pile.unshift(...uno.hands[from]);
  delete uno.hands[from];
  uno.players.splice(index, 1);
  if (uno.players.length < 2) {
    uno.phase = "finished";
    uno.winner = uno.players[0];
    uno.msg = "Everyone else left, so the last player wins.";
    unoPublish();
    return;
  }
  if (index < uno.turn) uno.turn -= 1;
  if (uno.dir === -1 && wasTurn) uno.turn -= 1;
  uno.turn = ((uno.turn % uno.players.length) + uno.players.length) % uno.players.length;
  uno.drew = null;
  uno.msg = `${unoName(from)} left the game.`;
  unoPublish();
}

// ---- networking ----

const cleanUnoPlayers = players => (Array.isArray(players) && players.length <= unoMaxPlayers
  ? [...new Set(players.filter(id => idPattern.test(id)))]
  : null);

function unoHandle(from, data) {
  switch (data.t) {
    case "uno-invite": {
      const chat = chatForSender(from, data.chatId);
      if (!chat || (!chat.isGroup && !state.friends[from]) || !safeIdPattern.test(data.gameId || "")) return true;
      if (declinedUnoGames.has(data.gameId)) return true;
      if (uno) {
        declinedUnoGames.add(data.gameId);
        return true;
      }
      uno = { id: data.gameId, chatId: chat.id, hostId: from, players: [], phase: "invited" };
      unoModal.classList.remove("hidden");
      renderUno();
      return true;
    }
    case "uno-join": {
      if (!uno || !unoHost() || uno.id !== data.gameId) return true;
      if (uno.phase !== "lobby") {
        unoSend(from, { t: "uno-unavailable", gameId: uno.id, reason: "That game has already started." });
        return true;
      }
      if (!unoChat()?.members.includes(from)) return true;
      if (!uno.players.includes(from)) {
        if (uno.players.length >= unoMaxPlayers) {
          unoSend(from, { t: "uno-unavailable", gameId: uno.id, reason: "This game is full." });
          return true;
        }
        uno.players.push(from);
        renderUno();
      }
      unoBroadcast({ t: "uno-lobby", gameId: uno.id, players: uno.players });
      return true;
    }
    case "uno-leave":
      if (uno && unoHost() && uno.id === data.gameId) unoHandleLeave(from);
      return true;
    case "uno-unavailable":
      if (uno?.hostId === from && uno.id === data.gameId && uno.phase === "lobby") {
        uno.phase = "ended";
        uno.message = typeof data.reason === "string" ? data.reason.slice(0, 100) : "This game is unavailable.";
        renderUno();
      }
      return true;
    case "uno-lobby": {
      if (!uno || uno.hostId !== from || uno.id !== data.gameId || uno.phase !== "lobby") return true;
      const players = cleanUnoPlayers(data.players);
      if (!players || !players.includes(state.me.id) || !players.includes(from)) return true;
      uno.players = players;
      uno.confirmed = true;
      renderUno();
      return true;
    }
    case "uno-state": {
      if (!uno || uno.hostId !== from || uno.id !== data.gameId || !["lobby", "play", "finished"].includes(uno.phase)) return true;
      const players = cleanUnoPlayers(data.players);
      if (!players || !players.includes(state.me.id) || !["play", "finished"].includes(data.phase)) return true;
      const hand = Array.isArray(data.hand) && data.hand.length <= 108 && data.hand.every(card => unoCardPattern.test(card)) ? data.hand : null;
      const counts = data.counts && typeof data.counts === "object" ? Object.fromEntries(players.map(id => [id, Number.isInteger(data.counts[id]) ? Math.min(Math.max(data.counts[id], 0), 108) : 0])) : null;
      if (!hand || !counts || !unoCardPattern.test(data.top) || !unoColors.includes(data.color) || !Number.isInteger(data.turn)
        || data.turn < 0 || data.turn >= players.length || ![1, -1].includes(data.dir)) return true;
      Object.assign(uno, {
        players, hand, counts, phase: data.phase, top: data.top, color: data.color, dir: data.dir, turn: data.turn,
        drew: typeof data.drew === "string" && unoCardPattern.test(data.drew) ? data.drew : null,
        winner: players.includes(data.winner) ? data.winner : null,
        msg: typeof data.msg === "string" ? data.msg.slice(0, 120) : "", confirmed: true
      });
      unoPicking = null;
      renderUno();
      return true;
    }
    case "uno-play":
      if (uno && unoHost() && uno.id === data.gameId && typeof data.card === "string" && unoCardPattern.test(data.card)) unoHostPlay(from, data.card, data.color);
      return true;
    case "uno-draw":
      if (uno && unoHost() && uno.id === data.gameId) unoHostDraw(from);
      return true;
    case "uno-pass":
      if (uno && unoHost() && uno.id === data.gameId) unoHostPass(from);
      return true;
    case "uno-end":
      if (uno && uno.hostId === from && uno.id === data.gameId) {
        const endedId = uno.id;
        uno.phase = "ended";
        uno.message = "The host ended the game.";
        renderUno();
        window.setTimeout(() => { if (uno?.id === endedId && uno.phase === "ended") unoEndLocal(); }, 3000);
      }
      return true;
    default:
      return false;
  }
}

// ---- actions from the local player ----

function unoPlayCard(card, color) {
  unoPicking = null;
  if (unoHost()) unoHostPlay(state.me.id, card, color);
  else unoSend(uno.hostId, { t: "uno-play", gameId: uno.id, card, color });
}

function unoDrawCard() {
  if (unoHost()) unoHostDraw(state.me.id);
  else unoSend(uno.hostId, { t: "uno-draw", gameId: uno.id });
}

function unoPass() {
  if (unoHost()) unoHostPass(state.me.id);
  else unoSend(uno.hostId, { t: "uno-pass", gameId: uno.id });
}

// ---- rendering ----

function unoCardElement(card, onClick, disabled) {
  const element = gameElement(onClick ? "button" : "div", `uno-card uno-${card[0]}`);
  element.textContent = unoSymbol(card);
  element.setAttribute("aria-label", card[0] === "w" ? `Wild ${unoSymbol(card)}` : `${unoColorNames[card[0]]} ${unoSymbol(card)}`);
  if (onClick) {
    element.type = "button";
    element.disabled = Boolean(disabled);
    element.addEventListener("click", onClick);
  }
  return element;
}

function unoHeader(subtitle) {
  const head = gameElement("div", "game-head uno-head");
  const titles = gameElement("div");
  titles.style.flex = "1";
  titles.append(gameElement("h3", "game-head-title", "Uno"), gameElement("div", "game-head-sub", subtitle));
  head.append(gameElement("span", "game-logo", "🃏"), titles, gameFullscreenButton(unoModal));
  return head;
}

function unoPlayerChips(parent, withCounts) {
  const row = gameElement("div", "game-players");
  uno.players.forEach((id, index) => {
    const chip = gameElement("span", `game-chip${withCounts && uno.phase === "play" && index === uno.turn ? " uno-turn" : ""}`);
    const avatar = gameElement("span", "avatar");
    const person = id === state.me.id ? myProfile() : viewPerson(id);
    setAvatar(avatar, person.displayName, person.avatar);
    const count = withCounts && uno.counts ? ` · ${uno.counts[id] ?? 0} 🂠` : "";
    chip.append(avatar, gameElement("span", "", `${unoName(id)}${id === uno.hostId ? " 👑" : ""}${count}`));
    row.append(chip);
  });
  parent.append(row);
}

function unoInviteView() {
  const body = gameElement("div", "game-body game-center");
  body.append(gameElement("div", "game-big", "🃏"), gameElement("p", "game-text", `${unoName(uno.hostId)} invited you to play Uno!`),
    gameElement("p", "game-hint", "Match the top card by color or number. First to empty their hand wins."));
  const actions = gameElement("div", "game-actions");
  actions.append(gameButton("Join game", () => {
    uno.phase = "lobby";
    uno.players = [uno.hostId, state.me.id];
    unoSend(uno.hostId, { t: "uno-join", gameId: uno.id });
    renderUno();
  }, "profile-btn primary"), gameButton("Decline", () => {
    declinedUnoGames.add(uno.id);
    unoEndLocal();
  }));
  body.append(actions);
  return body;
}

function unoLobbyView() {
  const body = gameElement("div", "game-body game-center");
  const host = unoHost();
  body.append(gameElement("div", "game-big", "🃏"), gameElement("p", "game-text", host ? "Invite your chat to play" : "Waiting for the host to start"),
    gameElement("p", "game-hint", "Play a card that matches the top card's color or number. Special cards skip, reverse, or make others draw. 2 to 8 players."));
  unoPlayerChips(body, false);
  if (!host && !uno.confirmed) body.append(gameElement("p", "game-hint", "Connecting to the host…"));
  const actions = gameElement("div", "game-actions");
  if (host) {
    const start = gameButton("Start game", unoStartGame, "profile-btn primary");
    start.disabled = uno.players.length < 2;
    actions.append(start);
  }
  actions.append(gameButton(host ? "Cancel game" : "Leave", unoLeave));
  body.append(actions);
  return body;
}

function unoPlayView() {
  const body = gameElement("div", "game-body game-center");
  const finished = uno.phase === "finished";
  const mine = unoMyTurn();
  unoPlayerChips(body, true);
  const table = gameElement("div", "uno-table");
  table.append(unoCardElement(uno.top));
  const swatch = gameElement("span", `uno-swatch uno-${uno.color}`, unoColorNames[uno.color]);
  table.append(swatch);
  body.append(table);
  body.append(gameElement("p", "game-hint", uno.msg || ""));
  if (finished) {
    body.append(gameElement("p", "game-text", uno.winner === state.me.id ? "🎉 You won!" : `${unoName(uno.winner)} won!`));
  } else {
    const turnName = uno.players[uno.turn];
    body.append(gameElement("p", "game-text", mine ? (uno.drew ? "You drew a playable card. Play it or pass." : "Your turn") : `${unoName(turnName)}'s turn`));
  }
  const hand = gameElement("div", "uno-hand");
  uno.hand.forEach(card => {
    const playable = mine && unoPlayable(card) && (!uno.drew || uno.drew === card);
    hand.append(unoCardElement(card, () => {
      if (card[0] === "w") {
        unoPicking = card;
        renderUno();
      } else {
        unoPlayCard(card);
      }
    }, !playable));
  });
  body.append(hand);
  if (unoPicking && mine) {
    const picker = gameElement("div", "game-actions");
    picker.append(gameElement("span", "game-hint", "Choose a color:"));
    unoColors.forEach(color => {
      const choice = gameElement("button", `uno-card uno-pick uno-${color}`, unoColorNames[color]);
      choice.type = "button";
      choice.addEventListener("click", () => unoPlayCard(unoPicking, color));
      picker.append(choice);
    });
    picker.append(gameButton("Cancel", () => { unoPicking = null; renderUno(); }));
    body.append(picker);
  }
  const actions = gameElement("div", "game-actions");
  if (!finished) {
    const draw = gameButton("Draw a card", unoDrawCard, "profile-btn primary");
    draw.disabled = !mine || Boolean(uno.drew);
    const pass = gameButton("Pass", unoPass);
    pass.disabled = !mine || !uno.drew;
    actions.append(draw, pass);
  }
  actions.append(gameButton(finished ? "Close" : "Leave game", finished ? () => { if (unoHost()) unoBroadcast({ t: "uno-end", gameId: uno.id }); unoEndLocal(); } : unoLeave));
  body.append(actions);
  return body;
}

function renderUno() {
  if (!uno) return unoClose();
  autoFullscreenOnStart(unoModal, uno);
  const subtitle = ({
    invited: "Card game", lobby: `Lobby · ${uno.players.length} / ${unoMaxPlayers} players`, play: "Match the top card",
    finished: "Game over", ended: "Game ended"
  })[uno.phase] || "Card game";
  let body;
  if (uno.phase === "invited") body = unoInviteView();
  else if (uno.phase === "lobby") body = unoLobbyView();
  else if (uno.phase === "ended") {
    body = gameElement("div", "game-body game-center");
    body.append(gameElement("p", "game-text", uno.message || "This game has ended."));
    const actions = gameElement("div", "game-actions");
    actions.append(gameButton("Close", unoEndLocal));
    body.append(actions);
  } else body = unoPlayView();
  unoCard.replaceChildren(unoHeader(subtitle), body);
}

setupGameWindow(unoModal, unoCard, "discard-game-corner");

window.setInterval(() => {
  if (!state || !uno) return;
  const now = Date.now();
  if (now - unoLastRetry < 3000) return;
  if (!unoHost()) {
    if (uno.phase === "lobby" && !uno.confirmed) {
      unoLastRetry = now;
      unoSend(uno.hostId, { t: "uno-join", gameId: uno.id });
    }
    return;
  }
  if (uno.phase === "lobby") {
    unoLastRetry = now;
    unoInviteMissing();
  }
}, 1000);
