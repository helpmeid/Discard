# Dead Zone — Last Signal (5.0)

Choose **Story · Last Signal** or **Endless** in the host's lobby. The selected
mode and difficulty apply to the whole party, including invited friends.

Last Signal takes place in an abandoned quarantine district. The evacuation
network has gone silent. Recover the emergency cache (hold Interact for two
seconds), restore the district radio (four seconds), then remain inside the
evacuation zone for a cumulative 45 seconds while the waves continue. The arrow,
ground markers and objective panel guide the team. Cache and radio completion
give living teammates a pistol, ammunition and medical supplies. The host
simulates all objectives and broadcasts progress and the victory state.

Endless retains escalating waves, all four difficulties, random chest loot,
supply drops, doors, boarding, repairs, equipment and cooperative combat.
Runners are faster and weaker; brutes are slower and tougher. Between waves,
living survivors recover some health and have nine seconds to resupply.

## Presentation and controls

- Furnished, labelled interiors; a tiled quarantine square, abandoned vehicles,
  debris, cracked paving, guide lights and a marked evacuation pad.
- Facing characters with bodies, hands, equipment and walking motion.
- Blood pools, fallen infected, blood particles, impact sparks, muzzle lighting,
  directional flashlight glow, vignette and damage feedback. Effects and stains
  have bounded counts to keep snapshots and rendering from growing indefinitely.
- Larger red health meter, stamina, equipment and resources; an objective panel
  separate from the wave readout. The playfield preserves its 960:600 aspect ratio.
- WASD/arrows move, Shift sprints, mouse/Space attacks, E interacts, I opens the
  inventory, F operates doors, B boards, R repairs, C uses mints, 1/2 swaps weapons.
  Rebind through Escape → Settings / Keybinds. Interaction prompts use saved binds.
- Solo menus pause simulation. Online menus leave the party simulation running
  and stop the menu user's movement and attacks.

Chest opening leaves items on the ground and requires releasing and pressing
Interact again to collect them. Fast bullets use collision substeps. Melee cannot
hit through a closed door or wall. Remote door/repair/board/heal presses are
consumed once per press rather than repeating on every host frame. Sprint
exhaustion requires recovery to 25 stamina before sprinting resumes. Dead players
are not revived by the between-wave health bonus.

## Verification

Run `node --check dead-zone.js` and `node --test tests/dead-zone.test.cjs`.
Ten regression tests cover story completion, endless, stamina, wall collision,
chest drops/pickup, projectile hits, host processing of guest actions, door press
consumption, melee occlusion, continuous house-entry navigation and projectiles during resupply.

The optional `node tests/dead-zone.browser.cjs` requires Playwright and installed
Edge (or set `DZ_BROWSER=chromium`). It opens two actual browser pages with an
in-memory message relay, joins a party, checks guest movement on the host,
inventory/settings, shooting, blood/effect snapshots and aspect ratio at 800×600.
Set `DZ_SCREENSHOT` to save a gameplay PNG; `DZ_PLAYWRIGHT` can select an existing
Playwright installation. The production game has no new runtime dependency.

Development validation: all ten Dead Zone regression tests pass; the two-page
Edge run has no page errors. The repository-wide suite has 125 passes and 11
failures; the original commit has 115 passes and the same 11 failures in Oakhaven
tests. Real accounts over the production peer transport, four-player latency,
long sessions and mobile input have not been tested. Furnishings and vehicles
are visual dressing; existing house walls and doors remain the collision layout.

## Weapon and healing presentation (6.5.4)

Every weapon now has its own silhouette, shared by survivors and Verity. Guns
have visible recoil and barrel-aligned muzzle flashes, including wider shotgun
flashes and colored energy flashes for special weapons.

Actual healing produces a small green particle burst and a floating restored-HP
number. The healed local player also gets a brief green screen-edge glow. This
covers mints, medkits, bandages, revives, wave recovery and healing Verity; healing
counters travel in authoritative snapshots so teammates see the feedback too.
Survivors below 25 HP get a subtle pulsing red screen edge. No healing ring or
armor-hit sparks were added.

Validation: syntax check and all three targeted effect tests pass. The existing
suite has 16 passes and one house-entry navigation failure, reproduced unchanged
on the pre-update source. Live browser visuals have not been verified.

## Navigation, melee silhouettes and placement (6.5.5 / Discard 4.3.1)

Zombies and Verity now share clearance-aware paths around houses, vehicles and
concrete barriers. Cached target fields are shared by the horde, with route
smoothing and invalidation when doors or barriers change. Zombies approach and
break closed doors; Verity opens doors to follow the team. Actors embedded in
old geometry walk out in bounded movement steps instead of teleporting. The old
short-range steering and Verity emergency teleport have been removed.

The machete now uses a short, broad chopping blade with a clipped rounded nose,
contrasting with the long curved katana. Crowbar hooks, pipe coupling, tapered
spiked bat and wrapped katana grip further distinguish the melee silhouettes.
All 23 weapon models were inspected in a silhouette preview.

Hold the barrier key (V by default) to display a green/red placement preview.
Left-click to confirm one barrier per fresh click; release V to cancel. Weapon
fire is suppressed while previewing. The preview and host placement use the
same footprint, obstacle, survivor-clearance and resource checks. Barriers have
1800 HP and remain destructible: infected attack them when no route exists.

Validation: 29 checks pass across the existing suite, effects, six navigation
checks and three barrier checks. The house-entry regression now measures valid
contact distance (28 units) rather than requiring overlap with the existing
27.5-unit survivor separation. Navigation checks cover entry/exit, closed doors,
Verity, door changes, exact grid/collision agreement and a crowded horde. A native
65-zombie benchmark simulated 12 seconds in approximately 0.75 seconds on the
development machine. These are automated simulations, not live multiplayer QA.
