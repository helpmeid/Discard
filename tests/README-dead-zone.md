# Dead Zone multiplayer checks

Version 4.2.0 uses protocol 2. Both players must reload after deployment.

The host's authoritative simulation runs in `dead-zone-host-worker.js`, independently
of animation frames and the host's UI timers. The host may switch tabs or minimize
the window. Their game tab must stay open. Single-player keeps the existing local
simulation and pause behavior. Browsers without Worker support use the local clock
as a fallback.

`dead-zone-net.js` provides the shared 60 Hz movement integrator, bounded command
history, input acknowledgements and replay, buffered remote interpolation, and the
real-time transport. The transport reserves negotiated RTCDataChannel ID 42 on the
existing PeerJS connection (`ordered: false`, `maxRetransmits: 0`). Reliable PeerJS
messages carry deployment, inventories, doors, loot, blood, chat, and equipment
actions. Motion packets run at 20 Hz; retransmitted input bundles repair dropped
commands without repeating actions. A congested motion channel discards stale
updates. A reliable fallback works while the real-time channel establishes.

Save format and storage keys remain version 1. The worker provides full checkpoints
for manual and automatic saving; network snapshots are never saved as simulation
checkpoints. Returning to the menu terminates the worker.

## Automated checks

```sh
node --check dead-zone.js
node --check dead-zone-net.js
node --check dead-zone-host-worker.js
node --check app.js
node --test tests/dead-zone-net.test.cjs tests/dead-zone.test.cjs
```

The tests include lossy/reordered commands, latency, jitter, exact reconciliation,
collision and sprint consistency, duplicate actions, bounded queues, stale state,
metadata, save round trips, a real worker without any host animation loop, and two
complete client instances continuing after the host's UI timers stop.

One existing test, `infected can enter an open house without position jumps`, also
fails on the pre-rewrite source. It concerns the existing infected pathfinding.

## Browser checks

With Playwright and Edge installed:

```sh
node tests/dead-zone.browser.cjs
```

Optional variables: `DZ_PLAYWRIGHT` (module path), `DZ_BROWSER=chromium`,
`DZ_LATENCY_MS=80`, `DZ_JITTER_MS=35`, `DZ_DROP_EVERY=7`.

The browser test uses actual local WebRTC channels, two game pages, the host worker,
65 infected, movement, combat, inventory, persistent HUD nodes, and saving. It stops
the host's animation loop and checks that the guest can still move and advance the
match. Playwright's background-throttling override flags are explicitly removed.

Alternatively, serve the repository over local HTTP and open
`tests/dead-zone-realtime.html`. This self-contained browser check uses two frames,
actual WebRTC, 80 ms of delay each way, jitter and packet loss, then displays its
results. A final manual check should use two devices and switch the host's tab away
for several minutes, then verify guest combat, doors, loot and save/resume.
