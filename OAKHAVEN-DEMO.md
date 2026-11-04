# Oakhaven demo — sequel-style systems revision

Open your existing Discard loader, then **Games → Oakhaven**. The game labels itself as a demo and asks for password **1423** before showing worlds or joining a party. The Discard loader file is unchanged.

The original medieval story, Oakhaven, Old Man Garrow and the Obsidian Duke remain. The visual language is original block-built geometry and SVG item artwork. No Minecraft code, game assets, logos or downloaded textures are included. The active game no longer loads the earlier generated illustrations.

## Implemented

### Worlds and campfire

- Six named local worlds per Discard account, each with its own solo/couch/online type, character equipment, XP, health, progress, elapsed world time and discovered stations. Rename and two-step deletion are available in World options.
- Compatible version-10 checkpoints import as **Your Earlier Oath**. The old save key remains intact. Custom bindings are retained where possible; former default bindings adopt the new controls. The much older, different-coordinate prototype saves remain stored separately.
- A live 3D campfire lobby with seated heroes, warm fire lighting, embers, party seats, equipment access, friend invitations and ready status before loading.
- Online worlds require the companion to join and ready up. The host then begins loading; both clients prepare the world and scenery, and the host waits for the guest's loaded acknowledgement before either starts. Game simulation is locked while gathering/loading. Leaving or timing out returns the remaining player to a locked campfire. An online world cannot resume alone through the pause menu.
- Couch worlds require Player II to join the campfire. Multiplayer prologues have different shared-story captions and two young heroes in the 3D scenes. Both players must vote to skip; normal playback ends together. Host-owned story time prevents independent progression.
- Loading displays actual preparation stages over the campfire background. It is internal game loading; the Discard startup loader is untouched.

### Combat and controls

- Four arrow charges regenerate automatically: a charge returns after 2.6 seconds of recharge, following a short delay after firing. Bow charging suspends recharge. A shot requires at least 0.18 seconds of draw; maximum draw is 1.1 seconds, with 0.58 seconds of firing recovery. Repeated tiny clicks do not fire arrows.
- Light sword hits cost stamina, third hits have added recovery, and exhausted heroes must recover before continuing. Heavy attacks cost more. Guarding, perfect parries, dodging, flanking shields, three real artifacts and movement give alternatives to holding attack. Perfect parries restore stamina.
- Jump and dodge are separate actions. Heavy jumps land with area damage, stagger, dust and a shockwave. An airborne normal jump can turn into a heavy landing strike. Water has a safe-ground recovery penalty if a jump cannot land.
- Fixed facing is shared by the model, sword arc, damage and arrows. Enemy click targeting keeps the selected enemy in the attack direction. Ground clicks can move within a single navigation tile and finish at the clicked point. Left-click context actions approach/open chests, NPCs and station signs.
- New expanding ability/landing rings, charged-arrow trails, target markers, hitstop, knockback, screen kick, damage flashes, particles and synthesized swing/impact/footstep sounds. Reduced effects suppress camera shake and character damage flashes. Effects and labels stay bounded.
- The mouse stays visible during normal gameplay. Actual controller activity hides it over the world canvas; mouse or keyboard activity restores it. Controller support uses the browser's standard gamepad mapping.
- Click-to-move is the solo/online default. Optional WASD movement is available in settings; split-keyboard couch movement remains enabled. Keyboard bindings are configurable, non-conflicting and stored per account. Both players can navigate menus and activate buttons with their attack key.

| Action | Player I | Couch Player II |
|---|---|---|
| Move | Left click; optional WASD | Arrows |
| Melee | Left click / F | J |
| Heavy strike | G | K |
| Charged bow | Right mouse / T | U |
| Jump | Space | . |
| Heavy jump | Q / mouse side button | , |
| Dodge | R / mouse side button | L |
| Guard | Left Shift | Right Shift |
| Potion | E | P |
| Interact / hold revive | Left click context / C | O |
| Bell / Ward / Dash | 1 / 2 / 3 | ; / ' / / |
| Equipment tap / quick equipment hold | I | Backslash |
| World map | M | Right bracket |

Tab opens full equipment; Escape opens/closes the menu. Online guests use Player I controls for their second hero. Standard controller mapping: left stick moves, A jumps or interacts nearby, X attacks (or performs an airborne heavy strike), RT charges a bow, LB/right-stick direction dodges, LT drinks a potion, Y/B/RB use artifacts, and D-pad up taps/holds inventory. Menu/Options pauses and View/Share opens the map. Controller mapping is fixed in this revision; keyboard bindings are editable.

### Equipment and characters

