# Historical first 3D rebuild

The active game now uses the sequel-style demo systems. See [OAKHAVEN-DEMO.md](OAKHAVEN-DEMO.md). The following records the earlier first rebuild; its loader warning was later withdrawn after correct HTML script-data parsing and bundle assembly checks.

# Oakhaven: Ash & Oath — ground-up rebuild

This revision replaces the active prototype with four new modules. It uses original block-built models, terrain, story and interface. Minecraft Dungeons and the user's village-road screenshot guide the isometric camera, readable combat and compact HUD; no Minecraft assets, branding or code are included.

## What is implemented

- A new 48-second opening with eight staged **3D** camera shots: childhood Oakhaven, father and child, invasion, the Obsidian Duke, the last stand, aftermath, an eight-year jump and Garrow at the Watchtower. A smaller childhood model becomes a clean-shaven 18-year-old hero. Burning houses use animated block flames/smoke. Captions and an interact-key skip are included. These scenes use geometry rather than enlarged still images. Existing illustrated assets are reused only behind menus.
- A new Watchtower camp and a 64×48-block expedition, **The Ashen Road**: village orchard, mill stream/bridge, guarded tents/cages, optional chests and a ruined sanctuary. Houses, layered trees, flowers, grass, fences, carts, lanterns, stone ruins and terrain elevation are authored as geometry.
- Click-to-move with A* routes around water and obstacles; click enemies to approach and attack. Keyboard-only movement remains supported, along with pointer aim and a charged bow. Starting keyboard movement restores keyboard facing. The cursor hides while playing and returns in menus.
- Three-hit melee combos, a heavy strike, dodge, guard/perfect parry, stamina, hitstop, knockback, poise/stagger, sparks, damage labels, enemy windups and a healing potion. Animation, melee damage and arrow direction share the same facing. Discrete actions tapped during hitstop are buffered.
- Three usable, separately cooled abilities: Garrow's Bell stuns nearby enemies, Watchtower Ward reduces damage, and Oathbound Dash lunges with damage and invulnerability.
- Soldiers, archers, brutes, boars, hounds and a two-phase Huntsman boss. Thirteen initial enemies are placed across the mission; the boss can call additional hounds. Clear patrols, free three guarded villagers, defeat the Huntsman, then return to camp. The boss remains gated until the villagers are freed.
- Gold, food, arrows, XP/levels and actual equipable swords/armor/bow. Two optional chests contain named weapons. The equipment menu switches between both couch characters.
- Compact heart/health, keyed ability/potion cooldown slots, dodge readiness, stamina, XP level, crowns/arrows, minimap, mission map, nearby interaction prompts, objective text, boss health and party status.
- Separate solo and two-player couch modes, disjoint default left/right keyboard controls, rebinds with collision checks, keyboard menu navigation and attack-key activation, plus held-interact revival.
- Experimental two-person online invitations through Discard's existing friend transport and `oak-` message routing. Host owns simulation, guest sends bounded input at up to 30 Hz, snapshots are sent at 10 Hz. Version 10, friend/session checks, bounded snapshot validation and timeouts are included. Guest uses their Player I controls for the second hero. Couch and online cannot be combined.
- Per-account solo checkpoints every ten simulation seconds and on pause/leave while alive. New saves use `discard-oakhaven-reborn-1-<account>`. Older saves remain stored separately; the previous engine's coordinates/progression are not migrated into this different level. Existing Games hub, Event Horizon, chat games and active foreground playtime remain integrated.

## Controls

| Action | Player I | Player II |
|---|---|---|
| Move | WASD | Arrows |
| Strike / menu activation | F | J |
| Heavy strike | G | K |
| Charge/release bow | Q | U |
| Dodge | Space | L |
| Guard | R | I |
| Potion | H | P |
| Interact / hold revive | E | O |
| Bell / Ward / Dash | 1 / 2 / 3 | ; / ' / / |

V opens equipment, Tab opens the mission map, Escape opens/closes pause. Menu movement uses either player's configured up/down controls; Tab cycles within the menu. Left mouse moves/targets an enemy; hold/release right mouse charges/fires the bow. Couch mode uses keyboard input exclusively.

## Architecture and performance choices

- `oakhaven-world.js`: deterministic map authoring, spatial collision buckets, segment clearance and A* navigation. Routes check intermediate positions, not only tile centers, so bridge rails cannot be cut through diagonally.
- `oakhaven-engine.js`: fixed-step 60 Hz simulation, action timelines, AI, quests, loot, gear, saves and network validation. No DOM or rendering dependencies.
- `oakhaven-renderer.js`: native WebGL 1, cuboid rigs, cached 8×8-block static meshes, two main-scene draws, directional shadow map (two extra draws), fog/lighting and a dithered foreground cutaway around heroes. Static geometry is uploaded when visible chunk bounds change. Canvas is capped at 1600×1000 preserving aspect ratio. Low graphics disables the shadow pass and caps at 1100×700; reduced effects disables camera shake.
- `oakhaven-game.js`: Discard lifecycle/party adapter, menus/HUD, input, cinema captions, local saving and synthesized sound effects.

`index.html` now loads these new modules. The prior `oakhaven-core.js`, `oakhaven-3d.js` and `oakhaven.js` remain in the repository as archived source but are no longer loaded by Discard. Their old tests are retained as historical regressions. The art file still adds about 2.34 MB to the loader bundle; no additional engine, image or font requests are introduced.

## Verified and unverified

New automated checks cover navigation through the actual movement controller, facing/strike timing, guard/dodge/bow/artifacts, quest/rescue/boss transitions, loot/equipment, revival, saves, keyboard/mouse adapters, per-account playtime, simulated peer invitation/input/snapshot/leave, resolution caps, draw counts, static uploads, finite geometry/cameras and all eight cinematic shots. Existing prototype tests run separately in the same suite. Mock rendering checks do **not** compile shaders or exercise a GPU.

CPU-rasterized previews of the submitted mesh/camera were inspected for camp, road, crossing and opening shots. They are design checks, not browser screenshots. Actual browser rendering, shader compilation, sound, long-session balance, keyboard ghosting, accessibility, real two-device WebRTC play, Chromebook FPS and full loader launch remain unverified in this environment. `tests/oakhaven-rebuild-browser.html` is an isolated manual graphics fixture, not an alternative product entry point.

The existing `discard-loader.html` is deliberately unchanged. Its relative-script discovery finds all four replacement modules in `index.html`; they do not rely on module imports or new remote dependencies. The earlier claim that a closing-script string prevented loader startup was incorrect. A simple regular expression had extracted the wrong script boundary. The unchanged loader now passes script-data boundary, real-source bundle assembly and cache-fallback checks. No loader repair was applied.

## Still planned

This is a rebuilt playable first expedition, **not** the requested finished 8–10-hour campaign or commercial-quality equivalent. Iron Crags, Whispering Veil, the remaining lieutenants, the Duke's playable finale, longer branching missions, a larger equipment/enchantment system, more enemy families, polished music/voice acting, gamepad support, online interpolation/prediction, reconnect/host migration, difficulty balance and measured Chromebook optimization remain future work. The current opening has scripted actors and captions, not voice performances or a complete animated film.
