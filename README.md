# Discard

A Discord-style chat app that is **fully peer to peer**. There is no server: download `index.html`, open it in Chrome, and chat.

**Version 2.0.3**

## How to play

1. Download the zip file of this repository (green **Code** button, then **Download ZIP**).
2. Unzip it.
3. Open `index.html` to load into Discard. Keep `app.js` and `assets.js` in the same folder as `index.html`; it loads them.

## Run a local test server

To test the app over HTTP, open a terminal in the project folder and run:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Then open [http://localhost:8000](http://localhost:8000). Stop the server with `Ctrl+C`.

## Using it

1. Open `index.html`. Choose **Create account** (username + password, optional display name) or **Sign in**. Accounts and passwords live only on your computer, and you can have several on one computer.
2. Open **Friends** and copy your **friend code**. Send it to a friend, and paste theirs into "Paste a friend code".
3. They accept the request, then you can message, send images/GIFs, and make group chats.

Group owners can use **Manage group** to remove members, transfer ownership, or delete the group. Other members can leave. Use **Unadd** in Friends to remove a friend and delete that direct chat history from your device. You can delete your own messages; deletion is sent to chat participants who are online.

Messages travel directly between browsers (WebRTC via [PeerJS](https://peerjs.com), which uses a free public service only to introduce peers). Group messages are sent to each member separately: online members receive them right away, while messages for offline members stay queued on the sender's device and are delivered when the sender and recipient are both online. The sender must open Discard again for queued messages to continue delivering; there is no always-on server to deliver them while the sender is offline. The delivery status shows how many group members have received each message.

Because there is no central server, offline members may retain an older copy until they reconnect. The group owner queues membership changes and group deletions locally and sends them when members reconnect; message deletions are sent only to online chat participants.

## Discard Official

Friends panel has **Add Discard Official ✓**. It accepts you automatically and replies "Message received! Thanks for contacting Discard." to your messages (once every 20 seconds per person). It only answers while the owner has it open and unlocked.

The account is verified with a digital signature, so nobody else can pretend to be it. Reserved names like "DiscardOfficial" can't be used by normal profiles.

## Your data

Everything is saved on your own computer (IndexedDB): profile, friends, messages, images, GIFs.

- If storage runs low, or messages exceed a size cap (about 40% of the browser's quota, 20-300 MB), the **oldest messages are deleted automatically**.
- Settings has **Export backup**; restore it from **Create account** (Restore from a backup file). Clearing browser data erases your profile, so export a backup first.
- Keep one tab open per profile.

## GIFs

Built-in GIFs, your uploads and favorites work out of the box. For Tenor search, paste a free Tenor API key in the GIF panel (stored only on your computer).

## Limits

Some strict school/work networks block WebRTC, in which case friends cannot connect.
