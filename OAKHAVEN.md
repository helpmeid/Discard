# Oakhaven: Ash & Oath — implementation ledger

## Current revision: storybook presentation and combat polish

This revision keeps the user's approved teal/silver, warm village, ember-Duke and misty-watchtower theme. Four original storybook illustrations now drive eight composed shots over 48 seconds, with pans/zooms, black fades, progressive captions, a musical chord score and skip control. The menu uses the same art. `ART-DIRECTION.md` records the built-in image-generation tool, full prompts and provenance; the art is not claimed to be human-drawn. Runtime JPEG panels are embedded in `oakhaven-art.js` (about 702 KB), automatically inlined/cached by the existing loader. The loader file itself is unchanged. Illustrated shots avoid unnecessary WebGL scene redraws.

The playable game remains native WebGL 3D. New work includes articulated arms/legs, rolling body motion, folded animated teal capes, gold tabard details, bow poses, mixed broadleaf/conifer scenery, ruined walls, torch props, warmer shader grading, ground variation, distance haze/vignette and a closer camera. Environment geometry remains under the original 20,000-triangle cap. The shader effects are code-verified, not visually GPU-verified. A quest panel, distance indicator, hotbar, floating combat text and throttled health/stamina DOM updates improve readability.

Movement now follows screen directions. Q (P2: U) fires a cooldown-limited bow with nearby-target aim assistance; friendly arrows cannot damage allies. H (P2: P) heals 55 HP with an 18-second cooldown and cannot revive the dead. Archers maintain distance and fire; brutes have longer visible slam windups and heavier damage. The crossing chest becomes available after its encounter: E nearby upgrades the party's blade damage by 25%, once. E near a fallen co-op partner revives them once per expedition. Existing light/heavy combos, shield/parry, stamina, rolls, hitstop, particles and the Huntsman remain. Impact text is capped at 20 entries and expires.

Solo expeditions checkpoint locally every eight seconds and on pause/leave while alive. Continue expedition restores the last valid checkpoint on that local account/browser. Transient arrows/particles/impact text are cleared when saving. Defeat does not overwrite the last living checkpoint. These are local solo mission checkpoints, not cloud saves, full campaign saves or online reconnect. Existing custom keybinds are preserved when adding the new controls, with duplicate defaults assigned free keys. Network state version is now 3; both online players must update via their loaders.

Validation: **36 passing tests** cover the previous systems plus screen-relative movement, bows/no friendly fire, potion cooldown, brute/archer behavior, chest reward idempotence, revive limits, eight-shot timeline continuity, four valid embedded JPEG assets and their size cap, bounded impact text, checkpoint restore and keybind migration. JavaScript syntax and whitespace checks pass. Source illustrations and CPU-projected geometry previews were inspected. Real browser layout/GPU shader rendering, real two-device WebRTC, manual mission completion and Chromebook frame pacing remain unverified. This is still a prototype expedition, not a completed 8–10 hour campaign. The current section supersedes the older revision notes below.

## Current revision: original stylized 3D rebuild

The user's updated direction replaces the pixel/2D presentation. The current version uses a native WebGL low-poly renderer with an angled orthographic camera, depth-tested 3D terrain, buildings/ruins/bridge/water, foliage and stone detail. Characters have modeled heads/faces/helmets, tunics, breastplates, shoulder armor, animated legs, boots, capes, swords and shields. Garrow has a face/beard/staff; beasts have bodies, legs, ears, snouts and tusks. No Minecraft assets, characters, branding, models or story are used.

A 30-second in-engine opening stages Oakhaven before the invasion, nightfall/fire/smoke, the Duke confronting the mentor with a ground-shock effect, the mentor falling, and the eight-year time jump. Subtitles and changing camera targets tell the story; E skips it. This is a procedural cinematic, not a rendered video or voiced performance. Simulation inputs/combat are suspended during the intro. All party members follow the host's cinematic clock.

Training is now optional: press E at camp to begin. The expedition is expanded to 1280×800 simulation units with an eastward woodland trail, boars, a timber crossing/marauder camp, then the southeastern Huntsman ruin. Distant enemies wait until approached. Three-hit light combos culminate in a stronger hit; heavy strikes, rolls, parries and impact effects remain. Dropped gold/health pickups and a pre-boss heal support the longer mission. Simple circle obstacles block major buildings/ponds. This is still one short mission, not a finished dungeon campaign or feature-equivalent recreation of Minecraft Dungeons.

