# Discard

A Discord-style chat app that is **fully peer to peer**. There is no server: download `index.html`, open it in Chrome, and chat.

**Version 3.5.10**

## How to play

**Easiest (auto-updating):** download just [`discard-loader.html`](discard-loader.html) and open it in Chrome. It fetches the latest Discard from GitHub every time, so you never re-download to update. Keep using the same copy of that file so your saved data stays in the same place.

**Offline copy:** download the zip of this repository, unzip it, and open `index.html` (keep all companion JavaScript files and images beside it, including `oakhaven-core.js`, `oakhaven.js`, and `game-time.js`).

## Run a local test server

To test the app over HTTP, open a terminal in the project folder and run:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Then open [http://localhost:8000](http://localhost:8000). Stop the server with `Ctrl+C`.

## Using it

Unread chats show a red count in the chat list and a red dot on the browser tab icon. Press **Pin** in a chat's header to keep it at the top of your list.
Enable **Message notifications** in Settings to see incoming message alerts while a game is covering your chat.

If sign-in says your account is already open in another tab, use **Unlock Account** after entering your password. It closes old tabs when Chrome permits it, or signs them out without reloading, and then signs you in. This does not affect accounts on other Chromebooks, and it does not delete saved messages.

1. Open `index.html`. Choose **Create account** (username + password, optional display name) or **Sign in**. Accounts and passwords live only on your computer, and you can have several on one computer.
2. Open **Friends** and copy your **friend code**. Send it to a friend, and paste theirs into "Paste a friend code".
3. They accept the request, then you can message, reply to messages, send files (up to 5 MB), images and GIFs, and make group chats. New accounts get a six-character friend code like `ab12cd` (the old `dsc-` prefix is hidden, and still accepted if pasted).
4. Click anyone's picture or name to set a **nickname** that only you see. Group owners can set a group picture. Every message shows its sender's picture, name and @username.
5. Settings has **Disguise tab as Minga**, which changes the browser tab's title and icon.

Group owners can use **Manage group** to add friends, remove members, transfer ownership, or delete the group. Other members can leave. Cancel a pending outgoing friend request with **Delete** in the chat list or **Cancel** in Friends. Use **Unadd** in Friends to remove a friend from both friends lists and delete the direct chat history on both devices; if the friend is offline, the removal waits on your device until you reconnect and both apps can communicate. You can delete your own messages; deletion is sent to chat participants who are online.

Messages travel directly between browsers (WebRTC via [PeerJS](https://peerjs.com), which uses a free public service only to introduce peers). Group messages are sent to each member separately: online members receive them right away, while messages for offline members stay queued on the sender's device and are delivered when the sender and recipient are both online. The sender must open Discard again for queued messages to continue delivering; there is no always-on server to deliver them while the sender is offline. The delivery status shows how many group members have received each message.

Because there is no central server, offline members may retain an older copy until they reconnect. The group owner queues membership changes and group deletions locally and sends them when members reconnect; message deletions are sent only to online chat participants.

## Garlic Fone

Open any chat, press the **+** at the left of the message bar and choose **🧄 Garlic Fone** to invite everyone in it to a telephone-pictionary game (2-8 players). Everyone writes a phrase, then the chains rotate: draw what you read, describe what you see, and so on. At the end each chain is revealed step by step. The host picks the number of rounds in the lobby (one per player by default, or 2 to 12; extra rounds loop the chains back around) and sets the time limits (presets or custom seconds per round type, or no limit; defaults are 40s to write, 90s to draw, 45s to describe) and a countdown bar shows the time left, and a step bar shows how far through the game you are. When time runs out your work is submitted automatically. The drawing pad has a fill bucket, an opacity slider and an eraser, and **Ctrl+Z** undoes and **Ctrl+Shift+Z** redoes (Cmd on Mac). Leaving mid-game asks for confirmation, and closing or reloading the tab always asks "are you sure?". The host's browser runs the game, so everyone must stay online, and invites only reach people who are online. The host can **Skip waiting** for slow players.

## Games

Press the **🎮** button above your chat list to open **Games**, the home for main games. Chat minigames such as Uno stay in the chat's **+** menu. Each main game shows active foreground playtime for the current local account, starting with this update (past playtime cannot be recovered). Time is stored on this browser/device; it is not cloud-synced. Oakhaven excludes pause, party waiting, hidden tabs, defeat, and completion. Event Horizon counts time while its game panel is open and the page has focus; idle production is unchanged.

**Event Horizon**, the black hole idle game, is still available. Use **Export save** to download progress and **Import save** to restore it after confirmation. These transfers contain Event Horizon progress, not the new playtime counters.

**Oakhaven: Ash & Oath** combines **original stylized 3D** gameplay with a storybook opening: eight illustrated shots over 48 seconds, camera moves, dialogue, fades and musical cues. The teal/silver hero, warm village, ember-armored Duke and misty Watchtower share a consistent theme. Press E to skip the intro, then E at camp to set out; training is optional. Follow the woodland trail, fight through the marauder crossing, upgrade at the chest, then face the Huntsman. Sword combos, bow combat, healing potions, archers and brutes, pickups and co-op revives expand the first mission. WebGL is required; no extra engine or art downloads are needed. This is still a prototype expedition, not the planned 8–10 hour campaign. [ART-DIRECTION.md](ART-DIRECTION.md) records artwork provenance and prompts.

Choose solo, split-keyboard couch play or online beta. Player 1 uses screen-relative WASD / F attack / G heavy / Space roll / R block / Q bow / H heal / E interact or revive. Player 2 uses arrows / J attack / K heavy / L roll / I block / U bow / P heal / O interact. Bow aim assists nearby targets; healing has an 18-second cooldown, and each fallen partner can be revived once. Solo also supports mouse aiming, left-click strikes and right-click blocking. Escape pauses; Tab and Enter navigate menus. Controls & settings contains rebinds, reduced effects and the sound/music toggle. Existing custom controls migrate when new actions are added. The cursor is hidden during play. Solo missions checkpoint locally every eight seconds and on pause/leave while alive; Continue expedition restores the last valid checkpoint. Saves are per account/browser, not cloud-synced or online reconnects. The existing Discard loader is unchanged; reopen it online to fetch the revision. Both online friends must reopen to use protocol version 3.

Online co-op is **experimental**: open Oakhaven, select a Discard friend, and invite them. They open Games → Oakhaven to accept. Two players share a host-controlled world; guest uses Player 1 keybinds to control the second character. Both must be online and on compatible versions. Invites expire after 60 seconds; active connections time out after 15 seconds without traffic. No reconnect, host migration, or mixed couch-plus-online mode yet. The party flow has simulated transport tests; real two-device WebRTC play and Chromebook performance still need manual verification. See [OAKHAVEN.md](OAKHAVEN.md) for exact scope, architecture, campaign plan, and acceptance checks.

Run simulation and adapter checks with `node --test tests/*.test.cjs` (Node 22+; no dependency installation). `tests/oakhaven-browser.html` is an isolated manual UI fixture using a synthetic local account and no network friends.

## Other chat games

Open a chat, press **+**, and choose **🕵️ Impostor** or **🎨 Sketch & Guess**. Games open in a small panel in a corner of the screen so you can keep chatting; drag the title bar to move it to any corner, click it to collapse, or press ⛶ for fullscreen. Both are hosted peer-to-peer by the person who starts the game; players need to stay online.

**Impostor** needs at least 3 players. Everyone except one player gets the secret word. Share clues, vote for who seems suspicious, and see the reveal.

**Sketch & Guess** rotates the artist through the chat. Draw the word while others guess; the sketch is shown live, with letter hints appearing over time. Earlier correct guesses earn more points. Choose the word category and number of rounds in the lobby.

**Uno** (press **+** and choose **🃏 Uno**, 2 to 8 players) is a card game: play a card matching the top card's color or number. Skip, Reverse, Draw 2, Wild and Wild Draw 4 cards work as usual; if you cannot play, draw a card (and play it if it fits, or pass). Playing your second-to-last card announces "UNO!". First to empty their hand wins. The host's browser holds the deck and everyone's hands, so players need to stay online.

**Uno** has house rules the host sets in the lobby: stacking draw cards (off, +2 on +2 and +4 on +4 only, or any draw card on any draw card), Wild +4 only when you have no card of the current color, draw until you can play, and the starting hand size (3 to 10).

**Hangman** (press **+** and choose **🔤 Hangman**, 2 to 8 players): each round one player secretly picks a word (and an optional hint) and everyone else guesses letters or the whole word together. Six wrong guesses lose the round. The word-picker rotates every round. You score 1 point per letter you find and 3 for solving the word; if nobody solves it the word-picker gets 2. The host's screen can see the word, since the host runs the game.

**Event Horizon** has a **🌌 One giant tree** button above the skill tree that merges every branch into a single big tree (toggle it off to go back to one branch at a time). Your upgrades are the same either way.

## Appearance

Open **Customize appearance** and choose **Custom background** to build your own look:

- 12 one-click presets (Aurora, Sunset, Neon, Mocha and more) plus a live preview.
- Solid, linear fade, radial glow, color sweep or mesh blend backgrounds, with up to three colors and an angle slider.
- **Animate fade** slowly drifts the gradient (slow, medium or fast; disabled if your system prefers reduced motion).
- Text contrast is automatic, or force light or dark text. Glass and blur sliders control how see-through the panels are.
- **Shuffle** makes a random palette, **Swap colors** flips it, and **Copy code** / **Paste code** share a theme with friends.

Everything is saved with your account.

## Discard Official

Friends panel has **Add Discard Official ✓**. It accepts you automatically and replies "Message received! Thanks for contacting Discard." to your messages (once every 20 seconds per person). It only answers while the owner has it open and unlocked.

When signed in as Discard Official, the Friends panel has an **Announcement** box that sends one message to every friend (offline friends get it when they reconnect). Other accounts never see it.

The account is verified with a digital signature, so nobody else can pretend to be it. Reserved names like "DiscardOfficial" can't be used by normal profiles.

## Your data

Everything is saved on your own computer (IndexedDB): profile, friends, messages, images, GIFs.

- Messages are never deleted on a schedule. Only if the browser truly refuses to save because the disk is full are the oldest messages removed to make room.
- Settings has **Export backup**; restore it from **Create account** (Restore from a backup file). Clearing browser data erases your profile, so export a backup first.
- Keep one tab open per profile.

## GIFs

Built-in GIFs, your uploads and favorites work out of the box. GIF search uses GIPHY with a shared API key set by `GIPHY_API_KEY` at the top of `app.js`, so everyone can search without setup. Replace it with your own key from developers.giphy.com if needed.

## Limits

Some strict school/work networks block WebRTC, in which case friends cannot connect.
