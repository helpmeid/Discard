# Dead Zone public lobby code backend

The redesigned Dead Zone lobby UI is included in the app. **Public joins are not active until a lobby registry Worker is deployed and its URL configured.** Without this, the existing friend-based lobby discovery remains available.

## Deploy on Cloudflare Workers

1. Create a Cloudflare KV namespace named `DEADZONE_LOBBIES`.
2. Create a Cloudflare Worker with the code in `backend/deadzone-lobbies-worker.js`.
3. Bind the KV namespace to the Worker as `LOBBIES` (the code references `env.LOBBIES`).
4. Set `ALLOWED_ORIGIN` to your exact Discard website origin (for example, `https://example.pages.dev`), including protocol and excluding trailing slash.
5. Deploy. Confirm that `https://YOUR-WORKER-URL/lobbies/deadzone/ABCDE` returns a 404 JSON response for a nonexistent lobby.
6. In Discard, before launching Dead Zone, configure its public backend URL with `localStorage.setItem('deadzone-lobby-api','https://YOUR-WORKER-URL')` in the same browser profile and reload the tab. Alternately define `window.DEAD_ZONE_LOBBY_API` before loading the game script in `index.html` for all users.

## Behavior

- Hosting registers a random five-letter code, with a 90-second KV expiry, and refreshes it every 35 seconds while in the lobby.
- Other users can look up that code, obtain the host's PeerJS ID and session ID, and connect without being Discard friends. The actual lobby host validates the session, player count, and the game message type.
- Leaving or starting a match attempts to remove the code; expired codes also disappear automatically.
- The game communicates directly peer-to-peer after discovery. The directory does not host game state.

## Production cautions

This is a minimal backend starter, not a fully hardened production matchmaking service. Five-letter codes are guessable, and the current registry has no authenticated host identity or per-IP rate limiting. Add Cloudflare WAF/rate limiting, abuse controls, and ideally authenticated lobby registration before opening it to a large public audience. KV is eventually consistent; concurrent code collisions are possible. For strong uniqueness, replace the KV create operation with a transactional Durable Object or database constraint.

The Worker responds with wildcard CORS headers, so do not consider CORS an authentication boundary. The `ALLOWED_ORIGIN` check reduces accidental cross-origin use but cannot authenticate callers outside browsers.