The renderer is `oakhaven-3d.js`, loaded before the browser adapter by index.html, so the existing loader's dependency discovery includes it without loader changes. No additional engine/CDN/model requests are needed. WebGL/hardware acceleration is required; unavailable rendering shows an explanatory menu message. Resolution is capped at 1600×1000; static geometry is cached; scenery has a test-enforced 20,000 triangle budget per environment. CPU geometry previews were generated and inspected for camp, village and crossing. Those previews verify geometry/projection, not an actual browser GPU driver or measured Chromebook framerate.

Current automated verification: 24 passing tests cover mesh coordinates/budgets, modeled character proportions, camera projection, title/cinematic/world render paths, batched render submission with mocked WebGL, cutscene timing/skip/input suppression, loot healing, combos, three mission stages, stamina/parries/knockback, pause/rebind/playtime and simulated online parties. All JS syntax checks pass. Real browser rendering, real WebRTC and low-end hardware remain unverified. Audio is limited to synthesized strike/damage sounds with a toggle; there is no music or voice acting. No campaign save or full loot/equipment system exists. Network snapshot version is now 2; both online players must reopen their loaders to get the same revision.

The sections below preserve the initial slice's design history and longer campaign plan. Where they describe pixel graphics, a mandatory training gate, a single boar/boss arena or silent combat, the current revision above supersedes them.

This branch is a prototype vertical slice. No 8–10 hour campaign, polished art pass, complete inventory, or production-ready online mode is claimed.

## Built in this slice

- Games hub renamed, Event Horizon retained, RPG added. Uno/Garlic Fone/other chat games retain their existing placement and implementation.
- Per-account local active playtime for both main games. New counters start at zero; no invented historical hours. No offline accrual or cross-device sync. Saves every ten seconds and on page hide; abrupt browser termination may lose that interval.
- Original pixel canvas at 640×360 logical resolution, scaled without smoothing. Watchtower training arena and one Mire combat arena. Procedural placeholder scenery/characters are drawn in code; there are no external game-art downloads.
- Normalized omnidirectional movement and directional attack cones; light/heavy strikes, stamina, dodge invulnerability, facing-dependent blocks, 180 ms perfect-parry window, enemy poise and stagger, directional knockback, hit flashes, capped sparks, 2–4 frame hitstop, weight-based shake. Heavy finishing blows briefly slow simulation; this is a finisher prototype, not the complete critical-hit/weapon modifier system.
- Garrow's staff telegraph and training counters; five perfect parries plus three rolls unlock deployment. Shared counters in co-op. Mutated boar encounter, scrap counter, Huntsman spawn, ranged three-projectile fan, periodic hound summons, half-health transition, melee windup/recovery, rooted caltrops, victory/defeat and restart via menu.
- Solo keyboard and optional mouse; two-player split-keyboard couch mode; per-account rebinds with conflict detection; native Tab/Enter menu activation; scoped gameplay input; hidden arena cursor; Escape pause; focus/visibility input reset; reduced shake/flashes preference.
- Two-person experimental party transport through existing Discard `connectTo` / `sendTo` and `handleData` routing. Explicit friend invite/accept/decline. Host simulates both characters; guest sends validated action booleans. Host snapshots at 15 Hz, guest input at 30 Hz. Session IDs, friend and sender checks, capped snapshot collections, input timeout, party expiry/end, and account-switch cleanup.

## Deliberately incomplete or simplified

This is an arena-based slice, not an open world. No childhood playable prologue/cellar cinematic, Duke execution scene, complete branching Garrow dialogue, full war map, three explorable biomes, campaign saves, loot inventory, equip/crafting/armor system, ten item perks, ranged player weapon, stealth/high grass, destructible wagons, logs/boulders, moving bridges/elevators, explosives, antidotes, illusions, ally siege, or Duke finale exists yet. Scrap is a counter only. The stamina meter is available immediately; a permanently unlocked training reward/save is still planned. All combat is currently silent; audio/music assets and event mixing remain to be built.

Huntsman prototype differs from the requested final AI: open movement rather than grid pathfinding, a simultaneous three-bolt fan rather than tracked rapid burst, no perimeter path solver or four-tile smoke dash, no crossbow-break animation/audio, no fog-density change, and one heavy melee attack rather than the complete three-hit combo. Basic boars/hounds share pursuit behavior. Critical fatalities use simple screen-edge bars rather than the final vignette. No shield projectile reflection, healing, couch revive, damage balancing, or controller/touch support yet.

