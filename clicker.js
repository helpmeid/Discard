"use strict";

// Event Horizon: a solo black-hole game. You start as a tiny black hole and drag real objects, from boulders to
// galaxies, into it. Spend Spin on a star map per branch. Open it with window.openVoidForge(userId).
(() => {
  const G = 6.674e-11;
  const LIGHT = 2.998e8;
  const TAU = Math.PI * 2;
  const START_MASS = 1.67e-27;
  const OBJECT_MASS_MULT = 1 / 2.5;
  const OBJECT_SPAWN_MULT = 2.5;
  const BASE_REACH = 0.05;
  const SCARCITY = 4.9;
  const ACC_RATE = 0.00002;
  const UNIVERSE_MASS = 1.5e53;
  const MULTIVERSE_MASS = 1e99;
  const FADE_SECONDS = 200;
  const OFFLINE_CAP = 8 * 3600;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const rand = (low, high) => low + Math.random() * (high - low);

  const fmt = value => {
    if (!Number.isFinite(value)) return "∞";
    if (value === 0) return "0";
    const abs = Math.abs(value);
    if (abs >= 1 && abs < 1000) return abs < 10 ? value.toFixed(2) : abs < 100 ? value.toFixed(1) : String(Math.round(value));
    if (abs >= 1 && abs < 1e6) return Math.round(value).toLocaleString("en-US");
    // Words up to quadrillions, plain decimals down to 0.00001, scientific only beyond that.
    if (abs >= 1e6 && abs < 1e18) {
      let tier = Math.floor(Math.log10(abs) / 3);
      let scaled = abs / 1000 ** tier;
      if (scaled.toFixed(2) === "1000.00" && tier < 5) { tier += 1; scaled = abs / 1000 ** tier; }
      if (tier < 6) return `${value < 0 ? "-" : ""}${scaled.toFixed(2)} ${["", "thousand", "million", "billion", "trillion", "quadrillion"][tier]}`;
    }
    if (abs < 1 && abs >= 1e-5) {
      const decimals = Math.min(8, 2 - Math.floor(Math.log10(abs)));
      return value.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
    }
    let exp = Math.floor(Math.log10(abs));
    let mantissa = value / 10 ** exp;
    if (Math.abs(mantissa).toFixed(2) === "10.00") { mantissa /= 10; exp += 1; }
    return `${mantissa.toFixed(2)}e${exp}`;
  };
  const LENGTHS = [[9.461e24, "Gly"], [9.461e21, "Mly"], [9.461e15, "ly"], [1.496e11, "AU"], [1000, "km"], [1, "m"], [1e-3, "mm"], [1e-6, "µm"], [1e-9, "nm"], [1e-12, "pm"], [1e-15, "fm"], [1e-18, "am"], [1e-21, "zm"], [1e-24, "ym"]];
  const fmtLength = meters => {
    if (meters < 1.616e-35) return `${meters.toExponential(2)} m (smaller than the Planck length)`;
    for (const [size, unit] of LENGTHS) if (meters >= size) return `${fmt(meters / size)} ${unit}`;
    return `${meters.toExponential(2)} m`;
  };
  const schwarzschild = mass => 2 * G * mass / (LIGHT * LIGHT);

  // Real masses in kilograms.
  const REAL = [
    ["Halley's Comet", "☄️", 2.2e14, "The most famous comet, back every 76 years."],
    ["Eris", "🧊", 1.66e22, "A dwarf planet as massive as Pluto, far past Neptune."],
    ["Europa", "🌑", 4.8e22, "An icy moon hiding an ocean beneath its shell."],
    ["Io", "🌋", 8.9e22, "The most volcanic world in the Solar System."],
    ["Titan", "🟠", 1.35e23, "Saturn's moon, with thick air and lakes of methane."],
    ["Uranus", "🔵", 8.68e25, "An ice giant that rolls around the Sun on its side."],
    ["Sirius A", "⭐", 4.0e30, "The brightest star in our night sky."],
    ["Betelgeuse", "🔴", 2.2e31, "A red supergiant that will one day explode."],
    ["Eta Carinae", "💥", 2e32, "An unstable giant star about 100 times the Sun."],
    ["TON 618", "⚫", 1.3e41, "A black hole of about 66 billion Suns."],
    ["Perseus Cluster", "🔭", 1.3e45, "One of the most massive galaxy clusters nearby."],
    ["Coma Cluster", "🔭", 2e45, "Thousands of galaxies, and where dark matter was first suspected."],
    ["Boulder", "🪨", 2e4, "A house-sized rock of about 20 tonnes."],
    ["Blue Whale", "🐋", 1.5e5, "The heaviest animal that has ever lived."],
    ["Jumbo Jet", "✈️", 4e5, "A fully loaded Boeing 747."],
    ["Eiffel Tower", "🗼", 1e7, "About 10,000 tonnes of iron."],
    ["Titanic", "🚢", 5.2e7, "The ocean liner weighed around 52,000 tonnes."],
    ["Empire State Building", "🏙️", 3.3e8, "Roughly 365,000 tonnes of steel and stone."],
    ["Great Pyramid", "🔺", 6e9, "About six million tonnes of limestone."],
    ["Small Asteroid", "☄️", 1e11, "A 100-metre space rock."],
    ["Uluru", "🪨", 3e12, "Australia's giant sandstone monolith."],
    ["Lake Superior", "🌊", 1.2e13, "Holds about 12 trillion tonnes of fresh water."],
    ["Mount Everest", "🏔️", 1.6e14, "Earth's highest mountain above sea level."],
    ["Chicxulub Impactor", "🦖", 1e15, "The ~10 km asteroid that ended the dinosaurs."],
    ["Phobos", "🌑", 1.07e16, "The larger of Mars's two moons."],
    ["Prometheus", "🌑", 1.6e17, "A tiny shepherd moon of Saturn."],
    ["Amalthea", "🌑", 2.1e18, "An inner moon of Jupiter."],
    ["Hyperion", "🌑", 5.6e18, "Saturn's sponge-like, tumbling moon."],
    ["Mimas", "🌑", 3.75e19, "Saturn's 'Death Star' moon."],
    ["Enceladus", "🧊", 1.08e20, "An icy moon that sprays water into space."],
    ["Vesta", "🪨", 2.6e20, "The second-largest object in the asteroid belt."],
    ["Ceres", "🪨", 9.4e20, "The largest asteroid, and a dwarf planet."],
    ["Pluto", "🧊", 1.3e22, "A dwarf planet with a heart-shaped glacier."],
    ["The Moon", "🌙", 7.35e22, "Earth's only natural satellite."],
    ["Ganymede", "🌑", 1.48e23, "The largest moon in the Solar System."],
    ["Mercury", "⚫", 3.3e23, "The smallest planet."],
    ["Mars", "🔴", 6.42e23, "The Red Planet."],
    ["Venus", "🟡", 4.87e24, "Hotter than Mercury, thanks to its thick air."],
    ["Earth", "🌍", 5.97e24, "Home: about 5.97 septillion kilograms."],
    ["Neptune", "🔵", 1.02e26, "An ice giant with supersonic winds."],
    ["Saturn", "🪐", 5.68e26, "Less dense than water."],
    ["Jupiter", "🟠", 1.9e27, "More massive than all other planets combined."],
    ["Brown Dwarf", "🟤", 5e28, "A failed star, roughly 25 Jupiters."],
    ["Proxima Centauri", "🔴", 2.4e29, "The nearest star to the Sun."],
    ["The Sun", "☀️", 1.99e30, "99.86% of the mass of the Solar System."],
    ["Rigel", "💙", 4.2e31, "A blue supergiant, about 21 Suns."],
    ["Orion Nebula", "🌫️", 4e32, "A stellar nursery 1,300 light-years away."],
    ["Pleiades", "✨", 1.6e33, "The Seven Sisters star cluster."],
    ["Westerlund 1", "🎇", 1e35, "A super star cluster packed with giants."],
    ["Messier 13", "🎆", 1.2e36, "A globular cluster of hundreds of thousands of stars."],
    ["Omega Centauri", "🌟", 8e36, "The biggest globular cluster around the Milky Way."],
    ["Sagittarius A*", "⚫", 8.2e36, "The black hole at the centre of our galaxy."],
    ["Fornax Dwarf Galaxy", "🌀", 4e38, "A small galaxy orbiting the Milky Way."],
    ["Sagittarius Dwarf", "🌀", 1e39, "A galaxy being torn apart by the Milky Way."],
    ["Large Magellanic Cloud", "🌀", 2e40, "A satellite galaxy of the southern sky."],
    ["Triangulum Galaxy", "🌀", 1e41, "Third-largest galaxy of the Local Group."],
    ["Andromeda Galaxy", "🌌", 2.4e42, "Our big neighbour, falling toward us."],
    ["The Milky Way", "🌌", 3e42, "Our home galaxy, about 200 billion stars."],
    ["Local Group", "🌠", 1e43, "The galaxy family around the Milky Way."],
    ["Fornax Cluster", "🔭", 1.4e44, "A rich cluster of galaxies."],
    ["Virgo Cluster", "🔭", 2.4e45, "More than a thousand galaxies."],
    ["Shapley Concentration", "🔭", 2e46, "The biggest clump of galaxies nearby."],
    ["Laniakea Supercluster", "🌐", 2e47, "Our home supercluster, 520 million light-years wide."],
    ["Sloan Great Wall", "🧱", 1e49, "A wall of galaxies 1.4 billion light-years long."],
    ["Cosmic Web Filament", "🕸️", 1e50, "The threads that hold the universe together."],
    ["Huge-LQG", "🕸️", 3e51, "One of the largest known structures."],
    ["Hercules–Corona Borealis Wall", "🧱", 1.5e52, "Possibly the largest structure we know of."],
    ["The Observable Universe", "🌌", UNIVERSE_MASS, "Everything we can see: about 1.5e53 kg of ordinary matter."]
  ];
  const SMALL = [
    ["Electron", "⚡", 9.109e-31, "The lightest particle you can weigh on a scale of atoms."],
    ["Muon", "🟣", 1.884e-28, "A heavy cousin of the electron that lives for two microseconds."],
    ["Proton", "➕", 1.6726e-27, "The positive heart of every hydrogen atom."],
    ["Hydrogen Atom", "⚛️", 1.674e-27, "The most common atom in the universe."],
    ["Deuterium Atom", "⚛️", 3.344e-27, "Heavy hydrogen with an extra neutron."],
    ["Hydrogen Molecule (H₂)", "🎈", 3.348e-27, "Two hydrogen atoms bonded together."],
    ["Helium Atom", "🎈", 6.646e-27, "Forged in the first minutes after the Big Bang."],
    ["Lithium Atom", "🔋", 1.152e-26, "The lightest metal."],
    ["Carbon Atom", "⚫", 1.994e-26, "The backbone of all known life."],
    ["Nitrogen Atom", "💨", 2.326e-26, "Makes up 78% of the air you breathe."],
    ["Oxygen Atom", "🫧", 2.657e-26, "Made inside massive stars."],
    ["Methane Molecule", "🔥", 2.66e-26, "Natural gas: one carbon with four hydrogens."],
    ["Ammonia Molecule", "🧴", 2.83e-26, "One nitrogen and three hydrogens."],
    ["Water Molecule", "💧", 2.99e-26, "H₂O: two hydrogens and an oxygen."],
    ["Neon Atom", "💡", 3.35e-26, "Glows red-orange when electrified."],
    ["Sodium Atom", "🧂", 3.82e-26, "A soft, explosive metal."],
    ["Silicon Atom", "💻", 4.66e-26, "The stuff of sand and microchips."],
    ["Carbon Dioxide Molecule", "☁️", 7.31e-26, "What you breathe out."],
    ["Ethanol Molecule", "🍷", 7.65e-26, "The alcohol in drinks."],
    ["Iron Atom", "🔩", 9.27e-26, "The end of the line for fusion in stars."],
    ["Salt Unit (NaCl)", "🧂", 9.7e-26, "One sodium and one chlorine ion."],
    ["Copper Atom", "🪙", 1.055e-25, "Conducts electricity very well."],
    ["Silver Atom", "🥈", 1.79e-25, "The best electrical conductor of all metals."],
    ["Glucose Molecule", "🍬", 2.99e-25, "Blood sugar: the fuel of your cells."],
    ["Caffeine Molecule", "☕", 3.22e-25, "Why your coffee wakes you up."],
    ["Gold Atom", "🥇", 3.27e-25, "Forged when neutron stars collide."],
    ["Lead Atom", "⚓", 3.44e-25, "Dense, soft, and stable."],
    ["Uranium Atom", "☢️", 3.95e-25, "One of the heaviest atoms found in nature."],
    ["Penicillin Molecule", "💊", 5.55e-25, "The first true antibiotic."],
    ["Cholesterol Molecule", "🧈", 6.43e-25, "Essential to every cell membrane."],
    ["Chlorophyll Molecule", "🌿", 1.48e-24, "Catches sunlight for plants."],
    ["Vitamin B12", "💉", 2.25e-24, "One of the largest vitamins."],
    ["Insulin", "🩸", 9.64e-24, "A small protein that regulates blood sugar."],
    ["Hemoglobin", "🔴", 1.07e-22, "The protein that carries oxygen in your blood."],
    ["Antibody (IgG)", "🛡️", 2.49e-22, "A Y-shaped protein that tags invaders."],
    ["Rubisco", "🍃", 8.97e-22, "Possibly the most abundant protein on Earth."],
    ["Ribosome", "🧬", 4.15e-21, "A molecular machine that builds proteins."],
    ["Titin", "🧵", 6.3e-21, "The largest known protein, in your muscles."],
    ["Poliovirus", "🦠", 1.41e-20, "A simple virus about 30 nanometres wide."],
    ["Influenza Virion", "🤧", 3e-19, "One flu virus particle."],
    ["T4 Bacteriophage", "🔬", 3.3e-19, "A virus that looks like a lunar lander."],
    ["Mimivirus", "🦠", 2e-16, "A giant virus as large as some bacteria."],
    ["Human Chromosome 21", "🧬", 5e-17, "The DNA in the smallest human chromosome."],
    ["E. coli Bacterium", "🦠", 1e-15, "About one picogram."],
    ["Red Blood Cell", "🩸", 2.7e-14, "Your body makes two million every second."],
    ["Yeast Cell", "🍞", 6e-14, "The microbe that makes bread and beer."],
    ["Human Cell", "🧫", 2.5e-12, "A typical cell is a few nanograms."],
    ["Pollen Grain", "🌼", 1e-11, "A speck from a flower."],
    ["Egg Cell", "🥚", 5e-10, "The largest cell in the human body."],
    ["Paramecium", "🧫", 5e-9, "A single-celled swimmer you can just see."],
    ["Dust Mite", "🕷️", 1.5e-8, "Lives in your bedding."],
    ["Grain of Sand", "🏖️", 1e-6, "About a milligram."],
    ["Ant", "🐜", 3e-6, "A few milligrams of tireless worker."],
    ["Raindrop", "🌧️", 5e-6, "A small falling drop of water."],
    ["Grain of Rice", "🍚", 2.5e-5, "About 25 milligrams."],
    ["Honeybee", "🐝", 1e-4, "Weighs a tenth of a gram."],
    ["Paperclip", "📎", 1e-3, "About one gram."],
    ["Penny", "🪙", 2.5e-3, "A US one-cent coin."],
    ["Mouse", "🐭", 2e-2, "A small rodent."],
    ["Chicken Egg", "🥚", 5.8e-2, "A breakfast staple."],
    ["Apple", "🍎", 0.18, "A medium apple."],
    ["Brick", "🧱", 2.5, "A common clay brick."],
    ["House Cat", "🐈", 4.5, "A very tiny predator."],
    ["Bowling Ball", "🎳", 7, "A heavy sphere."],
    ["Human", "🧍", 70, "An average adult."],
    ["Grand Piano", "🎹", 480, "Heavy and expensive."],
    ["Car", "🚗", 1500, "A small family car."],
    ["Elephant", "🐘", 5000, "The largest land animal."]
  ];
  const TIERS = [...SMALL, ...REAL].sort((a, b) => a[2] - b[2]).map(([name, icon, mass, fact], index) => ({ name, icon, mass, fact, stage: 0, index }));
  const ERAS = [[0, "⚛️ Atomic Age"], [3e-26, "🧪 Molecular Age"], [3e-24, "🧬 Protein Age"], [1e-20, "🦠 Viral Age"], [1e-15, "🔬 Cellular Age"], [1e-6, "🐜 Tiny Creature Age"], [1e-2, "🧍 Human Scale"], [1e4, "🏗️ Monument Age"], [1e11, "☄️ Asteroid Age"], [1e17, "🌑 Moon Age"], [1e23, "🪐 Planet Age"], [1e30, "☀️ Stellar Age"], [1e34, "✨ Cluster Age"], [1e38, "🌀 Galaxy Age"], [1e43, "🔭 Supercluster Age"], [1e47, "🕸️ Cosmic Web Age"], [UNIVERSE_MASS, "🫧 Multiverse Age"]];
  const eraOf = mass => ERAS.reduce((best, era, index) => (mass >= era[0] ? index : best), 0);
  const STAGE1_NAMES = ["Neighbouring Universe", "Twin Universes", "Universe Cluster", "Universe Filament", "Foam Bubble", "Brane Sheet", "Brane Stack", "Landscape Valley", "Vacuum Bubble", "Inflation Zone", "Eternal Domain", "Bubble Chain"];
  const STAGE1_STEP = Math.pow(1e100 / UNIVERSE_MASS, 1 / 36);
  for (let step = 1; step <= 36; step += 1) {
    const cycle = Math.floor((step - 1) / 12);
    const base = STAGE1_NAMES[(step - 1) % 12];
    TIERS.push({ name: cycle ? `${base} ${["", "II", "III"][cycle]}` : base, icon: ["🫧", "🔮", "💠", "🌐"][step % 4], mass: UNIVERSE_MASS * STAGE1_STEP ** step, fact: "A fictional slice of the multiverse, many universes at a time.", stage: 1, index: TIERS.length });
  }
  const SPIN_E = 5000;
  // Added after launch: if the tier list grows, saved "found" counts (keyed by tier index) must be remapped.
  const TIER_VERSION = 2;
  const NEW_TIER_NAMES = new Set(["Halley's Comet", "Eris", "Europa", "Io", "Titan", "Uranus", "Sirius A", "Betelgeuse", "Eta Carinae", "TON 618", "Perseus Cluster", "Coma Cluster"]);
  const remapFound = found => {
    const old = TIERS.filter(tier => !NEW_TIER_NAMES.has(tier.name));
    const next = {};
    Object.keys(found || {}).forEach(key => { const tier = old[Number(key)]; if (tier) next[tier.index] = found[key]; });
    return next;
  };
  const COST_UNIT = 20;
  const SPIN_SLOPE = 0.03;
  const STAGE1_SOFT = 6;
  const DEPTH_GROWTH = 4;
  const LEVEL_GROWTH = 5;
  // Spin is earned from growth itself (per e-fold of mass), so it can't be farmed by eating faster.
  const spinPerFold = mass => SPIN_E * 10 ** (SPIN_SLOPE * Math.log10(Math.max(mass, START_MASS) / START_MASS));

  const STRANGER_SCENE = [
    { text: "The last speck of the observable universe slips past your horizon. Every star, every galaxy. Gone." },
    { text: "For the first time you feel full. And something else... something watching." },
    { who: "???", text: "Well. That was thorough." },
    { who: "???", text: "I have seen black holes before. None of them ever finished the meal." },
    { who: "???", text: "Did you think this was all there was? Your universe is one bubble in a foam of countless others." },
    { who: "???", text: "I can open the way. You only have to keep eating." },
    { text: "A rift tears open in the dark. Beyond it: more." }
  ];
  const MULTIVERSE_SCENE = [
    { text: "The last universe collapses into you. Every timeline. Every possibility. Every version of everything." },
    { who: "The Stranger", text: "...You actually did it." },
    { who: "The Stranger", text: "I am sorry. I should have told you what happens to something that eats everything." },
    { who: "The Stranger", text: "There is nothing left to feed on. And a black hole that cannot eat cannot hold itself together." },
    { text: "The stranger turns away. Slowly, they fade. The first thing you ever truly lost." },
    { text: "Hawking radiation. Quietly, you begin to leak away." }
  ];
  const END_SCENE = [
    { text: "At the very end you weigh no more than the atom you started as. Then even that is gone." },
    { text: "The last of you slips out as light." },
    { text: "A faint glow. Then nothing." },
    { text: "Somewhere in the dark, a single spark drifts on, finally free." }
  ];
  const WHISPERS = ["It is so quiet.", "You remember the taste of the first boulder.", "Somewhere, a single photon escapes. Then another.", "You are lighter than you have ever been.", "You wonder if anything out there will remember you.", "The stranger was right. Nothing lasts.", "It was not so bad, being hungry.", "Thank you for the meal."];
  const STRANGER_QUOTES = ["\"Do not stop now. There are more of them.\"", "\"Each universe tastes a little different, don't you think?\"", "\"I have waited a long time for someone like you.\"", "\"Faster. The foam is thinning.\"", "\"Almost there. Do you feel it? The hunger getting quieter?\"", "\"Whatever happens after this... remember I tried to warn you.\""];

  // ---------- Skill tree (radial) ----------
  const pct = value => `${Math.round(value * 1000) / 10}%`;
  const num = value => (Number.isInteger(value) ? String(value) : value.toFixed(1));
  const STAT_NOUN = { eventRate: "Anomaly Lure", eventTime: "Anomaly Duration", synergy: "Keystone", yield: "Absorption", spin: "Rotation", reach: "Reach", spawn: "Abundance", grab: "Grab Range", cap: "Crowding", pull: "Gravitation", drift: "Infall", drone: "Drones", droneSpeed: "Thrust", multi: "Grip", cursor: "Magnetism", echo: "Echo", combo: "Chain", tempo: "Cadence", nova: "Nova", stardust: "Stardust", crit: "Luck", critPow: "Impact", accretion: "Accretion", exotic: "Strangeness", offline: "Slumber", discount: "Thrift" };
  const STAT_TEXT = {
    yield: v => `+${pct(v)} mass absorbed from every object`,
    spin: v => `+${pct(v)} Spin from every object`,
    reach: v => `Objects up to ${(Math.min(1, BASE_REACH * (1 + v)) * 100).toPrecision(2)}% of your own mass can be swallowed per gulp`,
    spawn: v => `Objects respawn ${pct(v)} faster`,
    grab: v => `+${pct(v)} gravity field size: hold to pull things toward your cursor`,
    cap: v => `+${num(v)} max objects floating in space at once`,
    pull: v => `+${pct(v)} gravity range`,
    drift: v => `+${pct(v)} pull strength, so objects fall in faster`,
    drone: v => `+${num(v)} auto-feeder drone${v === 1 ? "" : "s"}`,
    droneSpeed: v => `Drones work ${pct(v)} faster`,
    multi: v => `Cursor gravity +${num(v * 25)}% stronger`,
    cursor: v => `Cursor gravity +${pct(v)} stronger`,
    echo: v => `${pct(Math.min(0.9, v))} chance a swallow echoes and is counted twice (x2 mass)`,
    combo: v => `Swallow again within the combo window to chain: +${pct(v)} mass per stack (up to 20 stacks)`,
    tempo: v => `Combo window +${num(v)}s longer`,
    nova: v => `Every ${Math.max(6, 60 / (1 + 4 * v)).toFixed(0)}s a Nova automatically swallows everything on screen`,
    stardust: v => `${pct(Math.min(0.5, v))} chance a swallow drops x10 Spin`,
    crit: v => `+${pct(v)} chance of a gulp (x5 mass)`,
    critPow: v => `Gulps hit +${num(v)} harder`,
    accretion: v => `Your mass grows by ${(v * ACC_RATE * 100).toFixed(4)}% every second on its own`,
    exotic: v => `+${pct(v)} chance an object is Exotic (x25 mass)`,
    offline: v => `+${pct(v)} offline gains`,
    eventRate: v => `Special anomalies appear ${pct(v)} more often`,
    eventTime: v => `Anomaly boosts last +${num(v * EVENT_SECONDS)}s longer`,
    synergy: v => `Keystone: x${(1.2 ** v).toFixed(2)} mass and x${(1.15 ** v).toFixed(2)} Spin from everything`,
    discount: v => `Skills cost ${((1 - 0.985 ** v) * 100).toFixed(1)}% less`
  };
  const FLAG_TEXT = { ring: "a bright photon ring", corona: "a pulsing hot corona", jets: "relativistic jets", lensing: "gravitational lensing", halo: "a soft outer halo", trails: "glowing object trails", sparkle: "twinkling sparks", dust: "a denser accretion disk", aurora: "an aurora around the horizon", bloom: "a brilliant bloom" };

  const BRANCHES = [
    { id: "feed", name: "Feeding", color: "#ff9d4a", spine: [["Wider Maw", "🕳️", "yield", 0.25], ["Tidal Shearing", "🌊", "yield", 0.35], ["Digestive Furnace", "🔥", "yield", 0.5], ["Photon Capture", "💡", "yield", 0.7], ["Full-Spectrum Feast", "🌈", "yield", 1], ["Matter Compression", "🗜️", "yield", 1.4], ["Degenerate Feast", "⚛️", "yield", 2], ["Singularity Heart", "💜", "yieldX", 0.15], ["Cosmic Appetite", "👄", "yield", 4], ["The Great Gulp", "🌌", "yieldX", 0.25]] },
    { id: "grav", name: "Gravity", color: "#6ea8ff", spine: [["Gravity Well", "🧲", "pull", 0.2], ["Tidal Pull", "🌀", "drift", 0.3], ["Cursor Magnet", "🧲", "cursor", 0.5], ["Frame Dragging", "🔄", "drift", 0.5], ["Spacetime Funnel", "🌪️", "pull", 0.5], ["Horizon Stretch", "📏", "drift", 0.8], ["Gravitational Lens", "🔭", "pull", 0.8], ["Accretion Vortex", "🌀", "drift", 1.2], ["Magnetar Cursor", "🚀", "cursor", 0.8], ["Cosmic Whirlpool", "🌊", "drift", 2]] },
    { id: "reach", name: "Reach", color: "#7dffb0", costMult: 0.6, spine: [["Heavier Targets", "🏋️", "reach", 0.25], ["Busier Space", "🌠", "cap", 1], ["Faster Spawns", "⏱️", "spawn", 0.3], ["Long Fingers", "🖐️", "grab", 0.3], ["Bigger Appetite", "🍖", "reach", 0.4], ["Crowded Orbit", "🪐", "cap", 2], ["Debris Fields", "☄️", "spawn", 0.5], ["Wide Grip", "🤲", "grab", 0.5], ["Stellar Nursery", "⭐", "cap", 3], ["Tide of Worlds", "🌍", "reach", 1]] },
    { id: "auto", name: "Automation", color: "#ffe066", spine: [["Tug Drone", "🤖", "drone", 1], ["Better Thrusters", "🔧", "droneSpeed", 0.3], ["Net Grabber", "🕸️", "multi", 1], ["Drone Swarm", "🐝", "drone", 1], ["Overclocked Drones", "⚙️", "droneSpeed", 0.5], ["Wide Net", "🪢", "multi", 1], ["Drone Fleet", "🛸", "drone", 2], ["Quantum Thrusters", "⚡", "droneSpeed", 0.8], ["Tractor Cloud", "☁️", "multi", 2], ["Autonomous Armada", "🚁", "drone", 3]] },
    { id: "spin", name: "Spin", color: "#d28bff", spine: [["Angular Momentum", "🔃", "spin", 0.25], ["Kerr Rotation", "💫", "spin", 0.4], ["Ergosphere", "🔶", "discount", 1], ["Penrose Process", "🌟", "spin", 0.7], ["Spin Resonance", "🎶", "spin", 1], ["Efficiency Matrix", "🧮", "discount", 2], ["Frame-Drag Engine", "⚙️", "spin", 1.5], ["Maximal Kerr", "🌀", "spin", 2.5], ["Spinning Cosmos", "🔄", "discount", 3], ["Perpetual Motion", "♾️", "spin", 5]] },
    { id: "acc", name: "Accretion", color: "#ff6b6b", spine: [["Accretion Disk", "💿", "accretion", 1], ["Hot Corona", "🔥", "accretion", 1.5], ["Magnetic Funnels", "🧲", "offline", 0.2], ["Viscous Spiral", "🌀", "accretion", 2], ["Disk Winds", "💨", "accretion", 3], ["Eternal Feast", "🍽️", "offline", 0.4], ["Quasar Mode", "✨", "accretion", 5], ["Radiative Efficiency", "☀️", "accretion", 8], ["Slumber Feeding", "😴", "offline", 0.6], ["Endless Hunger", "🕳️", "accretion", 15]] },
    { id: "exo", name: "Exotic", color: "#ff7ad9", costMult: 1.2, spine: [["Rogue Objects", "🪨", "exotic", 0.02], ["Lucky Gulp", "🍀", "crit", 0.04], ["Heavy Gulp", "💥", "critPow", 0.3], ["Dark Matter Lure", "🌑", "exotic", 0.03], ["Chain Reaction", "⛓️", "crit", 0.05], ["Supernova Gulp", "🎆", "critPow", 0.5], ["Antimatter Bait", "⚗️", "exotic", 0.05], ["Cosmic Jackpot", "🎰", "crit", 0.08], ["Strange Matter", "🧪", "critPow", 0.8], ["Exotic Overflow", "🌠", "exotic", 0.1]] },
    { id: "echo", name: "Echo", color: "#5ee6ff", costMult: 0.9, spine: [["Faint Echo", "🔊", "echo", 0.03], ["Rhythm", "🥁", "combo", 0.01], ["Resonance", "📣", "echo", 0.03], ["Slow Fade", "⌛", "tempo", 0.5], ["Reverb", "🌊", "echo", 0.04], ["Crescendo", "🎼", "combo", 0.015], ["Hall of Mirrors", "🪞", "echo", 0.05], ["Sustain", "🎹", "tempo", 1], ["Infinite Echo", "♾️", "echo", 0.06], ["Symphony", "🎻", "combo", 0.02]] },
    { id: "nova", name: "Nova", color: "#ff5c8a", costMult: 1.1, spine: [["Nova Seed", "💥", "nova", 0.25], ["Stardust Veil", "✨", "stardust", 0.02], ["Shockwave", "🌋", "nova", 0.3], ["Cosmic Dust", "🪄", "stardust", 0.03], ["Blast Wave", "🎇", "nova", 0.4], ["Stellar Forge", "⚒️", "stardust", 0.04], ["Supernova", "🌟", "nova", 0.5], ["Dust Storm", "🌪️", "stardust", 0.05], ["Hypernova", "☀️", "nova", 0.7], ["Stardust Jackpot", "🎰", "stardust", 0.06]] },
    { id: "vis", name: "Appearance", color: "#9bf0ff", costMult: 0.7, spine: [["Photon Ring", "⭕", "vis", 0.15, "ring"], ["Hot Corona Glow", "🔥", "vis", 0.15, "corona"], ["Relativistic Jets", "🌠", "vis", 0.15, "jets"], ["Lensing Mirror", "🔮", "vis", 0.15, "lensing"], ["Soft Halo", "💫", "vis", 0.15, "halo"], ["Comet Trails", "☄️", "vis", 0.15, "trails"], ["Sparks", "✨", "vis", 0.15, "sparkle"], ["Dense Disk", "💿", "vis", 0.15, "dust"], ["Aurora", "🌈", "vis", 0.15, "aurora"], ["Brilliant Bloom", "🌟", "vis", 0.15, "bloom"]] },
    { id: "anom", name: "Anomalies", color: "#ffb347", costMult: 0.8, spine: [["Anomaly Lure", "🧿", "eventRate", 0.15], ["Lingering Effect", "⏳", "eventTime", 0.1], ["Strange Beacon", "📡", "eventRate", 0.2], ["Time Dilation", "🕰️", "eventTime", 0.15], ["Rift Magnet", "🧲", "eventRate", 0.25], ["Stasis Field", "🛡️", "eventTime", 0.2], ["Chaos Caller", "🌪️", "eventRate", 0.3], ["Frozen Moment", "❄️", "eventTime", 0.25], ["Fate Weaver", "🧵", "eventRate", 0.4], ["Eternal Boon", "♾️", "eventTime", 0.3]] }
  ];
  const SPINE_LEN = 60;
  const RIFT_START = 26;
  const BAND_NAMES = ["", "Deep ", "Abyssal ", "Eternal ", "Primordial ", "Transcendent ", "Ultimate "];
  const KEYSTONES = {
    feed: ["Event Horizon Feast", "Heart of the Maw"], grav: ["Tidal Sovereign", "Curve of Space"], reach: ["Cosmic Net", "Harvest of Worlds"],
    auto: ["Hive Mind", "Machine Gods"], spin: ["Kerr Crown", "Eternal Whirl"], acc: ["Quasar Throne", "Endless Furnace"],
    exo: ["Strange Fortune", "Dark Jackpot"], echo: ["Eternal Chorus", "Voice of the Void"], nova: ["Star Breaker", "Dying Light"], anom: ["Omen Keeper", "Fate Engine"], vis: ["Radiant Beacon", "Brilliant Legend"]
  };
  const MINOR_OF = { yieldX: ["yield", 0.12], vis: ["yield", 0.08], drone: ["droneSpeed", 0.2], multi: ["cap", 0.5] };

  const NODES = [];
  const NODE = {};
  const addNode = node => { NODES.push(node); NODE[node.id] = node; };
  addNode({ id: "root", name: "Singularity", icon: "⚫", x: 0, y: 0, root: true, max: 1, stage: 0, text: () => "The seed of everything. Every path starts here." });
  BRANCHES.forEach((branch, k) => {
    const theta = -Math.PI / 2 + k * TAU / BRANCHES.length;
    for (let j = 0; j < SPINE_LEN; j += 1) {
      const rift = j >= RIFT_START;
      const band = Math.floor(j / 10);
      let [name, icon, stat, per, flag] = branch.spine[j % 10];
      if (rift || band) {
        name = `${rift ? "Rift " : ""}${BAND_NAMES[band]}${name}`;
        if (stat === "vis") { stat = "yield"; per = 0.3; flag = undefined; } else per *= 1.6 ** band * (rift ? 1.4 : 1);
      }
      const radius = 125 + j * 105;
      const base = 1.5 * DEPTH_GROWTH ** j * (branch.costMult || 1);
      const id = `${branch.id}${j}`;
      addNode({ id, name, icon, branch, stat, per, flag, base, growth: LEVEL_GROWTH, parent: j ? `${branch.id}${j - 1}` : "root", x: Math.cos(theta) * radius, y: Math.sin(theta) * radius, stage: rift ? 1 : 0, max: flag ? 1 : Infinity, big: true });
      if (j % 5 === 4 && !rift) {
        const nth = Math.floor(j / 5);
        const angle = theta + (k % 2 ? -1 : 1) * Math.min(0.26, 70 / radius) * 2.2;
        addNode({ id: `${id}k`, name: `${KEYSTONES[branch.id][nth % 2]}${nth > 1 ? ` ${["", "", "II", "III", "IV", "V"][Math.floor(nth / 2) + 1] || ""}`.trimEnd() : ""}`, icon: "🔱", branch, stat: "synergy", per: 1, base: base * 8, growth: 1, parent: id, x: Math.cos(angle) * (radius + 30), y: Math.sin(angle) * (radius + 30), stage: 0, max: 1, big: true, keystone: true });
      }
      if (j < 1 || (j > 22 && j % 2)) continue;
      const [mStat, mPer] = MINOR_OF[stat] || [stat, per * 0.4];
      const delta = Math.min(0.26, 70 / radius);
      [-1, 1].forEach((side, sideIndex) => {
        const angle = theta + side * delta;
        addNode({ id: `${id}${sideIndex ? "b" : "a"}`, name: `${STAT_NOUN[mStat]} ${j + 1}${sideIndex ? "B" : "A"}`, icon, branch, stat: mStat, per: mPer, base: base * 0.5, growth: LEVEL_GROWTH - 0.1, parent: id, x: Math.cos(angle) * (radius + 36), y: Math.sin(angle) * (radius + 36), stage: rift ? 1 : 0, max: Infinity });
      });
    }
  });

  // ---------- Styles ----------
  const css = `
  #vfRoot { position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column; color: #ece9ff; font-family: inherit; background: #04030a; overflow: hidden; user-select: none; }
  #vfRoot.hidden { display: none; }
  #vfRoot button { font-family: inherit; }
  #vfStage { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: default; }
  .vf-top { position: relative; z-index: 6; display: flex; align-items: center; gap: 10px; padding: 9px 14px; background: #05030cb3; backdrop-filter: blur(8px); border-bottom: 1px solid #ffffff18; }
  .vf-top h2 { margin: 0 8px 0 0; font-size: 15px; letter-spacing: .06em; white-space: nowrap; }
  .vf-tabs { display: flex; gap: 6px; flex: 1; flex-wrap: wrap; }
  .vf-btn, .vf-tab { border: 1px solid #ffffff2e; border-radius: 9px; padding: 6px 12px; color: #fff; background: #ffffff12; font-size: 12px; font-weight: 700; cursor: pointer; }
  .vf-tnode.keystone { box-shadow: 0 0 10px 2px #ffd54a99; border-color: #ffd54a; }
  .vf-btn:hover:not(:disabled), .vf-tab:hover { background: #ffffff26; }
  .vf-btn:disabled { opacity: .45; cursor: not-allowed; }
  .vf-tab[aria-pressed="true"] { background: var(--acc, #ff8a3a); border-color: #fff8; color: #120a05; }
  .vf-spin { font-size: 13px; font-weight: 800; color: #e7c8ff; white-space: nowrap; }
  .vf-hud { position: absolute; left: 16px; top: 62px; z-index: 3; max-width: min(92vw, 420px); pointer-events: none; text-shadow: 0 2px 12px #000; }
  .vf-era { font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--acc, #ff8a3a); margin-bottom: 4px; }
  .vf-mass { font-size: clamp(24px, 4vw, 38px); font-weight: 800; letter-spacing: .01em; }
  .vf-sub { font-size: 12px; opacity: .78; margin-top: 2px; }
  .vf-buffs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .vf-buff { padding: 4px 10px; border-radius: 999px; border: 2px solid var(--c); background: #120a28d0; font-size: 12px; font-weight: 700; }
  .vf-feed { margin-top: 10px; font-size: 12px; color: #ffd9a8; min-height: 16px; }
  .vf-bottom { position: absolute; left: 0; right: 0; bottom: 16px; z-index: 3; display: grid; justify-items: center; gap: 8px; padding: 0 16px; pointer-events: none; }
  .vf-goal { width: min(92vw, 520px); display: grid; gap: 4px; text-align: center; font-size: 12px; opacity: .92; }
  .vf-goalbar { height: 8px; border-radius: 6px; background: #ffffff18; overflow: hidden; }
  .vf-goalbar div { height: 100%; width: 0; border-radius: 6px; background: linear-gradient(90deg, var(--d2, #ff5e3a), var(--d1, #ffb347)); box-shadow: 0 0 10px var(--glow, #ff8a3a88); transition: width .4s; }
  .vf-hint { font-size: 14px; font-weight: 700; color: #fff; padding: 8px 14px; border-radius: 12px; background: #0008; animation: vfPulse 1.8s ease-in-out infinite; }
  @keyframes vfPulse { 50% { opacity: .55; } }
  .vf-stranger { display: flex; align-items: center; gap: 10px; max-width: 460px; animation: vfIn 1.2s ease both; }
  .vf-stranger.hidden, .vf-goal.hidden, .vf-hint.hidden { display: none; }
  .vf-figure { font-size: 36px; filter: drop-shadow(0 0 10px #ff4fd8); }
  .vf-bubble { padding: 8px 12px; border: 1px solid #ffffff22; border-radius: 12px; background: #000a; font-size: 13px; font-style: italic; text-align: left; }
  .vf-whisper { font-size: 15px; font-style: italic; min-height: 20px; opacity: .9; }
  .swap { animation: vfIn .8s ease both; }
  @keyframes vfIn { from { opacity: 0; transform: translateY(6px); } }
  .vf-panel { position: absolute; left: 0; right: 0; top: 47px; bottom: 0; z-index: 5; background: #05030ce8; backdrop-filter: blur(5px); }
  .vf-panel.hidden { display: none; }
  .vf-up { position: absolute; inset: 0; display: flex; flex-direction: column; background: #05030c; }
  .vf-bsel { display: flex; gap: 8px; padding: 10px 14px; overflow-x: auto; flex: none; scrollbar-width: none; background: #0a061aee; border-bottom: 1px solid #ffffff12; }
  .vf-bpick { position: relative; flex: none; display: flex; align-items: center; gap: 8px; padding: 6px 14px 6px 8px; border-radius: 999px; border: 1px solid #ffffff22; background: #140c2a; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; }
  .vf-bpick .bi { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: 16px; background: #05030c; border: 2px solid var(--c); }
  .vf-bpick.on { background: color-mix(in srgb, var(--c) 30%, #140c2a); border-color: var(--c); box-shadow: 0 0 16px color-mix(in srgb, var(--c) 55%, transparent); }
  .vf-bpick.has::after { content: ""; position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; border-radius: 50%; background: #ffd54a; box-shadow: 0 0 8px #ffd54a; }
  .vf-sky { flex: 1; position: relative; overflow: hidden; cursor: grab; touch-action: none; background:
    radial-gradient(1.2px 1.2px at 12% 18%, #fff9, transparent), radial-gradient(1px 1px at 33% 72%, #fff8, transparent), radial-gradient(1.4px 1.4px at 58% 36%, #fffb, transparent), radial-gradient(1px 1px at 81% 61%, #fff8, transparent), radial-gradient(1.2px 1.2px at 92% 12%, #fff9, transparent), radial-gradient(1px 1px at 46% 90%, #fff7, transparent),
    radial-gradient(ellipse at 30% 25%, color-mix(in srgb, var(--c) 24%, transparent), transparent 55%), radial-gradient(ellipse at 75% 75%, color-mix(in srgb, var(--c) 16%, transparent), transparent 60%), #05030c;
    background-size: 260px 260px, 310px 310px, 370px 370px, 290px 290px, 340px 340px, 230px 230px, 100% 100%, 100% 100%, auto; }
  .vf-sky.drag { cursor: grabbing; }
  .vf-map { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0; will-change: transform; }
  .vf-map svg { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; pointer-events: none; }
  .vf-map line { stroke: #ffffff22; stroke-width: 2; stroke-dasharray: 3 7; stroke-linecap: round; }
  .vf-map line.lit { stroke: var(--c); stroke-width: 3; stroke-dasharray: none; filter: drop-shadow(0 0 4px var(--c)); }
  .vf-map.far .nm { display: none; }
  .vf-zoomb { position: absolute; right: 12px; bottom: 170px; display: grid; gap: 6px; z-index: 4; }
  .vf-st { position: absolute; transform: translate(-50%, -50%); width: 58px; height: 58px; padding: 0; border: 0; border-radius: 50%; background: radial-gradient(circle, #1a1040 55%, #0a0618); color: #fff; display: grid; place-items: center; cursor: pointer; font-size: 24px; line-height: 1; box-shadow: 0 0 0 2px #ffffff30; }
  .vf-st.minor { width: 36px; height: 36px; font-size: 15px; }
  .vf-st.keystone { width: 66px; height: 66px; border-radius: 0; clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); background: #3a2a05; box-shadow: none; font-size: 22px; }
  .vf-st.keystone.open { background: radial-gradient(circle, #ffe59a, #b9831a); }
  .vf-st .ic { pointer-events: none; }
  .vf-st .lv { position: absolute; right: -4px; bottom: -6px; min-width: 18px; padding: 1px 5px; border-radius: 10px; background: var(--c); color: #0a0612; font-size: 11px; font-weight: 800; pointer-events: none; }
  .vf-st .lv:empty, .vf-st.keystone .lv { display: none; }
  .vf-st.locked { opacity: .35; }
  .vf-st.open { box-shadow: 0 0 0 2px var(--c); }
  .vf-st.owned { box-shadow: 0 0 0 2px var(--c), 0 0 18px 3px var(--c); background: radial-gradient(circle, #2c1a66 50%, #120a2e); }
  .vf-st.afford { box-shadow: 0 0 0 3px #fff, 0 0 20px 5px var(--c); }
  .vf-st.sel { box-shadow: 0 0 0 3px #fff, 0 0 24px 7px #fff8; }
  .vf-st.pop { filter: brightness(1.9); }
  .vf-st .nm { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 6px; width: 110px; font-size: 11px; line-height: 1.15; text-align: center; text-shadow: 0 1px 6px #000, 0 0 8px #000; pointer-events: none; opacity: .9; }
  .vf-st.minor .nm { display: none; }
  .vf-st.locked .nm { visibility: hidden; }
  .vf-start { position: absolute; transform: translate(-50%, -50%); width: 30px; height: 30px; border-radius: 50%; background: #000; box-shadow: 0 0 0 2px var(--c), 0 0 18px var(--c); }
  .vf-pick { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); width: min(94vw, 600px); display: grid; gap: 4px; padding: 12px 14px; border: 1px solid #ffffff2a; border-radius: 14px; background: #120a28f5; z-index: 3; }
  .vf-pick b { font-size: 15px; }
  .vf-pick small { font-size: 12px; opacity: .88; }
  .vf-pick .next { color: #9bf0b0; opacity: 1; }
  .vf-pick .cost { color: #ffd54a; font-weight: 800; opacity: 1; }
  .vf-pick .row { display: flex; gap: 8px; margin-top: 4px; }
  .vf-cat { position: absolute; inset: 0; overflow-y: auto; padding: 18px; }
  .vf-cat h3 { margin: 0 0 12px; font-size: 15px; }
  .vf-catgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
  .vf-card { display: grid; grid-template-columns: 40px 1fr; gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid #ffffff1c; border-radius: 12px; background: #ffffff0a; }
  .vf-card.unknown { opacity: .4; }
  .vf-card.known { cursor: pointer; }
  .vf-card.known:hover { background: #ffffff1a; border-color: #ffffff44; }
  .vf-tap { color: #9bf0ff; margin-top: 2px; }
  .vf-cattabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 12px; }
  .vf-detail { position: absolute; inset: 0; z-index: 4; display: grid; place-items: center; background: #03020aD0; padding: 12px; }
  .vf-detailcard { position: relative; width: min(94vw, 520px); max-height: 92%; overflow: auto; padding: 16px; border: 1px solid #ffffff2a; border-radius: 16px; background: #120a28; display: grid; gap: 8px; }
  .vf-close { position: absolute; right: 10px; top: 10px; }
  .vf-dhead { display: flex; gap: 12px; align-items: center; padding-right: 40px; }
  .vf-dhead .ic { font-size: 38px; }
  .vf-dhead b { display: block; font-size: 18px; }
  .vf-dhead small, .vf-note { opacity: .7; font-size: 11px; }
  .vf-fact { margin: 0; font-size: 13px; opacity: .9; }
  .vf-more { margin: 0; font-size: 13px; line-height: 1.5; opacity: .9; }
  .vf-detailcard h4 { margin: 6px 0 0; font-size: 13px; color: #ffd54a; }
  .vf-modes { display: flex; gap: 6px; }
  .vf-modes .vf-btn[aria-pressed="true"] { background: #7c4dff; }
  .vf-view { background: radial-gradient(circle, #1a1038, #07040f); border-radius: 12px; padding: 6px; }
  .vf-struct { width: 100%; max-height: 320px; display: block; }
  .vf-props { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; font-size: 12px; }
  .vf-props span { opacity: .65; }
  .vf-card .ic { font-size: 28px; text-align: center; }
  .vf-card b { display: block; font-size: 13px; }
  .vf-card small { display: block; font-size: 11px; opacity: .8; }
  .vf-toast { position: absolute; left: 50%; bottom: 70px; transform: translateX(-50%); padding: 9px 16px; border-radius: 12px; background: #7c4dff; color: #fff; font-size: 13px; font-weight: 700; z-index: 10; box-shadow: 0 8px 24px #0008; max-width: 90vw; text-align: center; }
  .vf-scene { position: absolute; inset: 0; z-index: 30; background: #000e; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 18px; padding: 30px; cursor: pointer; animation: vfIn .6s ease both; transition: opacity .7s; }
  .vf-scene.out { opacity: 0; }
  .vf-fig { font-size: 90px; opacity: 0; transition: opacity 1s; filter: drop-shadow(0 0 24px #ff4fd8); }
  .vf-fig.on { opacity: 1; }
  .vf-scenebox { width: min(100%, 720px); min-height: 120px; padding: 18px 22px; border: 1px solid #ffffff30; border-radius: 14px; background: #000c; }
  .vf-who { margin-bottom: 6px; color: #ffd54a; font-weight: 800; letter-spacing: .12em; }
  .vf-line { font-size: 17px; line-height: 1.55; }
  .vf-cont { margin-top: 10px; font-size: 11px; opacity: .5; text-align: right; }
  .vf-theend { position: absolute; inset: 0; z-index: 25; display: grid; place-items: center; padding: 24px; text-align: center; background: #000; animation: vfIn 2.5s ease both; }
  .vf-theend h1 { margin: 0 0 12px; font-size: 44px; letter-spacing: .3em; font-weight: 300; }
  .vf-theend p { max-width: 460px; margin: 0 auto 12px; opacity: .8; }
  .vf-theend .vf-btn { margin-top: 14px; padding: 9px 16px; }
  @media (prefers-reduced-motion: reduce) { #vfRoot * { animation: none !important; } }
  `;

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const PALETTES = [
    { hot: [255, 244, 214], mid: [255, 160, 60], cool: [200, 70, 40], glow: "255,140,60", d1: "#ffb347", d2: "#ff5e3a" },
    { hot: [255, 232, 255], mid: [255, 90, 220], cool: [90, 110, 255], glow: "190,80,255", d1: "#ff4fd8", d2: "#5a7bff" },
    { hot: [220, 226, 238], mid: [140, 150, 172], cool: [70, 80, 104], glow: "120,130,160", d1: "#8a93a8", d2: "#3a4052" }
  ];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ---------- State ----------
  const freshState = () => ({ v: 4, tv: TIER_VERSION, stage: 0, fade: 0, m0: 0, endings: 0, mass: START_MASS, spin: 0, eaten: 0, found: {}, lvl: {}, last: Date.now() });
  let root = null;
  let refs = null;
  let game = null;
  let saveKey = "";
  let raf = 0;
  let lastFrame = 0;
  let lastHud = 0;
  let lastSave = 0;
  let lastTree = 0;
  let tab = "cosmos";
  let sceneActive = false;
  let strangerIndex = -1;
  let whisperIndex = -1;
  let spawnTimer = 0;
  let combo = 0;
  let comboTimer = 0;
  let novaTimer = 0;
  let eventTimer = 20;
  const buffs = {};
  let S = {};
  let pulse = 0;
  let eraIndex = 0;
  let feedText = "";
  let feedAge = 0;
  let hover = null;
  let cursor = null;
  let drag = null;
  let view = { w: 800, h: 600, cx: 400, cy: 300, R: 14, scale: 1 };
  const objs = [];
  const particles = [];
  const floaters = [];
  const rings = [];
  const beams = [];
  let flash = { a: 0, color: "255,255,255" };
  let shake = 0;
  const drones = [];
  const stars = [];
  const disk = [];

  const level = node => game.lvl[node.id] || 0;
  const recompute = () => {
    S = { yield: 0, yieldX: 1, spin: 0, reach: 0, spawn: 0, grab: 0, cap: 0, pull: 0, drift: 0, drone: 0, droneSpeed: 0, multi: 0, cursor: 0, echo: 0, combo: 0, tempo: 0, nova: 0, stardust: 0, crit: 0, critPow: 0, accretion: 0, exotic: 0, offline: 0, discount: 0, synergy: 0, eventRate: 0, eventTime: 0, flags: {} };
    NODES.forEach(node => {
      const owned = level(node);
      if (!owned || node.root) return;
      if (node.stat === "yieldX") S.yieldX *= (1 + node.per) ** owned;
      else if (node.stat === "vis") { S.yield += node.per * owned; S.flags[node.flag] = true; } else S[node.stat] += node.per * owned;
    });
  };
  const yieldMult = () => (1 + S.yield) * S.yieldX * 1.2 ** S.synergy * 1.25 ** game.endings * (buffOn("feast") ? 3 : 1);
  const spinMult = () => (1 + S.spin) * 1.15 ** S.synergy * (1 + 0.1 * game.endings) * (buffOn("bloom") ? 3 : 1);
  const EVENTS = {
    frenzy: { icon: "☄️", name: "Meteor Shower", color: "#ff9d4a", text: "Objects spawn 6x faster" },
    surge: { icon: "🌀", name: "Gravity Surge", color: "#6ea8ff", text: "Gravity pull x8, objects dive straight in" },
    feast: { icon: "💎", name: "Mass Crystal", color: "#7dffb0", text: "Mass gained x3" },
    bloom: { icon: "✨", name: "Spin Bloom", color: "#d28bff", text: "Spin gained x3" },
    mirror: { icon: "🪞", name: "Echo Chamber", color: "#5ee6ff", text: "Echo chance +50%" },
    storm: { icon: "🌟", name: "Stardust Storm", color: "#ff8fb4", text: "Stardust chance +40%" },
    warp: { icon: "⏩", name: "Time Warp", color: "#ffe066", text: "Combos never expire and build twice as fast" }
  };
  const EVENT_SECONDS = 10;
  const eventSeconds = () => EVENT_SECONDS * (1 + S.eventTime);
  const buffOn = id => (buffs[id] || 0) > 0;
  const maxObjects = () => 4 + Math.floor(S.cap) + (buffOn("frenzy") ? 8 : 0);
  const critChance = () => Math.min(0.6, S.crit);
  const critMult = () => 5 + S.critPow;
  const exoticChance = () => Math.min(0.4, 0.02 + S.exotic);
  const costScale = () => Math.max(0.2, 0.985 ** S.discount);
  const nodeCost = (node, owned) => Math.ceil(node.base * COST_UNIT * node.growth ** owned * costScale());
  const nodeSeen = node => {
    if ((node.stage || 0) > game.stage) return false;
    if (node.root || !node.parent) return true;
    const parent = NODE[node.parent];
    return level(parent) > 0 || parent.root || (parent.parent && level(NODE[parent.parent]) > 0) || NODE[parent.parent]?.root;
  };
  const nodeOpen = node => !node.root && (node.stage || 0) <= game.stage && (NODE[node.parent].root || level(NODE[node.parent]) > 0);
  const nodeText = (node, owned) => {
    if (node.stat === "yieldX") return `x${((1 + node.per) ** owned).toFixed(2)} mass from every object`;
    if (node.flag) return `Unlocks ${FLAG_TEXT[node.flag]} and +${pct(node.per)} mass absorbed`;
    return STAT_TEXT[node.stat](node.per * owned);
  };

  const save = () => {
    game.last = Date.now();
    try { localStorage.setItem(saveKey, JSON.stringify(game)); } catch {}
  };
  const normalize = saved => {
    if (saved?.v !== 4 || !Number.isFinite(saved.mass) || saved.mass <= 0) return null;
    const lvl = {};
    Object.entries(saved.lvl && typeof saved.lvl === "object" ? saved.lvl : {}).forEach(([id, value]) => { if (NODE[id] && Number.isFinite(value) && value > 0) lvl[id] = Math.floor(value); });
    const found = saved.tv === TIER_VERSION ? saved.found || {} : remapFound(saved.found);
    const number = (value, fallback) => (Number.isFinite(value) && value >= 0 ? value : fallback);
    return { ...freshState(), ...saved, tv: TIER_VERSION, lvl, found, spin: number(saved.spin, 0), eaten: number(saved.eaten, 0), endings: Math.floor(number(saved.endings, 0)), fade: clamp(number(saved.fade, 0), 0, 1), stage: clamp(Math.floor(number(saved.stage, 0)), 0, 3), last: Date.now() };
  };
  const load = () => {
    try { return normalize(JSON.parse(localStorage.getItem(saveKey) || "null")) || freshState(); } catch { return freshState(); }
  };

  // Big meals get harder to find the heavier you are, so growth slows down as you scale up.
  const scarcity = mass => { const d = Math.max(0, Math.log10(mass / START_MASS)); return (1 + (Math.min(d, 80.3) + STAGE1_SOFT * Math.max(0, d - 80.3)) / 5) ** -SCARCITY; };
  const reachRatio = () => Math.min(1, BASE_REACH * (1 + S.reach) * scarcity(game.mass));
  const passiveRate = () => ACC_RATE * S.accretion * scarcity(game.mass);
  const topReachable = () => {
    const limit = game.mass * reachRatio();
    let best = TIERS[0];
    TIERS.forEach(tier => { if (tier.stage <= game.stage && tier.mass <= limit) best = tier; });
    return best;
  };
  // Objects come as clusters of one real thing; the cluster is sized from your own mass.
  const rollObject = (mass, ratio, stage) => {
    const limit = mass * ratio;
    let pool = TIERS.filter(tier => tier.stage <= stage && tier.mass <= limit && tier.mass >= limit * 1e-3).reverse();
    if (!pool.length) {
      const below = TIERS.filter(tier => tier.stage <= stage && tier.mass <= limit);
      pool = [below.length ? below[below.length - 1] : TIERS[0]];
    }
    const tier = pool[Math.min(pool.length - 1, Math.floor(-Math.log(1 - Math.random()) / Math.log(3)))];
    const n = Math.max(1, Math.round(limit * (0.2 + 0.27 * Math.random()) / tier.mass));
    return { tier, n };
  };

  const toast = message => {
    root.querySelector(".vf-toast")?.remove();
    const note = make("div", "vf-toast", message);
    root.append(note);
    window.setTimeout(() => note.remove(), 3200);
  };

  // ---------- Geometry ----------
  const holeRadius = () => {
    const logMass = Math.log10(Math.max(game.mass, 1e-40));
    const base = 6 + 86 * clamp((logMass - Math.log10(START_MASS)) / 80.3, 0, 1) ** 0.85 + 28 * clamp((logMass - 53.2) / 46, 0, 1);
    return base * view.scale * (game.stage >= 2 ? 1 - 0.7 * game.fade ** 2 : 1);
  };
  // Size follows mass relative to the heaviest thing that can currently spawn, so heavy objects clearly dwarf light ones.
  const objectSize = mass => {
    const rel = clamp(mass / Math.max(game.mass * reachRatio(), 1e-60), 1e-4, 1);
    const t = clamp(1 + Math.log10(rel) / 3.2, 0, 1);
    const base = Math.max(view.R, 26 * view.scale);
    return Math.min(view.R * 0.9, clamp(base * (0.45 + 1.5 * t ** 1.3), 12 * view.scale, 120 * view.scale));
  };

  // ---------- Objects ----------
  const spawnObject = () => {
    const { tier, n } = rollObject(game.mass, reachRatio(), game.stage);
    const mass = tier.mass * n;
    const angle = rand(0, TAU);
    const distance = Math.min(view.w, view.h) * rand(0.3, 0.44) + view.R;
    const x = clamp(view.cx + Math.cos(angle) * distance, 36, view.w - 36);
    const y = clamp(view.cy + Math.sin(angle) * distance * 0.9, 90, view.h - 70);
    const dx = view.cx - x;
    const dy = view.cy - y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = Math.sqrt(orbitAccel(d) * d) * rand(0.5, 0.9) * (Math.random() < 0.5 ? 1 : -1);
    objs.push({ tier: tier.index, n, mass, x, y, vx: -dy / d * speed, vy: dx / d * speed, age: 0, tug: false, exotic: Math.random() < exoticChance(), size: objectSize(mass), trail: [] });
  };
  const spawnEvent = () => {
    const id = Object.keys(EVENTS)[Math.floor(Math.random() * Object.keys(EVENTS).length)];
    spawnObject();
    const object = objs[objs.length - 1];
    if (!object) return;
    object.ev = id;
    object.life = 16;
    object.n = 1;
    object.exotic = false;
    toast(`${EVENTS[id].icon} A ${EVENTS[id].name} appeared! Swallow it fast.`);
  };
  const orbitAccel = d => 42000 * (0.6 + view.R / 60) / (d + 30) ** 1.2;

  const burst = (x, y, color, count, attract) => {
    if (tab !== "cosmos") return;
    for (let index = 0; index < count && particles.length < 500; index += 1) {
      const angle = rand(0, TAU);
      const speed = rand(30, 190);
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: rand(0.5, 1), age: 0, color, size: rand(1.5, 3.5), attract });
    }
  };

  const eat = (object, fromPassive) => {
    const tier = TIERS[object.tier];
    if (object.ev) {
      const info = EVENTS[object.ev];
      buffs[object.ev] = eventSeconds();
      feedText = `${info.icon} ${info.name}! ${info.text} for ${Math.round(eventSeconds())}s`;
      feedAge = 0;
      pulse = 1.4;
      burst(object.x, object.y, info.color, 36, true);
      return;
    }
    const crit = !fromPassive && Math.random() < critChance();
    const echoed = Math.random() < Math.min(0.9, S.echo + (buffOn("mirror") ? 0.5 : 0));
    const dusted = Math.random() < Math.min(0.5, S.stardust + (buffOn("storm") ? 0.4 : 0));
    const chain = combo;
    const gain = object.mass * OBJECT_MASS_MULT * yieldMult() * (1 + S.combo * chain) * (echoed ? 2 : 1) * (object.exotic ? 25 : 1) * (crit ? critMult() : 1);
    // Spin uses a nominal catch size so crits, exotics and odd object sizes don't make it swing wildly.
    const spinGain = Math.log1p(0.33 * reachRatio() * yieldMult()) * spinPerFold(game.mass) * spinMult() * (dusted ? 10 : 1);
    combo = Math.min(20, combo + (buffOn("warp") ? 2 : 1));
    comboTimer = 4 + S.tempo;
    game.mass += gain;
    game.spin += spinGain;
    game.eaten += object.n;
    game.found[tier.index] = (game.found[tier.index] || 0) + object.n;
    pulse = Math.min(1.4, pulse + (crit ? 1 : 0.5));
    feedText = `Swallowed ${object.n > 1 ? `${fmt(object.n)} × ` : ""}${object.exotic ? "Exotic " : ""}${tier.name}  +${fmt(gain)} kg  +${fmt(spinGain)} Spin${crit ? "  GULP!" : ""}${echoed ? "  ECHO x2!" : ""}${dusted ? "  STARDUST x10 Spin!" : ""}${S.combo && chain > 1 ? `  Chain x${chain}` : ""}`;
    feedAge = 0;
    if (tab === "cosmos" && floaters.length < 40) floaters.push({ x: view.cx, y: view.cy - view.R * 1.6, text: `+${fmt(gain)} kg`, age: 0, color: crit ? "#ffd54a" : "#ffffff", big: crit });
    burst(object.x, object.y, object.exotic ? "#ffd54a" : "#ffb98a", crit ? 26 : 10, true);
    if (echoed && tab === "cosmos" && rings.length < 20) {
      rings.push({ x: view.cx, y: view.cy, age: 0, life: 0.7, from: view.R, to: view.R * 3.2, color: "94,230,255", width: 3 });
      rings.push({ x: view.cx, y: view.cy, age: -0.12, life: 0.7, from: view.R, to: view.R * 4.2, color: "94,230,255", width: 2 });
    }
    if (dusted && tab === "cosmos" && floaters.length < 40) {
      burst(view.cx, view.cy, "#ffd1e6", 30, false);
      burst(view.cx, view.cy, "#ff8fb4", 20, false);
      floaters.push({ x: view.cx, y: view.cy - view.R * 2.4, text: `✨ +${fmt(spinGain)} Spin`, age: 0, color: "#ff8fb4", big: true });
    }
  };

  const triggerNova = targets => {
    if (tab !== "cosmos") return;
    const { cx, cy, w, h } = view;
    const reach = Math.hypot(w, h);
    targets.slice(0, 24).forEach(object => {
      beams.push({ x: object.x, y: object.y, age: 0, life: 0.55 });
      burst(object.x, object.y, "#ffb3c9", 14, true);
    });
    [0, 0.12, 0.26].forEach((delay, index) => rings.push({ x: cx, y: cy, age: -delay, life: 0.9 + index * 0.15, from: view.R, to: reach * (0.55 + index * 0.2), color: index === 1 ? "255,214,120" : "255,92,138", width: 6 - index * 1.5 }));
    flash = { a: 0.75, color: "255,200,220" };
    shake = 14;
    pulse = 1.4;
    floaters.push({ x: cx, y: cy - view.R * 2.6, text: `💥 NOVA ×${targets.length}`, age: 0, color: "#ff8fb4", big: true });
  };

  // ---------- Story ----------
  const playScene = (lines, done) => {
    sceneActive = true;
    drag = null;
    const layer = make("div", "vf-scene");
    const figure = make("div", "vf-fig", "🕴️");
    const box = make("div", "vf-scenebox");
    const who = make("div", "vf-who");
    const text = make("div", "vf-line");
    box.append(who, text, make("div", "vf-cont", "Click to continue"));
    layer.append(figure, box);
    root.append(layer);
    let index = 0;
    let shown = 0;
    let full = "";
    let timer = 0;
    const show = () => {
      const line = lines[index];
      who.textContent = line.who || "";
      who.style.display = line.who ? "block" : "none";
      figure.classList.toggle("on", Boolean(line.who));
      full = line.text;
      shown = 0;
      text.textContent = "";
      clearInterval(timer);
      timer = window.setInterval(() => {
        shown += 2;
        text.textContent = full.slice(0, shown);
        if (shown >= full.length) clearInterval(timer);
      }, 26);
    };
    layer.addEventListener("click", () => {
      if (shown < full.length) { shown = full.length; text.textContent = full; clearInterval(timer); return; }
      index += 1;
      if (index >= lines.length) {
        clearInterval(timer);
        layer.classList.add("out");
        window.setTimeout(() => { layer.remove(); sceneActive = false; done(); }, 700);
        return;
      }
      show();
    });
    show();
  };

  const showEnding = () => {
    root.querySelector(".vf-theend")?.remove();
    if (game.stage < 3) return;
    const panel = make("div", "vf-theend");
    const inner = make("div");
    inner.append(
      make("h1", "", "THE END"),
      make("p", "", "You swallowed a universe, and then everything. And then you were gone."),
      make("p", "", `Objects swallowed: ${fmt(game.eaten)} · Peak mass: ${fmt(game.m0)} kg · Endings: ${game.endings + 1}`)
    );
    const again = make("button", "vf-btn", "Begin again (+25% mass and +10% Spin per ending)");
    again.type = "button";
    again.addEventListener("click", () => {
      game = { ...freshState(), endings: game.endings + 1, found: game.found, eaten: game.eaten };
      recompute();
      save();
      applyStage();
    });
    inner.append(again);
    panel.append(inner);
    root.append(panel);
  };

  const applyStage = () => {
    const palette = PALETTES[Math.min(2, game.stage === 3 ? 2 : game.stage)];
    root.style.setProperty("--d1", palette.d1);
    root.style.setProperty("--d2", palette.d2);
    root.style.setProperty("--glow", `rgba(${palette.glow},.55)`);
    root.style.setProperty("--acc", palette.d1);
    refs.stranger.classList.toggle("hidden", game.stage !== 1);
    refs.goal.classList.toggle("hidden", game.stage >= 2);
    strangerIndex = -1;
    whisperIndex = -1;
    eraIndex = eraOf(game.mass);
    refs.whisper.textContent = "";
    objs.length = 0;
    if (game.stage >= 2) setTab("cosmos");
    refs.tabs.forEach(([, button]) => { button.style.display = game.stage >= 2 ? "none" : ""; });
    buildTree();
    showEnding();
  };

  const checkStage = () => {
    if (sceneActive) return;
    if (game.stage === 0 && game.mass >= UNIVERSE_MASS) {
      setTab("cosmos");
      playScene(STRANGER_SCENE, () => { game.stage = 1; save(); applyStage(); toast("A rift opens. New skills and objects are unlocked."); });
    } else if (game.stage === 1 && game.mass >= MULTIVERSE_MASS) {
      setTab("cosmos");
      playScene(MULTIVERSE_SCENE, () => { game.stage = 2; game.fade = 0; game.m0 = game.mass; save(); applyStage(); });
    } else if (game.stage === 2 && game.fade >= 1) {
      playScene(END_SCENE, () => { game.stage = 3; save(); applyStage(); });
    }
  };

  // ---------- Simulation ----------
  const updateDrones = dt => {
    const count = Math.floor(S.drone);
    while (drones.length < Math.min(count, 16)) drones.push({ a: rand(0, TAU), t: rand(0, 3) });
    while (drones.length > Math.min(count, 16)) drones.pop();
    const interval = 3.2 / (1 + S.droneSpeed);
    const perTick = Math.max(1, Math.ceil(count / 16));
    drones.forEach(drone => {
      drone.a += dt * 0.6;
      drone.t -= dt;
      if (drone.t > 0) return;
      drone.t = interval;
      for (let n = 0; n < perTick; n += 1) {
        let best = null;
        let bestDistance = Infinity;
        objs.forEach(object => {
          if (object.ev || object.tug || (drag && drag.set?.has(object))) return;
          const d = Math.hypot(object.x - view.cx, object.y - view.cy);
          if (d < bestDistance) { best = object; bestDistance = d; }
        });
        if (best) { best.tug = true; drone.target = best; }
      }
    });
  };

  const physics = dt => {
    const { cx, cy, R } = view;
    const surge = buffOn("surge") ? 8 : 1;
    const pullRange = Math.max(R * 3, 70) * (1 + S.pull) * (surge > 1 ? 3 : 1.4);
    const damping = 0.03 * (1 + S.drift);
    const field = drag ? fieldRadius() : 0;
    if (drag) {
      drag.items = objs.filter(o => Math.hypot(o.x - drag.px, o.y - drag.py) < field).map(o => ({ o }));
      drag.set = new Set(drag.items.map(item => item.o));
    }
    for (let index = objs.length - 1; index >= 0; index -= 1) {
      const object = objs[index];
      object.age += dt;
      if (object.ev && object.age > object.life) { objs.splice(index, 1); continue; }
      object.size = objectSize(object.mass);
      const pulled = field && Math.hypot(object.x - drag.px, object.y - drag.py) < field;
      if (pulled) {
        const fx = drag.px - object.x;
        const fy = drag.py - object.y;
        const fd = Math.hypot(fx, fy) || 1;
        const fw = 1 - fd / field;
        const heavy = Math.min(1, object.mass / game.mass) ** 0.4;
        const strength = 3200 * (1 + 0.25 * S.multi + S.cursor) * (0.25 + 0.75 * fw) / (1 + 1.5 * heavy);
        object.vx += fx / fd * strength * dt;
        object.vy += fy / fd * strength * dt;
        const cling = Math.exp(-(2 + 6 * fw) * dt);
        object.vx = drag.vx + (object.vx - drag.vx) * cling;
        object.vy = drag.vy + (object.vy - drag.vy) * cling;
        object.x += object.vx * dt;
        object.y += object.vy * dt;
      } else {
        const dx = cx - object.x;
        const dy = cy - object.y;
        const d = Math.hypot(dx, dy) || 1;
        let accel = orbitAccel(d);
        if (d < pullRange) {
          const w = 1 - d / pullRange;
          accel += 520 * (1 + S.drift) * surge * (0.35 + 0.65 * w);
          const ux = dx / d;
          const uy = dy / d;
          const radial = object.vx * ux + object.vy * uy;
          const bleed = Math.min(1, dt * (1.2 + 0.8 * surge) * (0.4 + w));
          object.vx -= (object.vx - radial * ux) * bleed;
          object.vy -= (object.vy - radial * uy) * bleed;
        }
        if (object.tug) accel += 700;
        object.vx += dx / d * accel * dt;
        object.vy += dy / d * accel * dt;
        const damp = Math.exp(-(damping + (object.tug ? 0.8 : 0)) * dt);
        object.vx *= damp;
        object.vy *= damp;
        object.x += object.vx * dt;
        object.y += object.vy * dt;
      }
      if (S.flags.trails) {
        object.trail.push(object.x, object.y);
        if (object.trail.length > 24) object.trail.splice(0, 2);
      }
      const d = Math.hypot(cx - object.x, cy - object.y);
      if (d < R * 0.85 + object.size * 0.22) {
        eat(object, false);
        if (drag) drag.items = drag.items.filter(item => item.o !== object);
        objs.splice(index, 1);
      } else if (d > Math.max(view.w, view.h) * 1.3) objs.splice(index, 1);
    }
  };

  const update = (dt, realDt) => {
    if (sceneActive) return;
    if (game.stage >= 2) {
      game.fade = Math.min(1, game.fade + realDt / FADE_SECONDS);
      game.mass = Math.max(START_MASS, (game.m0 || START_MASS) * (START_MASS / (game.m0 || START_MASS)) ** game.fade);
      objs.length = 0;
      checkStage();
      return;
    }
    Object.keys(buffs).forEach(id => { buffs[id] = Math.max(0, buffs[id] - dt); });
    if (combo && !buffOn("warp")) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }
    if (S.nova > 0) {
      novaTimer -= dt;
      if (novaTimer <= 0) {
        const targets = objs.filter(object => !object.ev);
        if (targets.length) {
          const swallowed = new Set(targets);
          targets.forEach(object => eat(object, true));
          const remaining = objs.filter(object => !swallowed.has(object));
          objs.length = 0;
          objs.push(...remaining);
          if (drag) drag.items = drag.items.filter(item => !swallowed.has(item.o));
          triggerNova(targets);
          toast(`💥 Nova! Swallowed ${targets.length} object${targets.length === 1 ? "" : "s"}.`);
          novaTimer = Math.max(6, 60 / (1 + 4 * S.nova));
        } else novaTimer = 2;
      }
    } else novaTimer = 15;
    eventTimer -= dt;
    if (eventTimer <= 0) {
      eventTimer = rand(35, 70) / (1 + S.eventRate);
      if (objs.length < maxObjects() + 2 && !objs.some(object => object.ev)) spawnEvent();
    }
    spawnTimer -= dt;
    if (spawnTimer <= 0 && objs.length < maxObjects()) {
      spawnObject();
      spawnTimer = 1.4 / OBJECT_SPAWN_MULT / (1 + S.spawn) / (buffOn("frenzy") ? 6 : 1) * rand(0.7, 1.3);
    }
    physics(dt);
    updateDrones(dt);
    if (S.accretion) {
      const fold = passiveRate() * realDt;
      game.spin += fold * spinPerFold(game.mass) * spinMult();
      game.mass *= Math.exp(fold);
    }
    checkStage();
  };

  // ---------- Rendering ----------
  const STAR_TINTS = ["#ffffff", "#cfe0ff", "#9ec0ff", "#fff1c9", "#ffd2a1", "#ffb38a"];
  const streaks = [];
  let nebula = null;
  let nebulaKey = "";
  let nebulaHaze = null;
  let nebulaVignette = null;
  const initStars = () => {
    stars.length = 0;
    for (let index = 0; index < 340; index += 1) {
      const z = Math.pow(Math.random(), 1.6);
      stars.push({ x: Math.random(), y: Math.random(), z, tw: rand(0, TAU), speed: rand(0.6, 2.2), tint: STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)], big: z > 0.93 });
    }
    disk.length = 0;
    for (let index = 0; index < 1100; index += 1) disk.push({ a: rand(0, TAU), r: Math.random() ** 1.15, s: rand(0.7, 2.1), o: rand(0.45, 1) });
  };

  const rgba = (rgb, alpha) => `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${alpha})`;
  const palette = () => PALETTES[game.stage >= 2 ? 2 : game.stage];

  // The nebula is painted once into an offscreen canvas and only re-made when the size or story stage changes.
  const buildNebula = () => {
    const { w, h } = view;
    const key = `${Math.round(w)}x${Math.round(h)}-${Math.min(game.stage, 2)}`;
    if (key === nebulaKey && nebula) return nebula;
    nebulaKey = key;
    nebula = document.createElement("canvas");
    nebula.width = Math.max(2, Math.round(w / 2));
    nebula.height = Math.max(2, Math.round(h / 2));
    const n = nebula.getContext("2d");
    const hues = [[[90, 40, 170], [30, 80, 200]], [[190, 40, 150], [90, 50, 220]], [[70, 80, 110], [50, 55, 80]]][Math.min(game.stage, 2)];
    const rnd = (() => { let seed = 12345 + Math.min(game.stage, 2) * 77; return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; })();
    n.scale(0.5, 0.5);
    n.globalCompositeOperation = "lighter";
    for (let index = 0; index < 11; index += 1) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = (0.22 + rnd() * 0.4) * Math.max(w, h);
      const color = hues[index % 2];
      const grad = n.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${0.2 + rnd() * 0.12})`);
      grad.addColorStop(0.55, `rgba(${color[0]},${color[1]},${color[2]},0.06)`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      n.fillStyle = grad;
      n.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let index = 0; index < 700; index += 1) {
      const color = hues[index % 2];
      n.fillStyle = `rgba(${color[0] + 80},${color[1] + 80},${color[2] + 60},${0.02 + rnd() * 0.05})`;
      const size = 1 + rnd() * 6;
      n.fillRect(rnd() * w, rnd() * h, size, size);
    }
    const bake = () => {
      const c = document.createElement("canvas");
      c.width = nebula.width;
      c.height = nebula.height;
      return c;
    };
    const pal = palette();
    const { cx, cy } = view;
    nebulaHaze = bake();
    const hc = nebulaHaze.getContext("2d");
    const haze = hc.createRadialGradient(cx / 2, cy / 2, 0, cx / 2, cy / 2, Math.max(w, h) * 0.325);
    haze.addColorStop(0, `rgba(${pal.glow},0.16)`);
    haze.addColorStop(0.45, `rgba(${pal.glow},0.04)`);
    haze.addColorStop(1, "rgba(0,0,0,0)");
    hc.fillStyle = haze;
    hc.fillRect(0, 0, nebula.width, nebula.height);
    nebulaVignette = bake();
    const vc = nebulaVignette.getContext("2d");
    const vignette = vc.createRadialGradient(cx / 2, cy / 2, Math.min(w, h) * 0.225, cx / 2, cy / 2, Math.max(w, h) * 0.4);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.55)");
    vc.fillStyle = vignette;
    vc.fillRect(0, 0, nebula.width, nebula.height);
    return nebula;
  };

  const drawBackground = (ctx, time) => {
    const pal = palette();
    const { w, h, cx, cy, R } = view;
    const dim = 1 - (game.stage >= 2 ? game.fade * 0.8 : 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#030208";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = dim * 0.95;
    ctx.drawImage(buildNebula(), Math.sin(time * 0.05) * 14 - 14, Math.cos(time * 0.04) * 10 - 10, w + 28, h + 20);
    ctx.globalAlpha = 1;
    ctx.globalAlpha = dim;
    ctx.drawImage(nebulaHaze, 0, 0, w, h);
    ctx.globalAlpha = 1;
    const lensR = R * 1.9;
    const driftX = Math.sin(time * 0.03) * 6;
    stars.forEach(star => {
      const px = (star.x * (w + 80) + driftX * star.z * 4 + time * star.z * 1.5) % (w + 80) - 40;
      let x = px;
      let y = star.y * h + Math.sin(time * 0.05 + star.tw) * 4 * star.z;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy) || 1;
      if (d < R * 7) {
        const bend = Math.min(R * 2.4, (lensR * lensR) / d);
        x += dx / d * bend;
        y += dy / d * bend;
        if (Math.hypot(x - cx, y - cy) < R * 1.02) return;
      }
      const twinkle = 0.55 + 0.45 * Math.sin(time * star.speed + star.tw);
      const size = 0.7 + star.z * (star.big ? 3.2 : 1.7);
      ctx.globalAlpha = (0.2 + 0.75 * star.z) * twinkle * dim;
      ctx.fillStyle = star.tint;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      if (star.big) {
        ctx.globalAlpha *= 0.55;
        ctx.fillRect(x - size * 3, y - 0.5, size * 6, 1);
        ctx.fillRect(x - 0.5, y - size * 3, 1, size * 6);
      }
    });
    ctx.globalAlpha = 1;
    if (game.stage < 2 && Math.random() < 0.004) {
      const side = Math.random() < 0.5;
      streaks.push({ x: side ? rand(0, w) : w + 20, y: side ? -10 : rand(0, h * 0.5), vx: -rand(500, 900), vy: rand(250, 500), life: 0 });
    }
    for (let index = streaks.length - 1; index >= 0; index -= 1) {
      const streak = streaks[index];
      streak.life += 0.016;
      streak.x += streak.vx * 0.016;
      streak.y += streak.vy * 0.016;
      if (streak.life > 1.2 || streak.x < -100 || streak.y > h + 50) { streaks.splice(index, 1); continue; }
      const tail = ctx.createLinearGradient(streak.x, streak.y, streak.x - streak.vx * 0.12, streak.y - streak.vy * 0.12);
      tail.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - streak.life / 1.2) * dim})`);
      tail.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = tail;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(streak.x, streak.y);
      ctx.lineTo(streak.x - streak.vx * 0.12, streak.y - streak.vy * 0.12);
      ctx.stroke();
    }
    ctx.drawImage(nebulaVignette, 0, 0, w, h);
  };

  const diskColor = (heat, bright, alpha) => {
    const pal = palette();
    const rgb = heat > 0.5 ? mix(pal.mid, pal.hot, (heat - 0.5) * 2) : mix(pal.cool, pal.mid, heat * 2);
    return rgba(rgb.map(value => value * bright), alpha);
  };

  // A smooth glowing band under the particles gives the disk body; each half is drawn when its pass runs.
  let baseCache = null;
  let baseKey = "";
  const drawDiskBase = (ctx, front, fade) => {
    const { cx, cy, R } = view;
    const key = `${Math.round(R)}-${Math.min(game.stage, 2)}-${Math.round(fade * 20)}`;
    if (key !== baseKey || !baseCache) {
      baseKey = key;
      const half = Math.ceil(R * 4.9);
      baseCache = document.createElement("canvas");
      baseCache.width = half * 2;
      baseCache.height = Math.ceil(half * 2 * 0.26) + 2;
      const c = baseCache.getContext("2d");
      c.translate(half, baseCache.height / 2);
      c.scale(1, 0.26);
      const base = c.createRadialGradient(0, 0, R * 1.2, 0, 0, R * 4.9);
      base.addColorStop(0, diskColor(1, 1, 0.55 * fade));
      base.addColorStop(0.1, diskColor(1, 1, 0.5 * fade));
      base.addColorStop(0.18, diskColor(0.78, 1, 0.42 * fade));
      base.addColorStop(0.55, diskColor(0.4, 0.9, 0.18 * fade));
      base.addColorStop(1, diskColor(0.1, 0.6, 0));
      c.fillStyle = base;
      c.beginPath();
      c.arc(0, 0, R * 4.9, 0, TAU);
      c.fill();
    }
    const w = baseCache.width;
    const h = baseCache.height;
    const hh = Math.floor(h / 2);
    ctx.globalCompositeOperation = "lighter";
    if (front) ctx.drawImage(baseCache, 0, hh, w, h - hh, cx - w / 2, cy, w, h - hh);
    else ctx.drawImage(baseCache, 0, 0, w, hh, cx - w / 2, cy - hh, w, hh);
    ctx.globalCompositeOperation = "source-over";
  };

  let diskColorKey = "";
  let diskStyles = [];
  const diskBuckets = Array.from({ length: 30 }, () => []);
  const drawDisk = (ctx, front, dt, fade, time) => {
    const { cx, cy, R } = view;
    drawDiskBase(ctx, front, fade, time);
    if (front) {
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.01, 0, TAU);
      ctx.fill();
    }
    const count = S.flags.dust ? disk.length : Math.floor(disk.length * 0.7);
    ctx.globalCompositeOperation = "lighter";
    const HB = 6;
    const BB = 5;
    const colorKey = `${Math.min(game.stage, 2)}-${Math.round(fade * 20)}`;
    if (colorKey !== diskColorKey) {
      diskColorKey = colorKey;
      diskStyles = [];
      for (let h = 0; h < HB; h += 1) for (let b = 0; b < BB; b += 1) diskStyles.push(diskColor(1 - (h + 0.5) / HB * 0.95, Math.min(1.1, 0.25 + 1.1 * (b + 0.5) / BB), 0.8 * fade));
    }
    const buckets = diskBuckets;
    for (let i = 0; i < buckets.length; i += 1) buckets[i].length = 0;
    const lineScale = Math.max(0.6, R / 55) * 1.3;
    const r2 = R * R;
    for (let index = 0; index < count; index += 1) {
      const p = disk[index];
      const rr = R * (1.4 + p.r * 3.5);
      if (!front) p.a += dt * 1.7 / (1 + p.r * 2.2) ** 1.5;
      const sin = Math.sin(p.a);
      if ((sin >= 0) !== front) continue;
      const cos = Math.cos(p.a);
      const x = cx + cos * rr;
      const y = cy + sin * rr * 0.26;
      if (front && (x - cx) ** 2 + (y - cy) ** 2 < r2) continue;
      const doppler = 0.5 + 0.5 * Math.cos(p.a + 0.9);
      const bright = Math.min(1, (0.25 + 0.95 * doppler ** 1.6) * p.o);
      const hb = Math.min(HB - 1, Math.floor(p.r * HB));
      const bb = Math.min(BB - 1, Math.floor(bright * BB));
      const trail = 0.09 / (1 + p.r);
      buckets[hb * BB + bb].push(x, y, cx + Math.cos(p.a - trail) * rr, cy + Math.sin(p.a - trail) * rr * 0.26);
    }
    ctx.lineWidth = lineScale;
    for (let i = 0; i < buckets.length; i += 1) {
      const list = buckets[i];
      if (!list.length) continue;
      ctx.strokeStyle = diskStyles[i];
      ctx.beginPath();
      for (let k = 0; k < list.length; k += 4) {
        ctx.moveTo(list[k], list[k + 1]);
        ctx.lineTo(list[k + 2], list[k + 3]);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  };

  let glowCache = null;
  let glowKey = "";
  const buildGlow = () => {
    const { R } = view;
    const key = `${Math.round(R)}-${Math.min(game.stage, 2)}-${S.flags.halo ? 1 : 0}`;
    if (key === glowKey && glowCache) return glowCache;
    glowKey = key;
    const size = Math.max(8, Math.ceil(R * 7));
    glowCache = document.createElement("canvas");
    glowCache.width = size;
    glowCache.height = size;
    const c = glowCache.getContext("2d");
    const pal = palette();
    const m = size / 2;
    const k = size / (R * 14);
    const g = c.createRadialGradient(m, m, R * 0.8 * k, m, m, R * (S.flags.halo ? 7 : 5) * k);
    g.addColorStop(0, `rgba(${pal.glow},${0.4 * 1.15})`);
    g.addColorStop(0.4, `rgba(${pal.glow},${0.12 * 1.15})`);
    g.addColorStop(1, `rgba(${pal.glow},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    return glowCache;
  };

  const drawHoleBack = (ctx, time, dt) => {
    const { cx, cy, R } = view;
    const pal = palette();
    const fade = game.stage >= 2 ? 1 - game.fade * 0.9 : 1;
    const glowStrength = (0.5 + pulse * 0.35 + (S.flags.bloom ? 0.3 : 0)) * fade;
    ctx.globalCompositeOperation = "lighter";
    const glowImage = buildGlow();
    ctx.globalAlpha = Math.min(1, glowStrength / 1.15);
    ctx.drawImage(glowImage, cx - R * 7, cy - R * 7, R * 14, R * 14);
    ctx.globalAlpha = 1;
    if (S.flags.jets) {
      [-1, 1].forEach(dir => {
        const jet = ctx.createLinearGradient(cx, cy, cx, cy + dir * R * 9);
        jet.addColorStop(0, `rgba(${pal.glow},${0.5 * fade})`);
        jet.addColorStop(1, `rgba(${pal.glow},0)`);
        ctx.fillStyle = jet;
        ctx.beginPath();
        ctx.moveTo(cx - R * 0.25, cy);
        ctx.lineTo(cx + R * 0.25, cy);
        ctx.lineTo(cx + R * (0.6 + 0.1 * Math.sin(time * 4)), cy + dir * R * 9);
        ctx.lineTo(cx - R * 0.6, cy + dir * R * 9);
        ctx.closePath();
        ctx.fill();
      });
    }
    if (S.flags.aurora) {
      for (let band = 0; band < 3; band += 1) {
        ctx.strokeStyle = rgba(mix(pal.cool, pal.hot, band / 2), 0.18 * fade);
        ctx.lineWidth = R * 0.12;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * (2 + band * 0.35 + 0.08 * Math.sin(time + band)), R * (2 + band * 0.35), time * 0.2 * (band + 1), 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
    drawDisk(ctx, false, dt, fade, time);
  };

  // The lensed arcs only change with size, stage, upgrades and fade, so they are painted once and reused.
  let lensCache = null;
  let lensKey = "";
  const buildLens = fade => {
    const { R } = view;
    const key = `${Math.round(R)}-${Math.min(game.stage, 2)}-${S.flags.lensing ? 1 : 0}-${Math.round(fade * 20)}`;
    if (key === lensKey && lensCache) return lensCache;
    lensKey = key;
    const size = Math.ceil(R * 4.2);
    lensCache = document.createElement("canvas");
    lensCache.width = size;
    lensCache.height = size;
    const c = lensCache.getContext("2d");
    const pal = palette();
    const cx = size / 2;
    const cy = size / 2;
    c.globalCompositeOperation = "lighter";
    c.shadowColor = `rgba(${pal.glow},1)`;
    c.shadowBlur = R * 0.5;
    for (let layer = 0; layer < 18; layer += 1) {
      const t = layer / 17;
      const radius = R * (1.06 + t * 0.5);
      const alpha = (0.5 - t * 0.42) * fade * (S.flags.lensing ? 1.15 : 0.85);
      c.strokeStyle = diskColor(0.95 - t * 0.7, 1, alpha);
      c.lineWidth = Math.max(1.2, R * (0.06 - t * 0.03));
      c.beginPath();
      c.arc(cx, cy, radius, Math.PI * (1.04 - t * 0.08), Math.PI * (1.96 + t * 0.08));
      c.stroke();
      c.beginPath();
      c.arc(cx, cy, radius * 0.97, Math.PI * (0.18 + t * 0.14), Math.PI * (0.82 - t * 0.14));
      c.globalAlpha = 0.6;
      c.stroke();
      c.globalAlpha = 1;
    }
    if (S.flags.lensing) {
      c.strokeStyle = diskColor(0.5, 1, 0.22 * fade);
      c.lineWidth = R * 0.05;
      c.beginPath();
      c.arc(cx, cy, R * 1.55, 0, TAU);
      c.stroke();
    }
    return lensCache;
  };

  const drawHoleFront = (ctx, time, dt) => {
    const { cx, cy, R } = view;
    const pal = palette();
    const fade = game.stage >= 2 ? 1 - game.fade * 0.9 : 1;
    ctx.globalCompositeOperation = "lighter";
    const lens = buildLens(fade);
    ctx.drawImage(lens, cx - lens.width / 2, cy - lens.height / 2);
    ctx.globalCompositeOperation = "source-over";
    const shadow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    shadow.addColorStop(0, "#000");
    shadow.addColorStop(0.85, "#000");
    shadow.addColorStop(1, "#050208");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * (1 + pulse * 0.03), 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = `rgba(${pal.glow},1)`;
    ctx.shadowBlur = R * (S.flags.ring ? 0.9 : 0.45);
    ctx.strokeStyle = `rgba(255,240,214,${(0.85 + pulse * 0.15) * fade})`;
    ctx.lineWidth = Math.max(1.5, R * (S.flags.ring ? 0.075 : 0.04));
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.03, 0, TAU);
    ctx.stroke();
    if (S.flags.ring) {
      ctx.lineWidth = Math.max(1, R * 0.02);
      ctx.strokeStyle = `rgba(255,220,180,${0.5 * fade})`;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.12, 0, TAU);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
    drawDisk(ctx, true, dt, fade, time);
    if (S.flags.corona) {
      ctx.globalCompositeOperation = "lighter";
      const corona = ctx.createRadialGradient(cx, cy, R, cx, cy, R * (1.6 + 0.15 * Math.sin(time * 3)));
      corona.addColorStop(0, `rgba(${pal.glow},${0.3 * fade})`);
      corona.addColorStop(1, `rgba(${pal.glow},0)`);
      ctx.fillStyle = corona;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.8, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    if (S.flags.sparkle && Math.random() < 0.5) burst(cx + rand(-R, R) * 2, cy + rand(-R, R) * 2, "#fff", 1, false);
  };

  // Emoji text and shadowBlur are expensive, so each look is drawn once to a small canvas and reused with drawImage.
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const spriteCache = new Map();
  let spriteScale = 1;
  const getSprite = (icon, size, cluster, glow) => {
    const px = Math.max(8, Math.round(size * 1.1 / 4) * 4);
    const key = `${icon}|${px}|${cluster ? 1 : 0}|${glow}`;
    let sprite = spriteCache.get(key);
    if (sprite) return sprite;
    if (spriteCache.size > 600) spriteCache.clear();
    const blur = glow === "exotic" ? px * 0.8 : glow === "hl" ? 14 : 0;
    const side = Math.ceil(px * 1.7 + blur * 2.5);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(side * spriteScale);
    canvas.height = canvas.width;
    const sctx = canvas.getContext("2d");
    sctx.scale(spriteScale, spriteScale);
    sctx.translate(side / 2, side / 2);
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";
    if (glow) {
      sctx.shadowColor = glow === "exotic" ? "#ffd54a" : "#ffffff";
      sctx.shadowBlur = blur * spriteScale;
    }
    if (cluster) {
      sctx.font = `${Math.round(px * 0.7 / 1.1)}px ${EMOJI_FONT}`;
      sctx.fillText(icon, -px / 1.1 * 0.38, -px / 1.1 * 0.3);
      sctx.fillText(icon, px / 1.1 * 0.3, px / 1.1 * 0.34);
    }
    sctx.font = `${px}px ${EMOJI_FONT}`;
    sctx.fillText(icon, 0, 0);
    sprite = { canvas, side };
    spriteCache.set(key, sprite);
    return sprite;
  };

  const drawObjects = (ctx, time) => {
    const { cx, cy, R } = view;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    objs.forEach(object => {
      const tier = TIERS[object.tier];
      const d = Math.hypot(cx - object.x, cy - object.y);
      const squeeze = clamp((d - R * 0.8) / (R * 2.2), 0.25, 1);
      const alpha = Math.min(1, object.age * 2.5);
      if (S.flags.trails && object.trail.length > 4) {
        ctx.strokeStyle = "rgba(190,210,255,.35)";
        ctx.lineWidth = Math.max(1, object.size * 0.12);
        ctx.beginPath();
        ctx.moveTo(object.trail[0], object.trail[1]);
        for (let index = 2; index < object.trail.length; index += 2) ctx.lineTo(object.trail[index], object.trail[index + 1]);
        ctx.stroke();
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(object.x, object.y);
      ctx.rotate(Math.atan2(cy - object.y, cx - object.x));
      ctx.scale(1 + (1 - squeeze) * 1.6, squeeze);
      if (object.ev) {
        const color = EVENTS[object.ev].color;
        ctx.shadowColor = color;
        ctx.shadowBlur = object.size * 1.2;
        ctx.globalAlpha = alpha * (object.life - object.age < 4 ? 0.5 + 0.5 * Math.sin(object.age * 14) : 1);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, object.size * 0.85, 0, TAU);
        ctx.stroke();
        ctx.font = `${Math.round(object.size * 1.1)}px ${EMOJI_FONT}`;
        ctx.fillText(EVENTS[object.ev].icon, 0, 0);
        ctx.restore();
        return;
      }
      const glow = object.exotic ? "exotic" : drag?.set?.has(object) || hover === object ? "hl" : "";
      const sprite = getSprite(tier.icon, object.size, object.n > 1, glow);
      ctx.drawImage(sprite.canvas, -sprite.side / 2, -sprite.side / 2, sprite.side, sprite.side);
      ctx.restore();
    });
    const focus = drag?.items[0]?.o || hover;
    if (focus && objs.includes(focus)) {
      const tier = TIERS[focus.tier];
      const label = focus.ev ? `${EVENTS[focus.ev].icon} ${EVENTS[focus.ev].name}: ${EVENTS[focus.ev].text} for ${Math.round(eventSeconds())}s` : `${focus.n > 1 ? `${fmt(focus.n)} × ` : ""}${tier.name} · ${fmt(focus.mass)} kg${focus.exotic ? " · EXOTIC x25" : ""}`;
      ctx.font = "600 12px sans-serif";
      const width = ctx.measureText(label).width + 16;
      const x = clamp(focus.x, width / 2 + 6, view.w - width / 2 - 6);
      const y = focus.y - focus.size * 0.8 - 14;
      ctx.fillStyle = "rgba(0,0,0,.72)";
      ctx.fillRect(x - width / 2, y - 11, width, 22);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, x, y);
    }
    drones.forEach(drone => {
      const x = cx + Math.cos(drone.a) * (R * 2.5 + 16);
      const y = cy + Math.sin(drone.a) * (R * 2.5 + 16) * 0.7;
      if (drone.target && objs.includes(drone.target) && drone.target.tug) {
        ctx.strokeStyle = "rgba(255,224,102,.5)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(drone.target.x, drone.target.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = "#ffe066";
      ctx.shadowColor = "#ffe066";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  };

  const drawEffects = (ctx, dt) => {
    const { cx, cy } = view;
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const p = particles[index];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(index, 1); continue; }
      if (p.attract) {
        const dx = cx - p.x;
        const dy = cy - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.vx += dx / d * 900 * dt;
        p.vy += dy / d * 900 * dt;
      } else p.vy += 120 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let index = rings.length - 1; index >= 0; index -= 1) {
      const ring = rings[index];
      ring.age += dt;
      if (ring.age >= ring.life) { rings.splice(index, 1); continue; }
      if (ring.age < 0) continue;
      const t = ring.age / ring.life;
      const ease = 1 - (1 - t) ** 3;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.from + (ring.to - ring.from) * ease, 0, TAU);
      ctx.lineWidth = ring.width * (1 - t) + 0.5;
      ctx.strokeStyle = `rgba(${ring.color},${(1 - t) * 0.9})`;
      ctx.shadowColor = `rgba(${ring.color},1)`;
      ctx.shadowBlur = 18;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (let index = beams.length - 1; index >= 0; index -= 1) {
      const beam = beams[index];
      beam.age += dt;
      if (beam.age >= beam.life) { beams.splice(index, 1); continue; }
      const t = beam.age / beam.life;
      const grad = ctx.createLinearGradient(beam.x, beam.y, cx, cy);
      grad.addColorStop(0, `rgba(255,214,230,${0.9 * (1 - t)})`);
      grad.addColorStop(1, `rgba(255,92,138,${0.2 * (1 - t)})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 4 * (1 - t) + 1;
      ctx.beginPath();
      ctx.moveTo(beam.x, beam.y);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    }
    ctx.restore();
    if (S.nova > 0 && game.stage < 2) {
      const wait = Math.max(6, 60 / (1 + 4 * S.nova));
      const charge = clamp(1 - novaTimer / wait, 0, 1);
      ctx.beginPath();
      ctx.arc(cx, cy, view.R * 1.9, -Math.PI / 2, -Math.PI / 2 + TAU * charge);
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.strokeStyle = `rgba(255,${Math.round(120 + 100 * charge)},160,${0.35 + 0.55 * charge})`;
      ctx.stroke();
    }
    if (S.combo > 0 && combo > 1) {
      const live = buffOn("warp") ? 1 : clamp(comboTimer / (4 + S.tempo), 0, 1);
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(94,230,255,${0.5 + 0.5 * live})`;
      ctx.font = `800 ${18 + combo * 0.8}px sans-serif`;
      ctx.fillText(`CHAIN ×${combo}`, cx, cy + view.R * 2.6 + 18);
      ctx.fillStyle = "rgba(94,230,255,0.7)";
      ctx.fillRect(cx - 40, cy + view.R * 2.6 + 26, 80 * live, 3);
    }
    ctx.textAlign = "center";
    for (let index = floaters.length - 1; index >= 0; index -= 1) {
      const item = floaters[index];
      item.age += dt;
      if (item.age > 1.2) { floaters.splice(index, 1); continue; }
      ctx.globalAlpha = 1 - item.age / 1.2;
      ctx.fillStyle = item.color;
      ctx.font = `800 ${item.big ? 24 : 16}px sans-serif`;
      ctx.fillText(item.text, item.x, item.y - item.age * 60);
    }
    ctx.globalAlpha = 1;
  };

  const resize = () => {
    const canvas = refs.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = canvas.clientWidth || window.innerWidth || 800;
    const h = canvas.clientHeight || window.innerHeight || 600;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    view.w = w;
    view.h = h;
    view.scale = clamp(Math.min(w, h) / 700, 0.6, 1.2);
    view.cx = w / 2;
    view.cy = h / 2 + 20;
    view.R = holeRadius();
    return dpr;
  };

  // ---------- HUD ----------
  const compare = mass => {
    let best = null;
    TIERS.forEach(tier => { if (tier.mass <= mass * 1.01 && (!best || tier.mass > best.mass)) best = tier; });
    return best ? `≈ ${fmt(mass / best.mass)} × ${best.name}` : `≈ ${fmt(mass / 1000)} tonnes`;
  };

  const updateHud = () => {
    refs.mass.textContent = `${fmt(game.mass)} kg`;
    refs.compare.textContent = compare(game.mass);
    refs.radius.textContent = `Event horizon radius: ${fmtLength(schwarzschild(game.mass))}`;
    refs.spin.textContent = `🌀 ${fmt(game.spin)} Spin`;
    refs.hint.classList.toggle("hidden", game.eaten >= 3 || game.stage > 0);
    if (game.stage < 2) {
      const era = eraOf(game.mass);
      refs.era.textContent = ERAS[era][1];
      if (era > eraIndex) { eraIndex = era; toast(`New era: ${ERAS[era][1]}`); }
    } else refs.era.textContent = "";
    const logMass = Math.log10(Math.max(game.mass, 1e-40));
    const logStart = Math.log10(START_MASS);
    const lowGoal = Math.log10(UNIVERSE_MASS);
    const highGoal = Math.log10(MULTIVERSE_MASS);
    if (game.stage < 2) {
      const frac = game.stage === 0 ? (logMass - logStart) / (lowGoal - logStart) : (logMass - lowGoal) / (highGoal - lowGoal);
      refs.goalText.textContent = game.stage === 0 ? `Goal: swallow the Universe · ${fmt(game.mass)} / ${fmt(UNIVERSE_MASS)} kg` : `Goal: swallow the Multiverse · ${fmt(game.mass)} / ${fmt(MULTIVERSE_MASS)} kg`;
      refs.goalFill.style.width = `${(clamp(frac, 0, 1) * 100).toFixed(1)}%`;
      if (game.stage === 1) {
        const index = Math.min(STRANGER_QUOTES.length - 1, Math.floor(clamp(frac, 0, 1) * STRANGER_QUOTES.length));
        if (index !== strangerIndex) { strangerIndex = index; refs.strangerText.textContent = STRANGER_QUOTES[index]; refs.strangerText.classList.remove("swap"); void refs.strangerText.offsetWidth; refs.strangerText.classList.add("swap"); }
      }
    } else if (game.stage === 2) {
      const index = Math.min(WHISPERS.length - 1, Math.floor(game.fade * WHISPERS.length));
      if (index !== whisperIndex) { whisperIndex = index; refs.whisper.textContent = WHISPERS[index]; refs.whisper.classList.remove("swap"); void refs.whisper.offsetWidth; refs.whisper.classList.add("swap"); }
    }
    refs.feed.textContent = feedAge < 6 ? feedText : "";
    const active = Object.keys(EVENTS).filter(buffOn);
    const chips = active.map(id => `${EVENTS[id].icon} ${EVENTS[id].name} ${buffs[id].toFixed(1)}s`).join("|");
    if (chips !== refs.buffs._last) {
      refs.buffs._last = chips;
      refs.buffs.replaceChildren(...active.map(id => { const chip = make("span", "vf-buff", `${EVENTS[id].icon} ${EVENTS[id].name}`); chip.style.setProperty("--c", EVENTS[id].color); chip.append(make("b", "", "")); chip.dataset.id = id; return chip; }));
    }
    refs.buffs.querySelectorAll(".vf-buff").forEach(chip => { chip.lastChild.textContent = ` ${buffs[chip.dataset.id].toFixed(1)}s`; });
  };

  const frame = now => {
    if (!root || root.classList.contains("hidden")) return;
    const realDt = Math.min(0.5, (now - lastFrame) / 1000 || 0);
    const dt = Math.min(0.05, realDt);
    lastFrame = now;
    feedAge += realDt;
    pulse = Math.max(0, pulse - realDt * 2.2);
    const dpr = resize();
    if (dpr !== spriteScale) { spriteScale = dpr; spriteCache.clear(); }
    update(dt, realDt);
    view.R = holeRadius();
    const ctx = refs.canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    shake = Math.max(0, shake - realDt * 28);
    flash.a = Math.max(0, flash.a - realDt * 1.6);
    // Effects only age while the canvas is drawn, so drop them in other menus instead of letting them pile up.
    if (tab !== "cosmos") clearEffects();
    else {
      ctx.save();
      if (shake > 0.1) ctx.translate(rand(-shake, shake), rand(-shake, shake));
      drawBackground(ctx, now / 1000);
      drawHoleBack(ctx, now / 1000, dt);
      drawObjects(ctx, now / 1000);
      drawHoleFront(ctx, now / 1000, dt);
      drawEffects(ctx, dt);
      ctx.restore();
      if (flash.a > 0.01) {
        ctx.fillStyle = `rgba(${flash.color},${flash.a * 0.55})`;
        ctx.fillRect(0, 0, view.w, view.h);
      }
    }
    if (tab === "cosmos" && cursor && !sceneActive && game.stage < 2) {
      const gx = drag ? drag.px : cursor.x;
      const gy = drag ? drag.py : cursor.y;
      ctx.save();
      ctx.beginPath();
      ctx.arc(gx, gy, drag ? fieldRadius() : grabRadius(), 0, TAU);
      ctx.fillStyle = hover || drag ? "rgba(125,255,176,0.12)" : "rgba(255,255,255,0.04)";
      ctx.fill();
      ctx.setLineDash([7, 6]);
      ctx.lineDashOffset = -now / 60;
      ctx.lineWidth = 2;
      ctx.strokeStyle = hover || drag ? "rgba(125,255,176,0.9)" : "rgba(255,255,255,0.5)";
      ctx.stroke();
      ctx.restore();
    }
    if (now - lastHud > 100) { lastHud = now; updateHud(); refs.stage.style.cursor = drag ? "grabbing" : "default"; }
    if (tab === "tree" && now - lastTree > 700) { lastTree = now; updateTree(); }
    if (now - lastSave > 5000) { lastSave = now; save(); }
    raf = requestAnimationFrame(frame);
  };

  // ---------- Dragging ----------
  const pointerPosition = event => {
    const rect = refs.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const grabRadius = () => 34 * (1 + S.grab);
  const fieldRadius = () => grabRadius();
  const objectAt = (x, y) => {
    let best = null;
    let bestDistance = Infinity;
    objs.forEach(object => {
      const d = Math.hypot(object.x - x, object.y - y);
      if (d < grabRadius() && d < bestDistance) { best = object; bestDistance = d; }
    });
    return best;
  };
  const onDown = event => {
    if (sceneActive || game.stage >= 2) return;
    const { x, y } = pointerPosition(event);
    event.preventDefault();
    refs.canvas.setPointerCapture?.(event.pointerId);
    cursor = { x, y };
    drag = { items: [], px: x, py: y, vx: 0, vy: 0, lx: x, ly: y, lt: performance.now() };
  };
  const onMove = event => {
    const { x, y } = pointerPosition(event);
    cursor = { x, y };
    if (drag) {
      const now = performance.now();
      const span = Math.max(0.016, (now - drag.lt) / 1000);
      drag.vx = (x - drag.lx) / span * 0.5 + drag.vx * 0.5;
      drag.vy = (y - drag.ly) / span * 0.5 + drag.vy * 0.5;
      drag.lx = x; drag.ly = y; drag.lt = now;
      drag.px = x; drag.py = y;
      return;
    }
    hover = sceneActive ? null : objectAt(x, y);
  };
  const onUp = () => {
    if (!drag) return;
    drag.items.forEach(({ o }) => {
      const speed = Math.hypot(o.vx, o.vy);
      const cap = 900;
      if (speed > cap) { o.vx *= cap / speed; o.vy *= cap / speed; }
    });
    drag = null;
  };

  // ---------- Tabs ----------
  const clearEffects = () => {
    particles.length = 0;
    floaters.length = 0;
    rings.length = 0;
    beams.length = 0;
    flash.a = 0;
    shake = 0;
    pulse = 0;
  };
  const setTab = next => {
    clearEffects();
    tab = next;
    refs.tabs.forEach(([name, button]) => button.setAttribute("aria-pressed", String(name === tab)));
    refs.treePanel.classList.toggle("hidden", tab !== "tree");
    refs.catPanel.classList.toggle("hidden", tab !== "catalog");
    if (tab === "tree") buildTree();
    if (tab === "catalog") buildCatalog();
    drag = null;
  };

  const CATEGORIES = [
    ["atoms", "⚛️ Atoms & Particles"], ["molecules", "🧪 Molecules"], ["bio", "🧬 Biology"], ["everyday", "🏠 Everyday"],
    ["worlds", "🌍 Worlds"], ["stars", "⭐ Stars"], ["galaxies", "🌀 Galaxies"], ["cosmic", "🕸️ Cosmic"], ["multi", "🫧 Multiverse"]
  ];
  const catOf = tier => {
    if (tier.stage === 1) return "multi";
    if (/Atom$/.test(tier.name) || ["Electron", "Muon", "Proton"].includes(tier.name)) return "atoms";
    if (/Molecule|Salt Unit|Vitamin B12/.test(tier.name)) return "molecules";
    if (tier.mass < 1e-6) return "bio";
    if (tier.mass < 1e10) return "everyday";
    if (tier.mass < 3e28) return "worlds";
    if (tier.mass < 4e38) return "stars";
    if (tier.mass < 1e43) return "galaxies";
    return "cosmic";
  };
  let catTab = "atoms";
  let catOpen = null;
  let catMode = "";

  const buildDetail = tier => {
    const count = game.found[tier.index] || 0;
    const chem = window.VF_CHEM;
    const shape = chem?.has(tier.name);
    const extra = chem?.info(tier.name);
    const overlay = make("div", "vf-detail");
    overlay.addEventListener("click", event => { if (event.target === overlay) { catOpen = null; buildCatalog(); } });
    const card = make("div", "vf-detailcard");
    const close = make("button", "vf-btn vf-close", "✕");
    close.type = "button";
    close.addEventListener("click", () => { catOpen = null; buildCatalog(); });
    card.append(close);
    const head = make("div", "vf-dhead");
    head.append(make("span", "ic", tier.icon));
    const title = make("div");
    title.append(make("b", "", tier.name), make("small", "", `${fmt(tier.mass)} kg · swallowed ${fmt(count)} · ${ERAS[eraOf(tier.mass)][1]}`));
    head.append(title);
    card.append(head, make("p", "vf-fact", tier.fact));
    if (shape) {
      const modes = shape.modes;
      if (!modes.some(([id]) => id === catMode)) catMode = modes[0][0];
      const view = make("div", "vf-view");
      const draw = () => { view.replaceChildren(chem.draw(tier.name, catMode)); };
      if (modes.length > 1) {
        const row = make("div", "vf-modes");
        modes.forEach(([id, label]) => {
          const button = make("button", "vf-btn", label);
          button.type = "button";
          button.setAttribute("aria-pressed", String(id === catMode));
          button.addEventListener("click", () => {
            catMode = id;
            row.querySelectorAll("button").forEach(other => other.setAttribute("aria-pressed", String(other === button)));
            draw();
          });
          row.append(button);
        });
        card.append(row);
      }
      draw();
      card.append(view);
    }
    if (extra?.props.length) {
      const table = make("div", "vf-props");
      extra.props.forEach(([label, value]) => { table.append(make("span", "", label), make("b", "", String(value))); });
      card.append(table);
    }
    if (extra?.note) card.append(make("small", "vf-note", extra.note));
    const ratios = [];
    if (tier.mass >= 1.674e-27 * 1.5) ratios.push(`${fmt(tier.mass / 1.674e-27)} hydrogen atoms`);
    ratios.push(tier.mass >= 70 ? `${fmt(tier.mass / 70)} humans` : `${fmt(70 / tier.mass)} of these weigh as much as a human`);
    card.append(make("h4", "", "Read more"), make("p", "vf-more", extra?.more || `${tier.name} weighs ${fmt(tier.mass)} kg. Things this size are found in the ${ERAS[eraOf(tier.mass)][1]}. You have swallowed ${fmt(count)} of them so far.`), make("small", "vf-note", `In mass: ${ratios.join(" · ")}`));
    overlay.append(card);
    return overlay;
  };

  const buildCatalog = () => {
    refs.catPanel.replaceChildren();
    const wrap = make("div", "vf-cat");
    const visible = TIERS.filter(tier => tier.stage <= game.stage);
    const known = visible.filter(tier => game.found[tier.index]).length;
    wrap.append(make("h3", "", `📖 Catalog · ${known} of ${visible.length} discovered`));
    const tabs = make("div", "vf-cattabs");
    const active = CATEGORIES.filter(([id]) => visible.some(tier => catOf(tier) === id));
    if (!active.some(([id]) => id === catTab)) catTab = active[0][0];
    active.forEach(([id, label]) => {
      const inTab = visible.filter(tier => catOf(tier) === id);
      const got = inTab.filter(tier => game.found[tier.index]).length;
      const button = make("button", "vf-tab", `${label} ${got}/${inTab.length}`);
      button.type = "button";
      button.setAttribute("aria-pressed", String(id === catTab));
      button.addEventListener("click", () => { catTab = id; catOpen = null; buildCatalog(); });
      tabs.append(button);
    });
    wrap.append(tabs);
    const grid = make("div", "vf-catgrid");
    visible.filter(tier => catOf(tier) === catTab).forEach(tier => {
      const count = game.found[tier.index] || 0;
      const card = make("div", `vf-card${count ? " known" : " unknown"}`);
      const info = make("div");
      info.append(make("b", "", count ? tier.name : "???"), make("small", "", count ? `${fmt(tier.mass)} kg · swallowed ${fmt(count)}` : "Not discovered yet"));
      if (count) {
        info.append(make("small", "", tier.fact), make("small", "vf-tap", window.VF_CHEM?.has(tier.name) ? "Click to see its structure" : "Click to read more"));
        card.addEventListener("click", () => { catOpen = tier.index; buildCatalog(); });
      }
      card.append(make("div", "ic", count ? tier.icon : "❔"), info);
      grid.append(card);
    });
    wrap.append(grid);
    refs.catPanel.append(wrap);
    if (catOpen != null && game.found[catOpen]) refs.catPanel.append(buildDetail(TIERS[catOpen]));
  };

  // ---------- Skill tree view ----------
  const STEP = 150;
  const rows = {};
  let branchIdx = 0;
  let selected = null;
  let mapRoot = null;
  let dragMoved = false;
  const nodeStatus = node => {
    const open = nodeOpen(node);
    const owned = level(node);
    const canBuy = open && owned < node.max && game.spin >= nodeCost(node, owned);
    return { seen: nodeSeen(node), open, owned, canBuy };
  };

  const buyNode = (id, max) => {
    const node = NODE[id];
    if (!node || node.root || !nodeOpen(node)) return;
    let bought = 0;
    do {
      const owned = level(node);
      if (owned >= node.max) break;
      const cost = nodeCost(node, owned);
      if (game.spin < cost) break;
      game.spin -= cost;
      game.lvl[id] = owned + 1;
      bought += 1;
    } while (max && bought < 500);
    if (!bought) return;
    recompute();
    const row = rows[id];
    if (row) { row.el.classList.add("pop"); setTimeout(() => row.el.classList.remove("pop"), 160); }
    updateTree();
    save();
  };

  const updateDetail = () => {
    const box = refs.detail;
    box.replaceChildren();
    const node = NODE[selected];
    if (!node) { box.append(make("small", "", "Drag to look around, scroll or use ＋ － to zoom. Tap a star to inspect it, tap again to buy. Gold stars are keystones.")); box.style.borderColor = "#ffffff2a"; return; }
    const { open, owned } = nodeStatus(node);
    box.style.borderColor = node.branch.color;
    box.append(make("b", "", `${node.icon} ${node.name} · ${node.branch.name}${owned ? ` · Lv ${owned}` : ""}`));
    if (!open) { box.append(make("small", "", (node.stage || 0) > game.stage ? "Locked: something must change in the universe first." : `Locked: buy ${NODE[node.parent].name} first.`)); return; }
    const capped = owned >= node.max;
    box.append(make("small", "", owned ? `Now: ${nodeText(node, owned)}` : "Not bought yet"));
    if (capped) { box.append(make("small", "", "Fully unlocked.")); return; }
    const cost = nodeCost(node, owned);
    box.append(make("small", "next", `Next: ${nodeText(node, owned + 1)}`));
    box.append(make("small", "cost", `Cost: ${fmt(cost)} Spin${game.spin >= cost ? "" : ` (you have ${fmt(game.spin)})`}`));
    const row = make("div", "row");
    const buy = make("button", "vf-btn", "Buy");
    buy.type = "button";
    buy.disabled = game.spin < cost;
    buy.addEventListener("click", () => buyNode(node.id, false));
    row.append(buy);
    if (node.max > 1) {
      const max = make("button", "vf-btn", "Buy max");
      max.type = "button";
      max.disabled = game.spin < cost;
      max.addEventListener("click", () => buyNode(node.id, true));
      row.append(max);
    }
    box.append(row);
  };

  const updateTree = () => {
    if (!refs.sky) return;
    NODES.forEach(node => {
      const row = rows[node.id];
      if (!row) return;
      const { seen, open, owned, canBuy } = nodeStatus(node);
      const key = `${seen}${open}${owned}${canBuy}${node.id === selected}`;
      if (row.el._key === key) return;
      row.el._key = key;
      row.el.style.display = seen ? "" : "none";
      row.el.classList.toggle("locked", !open);
      row.el.classList.toggle("open", open);
      row.el.classList.toggle("owned", owned > 0);
      row.el.classList.toggle("afford", canBuy);
      row.el.classList.toggle("sel", node.id === selected);
      row.ic.textContent = open ? node.icon : "🔒";
      row.lv.textContent = owned && !node.keystone ? String(owned) : "";
      if (row.line) {
        row.line.style.display = seen ? "" : "none";
        row.line.classList.toggle("lit", owned > 0);
      }
    });
    refs.branchBtns.forEach(([k, button]) => {
      const branch = BRANCHES[k];
      button.classList.toggle("has", NODES.some(node => node.branch === branch && nodeSeen(node) && nodeOpen(node) && level(node) < node.max && game.spin >= nodeCost(node, level(node))));
    });
    updateDetail();
  };

  const selectNode = id => {
    const previous = selected;
    selected = id;
    if (previous && rows[previous]) rows[previous].el._key = "";
    if (rows[id]) rows[id].el._key = "";
    updateTree();
  };

  // Spine stars follow a winding path; side stars orbit their spine star and keystones sit off to the side.
  const starPos = (branch, node, calm) => {
    const j = Number(node.id.slice(branch.id.length).match(/^\d+/)[0]);
    const suffix = node.id.slice(branch.id.length + String(j).length);
    const trunk = trunkPoint(j, calm);
    const heading = trunkHeading(j, calm);
    const flip = j % 2 ? -1 : 1;
    const place = (offset, dist) => [trunk[0] + Math.cos(heading + offset) * dist, trunk[1] + Math.sin(heading + offset) * dist];
    if (suffix === "a") return place(-flip * 0.95, 132);
    if (suffix === "b") return place(flip * 0.95, 132);
    if (suffix === "k") return place(flip * 2.0, 150);
    return trunk;
  };
  // The trunk meanders, bending left and right in long swells, so each branch spreads over the map.
  // In the giant tree the meander is damped so neighbouring branches do not run into each other.
  const trunkHeading = (j, calm) => (Math.sin(j * 0.42) * 1.15 + Math.sin(j * 0.13) * 0.3) * (calm ? 0.25 : 1);
  const trunkCaches = [[[0, 0]], [[0, 0]]];
  const trunkPoint = (j, calm) => {
    const cache = trunkCaches[calm ? 1 : 0];
    while (cache.length <= j) {
      const i = cache.length;
      const [px, py] = cache[i - 1];
      const h = trunkHeading(i - 1, calm);
      cache.push([px + Math.cos(h) * STEP, py + Math.sin(h) * STEP]);
    }
    return cache[j];
  };
  const GIANT_RADIUS = 560;
  const giantAngle = k => -Math.PI / 2 + k * TAU / BRANCHES.length;
  const giantPoint = (k, x, y) => {
    const angle = giantAngle(k);
    const gx = x + GIANT_RADIUS;
    return [gx * Math.cos(angle) - y * Math.sin(angle), gx * Math.sin(angle) + y * Math.cos(angle)];
  };
  const mapView = { x: 0, y: 0, zoom: 0.9 };
  const applyView = () => {
    if (!mapRoot) return;
    mapRoot.style.transform = `translate(${mapView.x}px, ${mapView.y}px) scale(${mapView.zoom})`;
    mapRoot.classList.toggle("far", mapView.zoom < 0.55);
  };
  const zoomMap = (factor, clientX, clientY) => {
    const rect = refs.sky.getBoundingClientRect();
    const px = (clientX ?? rect.left + rect.width / 2) - rect.left;
    const py = (clientY ?? rect.top + rect.height / 2) - rect.top;
    const next = clamp(mapView.zoom * factor, game?.giant ? 0.06 : 0.25, 2);
    mapView.x = px - (px - mapView.x) * next / mapView.zoom;
    mapView.y = py - (py - mapView.y) * next / mapView.zoom;
    mapView.zoom = next;
    applyView();
  };
  const centerOn = (x, y) => {
    mapView.x = refs.sky.clientWidth / 2 - x * mapView.zoom;
    mapView.y = refs.sky.clientHeight / 2 - y * mapView.zoom;
    applyView();
  };

  const buildTree = () => {
    if (!refs.sky) return;
    const branch = BRANCHES[branchIdx];
    const giant = Boolean(game.giant);
    refs.branchBtns.forEach(([k, button]) => button.classList.toggle("on", k === branchIdx));
    refs.giantBtn.classList.toggle("on", giant);
    refs.giantBtn.textContent = giant ? "🌌 One giant tree: On" : "🌌 One giant tree: Off";
    refs.sky.style.setProperty("--c", branch.color);
    refs.sky.querySelector(".vf-map")?.remove();
    Object.keys(rows).forEach(id => delete rows[id]);
    const nodes = NODES.filter(node => (giant || node.branch === branch) && (node.stage || 0) <= game.stage);
    mapRoot = make("div", "vf-map");
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    const start = make("div", "vf-start");
    const origin = giant ? [0, 0] : [-STEP * 0.8, 0];
    if (giant) start.style.setProperty("--c", "#ffffff");
    start.style.left = `${origin[0]}px`;
    start.style.top = `${origin[1]}px`;
    const pos = {};
    nodes.forEach(node => {
      pos[node.id] = giant
        ? giantPoint(BRANCHES.indexOf(node.branch), ...starPos(node.branch, node, true))
        : starPos(branch, node);
    });
    nodes.forEach(node => {
      const [x, y] = pos[node.id];
      const [px, py] = node.parent === "root" ? origin : (pos[node.parent] || origin);
      const line = document.createElementNS(svgNs, "line");
      line.setAttribute("x1", px);
      line.setAttribute("y1", py);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
      if (giant) line.style.setProperty("--c", node.branch.color);
      svg.append(line);
      rows[node.id] = { line };
    });
    mapRoot.append(svg, start);
    nodes.forEach(node => {
      const [x, y] = pos[node.id];
      const el = make("button", `vf-st${node.big && !node.keystone ? "" : " minor"}${node.keystone ? " keystone" : ""}`);
      el.type = "button";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.setAttribute("aria-label", node.name);
      if (giant) el.style.setProperty("--c", node.branch.color);
      const ic = make("span", "ic", node.icon);
      const lv = make("span", "lv");
      el.append(ic, lv, make("span", "nm", node.name));
      el.addEventListener("click", () => {
        if (dragMoved) return;
        if (selected === node.id) buyNode(node.id, false);
        else selectNode(node.id);
      });
      mapRoot.append(el);
      Object.assign(rows[node.id], { el, ic, lv });
    });
    refs.sky.prepend(mapRoot);
    updateTree();
    if (giant) {
      mapView.zoom = 0.3;
      centerOn(0, 0);
      return;
    }
    let target = [-STEP * 0.4, 0];
    nodes.forEach(node => { if (level(node) > 0 && node.big && !node.keystone) target = pos[node.id]; });
    mapView.zoom = 0.9;
    centerOn(target[0] + STEP * 0.5, target[1]);
  };

  const pickBranch = k => {
    branchIdx = k;
    selected = null;
    if (game.giant && mapRoot) {
      refs.branchBtns.forEach(([index, button]) => button.classList.toggle("on", index === k));
      refs.sky.style.setProperty("--c", BRANCHES[k].color);
      mapView.zoom = 0.6;
      centerOn(...giantPoint(k, STEP * 3, 0));
      updateTree();
      return;
    }
    buildTree();
  };

  const build = () => {
    const style = make("style");
    style.textContent = css;
    document.head.append(style);
    root = make("div");
    root.id = "vfRoot";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Event Horizon");
    refs = {};
    refs.canvas = make("canvas");
    refs.canvas.id = "vfStage";
    refs.stage = refs.canvas;
    refs.canvas.addEventListener("pointerdown", onDown);
    refs.canvas.addEventListener("pointermove", onMove);
    refs.canvas.addEventListener("pointerup", onUp);
    refs.canvas.addEventListener("pointercancel", onUp);
    refs.canvas.addEventListener("pointerleave", () => { hover = null; cursor = null; });

    const top = make("div", "vf-top");
    top.append(make("h2", "", "🕳️ Event Horizon"));
    const tabs = make("div", "vf-tabs");
    refs.tabs = [["cosmos", "🌌 Cosmos"], ["tree", "⬆️ Upgrades"], ["catalog", "📖 Catalog"]].map(([name, label]) => {
      const button = make("button", "vf-tab", label);
      button.type = "button";
      button.addEventListener("click", () => setTab(name));
      tabs.append(button);
      return [name, button];
    });
    refs.spin = make("div", "vf-spin");
    const closeButton = make("button", "vf-btn", "Close ✕");
    closeButton.type = "button";
    closeButton.addEventListener("click", close);
    const makeTransferButton = (label, title, run) => {
      const button = make("button", "vf-btn", label);
      button.type = "button";
      button.title = title;
      button.addEventListener("click", async () => {
        const result = await run();
        toast(result.ok ? result.message : result.error);
      });
      return button;
    };
    const userOf = () => saveKey.slice("discard-event-horizon-v4-".length);
    top.append(tabs, refs.spin, makeTransferButton("⬇ Export", "Download your save", () => transfer.export(userOf())), makeTransferButton("⬆ Import", "Load a save file", () => transfer.import(userOf())), closeButton);

    const hud = make("div", "vf-hud");
    refs.mass = make("div", "vf-mass");
    refs.compare = make("div", "vf-sub");
    refs.radius = make("div", "vf-sub");
    refs.feed = make("div", "vf-feed");
    refs.era = make("div", "vf-era");
    refs.buffs = make("div", "vf-buffs");
    hud.append(refs.era, make("div", "vf-sub", "MASS"), refs.mass, refs.compare, refs.radius, refs.feed, refs.buffs);

    const bottom = make("div", "vf-bottom");
    refs.hint = make("div", "vf-hint", "Hold the mouse to pull particles with your cursor’s gravity, then guide them into the black hole");
    refs.goal = make("div", "vf-goal");
    refs.goalText = make("div");
    const bar = make("div", "vf-goalbar");
    refs.goalFill = make("div");
    bar.append(refs.goalFill);
    refs.goal.append(refs.goalText, bar);
    refs.stranger = make("div", "vf-stranger hidden");
    refs.strangerText = make("div", "vf-bubble");
    refs.stranger.append(make("div", "vf-figure", "🕴️"), refs.strangerText);
    refs.whisper = make("div", "vf-whisper");
    bottom.append(refs.hint, refs.stranger, refs.whisper, refs.goal);

    refs.treePanel = make("div", "vf-panel hidden");
    const up = make("div", "vf-up");
    const bsel = make("div", "vf-bsel");
    refs.branchBtns = BRANCHES.map((branch, k) => {
      const button = make("button", "vf-bpick");
      button.type = "button";
      button.style.setProperty("--c", branch.color);
      button.append(make("span", "bi", branch.spine[0][1]), make("span", "", branch.name));
      button.addEventListener("click", () => pickBranch(k));
      bsel.append(button);
      return [k, button];
    });
    refs.giantBtn = make("button", "vf-bpick vf-giant");
    refs.giantBtn.type = "button";
    refs.giantBtn.style.setProperty("--c", "#b89bff");
    refs.giantBtn.addEventListener("click", () => {
      game.giant = !game.giant;
      selected = null;
      save();
      buildTree();
    });
    bsel.prepend(refs.giantBtn);
    refs.sky = make("div", "vf-sky");
    refs.detail = make("div", "vf-pick");
    const zoomBox = make("div", "vf-zoomb");
    [["＋", () => zoomMap(1.25)], ["－", () => zoomMap(0.8)], ["⌖", () => buildTree()]].forEach(([label, action]) => {
      const button = make("button", "vf-btn", label);
      button.type = "button";
      button.addEventListener("click", action);
      zoomBox.append(button);
    });
    let press = null;
    refs.sky.addEventListener("pointerdown", event => {
      if (event.target.closest(".vf-zoomb")) return;
      press = { x: event.clientX, y: event.clientY, vx: mapView.x, vy: mapView.y };
      dragMoved = false;
    });
    refs.sky.addEventListener("pointermove", event => {
      if (!press) return;
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      if (!dragMoved && Math.hypot(dx, dy) > 6) { dragMoved = true; refs.sky.classList.add("drag"); refs.sky.setPointerCapture?.(event.pointerId); }
      if (dragMoved) { mapView.x = press.vx + dx; mapView.y = press.vy + dy; applyView(); }
    });
    const release = () => { press = null; refs.sky.classList.remove("drag"); setTimeout(() => { dragMoved = false; }, 0); };
    refs.sky.addEventListener("pointerup", release);
    refs.sky.addEventListener("pointercancel", release);
    refs.sky.addEventListener("wheel", event => { event.preventDefault(); zoomMap(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY); }, { passive: false });
    refs.sky.append(zoomBox);
    up.append(bsel, refs.sky, refs.detail);
    refs.treePanel.append(up);

    refs.catPanel = make("div", "vf-panel hidden");
    root.append(refs.canvas, top, hud, bottom, refs.treePanel, refs.catPanel);
    document.body.append(root);
    initStars();
  };

  const close = () => {
    if (!root) return;
    save();
    cancelAnimationFrame(raf);
    root.querySelectorAll(".vf-scene, .vf-toast").forEach(item => item.remove());
    sceneActive = false;
    drag = null;
    root.classList.add("hidden");
  };

  const keyFor = userId => `discard-event-horizon-v4-${userId || "guest"}`;
  const download = (name, text) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  const isOpen = userId => Boolean(root) && !root.classList.contains("hidden") && saveKey === keyFor(userId);
  // Shared by the in-game buttons and the Games area: both read and write the same per-account save.
  const transfer = {
    export(userId) {
      if (isOpen(userId)) save();
      const raw = localStorage.getItem(keyFor(userId));
      if (!raw) return { ok: false, error: "There is no Event Horizon save to export yet. Play for a bit first." };
      download(`event-horizon-save-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ format: "discard-event-horizon", version: 1, game: JSON.parse(raw) }));
      return { ok: true, message: "Event Horizon save exported." };
    },
    import(userId) {
      return new Promise(resolve => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.addEventListener("change", async () => {
          const file = input.files[0];
          if (!file) return resolve({ ok: false, error: "No file chosen." });
          try {
            const parsed = JSON.parse(await file.text());
            if (parsed?.format !== "discard-event-horizon") throw new Error("That is not an Event Horizon save file.");
            const imported = normalize(parsed.game);
            if (!imported) throw new Error("That save file is damaged or from an unsupported version.");
            if (!window.confirm("Replace your current Event Horizon progress with this file? This cannot be undone.")) return resolve({ ok: false, error: "Import cancelled." });
            localStorage.setItem(keyFor(userId), JSON.stringify(imported));
            if (isOpen(userId)) {
              game = load();
              recompute();
              objs.length = 0;
              combo = 0;
              applyStage();
              toast("Save imported.");
            }
            resolve({ ok: true, message: `Imported save: ${fmt(imported.mass)} kg, ${fmt(imported.spin)} Spin.` });
          } catch (error) {
            resolve({ ok: false, error: error.message || "Could not read that file." });
          }
        });
        input.click();
      });
    }
  };
  window.voidForgeTransfer = transfer;

  window.openVoidForge = userId => {
    saveKey = keyFor(userId);
    try {
      localStorage.removeItem(`discard-void-forge-${userId || "guest"}`);
      localStorage.removeItem(`discard-event-horizon-${userId || "guest"}`);
      localStorage.removeItem(`discard-event-horizon-v3-${userId || "guest"}`);
    } catch {}
    if (!root) build();
    game = load();
    recompute();
    objs.length = 0;
    particles.length = 0;
    floaters.length = 0;
    rings.length = 0;
    beams.length = 0;
    flash.a = 0;
    shake = 0;
    combo = 0;
    drones.length = 0;
    pulse = 0;
    feedText = "";
    root.classList.remove("hidden");
    setTab("cosmos");
    applyStage();
    view.R = holeRadius();
    const away = Math.min(OFFLINE_CAP, Math.max(0, (Date.now() - game.last) / 1000));
    if (game.stage >= 2) game.fade = Math.min(1, game.fade + away / FADE_SECONDS);
    else if (away > 60 && S.accretion > 0) {
      const efficiency = Math.min(1.5, 0.3 + S.offline);
      const before = game.mass;
      const fold = Math.min(20, passiveRate() * efficiency * away);
      game.spin += fold * spinPerFold(game.mass) * spinMult();
      game.mass *= Math.exp(fold);
      toast(`Welcome back! You grew by ${fmt(game.mass - before)} kg while you were away.`);
    }
    for (let index = 0; index < 3; index += 1) if (game.stage < 2) spawnObject();
    spawnTimer = 1;
    lastFrame = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    window.addEventListener("pagehide", save, { once: true });
  };
})();
