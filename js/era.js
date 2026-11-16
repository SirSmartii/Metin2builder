/* Zeitalter: blendet Spielinhalte nach Jahr und einzeln wählbaren Features aus.
   Die Stammdaten (App.master) bleiben vollständig; gerechnet wird mit einer gefilterten Sicht (App.db). */
(function () {
  "use strict";
  const E = {};
  E.BASE_YEAR = 2008;
  E.NOW_YEAR = 2026;
  E.BASE_CAP = 99;

  /* Jahreszahlen: ungefähre Einführung auf den offiziellen deutschen Servern. Im Admin-Menü änderbar. */
  E.defaults = function () {
    return [
      { id: "rare67", name: "6./7. Bonus", year: 2010, rare: true, note: "Zusatzboni über „Segen des Drachen“ u. Ä." },
      { id: "mount", name: "Reittiere mit Boni", year: 2010, slots: ["mount"] },
      { id: "costume", name: "Kostüme & Frisuren", year: 2011, slots: ["costume", "hair"] },
      { id: "cap105", name: "Level 105 & Seon-Pyeong-Biologe", year: 2012, cap: 105, toggles: ["bio92a", "bio92b", "bio94a", "bio94b"] },
      { id: "alchemy", name: "Drachensteinalchemie", year: 2012, slots: ["ds_diamant", "ds_rubin", "ds_jade", "ds_saphir", "ds_granat", "ds_onyx", "ds_amethyst"], toggles: ["ds_set"] },
      { id: "belt", name: "Gürtel", year: 2012, slots: ["belt"] },
      { id: "lycan", name: "Lykaner", year: 2014, classes: ["lycan"], bonus: ["vsLycan", "resLycan", "resClaw"] },
      { id: "wskin", name: "Waffenskins", year: 2014, slots: ["wskin"] },
      { id: "sash", name: "Schulterband", year: 2014, slots: ["sash"], bonus: ["sashAV", "sashMAV"] },
      { id: "pet", name: "Pet-System", year: 2015, slots: ["pet"] },
      { id: "cap120", name: "Level 120 (Verwunschener Wald)", year: 2016, cap: 120 },
      { id: "zodiac", name: "Zodiak-Tempel", year: 2017, bonus: ["zodiac"], itemRe: "zodiak", targetRe: "zodiak" },
      { id: "elements", name: "Talismane & Elemente", year: 2018, slots: ["talisman"], bonus: ["elFire", "elIce", "elWind", "elLightning", "elEarth", "elDark", "resEarth", "resDark", "resIce", "insect", "desert", "wbreak"], toggleGroups: ["Elixiere"], targetRe: "^st_element_" },
      { id: "aura", name: "Aura-Kostüm", year: 2019, slots: ["aura"] },
      { id: "bossdmg", name: "Bonus „Schaden gegen Bosse“", year: 2020, bonus: ["bossDmg", "skillBoss"] },
      { id: "yohara", name: "Yohara: Handschuhe & SungMa", year: 2021, slots: ["gloves"], bonus: ["sungma", "precision"] },
      { id: "serpent", name: "Schlangen-Ausrüstung", year: 2022, itemRe: "schlangen", pools: ["serpW1", "serpW2", "serpW3", "serpA1", "serpA3"], targetRe: "schlangen" },
      { id: "moon", name: "Mondschein-Ausrüstung", year: 2025, itemRe: "mondschein", pools: ["moonW1", "moonW2", "moonW3"] },
    ];
  };

  E.ensure = function (db) {
    if (!Array.isArray(db.features) || !db.features.length) db.features = E.defaults();
    else { const have = {}; db.features.forEach((f) => { have[f.id] = 1; }); E.defaults().forEach((f) => { if (!have[f.id]) db.features.push(f); }); }
    if (!db.era || typeof db.era !== "object") db.era = { year: E.NOW_YEAR, over: {} };
    if (!db.era.over) db.era.over = {};
    return db;
  };

  E.isOn = function (db, f) { const o = db.era.over[f.id]; return o == null ? f.year <= db.era.year : !!o; };
  E.isDefault = function (db) { return db.features.every((f) => E.isOn(db, f)); };
  E.label = function (db) {
    if (E.isDefault(db)) return "Aktuell";
    const mixed = db.features.some((f) => db.era.over[f.id] != null && !!db.era.over[f.id] !== (f.year <= db.era.year));
    return db.era.year + (mixed ? " +Mix" : "");
  };

  /* Gefilterte Sicht auf die Stammdaten. Objekte werden geteilt, nur Listen sind neu. */
  E.view = function (master) {
    E.ensure(master);
    const off = master.features.filter((f) => !E.isOn(master, f));
    const v = Object.assign({}, master);
    v._itemIdx = null; v._itemIdxSrc = null;
    v.allItems = master.items;
    v.maxLevel = master.features.reduce((m, f) => (f.cap && E.isOn(master, f) ? Math.max(m, f.cap) : m), E.BASE_CAP);
    v.eraLabel = E.label(master);
    if (!off.length) { v.classOff = {}; v.bonusOff = {}; return v; }

    const set = (k) => { const s = {}; off.forEach((f) => (f[k] || []).forEach((x) => { s[x] = 1; })); return s; };
    const slotOff = set("slots"), clsOff = set("classes"), bonOff = set("bonus"), togOff = set("toggles"), togGrp = set("toggleGroups"), poolOff = set("pools");
    const rx = (k) => off.filter((f) => f[k]).map((f) => { try { return new RegExp(f[k], "i"); } catch (e) { return null; } }).filter(Boolean);
    const itemRx = rx("itemRe"), targetRx = rx("targetRe");
    const noRare = off.some((f) => f.rare);
    v.classOff = clsOff; v.bonusOff = bonOff;

    v.slots = master.slots.filter((s) => !slotOff[s.id]).map((s) => (noRare && s.rare ? Object.assign({}, s, { rare: 0, rarePool: null }) : s));
    v.pools = {};
    Object.keys(master.pools).forEach((pid) => {
      const p = master.pools[pid], q = {};
      Object.keys(p).forEach((b) => { if (!bonOff[b]) q[b] = p[b]; });
      v.pools[pid] = q;
    });
    const onlyOffCls = (it) => it.cls && it.cls.length && it.cls.every((c) => clsOff[c]);
    v.items = master.items.filter((it) => !slotOff[it.slot] && (it.lvl || 0) <= v.maxLevel && !onlyOffCls(it)
      && !itemRx.some((r) => r.test(it.id) || r.test(it.name)) && !(it.innate || []).some((p) => poolOff[p])
      && !Object.keys(it.fixed || {}).some((b) => bonOff[b]));
    v.toggles = (master.toggles || []).filter((t) => !togOff[t.id] && !togGrp[t.group] && !(Object.keys(t.b || {}).length && Object.keys(t.b).every((b) => bonOff[b])));
    v.stones = master.stones.filter((s) => !bonOff[s.bonus]);
    v.targets = master.targets.filter((t) => !targetRx.some((r) => r.test(t.id)) && !(t.kind === "player" && clsOff[t.cls]) && (t.kind === "player" || (t.lvl || 0) <= v.maxLevel + 12));
    if (v.targets.length < 2) v.targets = master.targets;
    v.allTargets = master.targets;
    return v;
  };

  /* Was ein Build nutzt, das im gewählten Zeitalter nicht existiert (nur Hinweis, nichts wird gelöscht). */
  E.conflicts = function (build, master, view) {
    const out = [], have = {};
    view.slots.forEach((s) => { have[s.id] = 1; });
    const idx = {}; view.items.forEach((it) => { idx[it.id] = 1; });
    master.slots.forEach((s) => {
      const e = build.equip && build.equip[s.id];
      if (!e || e.on === false) return;
      if (!have[s.id]) { if (e.item || (e.lines || []).some((l) => l && l.b)) out.push(s.name); return; }
      if (e.item && !idx[e.item]) { const it = master.items.find((x) => x.id === e.item); if (it) out.push(it.name); }
    });
    if (view.classOff[build.cls]) out.push(master.classes[build.cls].name);
    if (build.level > view.maxLevel) out.push("Level " + build.level);
    return out;
  };

  window.Era = E;
})();