Online is a beta code path with simulated peers only. Real WebRTC delivery, latency, keyboard rollover on actual devices, accessibility review, and two-device end-to-end play remain unverified. Guest has no client prediction/interpolation or mouse-aim synchronization; use keyboard facing online. No reconnect, host migration, lobby browser, party chat overlay, campaign ownership transfer, or online+couch mixing. Host pausing freezes the world; guest menu pauses only their own input. Invitations appear in Games and require opening Oakhaven to accept. A network peer can disconnect and the match ends after timeout.

## Architecture and extension points

`oakhaven-core.js`: DOM-free simulation, state factory, combat/AI, bounded entities, protocol guards. Simulation uses 60 fixed ticks per second; rendering uses requestAnimationFrame with bounded catch-up. Hitstop pauses gameplay while particles/shake decay. Slow motion is a separate simulation multiplier. Max 160 particles, 32 bolts, 12 traps, 16 enemies and two players. Rendering resolution does not grow with display DPI. These are performance measures, not a verified Chromebook FPS guarantee.

`oakhaven.js`: presentation, input mapping, menu focus, settings storage and party adapter. Gameplay listeners are inactive when closed. Frame loop is canceled on leave. Gameplay is paused and held inputs cleared on focus loss. Host remains authoritative for position/damage; guests cannot submit their own coordinates/health. Integrate campaign checkpoints through a versioned save module rather than coupling save writes to render frames.

`game-time.js`: independent foreground-time counter for main games. It does not alter Event Horizon save/progression or introduce counters into chat games. Storage errors are nonfatal. Values are local convenience statistics, not trusted competitive telemetry.

Next systems should separate into `campaign` (quest graph, prerequisites, dialogue flags, versioned checkpoint saves), `world` (sector streaming, collision grid, spatial buckets, data-driven encounter blueprints), `equipment` (item definitions, passive modifiers, rarity/upgrade/crafting), `audio` (pooled voices and music states), and `network` (protocol version negotiation, snapshot codec, interpolation, reconnect). Add exact encounter/item tests around those systems as implemented. Never report content as playable solely because its data entry exists.

## Staged campaign target — planned, not playable

The original campaign aims for **8–10 hours** on a first playthrough. The budgets below are design targets; completion times must be measured with players after the levels exist. Avoid padding with repeat-wave grinding.

| Stage | Target | Required content and exit condition |
| --- | --- | --- |
| Act I: The Ash and the Oath | 25–35 min | Child movement/firewood/straw-dummy tutorials, Oakhaven attack, cellar cinematic, shield-shattering Duke confrontation, fade and time jump. |
| Act II: Watchtower of the Fallen | 35–45 min | Branching Garrow conversations, Iron and Reflex, The Wild Hunt, save checkpoint, gear/attributes, tactical map. |
| Howling Mire | 110–130 min | Sever the Lines (grass stealth/wagons), The Beast's Toll (gator), Trapper's Ridge (logs/boulders), full Huntsman AI, rewards/side discoveries. |
| Iron Crags | 110–130 min | Free the Forges, Broken Pass shield defense, explosive Bastion breach, Shield of the Realm boss and blacksmith/Tier 2 unlock. |
| Whispering Veil | 110–130 min | Three scouts, toxic abbey and antidotes, fake-wall Velvet Keep, assassins, teleporting Spymaster and mirror phase. |
| Act IV: Obsidian Citadel | 90–110 min | Liberated ally siege through Spires of Ruin, two-phase Duke sword/fire arena, epilogue and replay checkpoints. |
| Total | 480–580 min | 8h–9h40m target, subject to actual content/playtesting. |

The three lieutenant arcs should branch from the war map in any order. Each completion unlocks a durable story flag, a different hub capability, a unique combat reward, and a siege ally. The Citadel requires all three lieutenant flags. Side discoveries belong within the biome budgets and should carry narrative/mechanical value.

## Free the Forges — next-level blueprint (planned)