- A rebuilt equipment layout with a live 3D hero preview, seven equipped gear slots, a filtered item grid, original scalable icons, rarity frames, power levels, stat details and equip actions.
- Separate helmet, chest armor, leggings, boots and talisman slots alongside melee/ranged weapons. Armor adds protection; boots/talismans can improve movement, stamina or ammunition recovery. Equipment changes update the hero's appearance.
- Quick equipment opens a smaller overlay while the other couch player and the world continue. Full local equipment pauses the local session. Online equipment leaves the shared host simulation running.
- Larger block heads, layered hair, eyes/eyebrows, clean-shaven faces, chain/cloth/plate details, jointed limbs, capes, shields and distinct weapons. The adult hero is eighteen. Gray hair and a beard identify Garrow. The Duke has heavy dark armor and a crown. Creatures have articulated legs, ears, jaws, tails and tusks where appropriate.

### Region and rail network

- Watchtower camp plus a freely explored 64×48-block woodland region containing the orchard, mill crossing, guarded cages, sanctuary, a quarry and a small southern settlement/shrine route.
- Nineteen placed enemies across the region, including archers, shield soldiers, brutes, boars, hounds and the two-phase Huntsman. The boss can summon more hounds. Main progression still clears patrols, rescues three villagers and confronts the Huntsman. Five optional chests contain named weapons and additional gear.
- Five visible, usable rail stations: Watchtower Halt, Oakhaven Road, Old Orchard, Mill Crossing and Sanctuary Ridge. Walking near a station discovers it in that world. Rails/platforms/signs are rendered in the landscape and shown on the map.
- Fast travel uses a short shared departure/arrival transition. Both heroes must reach a safe source station and confirm boarding. Destination discovery is required. Enemy/quest/chest/rescue progress survives returning to camp and visiting the region again.
- The world currently uses two authored region maps. A large seamless overworld, full train-route simulation and the remaining campaign regions are future work.

## Implementation and loading

Active modules load in this order: `oakhaven-world.js`, `oakhaven-engine.js`, `oakhaven-renderer.js`, `oakhaven-saves.js`, `oakhaven-interface.js`, `oakhaven-demo.js`. They use browser globals and native WebGL; no module loader or new remote library is required. The previous shells and artwork remain archived in the repository, outside the active script list.

The game files loaded by the Discard loader shrink from about **2.43 MB to 156 KB**, chiefly by removing the 2.34 MB illustration payload from the entry page. Exact published byte sizes can vary slightly with line endings. The runtime now creates visuals from geometry and SVG.

Rendering caches static 8×8-block chunks and culls off-screen actors. Normal graphics cap the canvas at 1600×1000; high detail caps it at 2560×1440. Low graphics cap at 1100×700 and disable the shadow pass. Low graphics are selected automatically when available device-memory/thread indicators suggest a small device. Main geometry uses two draws, plus two for directional shadows. These are implementation choices and measured submissions, not a Chromebook FPS guarantee.

## Verification

`node --test tests/*.test.cjs` passes **114 checks**: 62 current engine/demo/renderer/loader checks plus 52 retained earlier-prototype regressions. New checks include password gating, six independent worlds, migration/quota failures, arrow regeneration/rate limits, stamina recovery, jump/slam effects, precise movement, region persistence, boarding consent, locked simulation, ready/load acknowledgements, shared-story skipping, guest movement, disconnects, quick/full equipment, cursor switching, playtime, bindings and longer idle sessions. A timer-underflow bug that would have rejected later saves/snapshots was corrected and covered by a five-minute simulation.

Loader checks run the **unchanged** loader against the real entry page and companion sources with mocked fetch/storage/document adapters, compile the assembled scripts and exercise its cache fallback. The downloaded loader was also inspected read-only. An earlier regular-expression check incorrectly reported a closing-script error: HTML's escaped/double-escaped script-data rules preserve the full script here. That warning and proposed edit were withdrawn. No loader repair is required by these checks. [HTML parsing rules](https://html.spec.whatwg.org/multipage/parsing.html#script-data-double-escape-start-state)

Mock GL checks validate finite geometry/cameras, drawing/caching limits, resolution settings and picking. CPU-rasterized geometry previews were inspected. Browser/GPU shader execution, final DOM layout at actual device sizes, sound quality, physical controllers/keyboard ghosting, real two-device WebRTC and measured Chromebook performance remain manual checks. The test adapters do not replace them.

## Scope remaining

This remains a demo with a rebuilt opening and first region. The requested 8–10-hour campaign, full Mire/Iron Crags/Whispering Veil arcs, remaining lieutenants, playable Obsidian Duke finale, broader side quests, deep enchanting, full music/voice acting, online prediction/reconnect/host migration and commercial-level art polish remain unfinished. The demo label and password gate deliberately make that status clear.

Design references were checked against Mojang's [Dungeons II gameplay systems](https://www.minecraft.net/en-us/article/minecraft-dungeons-ii-gameplay-systems) and [Xbox Wire's gameplay overview](https://news.xbox.com/en-us/2026/08/26/minecraft-dungeons-ii-new-features-gamescom-2026/amp/), alongside the user's requested controls and screenshot. These inform mechanics and readability; Oakhaven retains its own setting, characters and assets.
