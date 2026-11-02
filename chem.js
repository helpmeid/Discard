// Structure data and viewers for the Event Horizon catalog: atoms (shell model / electron cloud),
// a few particles, and molecules (ball-and-stick / space-filling). Keys match the catalog names in clicker.js.
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (parent) parent.append(node);
    return node;
  };
  const text = (parent, x, y, value, attrs = {}) => {
    const node = el("text", { x, y, "text-anchor": "middle", "dominant-baseline": "central", fill: "#fff", "font-size": 12, "font-weight": 700, ...attrs }, parent);
    node.textContent = value;
    return node;
  };
  const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const COLORS = { H: "#f4f4ff", C: "#4b4f5c", N: "#4a7dff", O: "#ff4d4d", S: "#ffd23f", Na: "#a96bff", Cl: "#3ddc84", Fe: "#e07a2f", Mg: "#7ed957" };
  const VDW = { H: 1.2, C: 1.7, N: 1.55, O: 1.52, S: 1.8, Na: 2.27, Cl: 1.75 };

  // shells: electrons per shell, A: mass number of the common isotope
  const ATOMS = {
    "Hydrogen Atom": { sym: "H", Z: 1, A: 1, shells: [1], cat: "Nonmetal", color: "#f4f4ff", more: "Hydrogen makes up about 75% of all ordinary matter. Nearly all of it was made in the first minutes after the Big Bang. One proton and one electron: the simplest atom there is. Inside the Sun, hydrogen fuses into helium and releases the light that warms Earth." },
    "Deuterium Atom": { sym: "H", Z: 1, A: 2, shells: [1], cat: "Nonmetal (isotope)", color: "#f4f4ff", more: "Heavy hydrogen: one proton plus one neutron. About 1 in 6,400 hydrogen atoms in seawater is deuterium. Water made with it is called heavy water, used in some nuclear reactors and in research." },
    "Helium Atom": { sym: "He", Z: 2, A: 4, shells: [2], cat: "Noble gas", color: "#ffd9a0", more: "The second most common element in the universe. A full outer shell means helium almost never reacts with anything. It boils at 4.2 K (-269 °C), and liquid helium cools MRI magnets. It was found in the Sun's light in 1868, decades before anyone found it on Earth." },
    "Lithium Atom": { sym: "Li", Z: 3, A: 7, shells: [2, 1], cat: "Alkali metal", color: "#ff7a9c", more: "The lightest metal: soft enough to cut with a knife, and light enough to float on oil. Lithium powers the rechargeable batteries in phones and electric cars. Stars destroy it, so most of the universe's lithium dates back to the Big Bang." },
    "Carbon Atom": { sym: "C", Z: 6, A: 12, shells: [2, 4], cat: "Nonmetal", color: "#8a90a6", more: "Four outer electrons let carbon bond to itself and many others, building the chains and rings that life is made of. Diamond, graphite and graphene are all pure carbon. Carbon is made inside stars when three helium nuclei fuse together." },
    "Nitrogen Atom": { sym: "N", Z: 7, A: 14, shells: [2, 5], cat: "Nonmetal", color: "#6d95ff", more: "Makes up 78% of the air, where two atoms hold on with a triple bond so strong the gas barely reacts. Nitrogen is needed for DNA and proteins, and fertiliser made from it helps feed roughly half of humanity." },
    "Oxygen Atom": { sym: "O", Z: 8, A: 16, shells: [2, 6], cat: "Nonmetal", color: "#ff6b6b", more: "About 21% of the air and the most common element in Earth's crust. Oxygen makes up around 65% of your body's mass, mostly as water. The oxygen in the air was produced by photosynthesis over billions of years." },
    "Neon Atom": { sym: "Ne", Z: 10, A: 20, shells: [2, 8], cat: "Noble gas", color: "#ff9a5c", more: "A noble gas with completely full shells, so it forms almost no compounds. When electricity passes through neon gas in a tube it glows red-orange: that's a neon sign. It was discovered in 1898 and named from the Greek for 'new'." },
    "Sodium Atom": { sym: "Na", Z: 11, A: 23, shells: [2, 8, 1], cat: "Alkali metal", color: "#a96bff", more: "A soft silver metal that reacts violently with water. Its single outer electron is easily given away, which is why it pairs with chlorine to make table salt. Nerve signals in your body depend on sodium ions crossing cell membranes." },
    "Silicon Atom": { sym: "Si", Z: 14, A: 28, shells: [2, 8, 4], cat: "Metalloid", color: "#b3a58a", more: "The second most abundant element in Earth's crust, mostly locked in sand and quartz. Silicon is a semiconductor, so it sits at the heart of computer chips and solar cells. The silicon crystals used for chips are grown to be extraordinarily pure." },
    "Iron Atom": { sym: "Fe", Z: 26, A: 56, shells: [2, 8, 14, 2], cat: "Transition metal", color: "#e07a2f", more: "Iron-56 is one of the most tightly bound nuclei, so fusion inside stars stops making energy at iron. Earth's core is mostly iron. Each hemoglobin molecule in your blood uses iron atoms to carry oxygen." },
    "Copper Atom": { sym: "Cu", Z: 29, A: 64, shells: [2, 8, 18, 1], cat: "Transition metal", color: "#d9824a", more: "One of the first metals people used, over 10,000 years ago. Copper conducts electricity very well, so it is in most wires. Mixed with tin it makes bronze." },
    "Silver Atom": { sym: "Ag", Z: 47, A: 108, shells: [2, 8, 18, 18, 1], cat: "Transition metal", color: "#d6dbe8", more: "Silver has the highest electrical and thermal conductivity of any metal. It is used in jewellery, mirrors, electronics and antibacterial coatings. Its symbol Ag comes from the Latin 'argentum'." },
    "Gold Atom": { sym: "Au", Z: 79, A: 197, shells: [2, 8, 18, 32, 18, 1], cat: "Transition metal", color: "#ffd54a", more: "Too heavy to be made in ordinary stars; most gold was forged when neutron stars collided. It barely reacts, so it never tarnishes. All the gold ever mined would fit in a cube about 21 metres on a side." },
    "Lead Atom": { sym: "Pb", Z: 82, A: 208, shells: [2, 8, 18, 32, 18, 4], cat: "Post-transition metal", color: "#7f8aa3", more: "Lead-208 is the heaviest stable nucleus known. Soft and dense, lead is used in batteries and radiation shielding, but it is poisonous. Its symbol Pb comes from the Latin 'plumbum'." },
    "Uranium Atom": { sym: "U", Z: 92, A: 238, shells: [2, 8, 18, 32, 21, 9, 2], cat: "Actinide", color: "#8cff6b", more: "One of the heaviest elements found in nature. Uranium-235 can sustain a nuclear chain reaction and fuels power plants. Uranium-238 has a half-life of 4.5 billion years, about the age of the Earth, so half of it would still be here after that long." }
  };

  const PARTICLES = {
    Electron: { kind: "electron", color: "#7fd4ff", props: [["Charge", "-1"], ["Mass", "9.109e-31 kg"], ["Spin", "1/2"], ["Made of", "nothing smaller known"]], more: "Found in 1897 by J. J. Thomson. It carries one unit of negative charge and is about 1/1836 of a proton's mass. As far as we know it has no inner parts. Electrons flowing through wires are electricity, and how they sit around atoms decides all of chemistry." },
    Muon: { kind: "electron", color: "#c58bff", props: [["Charge", "-1"], ["Mass", "207 × electron"], ["Lifetime", "2.2 microseconds"], ["Made of", "nothing smaller known"]], more: "A heavier cousin of the electron, about 207 times its mass. Muons are made when cosmic rays hit the upper atmosphere, and each lasts only 2.2 microseconds. Thanks to time dilation (Einstein's relativity) enough survive to reach the ground: about one muon passes through your hand every second." },
    Proton: { kind: "proton", color: "#ff6b6b", props: [["Charge", "+1"], ["Mass", "1.6726e-27 kg"], ["Quarks", "up, up, down"], ["Lifetime", "no decay ever seen"]], more: "Made of three quarks (two up and one down) held together by the strong force, carried by gluons. The number of protons in a nucleus is what makes an atom a particular element. No proton has ever been seen to decay." }
  };

  // Molecules: atoms in drawing units (about one bond length); bonds [a, b, order] (0 = ionic).
  const MOLECULES = {
    "Hydrogen Molecule (H₂)": { formula: "H₂", shape: "Linear", atoms: [["H", -0.37, 0], ["H", 0.37, 0]], bonds: [[0, 1, 1]], more: "The lightest molecule. Two atoms share one pair of electrons in a single bond only 74 picometres long. Hydrogen gas leaks through almost anything and is light enough to escape Earth's gravity, which is why almost none is left in our air." },
    "Methane Molecule": { formula: "CH₄", shape: "Tetrahedral (109.5°)", atoms: [["C", 0, 0], ["H", -0.9, -0.75], ["H", 0.9, -0.75], ["H", -0.9, 0.75], ["H", 0.9, 0.75]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], more: "In 3D the four hydrogens sit at the corners of a tetrahedron, 109.5° apart; this drawing flattens it. Methane is the main part of natural gas. It is also a strong greenhouse gas, made by microbes in wetlands and in cows." },
    "Ammonia Molecule": { formula: "NH₃", shape: "Trigonal pyramid (107°)", atoms: [["N", 0, -0.1], ["H", -0.95, 0.55], ["H", 0.95, 0.55], ["H", 0, -1.1]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]], more: "Nitrogen with three hydrogens and one lone pair of electrons, which makes the molecule a pyramid. It has a sharp smell. Huge amounts are made industrially (the Haber–Bosch process) to produce fertiliser." },
    "Water Molecule": { formula: "H₂O", shape: "Bent (104.5°)", atoms: [["O", 0, 0], ["H", -0.76, 0.59], ["H", 0.76, 0.59]], bonds: [[0, 1, 1], [0, 2, 1]], more: "Oxygen pulls the shared electrons toward itself, so the molecule is slightly negative at the oxygen end and positive at the hydrogens. That lets water molecules stick together with hydrogen bonds, which is why ice floats and water is liquid at room temperature. A glass of water holds about 8 × 10²⁴ of them." },
    "Carbon Dioxide Molecule": { formula: "CO₂", shape: "Linear (180°)", atoms: [["O", -1.16, 0], ["C", 0, 0], ["O", 1.16, 0]], bonds: [[0, 1, 2], [1, 2, 2]], more: "Carbon joined to two oxygens by double bonds, in a straight line. It is only about 0.04% of the air but traps heat. Plants take it in during photosynthesis, and you breathe out around 1 kg of it per day." },
    "Ethanol Molecule": { formula: "C₂H₆O", shape: "Chain with an OH group", atoms: [["C", 0, 0], ["C", 1.25, 0.75], ["O", 2.5, 0.05], ["H", -0.8, -0.6], ["H", -0.7, 0.85], ["H", 0.3, -1.0], ["H", 1.25, 1.85], ["H", 1.6, -0.35], ["H", 3.3, 0.6]], bonds: [[0, 1, 1], [1, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1], [1, 6, 1], [1, 7, 1], [2, 8, 1]], more: "Two carbons and an OH group. Yeast makes it by fermenting sugar, and it is the alcohol in drinks. The OH group lets it mix freely with water. It is also used as a fuel and a disinfectant." },
    "Salt Unit (NaCl)": { formula: "NaCl", shape: "Ionic crystal", ionic: true, atoms: [["Na", -1.3, 0], ["Cl", 1.3, 0]], bonds: [[0, 1, 0]], more: "Not a true molecule: sodium gives one electron to chlorine, making Na⁺ and Cl⁻ ions that attract each other (an ionic bond). In a salt crystal every ion is surrounded by six of the opposite kind. In water they come apart and float around freely." },
    "Glucose Molecule": { formula: "C₆H₁₂O₆", shape: "Six-membered ring", hideH: true, atoms: [["O", 0, -1], ["C", 0.87, -0.5], ["C", 0.87, 0.5], ["C", 0, 1], ["C", -0.87, 0.5], ["C", -0.87, -0.5], ["O", 1.73, -1], ["O", 1.73, 1], ["O", 0, 2], ["O", -1.73, 1], ["C", -1.73, -1], ["O", -2.6, -0.5]], bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 4, 1], [4, 5, 1], [5, 0, 1], [1, 6, 1], [2, 7, 1], [3, 8, 1], [4, 9, 1], [5, 10, 1], [10, 11, 1]], more: "Shown in its ring form with the hydrogens left out. Cells burn glucose with oxygen to power themselves, and plants build it from carbon dioxide and water using sunlight. Your brain uses about a fifth of your energy, almost all of it from glucose." },
    "Caffeine Molecule": { formula: "C₈H₁₀N₄O₂", shape: "Two fused rings", hideH: true, atoms: [["C", 0, -1], ["C", 0.87, -0.5], ["C", 0.87, 0.5], ["N", 0, 1], ["C", -0.87, 0.5], ["N", -0.87, -0.5], ["N", 1.82, -0.8], ["C", 2.4, 0], ["N", 1.82, 0.8], ["O", 0, -2], ["O", -1.73, 1], ["C", -1.73, -1], ["C", 0, 2], ["C", 2.2, -1.8]], bonds: [[0, 1, 1], [1, 2, 2], [2, 3, 1], [3, 4, 1], [4, 5, 1], [5, 0, 1], [1, 6, 1], [6, 7, 1], [7, 8, 2], [8, 2, 1], [0, 9, 2], [4, 10, 2], [5, 11, 1], [3, 12, 1], [6, 13, 1]], more: "A purine with two fused rings and three methyl groups (hydrogens not shown). It blocks the adenosine receptors in your brain, so you feel less sleepy. Plants make it as a natural pesticide." },
    "Penicillin Molecule": { formula: "C₁₆H₁₈N₂O₄S (penicillin G)", shape: "Fused 4- and 5-membered rings", hideH: true, atoms: [["N", 0, 0.6], ["C", 0, -0.6], ["C", -1.2, -0.6], ["C", -1.2, 0.6], ["C", 1.1, 1], ["C", 1.8, 0], ["S", 1.1, -1], ["O", -2.1, 1.2], ["N", -2.2, -1.3], ["C", -3.3, -0.8], ["O", -3.3, 0.4], ["C", -4.4, -1.4], ["C", -5.53, -0.81], ["C", -6.38, -0.3], ["C", -7.26, -0.79], ["C", -7.27, -1.79], ["C", -6.42, -2.3], ["C", -5.54, -1.81], ["C", 1.1, 2.1], ["O", 0.2, 2.7], ["O", 2, 2.7], ["C", 2.7, 0.7], ["C", 2.7, -0.7]], bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 0, 1], [0, 4, 1], [4, 5, 1], [5, 6, 1], [6, 1, 1], [3, 7, 2], [2, 8, 1], [8, 9, 1], [9, 10, 2], [9, 11, 1], [11, 12, 1], [12, 13, 2], [13, 14, 1], [14, 15, 2], [15, 16, 1], [16, 17, 2], [17, 12, 1], [4, 18, 1], [18, 19, 2], [18, 20, 1], [5, 21, 1], [5, 22, 1]], more: "The four-membered beta-lactam ring on the left is the active part: it stops bacteria from building their cell walls. Fleming spotted the effect of Penicillium mould in 1928. Shown as penicillin G, hydrogens not shown." },
    "Cholesterol Molecule": { formula: "C₂₇H₄₆O", shape: "Four fused rings and a tail", hideH: true, atoms: [["C", 0.866, -0.5], ["C", 0, -1], ["C", -0.866, -0.5], ["C", -0.866, 0.5], ["C", 0, 1], ["C", 0.866, 0.5], ["C", 1.732, 1], ["C", 2.598, 0.5], ["C", 2.598, -0.5], ["C", 1.732, -1], ["C", 1.732, -2], ["C", 2.598, -2.5], ["C", 3.464, -2], ["C", 3.464, -1], ["C", 4.35, -0.7], ["C", 4.9, -1.5], ["C", 4.35, -2.3], ["O", -1.732, 1], ["C", 0.866, -1.5], ["C", 3.464, -3], ["C", 5.2, -2.95], ["C", 5, -3.95], ["C", 6.1, -2.45], ["C", 7, -2.95], ["C", 7.9, -2.45], ["C", 8.8, -2.95], ["C", 8.8, -3.95], ["C", 9.7, -2.45]], bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 4, 1], [4, 5, 1], [5, 0, 1], [5, 6, 2], [6, 7, 1], [7, 8, 1], [8, 9, 1], [9, 0, 1], [9, 10, 1], [10, 11, 1], [11, 12, 1], [12, 13, 1], [13, 8, 1], [13, 14, 1], [14, 15, 1], [15, 16, 1], [16, 12, 1], [3, 17, 1], [0, 18, 1], [12, 19, 1], [16, 20, 1], [20, 21, 1], [20, 22, 1], [22, 23, 1], [23, 24, 1], [24, 25, 1], [25, 26, 1], [25, 27, 1]], more: "A steroid with four fused rings and a branched tail (hydrogens not shown). It sits in every animal cell membrane and is the raw material for hormones such as testosterone and estrogen, and for vitamin D. Your liver makes most of what your body needs." }
  };

  // Things we cannot draw atom by atom, but still have extra reading for.
  const READ = {
    "Chlorophyll Molecule": "A large ring (a porphyrin) holding a single magnesium atom at its centre. It absorbs red and blue light and reflects green, which is why leaves are green. Too big to draw here: it has about 137 atoms. Nearly all life's energy starts with this molecule.",
    "Vitamin B12": "The largest vitamin, with about 180 atoms built around a single cobalt atom. Only microbes can make it, so animals get it from food. Too big to draw here.",
    Insulin: "A hormone with 51 amino acids in two chains joined by sulfur bridges. It tells your cells to take in glucose. It was the first protein ever to have its amino acid sequence worked out (Frederick Sanger, 1955).",
    Hemoglobin: "Four protein chains, each holding a heme group with an iron atom that grabs one oxygen molecule. One red blood cell carries about 270 million hemoglobin molecules.",
    "Antibody (IgG)": "A Y-shaped protein whose two arms each bind one specific target (an antigen). Your body can make billions of different antibodies, and each one is a lock for a different key.",
    Rubisco: "The enzyme that grabs carbon dioxide during photosynthesis. It is slow and clumsy, but there is so much of it that it is probably the most abundant protein on Earth.",
    Ribosome: "A molecular machine of RNA and proteins that reads messenger RNA and strings amino acids into proteins. A fast-growing cell can have many thousands of them.",
    Titin: "The largest known protein, in your muscles, with about 35,000 amino acids. It acts like a spring that lets muscle spring back after stretching.",
    "Human Chromosome 21": "The smallest human chromosome, with about 46 million DNA base pairs. Having three copies instead of two causes Down syndrome."
  };

  const bounds = atoms => {
    const xs = atoms.map(a => a[1]);
    const ys = atoms.map(a => a[2]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };

  const drawMolecule = (data, mode) => {
    const svg = el("svg", { viewBox: "0 0 300 300", class: "vf-struct" });
    const box = bounds(data.atoms);
    const width = Math.max(box.x1 - box.x0, 0.1);
    const height = Math.max(box.y1 - box.y0, 0.1);
    const sf = mode === "space";
    const pad = sf ? 2.4 : 0;
    const scale = Math.min(280 / (width + pad), 280 / (height + pad), 70);
    const px = x => 150 + (x - (box.x0 + box.x1) / 2) * scale;
    const py = y => 150 + (y - (box.y0 + box.y1) / 2) * scale;
    const defs = el("defs", {}, svg);
    const syms = [...new Set(data.atoms.map(a => a[0]))];
    syms.forEach(sym => {
      const grad = el("radialGradient", { id: `g-${sym}`, cx: "35%", cy: "30%", r: "75%" }, defs);
      el("stop", { offset: "0%", "stop-color": "#fff", "stop-opacity": 0.85 }, grad);
      el("stop", { offset: "35%", "stop-color": COLORS[sym] || "#aaa" }, grad);
      el("stop", { offset: "100%", "stop-color": "#000", "stop-opacity": 0.55 }, grad);
    });
    const radius = sym => (sf ? (VDW[sym] || 1.7) * scale * 0.5 : Math.max(sym === "H" ? 5 : 8, Math.min(sym === "H" ? 9 : 15, scale * (sym === "H" ? 0.2 : 0.3))));
    if (!sf) {
      data.bonds.forEach(([a, b, order]) => {
        const A = data.atoms[a];
        const B = data.atoms[b];
        const x1 = px(A[1]);
        const y1 = py(A[2]);
        const x2 = px(B[1]);
        const y2 = py(B[2]);
        if (!order) { el("line", { x1, y1, x2, y2, stroke: "#ffd54a", "stroke-width": 3, "stroke-dasharray": "6 6" }, svg); return; }
        const length = Math.hypot(x2 - x1, y2 - y1) || 1;
        const nx = -(y2 - y1) / length;
        const ny = (x2 - x1) / length;
        for (let i = 0; i < order; i += 1) {
          const off = (i - (order - 1) / 2) * 7;
          el("line", { x1: x1 + nx * off, y1: y1 + ny * off, x2: x2 + nx * off, y2: y2 + ny * off, stroke: "#c9c9dd", "stroke-width": order > 1 ? 3 : 4.5, "stroke-linecap": "round" }, svg);
        }
      });
    }
    const order = data.atoms.map((atom, index) => ({ atom, index })).sort((a, b) => (a.atom[0] === "H" ? 0 : 1) - (b.atom[0] === "H" ? 0 : 1));
    if (sf) order.sort((a, b) => (VDW[a.atom[0]] || 1.7) - (VDW[b.atom[0]] || 1.7));
    order.forEach(({ atom }) => {
      const [sym, x, y] = atom;
      const r = radius(sym);
      el("circle", { cx: px(x), cy: py(y), r, fill: `url(#g-${sym})`, stroke: "#0006", "stroke-width": 1 }, svg);
      if (!sf || r > 10) {
        if (sym !== "C" || !data.hideH) text(svg, px(x), py(y), sym, { "font-size": sym === "H" ? 10 : 12, fill: sym === "H" ? "#222" : "#fff" });
      }
      if (data.ionic) text(svg, px(x), py(y) - r - 10, sym === "Na" ? "+" : "−", { "font-size": 20, fill: "#ffd54a" });
    });
    return svg;
  };

  const drawAtom = (data, mode) => {
    const svg = el("svg", { viewBox: "0 0 300 300", class: "vf-struct" });
    const defs = el("defs", {}, svg);
    const glow = el("radialGradient", { id: "g-cloud" }, defs);
    el("stop", { offset: "0%", "stop-color": data.color, "stop-opacity": 0.5 }, glow);
    el("stop", { offset: "100%", "stop-color": data.color, "stop-opacity": 0 }, glow);
    const rand = seeded(data.Z * 97 + data.A);
    if (mode === "cloud") {
      el("circle", { cx: 150, cy: 150, r: 145, fill: "url(#g-cloud)" }, svg);
      const n = data.shells.length;
      data.shells.forEach((count, shell) => {
        const radius = 30 + (shell + 0.5) * (110 / n);
        for (let i = 0; i < count * 14; i += 1) {
          const angle = rand() * Math.PI * 2;
          const r = radius + (rand() + rand() - 1) * (55 / n);
          el("circle", { cx: 150 + Math.cos(angle) * r, cy: 150 + Math.sin(angle) * r, r: 1.8, fill: data.color, opacity: 0.6 }, svg);
        }
      });
      el("circle", { cx: 150, cy: 150, r: 3, fill: "#ff6b6b" }, svg);
      text(svg, 150, 290, "The nucleus is about 100,000× smaller than the atom (enlarged here)", { "font-size": 9, opacity: 0.7 });
      return svg;
    }
    const shown = Math.min(data.A, 48);
    const nucleusR = 4 + 3.6 * Math.sqrt(shown);
    const protonShare = data.Z / data.A;
    for (let i = 0; i < shown; i += 1) {
      const r = nucleusR * 0.85 * Math.sqrt((i + 0.5) / shown);
      const a = i * 2.39996;
      el("circle", { cx: 150 + Math.cos(a) * r, cy: 150 + Math.sin(a) * r, r: 4.6, fill: rand() < protonShare ? "#ff6b6b" : "#9aa3b8", stroke: "#0005" }, svg);
    }
    if (data.A > shown) text(svg, 150, 292, `Nucleus: ${data.Z} protons and ${data.A - data.Z} neutrons (${shown} drawn)`, { "font-size": 9, opacity: 0.7 });
    const n = data.shells.length;
    const first = nucleusR + 22;
    const step = n > 1 ? Math.min(30, (140 - first) / (n - 1)) : 0;
    data.shells.forEach((count, shell) => {
      const r = first + shell * step;
      el("circle", { cx: 150, cy: 150, r, fill: "none", stroke: "#ffffff30", "stroke-width": 1.5 }, svg);
      const group = el("g", {}, svg);
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2 + shell;
        el("circle", { cx: 150 + Math.cos(a) * r, cy: 150 + Math.sin(a) * r, r: 4, fill: data.color, stroke: "#fff", "stroke-width": 1 }, group);
      }
      el("animateTransform", { attributeName: "transform", type: "rotate", from: "0 150 150", to: `${shell % 2 ? "-" : ""}360 150 150`, dur: `${5 + shell * 3}s`, repeatCount: "indefinite" }, group);
    });
    return svg;
  };

  const drawParticle = (data, mode) => {
    const svg = el("svg", { viewBox: "0 0 300 300", class: "vf-struct" });
    const defs = el("defs", {}, svg);
    const glow = el("radialGradient", { id: "g-part" }, defs);
    el("stop", { offset: "0%", "stop-color": data.color, "stop-opacity": 0.9 }, glow);
    el("stop", { offset: "100%", "stop-color": data.color, "stop-opacity": 0 }, glow);
    if (data.kind === "proton") {
      el("circle", { cx: 150, cy: 150, r: 120, fill: "url(#g-part)", opacity: 0.45 }, svg);
      const quarks = [["u", 150, 95, "#ff6b6b"], ["u", 102, 178, "#6bff9a"], ["d", 198, 178, "#6b9aff"]];
      quarks.forEach(([, x1, y1], i) => {
        const [, x2, y2] = quarks[(i + 1) % 3];
        el("line", { x1, y1, x2, y2, stroke: "#ffd54a", "stroke-width": 3, "stroke-dasharray": "4 5", opacity: 0.8 }, svg);
      });
      quarks.forEach(([label, x, y, color]) => {
        el("circle", { cx: x, cy: y, r: 22, fill: color, stroke: "#fff", "stroke-width": 2 }, svg);
        text(svg, x, y, label, { "font-size": 18, fill: "#111" });
      });
      text(svg, 150, 275, "Two up quarks and one down quark, bound by gluons", { "font-size": 10, opacity: 0.75 });
      return svg;
    }
    el("circle", { cx: 150, cy: 150, r: 110, fill: "url(#g-part)" }, svg);
    el("circle", { cx: 150, cy: 150, r: 9, fill: data.color, stroke: "#fff", "stroke-width": 2 }, svg);
    text(svg, 150, 275, "A point-like particle: no inner parts known", { "font-size": 10, opacity: 0.75 });
    return svg;
  };

  const has = name => {
    if (ATOMS[name]) return { kind: "atom", modes: [["shell", "Shell model"], ["cloud", "Electron cloud"]] };
    if (MOLECULES[name]) return { kind: "molecule", modes: [["stick", "Ball & stick"], ["space", "Space-filling"]] };
    if (PARTICLES[name]) return { kind: "particle", modes: [["view", "Structure"]] };
    return null;
  };
  const draw = (name, mode) => {
    if (ATOMS[name]) return drawAtom(ATOMS[name], mode);
    if (MOLECULES[name]) return drawMolecule(MOLECULES[name], mode);
    if (PARTICLES[name]) return drawParticle(PARTICLES[name], mode);
    return null;
  };
  const info = name => {
    const atom = ATOMS[name];
    if (atom) return { more: atom.more, props: [["Symbol", atom.sym], ["Protons", atom.Z], ["Neutrons", atom.A - atom.Z], ["Electrons", atom.Z], ["Shells", atom.shells.join(" · ")], ["Type", atom.cat]] };
    const molecule = MOLECULES[name];
    if (molecule) return { more: molecule.more, props: [["Formula", molecule.formula], ["Shape", molecule.shape], ["Atoms drawn", molecule.atoms.length], ["Bonds drawn", molecule.bonds.length]], note: molecule.hideH ? "Skeletal drawing: hydrogens are not shown." : "" };
    const particle = PARTICLES[name];
    if (particle) return { more: particle.more, props: particle.props };
    if (READ[name]) return { more: READ[name], props: [] };
    return null;
  };

  window.VF_CHEM = { has, draw, info };
})();
