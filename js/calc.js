/* Rechenkern.
   Formeln und Reihenfolge nach dem Schadenssimulator des offiziellen Metin2-Wikis
   (fr-wiki, MediaWiki:Script/Calculator.js, Stand 10/2026). Der Simulator ist per
   Ingame-Tests ermittelt; Magie-Werte sind dort als Näherung gekennzeichnet. */
(function () {
  "use strict";
  const fl = Math.floor;
  const C = {};

  C.ELEMENTS = ["fire", "ice", "wind", "lightning", "earth", "dark"];
  C.EL_BONUS = { fire: "elFire", ice: "elIce", wind: "elWind", lightning: "elLightning", earth: "elEarth", dark: "elDark" };
  C.EL_RES = { fire: "resFire", ice: "resIce", wind: "resWind", lightning: "resLightning", earth: "resEarth", dark: "resDark" };
  C.EL_NAME = { fire: "Feuer", ice: "Eis", wind: "Wind", lightning: "Blitz", earth: "Erde", dark: "Dunkelheit" };
  C.TYPE_BONUS = { animal: "animal", human: "human", orc: "orc", mystic: "mystic", undead: "undead", insect: "insect", desert: "desert", devil: "devil", zodiac: "zodiac" };
  C.TYPE_NAME = { none: "ohne Typ", animal: "Tier", human: "Halbmensch", orc: "Ork", mystic: "Esoterisch", undead: "Untot", insect: "Insekt", desert: "Wüste", devil: "Teufel", zodiac: "Zodiak" };
  C.CLASS_BONUS = { warrior: "vsWarrior", ninja: "vsNinja", sura: "vsSura", shaman: "vsShaman", lycan: "vsLycan" };
  C.WTYPE_NAME = { sword: "Schwert", twohand: "Zweihänder", dagger: "Dolch", bow: "Bogen", bell: "Glocke", fan: "Fächer", claw: "Kralle" };
  C.WRES_KEY = { sword: "sword", twohand: "twohand", dagger: "dagger", bow: "arrow", bell: "bell", fan: "fan", claw: "claw" };

  /* ---------- Hilfen ---------- */
  // Stützstellen {"0":a,"9":b,"15":c} linear interpolieren
  C.kp = function (obj, up) {
    if (obj == null) return 0;
    if (typeof obj === "number") return obj;
    const keys = Object.keys(obj).map(Number).sort((a, b) => a - b);
    if (!keys.length) return 0;
    if (up <= keys[0]) return obj[keys[0]];
    for (let i = 1; i < keys.length; i++) {
      if (up <= keys[i]) {
        const a = keys[i - 1], b = keys[i], t = (up - a) / (b - a);
        return obj[a] + (obj[b] - obj[a]) * t;
      }
    }
    return obj[keys[keys.length - 1]];
  };
  C.kpRange = function (obj, up) {
    if (!obj) return [0, 0];
    const keys = Object.keys(obj).map(Number).sort((a, b) => a - b);
    if (!keys.length) return [0, 0];
    const at = (k) => obj[k];
    if (up <= keys[0]) return at(keys[0]).slice();
    for (let i = 1; i < keys.length; i++) {
      if (up <= keys[i]) {
        const a = keys[i - 1], b = keys[i], t = (up - a) / (b - a);
        return [Math.round(at(a)[0] + (at(b)[0] - at(a)[0]) * t), Math.round(at(a)[1] + (at(b)[1] - at(a)[1]) * t)];
      }
    }
    return at(keys[keys.length - 1]).slice();
  };
  C.itemMaxUp = function (item) {
    if (!item) return 0;
    if (item.maxUp != null) return item.maxUp;
    let m = 0;
    ["atk", "matk", "def"].forEach((k) => { if (item[k] && typeof item[k] === "object") Object.keys(item[k]).forEach((u) => { m = Math.max(m, Number(u)); }); });
    if (item.fixed) Object.values(item.fixed).forEach((o) => { if (o && typeof o === "object") Object.keys(o).forEach((u) => { m = Math.max(m, Number(u)); }); });
    return m || 9;
  };
  // Höchstwert eines Bonus in einem Pool (Array = Stufen, Objekt = Stützstellen je Verbesserung)
  C.poolMax = function (pool, bonusId, up) {
    const v = pool && pool[bonusId];
    if (v == null) return 0;
    if (Array.isArray(v)) return v[v.length - 1];
    if (typeof v === "number") return v;
    return Math.round(C.kp(v, up || 0));
  };
  C.poolSteps = function (pool, bonusId, up) {
    const v = pool && pool[bonusId];
    if (v == null) return [];
    if (Array.isArray(v)) return v.slice();
    if (typeof v === "number") return [v];
    return [Math.round(C.kp(v, up || 0))];
  };

  /* ---------- Boni einsammeln ---------- */
  C.itemById = function (db, id) {
    if (!id) return null;
    if (!db._itemIdx || db._itemIdxSrc !== db.items) {
      db._itemIdx = {}; db._itemIdxSrc = db.items;
      db.items.forEach((it) => { db._itemIdx[it.id] = it; });
    }
    return db._itemIdx[id] || null;
  };
  C.stoneById = function (db, id) { return db.stones.find((s) => s.id === id) || null; };
  C.slotById = function (db, id) { return db.slots.find((s) => s.id === id) || null; };

  C.collect = function (build, db) {
    const B = {};
    const src = {};
    const add = (id, v, from) => {
      if (!id || !v) return;
      B[id] = (B[id] || 0) + v;
      (src[id] = src[id] || []).push({ from, v });
    };
    let weapon = null, armorDef = 0;
    db.slots.forEach((slot) => {
      const e = build.equip[slot.id];
      if (!e) return;
      const item = C.itemById(db, e.item);
      const up = Math.min(e.up || 0, item ? C.itemMaxUp(item) : (slot.maxUp || 0));
      const label = slot.name + (item ? " · " + item.name : "");
      if (slot.kind === "bonus" && !e.on) return;
      if (slot.base) Object.keys(slot.base).forEach((bid) => add(bid, slot.base[bid], label));
      if (item) {
        // Grundwerte-Bonus (z. B. „Episch +35 %" auf Privatservern): erhöht Angriffswert, mag. Angriffswert, Verteidigung und die festen Boni des Stücks
        const bm = 1 + (Number(e.bm) || 0) / 100;
        const sc = (r) => [Math.round(r[0] * bm), Math.round(r[1] * bm)];
        if (item.fixed) Object.keys(item.fixed).forEach((bid) => add(bid, Math.round(C.kp(item.fixed[bid], up) * bm), label));
        if (item.def) { const d = item.def; const dv = Array.isArray(C.firstVal(d)) ? avg(C.kpRange(d, up)) : C.kp(d, up); armorDef += Math.round(dv * bm); }
        if (slot.id === "weapon") {
          const r0 = sc(C.kpRange(item.atk, 0)), rU = sc(C.kpRange(item.atk, up));
          const mU = item.matk ? sc(C.kpRange(item.matk, up)) : [0, 0];
          weapon = { item, type: item.wtype, up, min0: r0[0], max0: r0[1], growth: Math.round(avg(rU) - avg(r0)), dMin: rU[0], dMax: rU[1], mMin: mU[0], mMax: mU[1] };
        }
      }
      (e.lines || []).forEach((l) => add(l.b, Number(l.v) || 0, label));
      (e.rare || []).forEach((l) => add(l.b, Number(l.v) || 0, label + " (6/7)"));
      (e.innate || []).forEach((l) => l && add(l.b, Number(l.v) || 0, label + " (Zufallsbonus)"));
      (e.stones || []).forEach((s) => {
        const st = s && C.stoneById(db, s.s);
        if (st) add(st.bonus, st.values[Math.min(s.l == null ? st.values.length - 1 : s.l, st.values.length - 1)], label + " · " + st.name);
      });
    });
    (db.toggles || []).forEach((t) => {
      if (build.toggles && build.toggles[t.id]) Object.keys(t.b).forEach((bid) => add(bid, t.b[bid], t.name.split(":")[0]));
    });
    return { B, src, weapon, armorDef };
  };
  C.firstVal = function (o) { const k = Object.keys(o)[0]; return o[k]; };
  function avg(r) { return (r[0] + r[1]) / 2; }

  /* ---------- Ziel ---------- */
  C.resolveTarget = function (build, db) {
    const list = db.targets;
    let t = list.find((x) => x.id === build.targetId);
    if (!t || (build.mode === "pvp") !== (t.kind === "player")) t = list.find((x) => (build.mode === "pvp") === (x.kind === "player")) || list[0];
    const o = Object.assign({ wres: {}, elem: {}, eres: {}, res: {} }, t, build.targetOverride || {});
    return o;
  };

  /* ---------- Fertigkeiten ---------- */
  C.SKILL_POWER = [0, .05, .06, .08, .10, .12, .14, .16, .18, .20, .22, .24, .26, .28, .30, .32, .34, .36, .38, .40,
    .50, .52, .54, .56, .58, .60, .63, .66, .69, .72, .82, .85, .88, .91, .94, .98, 1.02, 1.06, 1.10, 1.15, 1.25];
  C.skillLevelName = function (l) {
    if (l >= 40) return "P";
    if (l >= 30) return "G" + (l - 29);
    if (l >= 20) return "M" + (l - 19);
    return String(l);
  };
  // a = Angriff nach Primärboni (physisch) bzw. magischer Angriffswert (magisch); r = Zufallsanteil; s = Werte; k = Fertigkeitskraft; AF = Angriffsfaktor
  const R = (a, b) => [a, b];
  C.SKILLS = {
    warrior: {
      body: [
        { id: "w_b1", name: "Dreiwege-Schnitt", f: (a, s, k) => 1.1 * a + (0.5 * a + 1.5 * s.str) * k },
        { id: "w_b2", name: "Schwertwirbel", f: (a, s, k) => 3 * a + (0.8 * a + 5 * s.str + 3 * s.dex + s.vit) * k },
        { id: "w_b5", name: "Sausen", f: (a, s, k) => 2 * a + (a + 3 * s.dex + 7 * s.str + s.vit) * k },
        { id: "w_b6", name: "Lebenswille", f: (a, s, k) => (3 * a + (a + 1.5 * s.str) * k) * 1.07 },
        { id: "w_b9", name: "Erdbeben (7. Fertigkeit)", rnd: R(1, 1000), f: (a, s, k, r) => 3 * a + (0.9 * a + r + 5 * s.str + 3 * s.dex + s.lv) * k },
      ],
      mental: [
        { id: "w_m1", name: "Geist-Schlag", f: (a, s, k) => 2.3 * a + (4 * a + 4 * s.str + s.vit) * k },
        { id: "w_m2", name: "Schmetterschlag", f: (a, s, k) => 2.3 * a + (3 * a + 4 * s.str + 3 * s.vit) * k },
        { id: "w_m3", name: "Stampfer", f: (a, s, k) => 2 * a + (2 * a + 2 * s.dex + 2 * s.vit + 4 * s.str) * k },
        { id: "w_m5", name: "Schwertschlag", f: (a, s, k) => 2 * a + (a + 3 * s.dex + 5 * s.str + s.vit) * k },
        { id: "w_m6", name: "Schwertkugel", f: (a, s, k) => (2 * a + (2 * a + 2 * s.dex + 2 * s.vit + 4 * s.str) * k) * 1.1 },
        { id: "w_m9", name: "Erdbeben (7. Fertigkeit)", rnd: R(1, 1000), f: (a, s, k, r) => 3 * a + (0.9 * a + r + 5 * s.str + 3 * s.dex + s.lv) * k },
      ],
    },
    ninja: {
      blade: [
        { id: "n_b1", name: "Hinterhalt", rnd: R(500, 700), wb: ["dagger", 50], f: (a, s, k, r) => a + (1.2 * a + r + 4 * s.dex + 4 * s.str) * k },
        { id: "n_b2", name: "Blitzangriff", rnd: R(200, 300), wb: ["dagger", 35], f: (a, s, k, r) => a + (1.6 * a + r + 7 * s.dex + 7 * s.str) * k },
        { id: "n_b3", name: "Degenwirbel", f: (a, s, k) => 2 * a + (0.5 * a + 9 * s.dex + 7 * s.str) * k },
        { id: "n_b5", name: "Giftwolke", f: (a, s, k) => 2 * s.lv + (a + 3 * s.str + 18 * s.dex) * k },
        { id: "n_b6", name: "Schleichendes Gift", f: (a, s, k) => (2 * s.lv + (a + 3 * s.str + 18 * s.dex) * k) * 1.1 },
        { id: "n_b9", name: "Funkelnde Sterne (7. Fertigkeit)", rnd: R(1, 1000), f: (a, s, k, r) => a + (1.7 * a + r + 6 * s.dex + 5 * s.lv) * k },
      ],
      archery: [
        { id: "n_a1", name: "Wiederholter Schuss", unsure: true, archery: true, f: (a, s, k, r, AF) => a + 0.2 * a * fl(2 + 6 * k) + (0.8 * a + 8 * s.dex * AF + 2 * s.int) * k },
        { id: "n_a2", name: "Pfeilregen", archery: true, f: (a, s, k) => a + (1.7 * a + 5 * s.dex + s.str) * k },
        { id: "n_a3", name: "Feuerpfeil", archery: true, rnd: R(100, 300), f: (a, s, k, r) => 1.5 * a + (2.6 * a + 0.9 * s.int + r) * k },
        { id: "n_a5", name: "Giftpfeil", archery: true, rnd: R(100, 200), f: (a, s, k, r) => a + (1.4 * a + r + 7 * s.dex + 4 * s.str + 4 * s.int) * k },
        { id: "n_a6", name: "Funkenschlag", archery: true, rnd: R(100, 200), f: (a, s, k, r) => (a + (1.2 * a + r + 6 * s.dex + 3 * s.str + 3 * s.int) * k) * 1.2 },
        { id: "n_a9", name: "Sturmschuss (7. Fertigkeit)", archery: true, rnd: R(1, 1000), f: (a, s, k, r) => 1.9 * a + (2.6 * a + r) * k },
      ],
    },
    sura: {
      weapon: [
        { id: "s_w1", name: "Fingerschlag", f: (a, s, k) => a + 2 * s.lv + 2 * s.int + (2 * a + 4 * s.str + 14 * s.int) * k },
        { id: "s_w2", name: "Drachenwirbel", f: (a, s, k) => 1.1 * a + 2 * s.lv + 2 * s.int + (1.5 * a + s.str + 12 * s.int) * k },
        { id: "s_w6", name: "Zauber aufheben", magic: true, dispel: true, rnd: R(50, 100), f: (m, s, k, r, AF) => 40 + 5 * s.lv + 2 * s.int + (10 * s.int + 7 * m + r) * AF * k },
        { id: "s_w9", name: "Dämonenschlag (7. Fertigkeit)", rnd: R(1, 1000), f: (a, s, k, r) => 1.9 * a + (2.6 * a + r) * k },
      ],
      black: [
        { id: "s_b1", name: "Dunkler Schlag", magic: true, rnd: R(50, 100), f: (m, s, k, r, AF) => 40 + 5 * s.lv + 2 * s.int + (13 * s.int + 6 * m + r) * AF * k },
        { id: "s_b2", name: "Flammenschlag", magic: true, unsure: true, rnd: R(100, 500), f: (m, s, k, r) => 5 * s.lv + 2 * s.int + (7 * s.int + 8 * m + 4 * s.str + 2 * s.vit + r) * k },
        { id: "s_b3", name: "Geist der Flamme", magic: true, rnd: R(200, 500), f: (m, s, k, r, AF) => 30 + 2 * s.lv + 2 * s.int + (7 * s.int + 6 * m + r) * AF * k },
        { id: "s_b5", name: "Geisterschlag", magic: true, unsure: true, rnd: R(50, 150), f: (m, s, k, r, AF) => 40 + 2 * s.lv + 2 * s.int + (2 * s.vit + 2 * s.dex + 13 * s.int + 6 * m + r) * AF * k },
        { id: "s_b6", name: "Dunkler Stein", magic: true, f: (m, s, k, r, AF) => 120 + 6 * s.lv + (5 * s.vit + 5 * s.dex + 29 * s.int + 9 * m) * AF * k },
        { id: "s_b9", name: "Todeswelle (7. Fertigkeit)", magic: true, rnd: R(1, 1000), f: (m, s, k, r, AF) => 120 + 6 * s.lv + (5 * s.vit + 5 * s.dex + 30 * s.int + r + 9 * m) * AF * k },
      ],
    },
    shaman: {
      dragon: [
        { id: "h_d1", name: "Fliegender Talisman", magic: true, wb: ["bell", 10], f: (m, s, k, r, AF) => 70 + 5 * s.lv + (18 * s.int + 7 * s.str + 5 * m + 50) * AF * k },
        { id: "h_d2", name: "Drachenschießen", magic: true, wb: ["bell", 10], f: (m, s, k, r, AF) => 60 + 5 * s.lv + (16 * s.int + 6 * s.dex + 6 * m + 120) * AF * k },
        { id: "h_d3", name: "Drachengebrüll", magic: true, wb: ["bell", 10], f: (m, s, k, r, AF) => 70 + 3 * s.lv + (20 * s.int + 3 * s.str + 10 * m + 100) * AF * k },
        { id: "h_d9", name: "Meteor (7. Fertigkeit)", magic: true, rnd: R(1, 1000), f: (m, s, k, r, AF) => 120 + 6 * s.lv + (5 * s.vit + 5 * s.dex + 30 * s.int + r + 9 * m) * AF * k },
      ],
      heal: [
        { id: "h_h1", name: "Blitzwurf", magic: true, wb: ["fan", 10], rndf: (s) => [5 * s.int, 15 * s.int], f: (m, s, k, r, AF) => 60 + 5 * s.lv + (8 * s.int + 2 * s.dex + 8 * m + r) * AF * k },
        { id: "h_h2", name: "Blitz heraufbeschwören", magic: true, wb: ["fan", 10], rndf: (s) => [5 * s.int, 16 * s.int], f: (m, s, k, r, AF) => 40 + 4 * s.lv + (13 * s.int + 2 * s.str + 10 * m + r) * AF * k },
        { id: "h_h3", name: "Blitzkralle", magic: true, rnd: R(1, 800), f: (m, s, k, r, AF) => 50 + 5 * s.lv + (8 * s.int + 2 * s.str + 8 * m + r) * AF * k },
      ],
    },
    lycan: {
      instinct: [
        { id: "l_1", name: "Zerreißen", unsure: true, wb: ["claw", 54], f: (a, s, k) => 1.1 * a + (0.3 * a + 1.5 * s.str) * k },
        { id: "l_2", name: "Wolfsatem", wb: ["claw", 35], f: (a, s, k) => 2 * a + (a + 3 * s.dex + 5 * s.str + s.vit) * k },
        { id: "l_3", name: "Wolfssprung", wb: ["claw", 35], f: (a, s, k) => a + (1.6 * a + 200 + 7 * s.dex + 7 * s.str) * k },
        { id: "l_4", name: "Wolfsklaue", f: (a, s, k) => 3 * a + (0.8 * a + 6 * s.str + 2 * s.dex + s.vit) * k },
        { id: "l_9", name: "Peitschender Sturm (7. Fertigkeit)", rnd: R(1, 1000), f: (a, s, k, r) => 1.8 * a + (a + 6 * s.dex + r + 3 * s.str + s.lv) * k },
      ],
    },
  };
  C.skillList = function (cls, branch) { return (C.SKILLS[cls] && C.SKILLS[cls][branch]) || []; };
  C.findSkill = function (cls, branch, id) { return C.skillList(cls, branch).find((s) => s.id === id) || null; };

  /* ---------- Kontext ---------- */
  C.statAV = function (cls, s) {
    switch (cls) {
      case "ninja": return fl((s.str + 7 * s.dex) / 4);
      case "shaman": return fl((5 * s.int + s.dex) / 3);
      case "lycan": return s.vit + 2 * s.dex;
      default: return 2 * s.str;
    }
  };
  C.attackFactor = function (aDex, aLv, vDex) {
    const K1 = Math.min(90, fl((2 * aDex + aLv) / 3));
    const K2 = Math.min(90, fl((2 * (vDex || 0) + aLv) / 3));
    const AR = (K1 + 210) / 300;
    const ER = ((2 * K2 + 5) / (K2 + 95)) * 3 / 10;
    return { AF: fl((AR - ER) * 1e8) / 1e8, K1, K2, AR, ER };
  };

  C.makeCtx = function (build, db, col) {
    col = col || C.collect(build, db);
    const B = col.B, P = db.params;
    const g = (id) => B[id] || 0;
    const s = {
      lv: build.level,
      str: build.stats.str + g("str"), dex: build.stats.dex + g("dex"),
      vit: build.stats.vit + g("vit"), int: build.stats.int + g("int"),
    };
    const T = C.resolveTarget(build, db);
    const w = col.weapon || { type: null, up: 0, min0: 0, max0: 0, growth: 0, dMin: 0, dMax: 0, mMin: 0, mMax: 0 };
    const af = C.attackFactor(s.dex, s.lv, T.dex);
    const pvp = T.kind === "player";
    return { build, db, col, B, g, s, T, w, af, AF: af.AF, pvp, P, cls: build.cls };
  };

  function elementCoeff(ctx) {
    const { g, T, P } = ctx;
    const list = [];
    if (!ctx.pvp) {
      C.ELEMENTS.forEach((el) => {
        const p = g(C.EL_BONUS[el]);
        if (!p) return;
        const carried = (T.elem && T.elem[el]) ? true : false;
        list.push(carried ? P.elemMatch * (p - ((T.eres && T.eres[el]) || 0)) : P.elemOff * p);
      });
      return list;
    }
    // PvP: Portierung von calcElementCoeffPvP
    let minMalus = 0, maxDiff = 0; const saved = [];
    C.ELEMENTS.forEach((el) => {
      const p = g(C.EL_BONUS[el]);
      if (!p) return;
      const d = p - ((T.eres && T.eres[el]) || 0);
      if (d >= 0) { list.push(10 * d); minMalus -= d; maxDiff = Math.max(maxDiff, d); } else saved.push(d);
    });
    if (saved.length) {
      minMalus += maxDiff; saved.sort((a, b) => a - b);
      saved.forEach((d) => { list.push(10 * Math.max(minMalus, d)); minMalus = Math.min(0, Math.max(minMalus, minMalus - d)); });
    }
    return list;
  }

  // Primärboni (Schritte 2-10). trace: optionales Array für die Aufschlüsselung
  function primary(ctx, D, magic, skipTypes, trace) {
    const { g, T, pvp } = ctx;
    const push = (key, name, before, after, info) => { if (trace) trace.push({ key, name, before, after, info }); };
    let b;
    if (!magic) {
      b = D; D = fl(D * (100 + g("avp") + Math.min(100, g("meleeMagic"))) / 100);
      push("avp", "Angriffswert % / Nahkampfangriff", b, D);
    }
    if (skipTypes) return Math.max(0, D);
    let tb = 0, tname = "Typ-Bonus";
    if (pvp) { tb = Math.max(1, g("human") - ((T.res && T.res.human) || 0)); tname = "Stark gegen Halbmenschen"; }
    else if (T.type && C.TYPE_BONUS[T.type]) { tb = g(C.TYPE_BONUS[T.type]); tname = "Stark gegen " + C.TYPE_NAME[T.type]; }
    b = D; D += fl(D * tb / 100); push("type", tname, b, D);
    if (pvp) {
      const rb = g(C.CLASS_BONUS[T.cls] || "");
      const rr = (T.res && T.res.cls) || 0;
      b = D; D += fl(D * rb / 100) - fl(D * rr / 100); push("race", "Stark gegen Klasse − Abwehr", b, D);
    }
    if (T.kind === "stone") { b = D; D += fl(D * g("stone") / 100); push("stone", "Stark gegen Metinsteine", b, D); }
    if (!pvp) { b = D; D += fl(D * g("monster") / 100); push("monster", "Stark gegen Monster", b, D); }
    const co = elementCoeff(ctx);
    if (co.length) { b = D; let addv = 0; co.forEach((c) => { addv += Math.trunc(D * c / 10000); }); D += addv; push("element", "Kraft der Elemente", b, D); }
    return Math.max(0, D);
  }

  function targetDef(ctx, boosted) {
    const T = ctx.T;
    const d = T.def || 0;
    return (ctx.pvp && T.bio && boosted) ? fl(d * 1.1) : d;
  }
  function weaponDefense(ctx) {
    const T = ctx.T, wt = ctx.w.type;
    if (!wt) return 0;
    let wd = (T.wres && T.wres[C.WRES_KEY[wt]]) || 0;
    if (ctx.pvp && wt !== "bow") wd -= ctx.g("wbreak");
    return wd;
  }
  C.magicResCoeff = function (res, anti) {
    let r = res || 0;
    if (r > 0 && anti) r = fl(r * (1 - anti / 120) + 0.5);
    if (r <= 0) return 1;
    return 2000 / (6 * r + 1000) - 1;
  };

  C.chances = function (ctx, isSkill) {
    const { g, T, pvp } = ctx;
    const c = g("crit"), p = g("pierce");
    let cc, pc;
    if (isSkill) {
      cc = c === 0 ? 0 : (c <= 9 ? fl((c + 7) / 3) : fl((c + 5) / 3));
      pc = p <= 9 ? fl(p / 2) : 5 + fl((p - 10) / 4);
    } else {
      cc = pvp ? (c <= 9 ? (c > 0 ? fl((c + 5) / 5) : 0) : fl((c + 5) / 6)) : c;
      pc = p;
    }
    if (pvp) { cc = Math.max(0, cc - ((T.res && T.res.crit) || 0)); pc = Math.max(0, pc - ((T.res && T.res.pierce) || 0)); }
    return { crit: Math.min(100, Math.max(0, cc)), pierce: Math.min(100, Math.max(0, pc)), rawCrit: c, rawPierce: p };
  };

  // Abschluss ab Krit (Schritte 19-33)
  function finish(ctx, D, o, pre, isSkill, trace) {
    const { g, T, pvp, w } = ctx;
    const push = (key, name, before, after) => { if (trace) trace.push({ key, name, before, after }); };
    let b;
    if (o.crit) {
      b = D;
      if (pvp) D = D + 2 * Math.round(w.dMin + (w.dMax - w.dMin) * o.roll); else D = D + D;
      push("crit", "Kritischer Treffer", b, D);
    }
    if (o.pierce) {
      b = D;
      D += Math.min(targetDef(ctx, true), pre);
      D += fl(pre * 5 * Math.max(0, g("pierce") - 100) / 1000);
      push("pierce", "Durchbohrender Treffer", b, D);
    }
    const boss = !!T.boss;
    if (!isSkill) {
      b = D; D = fl(D * (100 + g("avgDmg") + (boss ? g("bossDmg") : 0)) / 100); push("avg", boss ? "Durchschnittsschaden + Boss-Schaden" : "Durchschnittsschaden", b, D);
      if (pvp) { b = D; D = fl(D * (100 - Math.min(99, (T.res && T.res.avg) || 0)) / 100); push("avgRes", "Gegner: DSS-Widerstand", b, D); }
    } else {
      b = D; D = fl(D * (100 + g("skillDmg") + (boss ? g("skillBoss") : 0)) / 100); push("skill", boss ? "Fertigkeitsschaden + Boss-Fertigkeitsschaden" : "Fertigkeitsschaden", b, D);
      if (pvp) { b = D; D = fl(D * (100 - Math.min(99, (T.res && T.res.skill) || 0)) / 100); push("skillRes", "Gegner: Fertigkeitswiderstand", b, D); }
    }
    const db = Math.min(ctx.P.dmgBonusCapPct, g("dmgBonus"));
    if (db > 0) { b = D; D += Math.min(ctx.P.dmgBonusCapFlat, fl(D * db / 100)); push("dmgBonus", "Schaden (Bonus)", b, D); }
    const fm = ctx.P.finalMult == null ? 1 : ctx.P.finalMult;
    if (fm !== 1) { b = D; D = fl(D * fm); push("server", "Server-Multiplikator", b, D); }
    return Math.max(0, D);
  }

  function baseDamage(ctx, o) {
    const { s, w, g, cls } = ctx;
    const mainAV = 2 * (s.lv + w.growth) + g("leadership");
    const roll = Math.round(w.min0 + (w.max0 - w.min0) * o.roll);
    const sec = 2 * (roll + g("sashAV")) + g("av") + (w.type === "bow" ? 25 : 0) + C.statAV(cls, s);
    return { mainAV, sec, D: mainAV + fl(ctx.AF * sec) };
  }

  // Ein einzelner Treffer. o = {roll, vari, crit, pierce}; attack = null (normaler Treffer) oder Fertigkeit
  C.hit = function (ctx, attack, o, trace) {
    const { T, s } = ctx;
    const push = (key, name, before, after) => { if (trace) trace.push({ key, name, before, after }); };
    const minFix = (d) => (d <= 2 ? 3 : d);
    let b;
    if (!attack) {
      const bd = baseDamage(ctx, o);
      let D = bd.D;
      push("base", "Basisschaden (Angriffswert × Angriffsfaktor)", 0, D);
      const pre = primary(ctx, D, false, false, trace);
      D = pre;
      b = D; D = minFix(D - targetDef(ctx, true)); push("def", "Verteidigung des Ziels", b, D);
      const wd = weaponDefense(ctx);
      if (wd) { b = D; D = Math.trunc(D * (100 - wd) / 100); push("wdef", "Waffenverteidigung des Ziels", b, D); }
      return finish(ctx, D, o, pre, false, trace);
    }
    const k = C.SKILL_POWER[Math.max(0, Math.min(40, ctx.build.skillLevel == null ? 40 : ctx.build.skillLevel))] * (ctx.P.skillPowerMult || 1);
    const rng = attack.rndf ? attack.rndf(s) : (attack.rnd || [0, 0]);
    const r = rng[0] + (rng[1] - rng[0]) * o.vari;
    const wb = (attack.wb && attack.wb[0] === ctx.w.type) ? attack.wb[1] : 0;
    if (attack.magic) {
      const m = Math.round(ctx.w.mMin + (ctx.w.mMax - ctx.w.mMin) * o.roll) + ctx.g("sashMAV");
      const Bm = ctx.g("mav");
      const aug = Bm > 0 && m > 0 ? Math.max(1, 0.0025056 * Math.pow(Bm, 0.602338) * Math.pow(m, 1.20476)) : 0;
      let D = fl(attack.f(m + aug, s, k, r, ctx.AF));
      push("base", "Fertigkeitsformel (mag. Angriffswert)", 0, D);
      if (wb) { b = D; D = fl(D * (100 + wb) / 100); push("wb", "Waffenbonus der Fertigkeit", b, D); }
      D = attack.dispel ? D : primary(ctx, D, true, false, trace);
      D = minFix(D);
      if (!attack.dispel) { b = D; D = fl(D * C.magicResCoeff(T.magicRes, ctx.g("antiMagic"))); if (D !== b) push("mres", "Magiewiderstand des Ziels", b, D); }
      const temp = D;
      b = D; D = fl(temp * (100 + ctx.g("magicAtk") + Math.min(100, ctx.g("meleeMagic"))) / 100 + 0.5); push("magicAtk", "Magischer Angriff %", b, D);
      return finish(ctx, D, o, temp, true, trace);
    }
    // physische Fertigkeit
    const bd = baseDamage(ctx, o);
    push("base", "Basisschaden (Angriffswert × Angriffsfaktor)", 0, bd.D);
    let atk = minFix(primary(ctx, bd.D, false, false, trace));
    if (attack.archery && ctx.w.type !== "bow") atk = 0;
    b = atk; let D = fl(attack.f(atk, s, k, r, ctx.AF)); push("formula", "Fertigkeitsformel (" + C.skillLevelName(ctx.build.skillLevel == null ? 40 : ctx.build.skillLevel) + ")", b, D);
    if (wb) { b = D; D = fl(D * (100 + wb) / 100); push("wb", "Waffenbonus der Fertigkeit", b, D); }
    const wd = weaponDefense(ctx);
    if (wd) { b = D; D = Math.trunc(D * (100 - wd) / 100); push("wdef", "Waffenverteidigung des Ziels", b, D); }
    if (!attack.archery) { b = D; D = minFix(D - targetDef(ctx, false)); push("def", "Verteidigung des Ziels", b, D); }
    const temp = D;
    return finish(ctx, D, o, temp, true, trace);
  };

  /* ---------- Auswertung ---------- */
  C.currentAttack = function (build) {
    if (!build.attack || build.attack === "hit") return null;
    return C.findSkill(build.cls, build.branch, build.attack);
  };

  C.evaluate = function (build, db, opts) {
    opts = opts || {};
    const col = opts.col || C.collect(build, db);
    const ctx = C.makeCtx(build, db, col);
    const attack = opts.attack !== undefined ? opts.attack : C.currentAttack(build);
    const isSkill = !!attack;
    const ch = C.chances(ctx, isSkill);
    const c = ch.crit / 100, p = ch.pierce / 100;
    const one = (roll, vari, crit, pierce) => C.hit(ctx, attack, { roll, vari, crit, pierce });
    const mean = opts.fast
      ? (crit, pierce) => one(0.5, 0.5, crit, pierce)
      : (crit, pierce) => (one(0.25, 0.25, crit, pierce) + one(0.75, 0.75, crit, pierce) + one(0.25, 0.75, crit, pierce) + one(0.75, 0.25, crit, pierce)) / 4;
    const n = mean(false, false), cr = mean(true, false), pi = mean(false, true), cp = mean(true, true);
    let exp = (1 - c) * (1 - p) * n + c * (1 - p) * cr + (1 - c) * p * pi + c * p * cp;
    let block = 0;
    if (ctx.pvp && !isSkill) { block = Math.min(100, (ctx.T.res && ctx.T.res.block) || 0); exp *= (1 - block / 100); }
    const res = { exp, normal: n, crit: cr, pierce: pi, critPierce: cp, chances: ch, block, isSkill, attack };
    if (opts.light) return res;
    res.min = one(0, 0, false, false);
    res.max = one(1, 1, false, false);
    res.maxAll = one(1, 1, true, true);
    res.ctx = ctx; res.col = col;
    const trace = [];
    C.hit(ctx, attack, { roll: 0.5, vari: 0.5, crit: false, pierce: false }, trace);
    res.trace = trace;
    if (ctx.T.hp) res.hitsToKill = Math.max(1, Math.ceil(ctx.T.hp / Math.max(1, exp)));
    return res;
  };

  /* ---------- Eigene Verteidigung (Schätzung) ---------- */
  C.defense = function (build, db, col) {
    col = col || C.collect(build, db);
    const B = col.B, g = (id) => B[id] || 0, P = db.params;
    const cp = (P.classes && P.classes[build.cls]) || { hpBase: 600, hpPerLv: 40, hpPerVit: 40 };
    const vit = build.stats.vit + g("vit");
    const def = fl((build.level + fl(vit * (P.defPerVit == null ? 1 : P.defPerVit)) + col.armorDef + g("def")) * (100 + g("defPct")) / 100);
    const hp = fl((cp.hpBase + build.level * cp.hpPerLv + vit * cp.hpPerVit + g("hp")) * (100 + g("hpPct")) / 100);
    return { def, hp, vit };
  };

  window.Calc = C;
})();