| Space | Layout and encounter | Quest change / performance note |
| --- | --- | --- |
| Mine approach | Two switchback routes into a visible work yard; three patrol infantry, one lookout; cover telegraphs safe approach. | Discover camp; stream only nearby sector. |
| Chain yard | Two guard pairs protect worker cages; shield overseer controls the gate. Side path reaches the cage lever. | Release first workers; save checkpoint. |
| Bell tower | Ranged guard above a broad staircase; alarm can summon a single bounded reinforcement group. | Disable alarm or survive reinforcements. |
| Smelter floor | Alternating furnace lanes telegraph heat; two overseers and four infantry split across lanes. | Acquire forge key; furnace cycle is fixed simulation state. |
| Blacksmith prison | Optional supply room, prisoner dialogue choices, two armored guards; cage keys cannot be lost on death. | Rescue master blacksmith; Tier 2 capability becomes available at hub. |
| Extraction road | Escort across two wide choke points, two capped attack waves and a shield captain; no endless spawn padding. | Escape with smiths; final checkpoint and reward. |

## Garrow dialogue/quest graph (planned beyond the current training line)

- Arrival: "Eight years and you still grip that hilt like a grudge." Responses ask about Oakhaven (history flag), training (Iron and Reflex), or the Duke (Garrow refuses until first deployment).
- Training completion: "A shield buys a heartbeat. Spend it moving." Grant permanent stamina unlock and Garrow's Regret recipe after saving the five-parry/three-roll flags.
- Wild Hunt return: choose whether to ask about the mutated animals or sell scrap. Unlock the map and three lieutenant leads without forcing a biome order.
- Each lieutenant return: acknowledge liberated NPCs and update the corresponding hub service. Garrow's guilt confession unlocks after the second lieutenant, with a forgiveness/accusation choice that changes epilogue dialogue, not access to the finale.
- All three defeated: "I taught you how to live. Don't let him choose what you live for." Unlock siege, provide explicit checkpoint confirmation and let the player continue side missions first.

## Equipment/asset checklist — all planned except generic sword/shield prototype

| Item | Required implementation and feedback |
| --- | --- |
| Oakhaven Splinter | Baseline arming sword, 2px hit judder. |
| Garrow's Regret | Perfect counter resets dodge cooldown; 4px hits, 8px parry jolt. |
| Mire-Stalker | 25% stacking poison proc; green flash, no shake. |
| Cragbreaker | Charged ground slow field (30%); 12px slam and four-frame hitstop. |
| Obsidian Cleaver | Kill-triggered fire wave/adjacent knockback; rotational 15px shake and vignette. |
| Vanguard Bastion | Perfect-block projectile reflection at 50% damage; 6px horizontal block jolt. |
| Cinder-Spark Bow | Every fourth arrow AoE fire/micro-stagger; impact-centered 8px shake. |
| Whispering Aegis | Shield-bash unlocks phase dash; two-frame distortion with reduced-effects alternative. |
| Kingmaker | Dodge-tail lance hit at 3× damage and knockdown; directional 10px surge. |
| Shattered Honor | Health-dependent damage and below-20% feedback multiplier. |

Art still needed: eight-direction hero ages/gear, Garrow, mentor/father, Duke, three lieutenants and biome enemies; village/watchtower/three biome/citadel tile sets; collision/occlusion definitions; attacks/rolls/parries/hit/death/boss transitions; ten item icons and equipment silhouettes; readable hazards, cinematic frames, dialogue portraits and UI. Audio still needed: weighted impacts, parry/shield break, roll/steps on each terrain, boss tells/horn, ambience, original music layers and accessibility alternatives to critical sound cues.

## Verification ledger

Automated: `node --test tests/*.test.cjs` — 15 passing tests, including simulation and minimal-DOM adapter tests, party invite/join/input/snapshot/end using two simulated peers, per-account keybind persistence/conflict checks, pause/cursor class lifecycle, and playtime exclusion during pause. The long simulation runs 36,000 ticks with capped transient entities; it is not a rendering benchmark. Syntax checks cover existing and new JavaScript, plus `git diff --check`.

Not verified: actual rendered layouts/screenshots, visual game feel, manual campaign completion, simultaneous physical couch-keyboard input, real peer-to-peer online sessions, loader network/offline fallback with the added scripts, whole-app manual regression, low-end GPU/CPU frame pacing, or actual 8–10 hour duration. Browser preview could not connect to the local server; local-file navigation was blocked by its security policy. The provided isolated browser fixture lets a reviewer verify UI without touching production accounts.

Before merging, manually launch Discard and confirm Games/Event Horizon and every existing chat game still open; run solo training→boss→victory and defeat→restart; complete the same flow in couch mode; check keyboard-only menus, remapping, focus loss, cursor restoration, effect reduction and account isolation; invite a real second device and test join, controls, pause, leave, timeout and sign-out; test the loader and an offline folder; measure frame time on a representative Chromebook. Keep this PR draft until those checks are complete.
