# Discard

A Discord-style chat app that is **fully peer to peer**. There is no server: download `index.html`, open it in Chrome, and chat.

**Version 2.0.0**

## How to play

1. Download the zip file of this repository (green **Code** button, then **Download ZIP**).
2. Unzip it.
3. Open `index.html` to load into Discard.

## Using it

1. Open `index.html` and create a profile (username + optional display name). No password or account.
2. Open **Friends** and copy your **friend code**. Send it to a friend, and paste theirs into "Paste a friend code".
3. They accept the request, then you can message, send images/GIFs, and make group chats.

Messages travel directly between browsers (WebRTC via [PeerJS](https://peerjs.com), which uses a free public service only to introduce peers). Both people must be online at the same time for delivery. If your friend is offline, the message shows "sending..." and is delivered automatically once you are both online.

## Your data

Everything is saved on your own computer (IndexedDB): profile, friends, messages, images, GIFs.

- If storage runs low, or messages exceed a size cap (about 40% of the browser's quota, 20-300 MB), the **oldest messages are deleted automatically**.
- Settings has **Export backup** / **Import backup**. Clearing browser data erases your profile, so export a backup first.
- Keep one tab open per profile.

## GIFs

Built-in GIFs, your uploads and favorites work out of the box. For Tenor search, paste a free Tenor API key in the GIF panel (stored only on your computer).

## Limits

Some strict school/work networks block WebRTC, in which case friends cannot connect.
