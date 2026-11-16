/* Optimierer und Flaschenhals-Analyse */
(function () {
  "use strict";
  const C = window.Calc;
  const O = {};
  const clone = (o) => JSON.parse(JSON.stringify(o));
  O.clone = clone;
  const EPS = 1e-6;
  // Zeilen und Steine, die weniger als 0,15 % bringen, werden nicht vorgeschlagen (sonst füllt der Optimierer alles mit Kleinkram)
  const MIN_GAIN = 0.0015;

  O.damage = function (build, db) { return C.evaluate(build, db, { light: true, fast: true }).exp; };
  /* Bewertung eines Builds. Ohne Ziel-Einstellung reiner Schaden. Mit O.goal fließt das Überleben ein:
     w = Gewicht (0…1) der ausgehaltenen Treffer, minHits = Treffer, die man mindestens aushalten will. */
  O.goal = { w: 0, minHits: 0 };
  O.score = function (build, db) {
    const G = O.goal;
    if (!G || (!(G.w > 0) && !(G.minHits > 0))) return O.damage(build, db);
    const col = C.collect(build, db);
    let s = C.evaluate(build, db, { light: true, fast: true, col }).exp;
    const sv = C.survival(build, db, col);
    if (G.w > 0) s = Math.pow(Math.max(s, 1e-9), 1 - G.w) * Math.pow(sv.hits * 1000, G.w);
    if (G.minHits > 0 && sv.hits < G.minHits) s *= Math.pow(sv.hits / G.minHits, 3);
    return s;
  };

  O.entry = function (build, slotId) {
    if (!build.equip[slotId]) build.equip[slotId] = { item: null, up: 0, lines: [], rare: [], innate: [], stones: [], on: false };
    const e = build.equip[slotId];
    ["lines", "rare", "innate", "stones"].forEach((k) => { if (!e[k]) e[k] = []; });
    return e;
  };
  O.sockets = function (slot, item) {
    if (!slot.stoneKind || !item) return 0;
    if (item.sockets != null) return item.sockets;
    return slot.id === "shoes" ? 2 : 3;
  };
  O.slotActive = function (build, db, slot) {
    const e = build.equip[slot.id];
    if (!e) return false;
    return slot.kind === "bonus" ? !!e.on : !!C.itemById(db, e.item);
  };

  // Bonus-Gruppen eines Slots: normale Zeilen, 6/7, eingebaute Zufallsboni
  O.groups = function (build, db, slot) {
    const e = build.equip[slot.id];
    const out = [];
    if (!O.slotActive(build, db, slot)) return out;
    const item = C.itemById(db, e.item);
    const up = e.up || 0;
    if (slot.lines) out.push({ key: "lines", count: slot.lines, pool: db.pools[slot.pool] || {}, up, blocked: item && item.fixed && !item.innate ? Object.keys(item.fixed) : [] });
    if (slot.rare) out.push({ key: "rare", count: slot.rare, pool: db.pools[slot.rarePool] || {}, up, blocked: [] });
    if (item && item.innate) item.innate.forEach((pid, i) => out.push({ key: "innate", index: i, count: 1, pool: db.pools[pid] || {}, up, blocked: [] }));
    return out;
  };
  // tier "good" = realistisch. Bei normalen Boni die zweithöchste Stufe. Bei eingebauten Zufallsboni (DSS/FKS usw.)
  // sind Höchstwerte Glückstreffer, dort gelten rund zwei Drittel des Maximums.
  function tierValue(pool, bid, up, tier, innate) {
    const st = C.poolSteps(pool, bid, up);
    if (!st.length) return 0;
    const max = st[st.length - 1];
    if (tier !== "good") return max;
    if (innate) {
      if (st.length === 1) return Math.round(max * 0.7);
      return st.reduce((best, v) => (Math.abs(v - max * 0.67) < Math.abs(best - max * 0.67) ? v : best), st[0]);
    }
    return st.length > 1 ? st[st.length - 2] : max;
  }
  O.tierValue = tierValue;

  // Eine Gruppe gierig füllen. mode: "fill" = nur freie Zeilen, "replace" = alles außer gesperrten Zeilen neu
  function optimizeGroup(build, db, slot, grp, opts) {
    const e = build.equip[slot.id];
    let base = O.score(build, db);
    if (grp.key === "innate") {
      const cur = e.innate[grp.index];
      if (cur && cur.lock) return;
      // Ein vorhandener Zufallsbonus ist gewürfelt und bleibt, wie er ist. Nur das theoretische Maximum (innate: "opt") darf ihn ändern.
      if (cur && cur.b && (opts.mode === "fill" || opts.innate !== "opt")) return;
      let best = cur || null, bestS = base;
      Object.keys(grp.pool).forEach((bid) => {
        const v = tierValue(grp.pool, bid, grp.up, opts.tier, true);
        e.innate[grp.index] = { b: bid, v };
        const s = O.score(build, db);
        if (s > bestS * (1 + EPS)) { bestS = s; best = { b: bid, v }; }
      });
      e.innate[grp.index] = best;
      return;
    }
    let arr = e[grp.key];
    // Werte, die das Stück schon hat: Bleibt ein Bonus erhalten, behält er seinen echten Wert (nie herunterstufen)
    const owned = {};
    arr.forEach((l) => { if (l.b) owned[l.b] = l.v; });
    // Neu verteilt werden nur gesperrte-freie Zeilen aus dem normalen Pool. Was nicht im Pool steht
    // (z. B. der negative Fertigkeitsschaden einer DSS-Waffe oder Server-Sonderboni), gehört fest zum Stück und bleibt.
    if (opts.mode === "replace") arr = arr.filter((l) => l.lock || (l.b && grp.pool[l.b] == null));
    else arr = arr.filter((l) => l.b);
    e[grp.key] = arr;
    base = O.score(build, db);
    const cand = Object.keys(grp.pool).concat(Object.keys(owned).filter((b) => grp.pool[b] == null));
    while (arr.length < grp.count) {
      const used = new Set(arr.map((l) => l.b).concat(grp.blocked));
      let best = null, bestS = base;
      cand.forEach((bid) => {
        if (used.has(bid)) return;
        const tv = tierValue(grp.pool, bid, grp.up, opts.tier);
        const v = owned[bid] != null ? (opts.tier === "good" ? owned[bid] : Math.max(owned[bid], tv)) : tv;
        if (!v) return;
        arr.push({ b: bid, v });
        const s = O.score(build, db);
        arr.pop();
        if (s > bestS * (1 + EPS)) { bestS = s; best = { b: bid, v }; }
      });
      if (!best || bestS < base * (1 + MIN_GAIN)) break;
      arr.push(best); base = bestS;
    }
  }
  function optimizeStones(build, db, slot, opts) {
    const e = build.equip[slot.id];
    const item = C.itemById(db, e.item);
    const n = O.sockets(slot, item);
    if (!n) { e.stones = []; return; }
    let arr = (e.stones || []).filter((s) => s && s.s);
    if (opts.mode === "replace") arr = arr.filter((s) => s.lock);
    arr = arr.slice(0, n);
    e.stones = arr;
    let base = O.score(build, db);
    const cands = db.stones.filter((s) => s.kind === slot.stoneKind);
    while (arr.length < n) {
      const usedIds = new Set(arr.map((s) => s.s));
      const usedFam = new Set(arr.map((s) => { const st = C.stoneById(db, s.s); return st && st.fam; }).filter(Boolean));
      let best = null, bestS = base;
      cands.forEach((st) => {
        if (usedIds.has(st.id) || (st.excl && usedIds.has(st.excl)) || (st.fam && usedFam.has(st.fam))) return;
        if (cands.some((o) => o.excl === st.id && usedIds.has(o.id))) return;
        // realistisch: eine Stufe unter dem Höchstwert des Steins
        const lv = opts.tier === "good" && st.values.length > 1 ? st.values.length - 2 : st.values.length - 1;
        arr.push({ s: st.id, l: lv });
        const s = O.score(build, db);
        arr.pop();
        if (s > bestS * (1 + EPS)) { bestS = s; best = { s: st.id, l: lv }; }
      });
      if (!best || bestS < base * (1 + MIN_GAIN)) break;
      arr.push(best); base = bestS;
    }
  }

  // Einen Slot optimieren (Gegenstand bleibt, außer opts.items)
  O.optimizeSlot = function (build, db, slotId, opts) {
    opts = Object.assign({ mode: "fill", tier: "max", upgrade: true, items: false, stones: true }, opts || {});
    const slot = C.slotById(db, slotId);
    if (!slot) return;
    const e = O.entry(build, slotId);
    if (slot.kind === "bonus") { if (opts.enableExtras && !slot.free) e.on = true; if (!e.on) return; }
    if (slot.kind === "item" && opts.items) {
      const cands = O.itemCandidates(build, db, slot, opts);
      if (cands.length) {
        let best = null, bestS = -1, bestDef = -1;
        const saved = clone(e);
        cands.forEach((it) => {
          const t = clone(saved);
          t.item = it.id; t.up = C.itemMaxUp(it);
          if (it.id !== saved.item) {
            delete t.bm;
            // Zeilen entfernen, die der neue Gegenstand nicht haben kann
            const lp = db.pools[slot.pool] || {};
            t.lines = (t.lines || []).filter((l) => lp[l.b] != null || l.lock);
          }
          if ((it.innate || []).join() !== ((C.itemById(db, saved.item) || {}).innate || []).join()) t.innate = [];
          build.equip[slotId] = t;
          fillSlot(build, db, slot, Object.assign({}, opts, { mode: opts.mode }));
          const s = O.score(build, db);
          const d = it.def ? C.kp(typeof C.firstVal(it.def) === "number" ? it.def : {}, t.up) : 0;
          if (s > bestS * (1 + EPS) || (Math.abs(s - bestS) <= bestS * EPS && d > bestDef)) { bestS = s; bestDef = d; best = clone(t); }
        });
        build.equip[slotId] = best || saved;
        return;
      }
    }
    if (!O.slotActive(build, db, slot)) return;
    const item = C.itemById(db, e.item);
    if (item && opts.upgrade) {
      const oldUp = e.up || 0;
      e.up = C.itemMaxUp(item);
      // eingebaute Zufallsboni wachsen mit der Verbesserung mit
      (e.innate || []).forEach((l, i) => {
        if (!l || !l.b || !item.innate) return;
        const pool = db.pools[item.innate[i]];
        if (l.v === tierValue(pool, l.b, oldUp, "max")) l.v = tierValue(pool, l.b, e.up, "max");
      });
    }
    fillSlot(build, db, slot, opts);
  };
  function fillSlot(build, db, slot, opts) {
    const e = build.equip[slot.id];
    const item = C.itemById(db, e.item);
    O.groups(build, db, slot).forEach((g) => { if (opts.noRare && g.key === "rare") return; optimizeGroup(build, db, slot, g, opts); });
    if (opts.stones !== false && slot.stoneKind) optimizeStones(build, db, slot, opts);
  }
  // Welche Gegenstände kommen für einen Slot in Frage? Waffentyp: "any" = egal, "same" = wie die aktuelle Waffe, sonst der genannte Typ
  O.itemCandidates = function (build, db, slot, opts) {
    const cls = build.cls;
    let wt = (opts && opts.wtype) || build.weaponType || "any";
    if (wt === "same") { const cur = C.itemById(db, (build.equip.weapon || {}).item); wt = cur && cur.wtype ? cur.wtype : "any"; }
    return db.items.filter((it) => it.slot === slot.id && (!it.cls || it.cls.indexOf(cls) >= 0) && (it.lvl || 0) <= build.level
      && (slot.id !== "weapon" || wt === "any" || it.wtype === wt));
  };

  // Alle Slots, mehrere Durchläufe, in Häppchen damit die Oberfläche flüssig bleibt
  O.optimizeAllAsync = function (srcBuild, db, opts, onProgress) {
    opts = Object.assign({ mode: "fill", tier: "max", upgrade: true, items: false, passes: 2, enableExtras: false }, opts || {});
    const build = clone(srcBuild);
    const before = O.score(build, db);
    const order = db.slots.filter((s) => !opts.slots || opts.slots.indexOf(s.id) >= 0).map((s) => s.id);
    const tasks = [];
    for (let p = 0; p < opts.passes; p++) order.forEach((id) => tasks.push({ id, pass: p }));
    return new Promise((resolve) => {
      let i = 0;
      function step() {
        const t0 = performance.now();
        while (i < tasks.length && performance.now() - t0 < 24) {
          const t = tasks[i++];
          // Im zweiten Durchlauf alles Nicht-Gesperrte neu verteilen, weil sich die Gewichte verschoben haben
          O.optimizeSlot(build, db, t.id, Object.assign({}, opts, { mode: t.pass > 0 && opts.mode === "replace" ? "replace" : opts.mode, items: opts.items && t.pass === 0 }));
        }
        if (onProgress) onProgress(i / tasks.length);
        if (i < tasks.length) setTimeout(step, 0);
        else resolve({ build, before, after: O.score(build, db) });
      }
      step();
    });
  };

  /* ---------- Potenzial je Slot (für die Hitze-Anzeige) ---------- */
  // opts = Planungs-Einstellungen (tier, noRare, upgrade, items, extras, wtype). Ohne Angabe: alles, Höchstwerte.
  O.slotPotential = function (build, db, only, opts) {
    const po = Object.assign({ tier: "max", upgrade: true, items: true, extras: true }, opts || {}, { mode: "replace" });
    const cur = O.score(build, db);
    const out = {};
    if (cur <= 0) return out;
    db.slots.forEach((slot) => {
      if (slot.free || (only && only.indexOf(slot.id) < 0)) return;
      const active = O.slotActive(build, db, slot);
      const t = clone(build);
      let hasItem = true;
      if (slot.kind === "item" && !active) {
        if (!po.items || !O.itemCandidates(t, db, slot, po).length) return;
        O.optimizeSlot(t, db, slot.id, Object.assign({}, po, { items: true }));
        hasItem = false;
      } else if (slot.kind === "bonus" && !active) {
        if (!po.extras) return;
        O.optimizeSlot(t, db, slot.id, Object.assign({}, po, { items: false, enableExtras: true }));
        hasItem = false;
      } else {
        O.optimizeSlot(t, db, slot.id, Object.assign({}, po, { items: false }));
      }
      const gain = O.score(t, db) / cur - 1;
      let itemGain = null;
      if (slot.kind === "item" && active && po.items) {
        const t2 = clone(build);
        O.optimizeSlot(t2, db, slot.id, Object.assign({}, po, { items: true }));
        itemGain = O.score(t2, db) / cur - 1;
      }
      const e = build.equip[slot.id] || {};
      const item = C.itemById(db, e.item);
      const free = active ? O.groups(build, db, slot).reduce((a, g) => a + Math.max(0, g.count - (g.key === "innate" ? (e.innate[g.index] && e.innate[g.index].b ? 1 : 0) : (e[g.key] || []).filter((l) => l.b).length)), 0) : 0;
      out[slot.id] = { gain: Math.max(0, gain), itemGain: itemGain == null ? null : Math.max(0, itemGain), empty: !hasItem, free, upLeft: item ? C.itemMaxUp(item) - (e.up || 0) : 0 };
    });
    return out;
  };

  /* ---------- Hebel je Bonus ---------- */
  // Was in der aktuellen Ausrüstung mit den Planungs-Einstellungen höchstens erreichbar wäre
  O.reachable = function (build, db, bid, opts) {
    const po = Object.assign({ tier: "max", upgrade: true }, opts || {});
    let max = 0;
    db.slots.forEach((slot) => {
      if (slot.free || !O.slotActive(build, db, slot)) return;
      const e = build.equip[slot.id];
      const item = C.itemById(db, e.item);
      const upRef = item ? (po.upgrade ? C.itemMaxUp(item) : (e.up || 0)) : 0;
      O.groups(build, db, slot).forEach((g) => {
        if (g.blocked.indexOf(bid) >= 0) return;
        if (g.key === "rare" && po.noRare) { (e.rare || []).forEach((l) => { if (l.b === bid) max += l.v; }); return; }
        if (g.key === "innate") {
          // ein vorhandener Zufallsbonus ist gewürfelt und zählt mit seinem Wert, ein freier Platz mit dem planbaren Wert
          const l = e.innate[g.index];
          if (l && l.b) { if (l.b === bid) max += l.v; } else max += tierValue(g.pool, bid, upRef, po.tier, true);
          return;
        }
        const own = (e[g.key] || []).find((l) => l.b === bid);
        max += Math.max(own ? own.v : 0, tierValue(g.pool, bid, item ? upRef : g.up, po.tier));
      });
      const n = O.sockets(slot, item);
      if (n) { const st = db.stones.filter((x) => x.kind === slot.stoneKind && x.bonus === bid); if (st.length) max += Math.max.apply(null, st.map((x) => x.values[po.tier === "good" && x.values.length > 1 ? x.values.length - 2 : x.values.length - 1])); }
      if (item && item.fixed && item.fixed[bid]) max += Math.round(C.kp(item.fixed[bid], upRef) * (1 + (Number(e.bm) || 0) / 100));
      if (slot.base && slot.base[bid]) max += slot.base[bid];
    });
    (db.toggles || []).forEach((t) => { if (build.toggles && build.toggles[t.id] && t.b[bid]) max += t.b[bid]; });
    return max;
  };

  O.levers = function (build, db, res, opts) {
    const col = res.col, cur = res.exp;
    const list = [];
    if (cur <= 0) return list;
    const withB = (mod) => {
      const c2 = { B: Object.assign({}, col.B), src: col.src, weapon: col.weapon, armorDef: col.armorDef };
      mod(c2.B);
      return C.evaluate(build, db, { light: true, col: c2 }).exp;
    };
    Object.keys(db.bonusTypes).forEach((bid) => {
      const bt = db.bonusTypes[bid];
      if (bt.g === "def" && bid !== "vit") return;
      const have = col.B[bid] || 0;
      const step = bt.u === "" ? (["str", "dex", "vit", "int"].indexOf(bid) >= 0 ? 10 : (bid === "av" || bid === "mav" || bid.indexOf("sash") === 0 ? 50 : 10)) : 10;
      const up = withB((B) => { B[bid] = have + step; });
      const stepGain = up / cur - 1;
      const without = have ? withB((B) => { B[bid] = 0; }) : cur;
      const share = have ? 1 - without / cur : 0;
      const reach = Math.max(O.reachable(build, db, bid, opts), have);
      const maxGain = reach > have ? withB((B) => { B[bid] = reach; }) / cur - 1 : 0;
      if (stepGain <= 1e-5 && share <= 1e-5) {
        if (have > 0 && bt.g === "off") list.push({ id: bid, name: bt.name, unit: bt.u, have, step, stepGain: 0, share: 0, reach, maxGain: 0, wasted: true });
        return;
      }
      list.push({ id: bid, name: bt.name, unit: bt.u, have, step, stepGain, share, reach, maxGain, wasted: false });
    });
    list.sort((a, b) => b.maxGain - a.maxGain || b.stepGain - a.stepGain);
    return list;
  };

  /* ---------- Hinweise ---------- */
  O.diagnostics = function (build, db, res) {
    const out = [];
    const ctx = res.ctx, T = ctx.T, g = ctx.g, cur = res.exp;
    const pct = (x) => (x * 100).toFixed(1).replace(".", ",") + " %";
    const tr = (key) => res.trace.find((t) => t.key === key);
    const w = ctx.w;
    if (!w.type) { out.push({ sev: 3, icon: "⚔️", title: "Keine Waffe angelegt", text: "Ohne Waffe fehlt der größte Teil des Angriffswerts." }); return out; }
    if (res.isSkill && res.attack.magic && !w.mMax) out.push({ sev: 3, icon: "🔮", title: "Waffe ohne magischen Angriffswert", text: "Diese Fertigkeit rechnet mit dem magischen Angriffswert der Waffe. Die gewählte Waffe hat keinen." });
    if (res.isSkill && res.attack.archery && w.type !== "bow") out.push({ sev: 3, icon: "🏹", title: "Bogen-Fertigkeit ohne Bogen", text: "Fernkampf-Fertigkeiten verursachen ohne Bogen keinen Schaden." });
    if (res.isSkill && res.attack.unsure) out.push({ sev: 1, icon: "❔", title: "Formel dieser Fertigkeit unbestätigt", text: "Der Wiki-Simulator führt diese Fertigkeit als nicht fertig umgesetzt. Das Ergebnis ist nur ein Richtwert." });
    // Angriffsfaktor
    if (ctx.af.K1 < 90) {
      const need = Math.ceil((270 - ctx.s.lv) / 2);
      const t = O.clone(build); t.stats.dex += Math.max(0, need - ctx.s.dex);
      const gain = O.score(t, db) / O.score(build, db) - 1;
      out.push({ sev: gain > 0.05 ? 2 : 1, icon: "🎯", title: "Angriffsfaktor nicht am Maximum", gain, text: "Dein Trefferwert liegt bei " + ctx.af.K1 + " von 90. Ab DEX " + need + " (bei Level " + ctx.s.lv + ") ist er voll, das brächte " + pct(gain) + "." });
    }
    // Verteidigung des Ziels
    const d = tr("def");
    if (d && d.before > 0) {
      const loss = 1 - d.after / d.before;
      if (loss > 0.12) out.push({ sev: loss > 0.4 ? 3 : loss > 0.22 ? 2 : 1, icon: "🧱", title: "Ziel-Verteidigung schluckt " + pct(loss), text: "Vor der Verteidigung stehen " + Math.round(d.before).toLocaleString("de-DE") + " Schaden, danach " + Math.round(d.after).toLocaleString("de-DE") + ". Durchbohrende Treffer holen die Verteidigung zurück, und alles vor der Verteidigung (Angriffswert, Stark gegen …) wirkt hier doppelt." });
    }
    // Waffenverteidigung
    const wd = tr("wdef");
    if (wd && wd.before > 0) {
      const loss = 1 - wd.after / wd.before;
      const cls = db.classes[build.cls];
      const alts = (cls.wtypes || []).filter((t) => t !== w.type).map((t) => ({ t, r: (T.wres && T.wres[C.WRES_KEY[t]]) || 0 })).filter((a) => a.r < ((T.wres && T.wres[C.WRES_KEY[w.type]]) || 0));
      let text = "Das Ziel hat " + ((T.wres && T.wres[C.WRES_KEY[w.type]]) || 0) + " % " + C.WTYPE_NAME[w.type] + "-Verteidigung.";
      if (alts.length) text += " Gegen " + alts.map((a) => C.WTYPE_NAME[a.t] + " nur " + a.r + " %").join(", ") + ".";
      if (ctx.pvp) text += " Bruch der Waffenverteidigung (Talisman) wirkt dagegen.";
      if (loss > 0.05) out.push({ sev: loss > 0.4 ? 3 : loss > 0.2 ? 2 : 1, icon: "🛡️", title: "Waffenverteidigung des Ziels: −" + pct(loss), text });
    }
    // Magiewiderstand
    const mr = tr("mres");
    if (mr && mr.before > 0) { const loss = 1 - mr.after / mr.before; if (loss > 0.05) out.push({ sev: loss > 0.35 ? 3 : 2, icon: "🌀", title: "Magiewiderstand des Ziels: −" + pct(loss), text: "Magiebruch (Stein, Pet) senkt den wirksamen Widerstand. Du hast " + g("antiMagic") + " %." }); }
    // Elemente
    if (!ctx.pvp && T.elem) {
      C.ELEMENTS.forEach((el) => {
        if (!T.elem[el]) return;
        const have = g(C.EL_BONUS[el]);
        const col = res.col, c2 = { B: Object.assign({}, col.B), src: col.src, weapon: col.weapon, armorDef: col.armorDef };
        c2.B[C.EL_BONUS[el]] = have + 20;
        const gain = C.evaluate(build, db, { light: true, col: c2 }).exp / cur - 1;
        if (have < 30) out.push({ sev: have === 0 ? 3 : 2, icon: "⚡", title: "Element-Schwäche des Ziels kaum genutzt", gain, text: "Das Ziel trägt das Element " + C.EL_NAME[el] + " (Widerstand " + ((T.eres && T.eres[el]) || 0) + "). Du hast " + have + " % " + db.bonusTypes[C.EL_BONUS[el]].name + ". Schon +20 % bringen " + pct(gain) + " (Talisman, Alchemie, Elixier)." });
      });
      const wrong = C.ELEMENTS.filter((el) => g(C.EL_BONUS[el]) > 0 && !T.elem[el]);
      if (wrong.length) out.push({ sev: 1, icon: "💤", title: "Element passt nicht zum Ziel", text: wrong.map((el) => db.bonusTypes[C.EL_BONUS[el]].name + " " + g(C.EL_BONUS[el]) + " %").join(", ") + " wirkt hier nur mit einem Zehntel." });
    }
    // Kritisch / Durchbohrend
    const ch = res.chances;
    if (res.isSkill && (ch.rawCrit || ch.rawPierce)) out.push({ sev: 0, icon: "ℹ️", title: "Krit/Durchbohrer gelten für Fertigkeiten abgeschwächt", text: "Angezeigt " + ch.rawCrit + " % / " + ch.rawPierce + " %, wirksam bei Fertigkeiten " + ch.crit + " % / " + ch.pierce + " %." });
    if (ch.crit < 30) {
      const col = res.col, c2 = { B: Object.assign({}, col.B), src: col.src, weapon: col.weapon, armorDef: col.armorDef };
      c2.B.crit = (c2.B.crit || 0) + 20;
      const gain = C.evaluate(build, db, { light: true, col: c2 }).exp / cur - 1;
      if (gain > 0.02) out.push({ sev: gain > 0.1 ? 2 : 1, icon: "💥", title: "Niedrige Krit-Chance (" + ch.crit + " %)", gain, text: "+20 % kritische Treffer brächten " + pct(gain) + " (Waffe, Halskette, Schuhe, Stein des Todesstoß, Roter Tau)." });
    }
    // Obergrenzen
    if (g("meleeMagic") > 100) out.push({ sev: 1, icon: "🚧", title: "Magie-/Nahkampfangriff über der Grenze", text: "Es zählen höchstens 100 %. Du hast " + g("meleeMagic") + " %." });
    if (g("dmgBonus") > db.params.dmgBonusCapPct) out.push({ sev: 1, icon: "🚧", title: "Schaden (Bonus) über der Grenze", text: "Es zählen höchstens " + db.params.dmgBonusCapPct + " % und +" + db.params.dmgBonusCapFlat + " Schaden." });
    if (res.isSkill && (build.skillLevel == null ? 40 : build.skillLevel) < 40) {
      const t = O.clone(build); t.skillLevel = 40;
      const gain = O.score(t, db) / O.score(build, db) - 1;
      out.push({ sev: gain > 0.15 ? 2 : 1, icon: "📘", title: "Fertigkeit nicht auf P", gain, text: "Auf Perfekter Meister wären es " + pct(gain) + " mehr." });
    }
    if (res.isSkill && g("avgDmg") > 0) out.push({ sev: 0, icon: "💤", title: "Durchschnittsschaden wirkt nicht auf Fertigkeiten", text: g("avgDmg") + " % Durchschnittsschaden zählen nur für normale Treffer." });
    if (!res.isSkill && g("skillDmg") > 0) out.push({ sev: 0, icon: "💤", title: "Fertigkeitsschaden wirkt nicht auf normale Treffer", text: g("skillDmg") + " % Fertigkeitsschaden zählen nur für Fertigkeiten." });
    out.sort((a, b) => b.sev - a.sev || (b.gain || 0) - (a.gain || 0));
    return out;
  };

  /* ---------- Einzelschritte (nächstes bestes Upgrade) ---------- */
  // opts = Planungs-Einstellungen. Vorgeschlagen wird nur, was die Einstellungen erlauben.
  O.candidates = function (build, db, opts) {
    const po = Object.assign({ tier: "max", upgrade: true, items: true, extras: true }, opts || {});
    const cur = O.score(build, db);
    const out = [];
    if (cur <= 0) return out;
    const name = (bid) => (db.bonusTypes[bid] ? db.bonusTypes[bid].name : bid);
    const fmt = (bid, v) => name(bid) + " " + (v > 0 ? "+" : "") + v + ((db.bonusTypes[bid] || {}).u || "");
    const push = (slot, kind, title, detail, t) => {
      const s = O.score(t, db);
      if (s > cur * (1 + MIN_GAIN)) out.push({ slot: slot.id, kind, title, detail, gain: s / cur - 1, build: t });
    };
    db.slots.forEach((slot) => {
      if (slot.free) return;
      const e = build.equip[slot.id];
      const active = O.slotActive(build, db, slot);
      if (!active) {
        const t = clone(build);
        if (slot.kind === "item") {
          if (!po.items || !O.itemCandidates(t, db, slot, po).length) return;
          O.optimizeSlot(t, db, slot.id, Object.assign({}, po, { mode: "replace", items: true }));
          const it = C.itemById(db, t.equip[slot.id].item);
          push(slot, "item", slot.name + " anlegen: " + (it ? it.name : ""), "Leerer Slot, mit bester Bonus-Verteilung", t);
        } else {
          if (!po.extras) return;
          O.optimizeSlot(t, db, slot.id, Object.assign({}, po, { mode: "replace", items: false, enableExtras: true }));
          push(slot, "extra", slot.name + " nutzen", "Noch nicht eingetragen, mit bester Bonus-Verteilung", t);
        }
        return;
      }
      const item = C.itemById(db, e.item);
      // Verbesserung
      if (item && po.upgrade && (e.up || 0) < C.itemMaxUp(item)) {
        const t = clone(build); const te = t.equip[slot.id];
        const from = te.up || 0; te.up = C.itemMaxUp(item);
        // Zufallsboni wachsen nur mit, wenn sie auf der bisherigen Stufe am Höchstwert lagen
        (te.innate || []).forEach((l, i) => { if (l && l.b && item.innate && l.v === tierValue(db.pools[item.innate[i]], l.b, from, "max")) l.v = tierValue(db.pools[item.innate[i]], l.b, te.up, "max"); });
        push(slot, "up", item.name + " auf +" + te.up + " verbessern", "von +" + from, t);
      }
      // Zeilen: freie füllen oder schwächste ersetzen
      O.groups(build, db, slot).forEach((grp) => {
        if (grp.key === "rare" && po.noRare) return;
        if (grp.key === "innate") {
          const t = clone(build); const te = t.equip[slot.id];
          const old = te.innate[grp.index];
          // nur freie Plätze vorschlagen: ein vorhandener Zufallsbonus lässt sich nicht gezielt verbessern
          if (old && old.b) return;
          te.innate[grp.index] = null;
          optimizeGroup(t, db, slot, grp, { mode: "replace", tier: po.tier, innate: "opt" });
          const nw = t.equip[slot.id].innate[grp.index];
          if (nw) push(slot, "innate", slot.name + ": Zufallsbonus " + fmt(nw.b, nw.v), "freier Platz", t);
          return;
        }
        const arr = (e[grp.key] || []).filter((l) => l.b);
        const label = grp.key === "rare" ? "6./7. Bonus" : "Bonus";
        const used = new Set(arr.map((l) => l.b).concat(grp.blocked));
        const tryAdd = (baseBuild, removed) => {
          let best = null, bestS = 0;
          Object.keys(grp.pool).forEach((bid) => {
            if (used.has(bid) && !(removed && removed.b === bid)) return;
            const v = tierValue(grp.pool, bid, grp.up, po.tier);
            if (!v) return;
            const t = clone(baseBuild); t.equip[slot.id][grp.key].push({ b: bid, v });
            const s = O.score(t, db);
            if (s > bestS) { bestS = s; best = { t, bid, v }; }
          });
          return best;
        };
        if (arr.length < grp.count) {
          const b0 = clone(build); b0.equip[slot.id][grp.key] = arr.slice();
          const best = tryAdd(b0, null);
          if (best) push(slot, "line", slot.name + ": " + label + " " + fmt(best.bid, best.v), "freie Zeile", best.t);
        } else {
          // schwächste nicht gesperrte Zeile ersetzen, oder vorhandene Zeile auf einen höheren Wert bringen.
          // Zeilen außerhalb des normalen Pools gehören fest zum Stück und bleiben.
          let bestRep = null;
          arr.forEach((l, i) => {
            if (l.lock || grp.pool[l.b] == null) return;
            const b0 = clone(build); b0.equip[slot.id][grp.key] = arr.filter((_, j) => j !== i);
            const best = tryAdd(b0, l);
            if (best && (best.bid !== l.b || best.v > l.v)) { const s = O.score(best.t, db); if (!bestRep || s > bestRep.s) bestRep = { s, best, l }; }
          });
          if (bestRep) push(slot, "line", slot.name + ": " + label + " " + fmt(bestRep.best.bid, bestRep.best.v), bestRep.best.bid === bestRep.l.b ? "Wert erhöhen von " + bestRep.l.v : "statt " + fmt(bestRep.l.b, bestRep.l.v), bestRep.best.t);
        }
      });
      // Steine
      if (slot.stoneKind && O.sockets(slot, item)) {
        const t = clone(build);
        const before = JSON.stringify(t.equip[slot.id].stones || []);
        const n = O.sockets(slot, item);
        const st = (t.equip[slot.id].stones || []).filter((s) => s && s.s);
        if (st.length >= n) {
          // schwächsten nicht gesperrten Stein herausnehmen und neu wählen
          let worst = -1, worstS = -1;
          st.forEach((s, i) => { if (s.lock) return; const t2 = clone(t); t2.equip[slot.id].stones = st.filter((_, j) => j !== i); const sc = O.score(t2, db); if (sc > worstS) { worstS = sc; worst = i; } });
          if (worst >= 0) t.equip[slot.id].stones = st.filter((_, j) => j !== worst);
        }
        optimizeStones(t, db, slot, { mode: "fill", tier: po.tier });
        if (JSON.stringify(t.equip[slot.id].stones) !== before) {
          const names = t.equip[slot.id].stones.map((s) => { const x = C.stoneById(db, s.s); return x ? x.name + " +" + (x.values.length > 1 ? s.l : 4) : ""; }).join(", ");
          push(slot, "stone", slot.name + ": Geiststeine anpassen", names, t);
        }
      }
      // Gegenstand tauschen (nur wenn erlaubt, und nur innerhalb des eingestellten Waffentyps)
      if (slot.kind === "item" && po.items) {
        const t = clone(build);
        O.optimizeSlot(t, db, slot.id, Object.assign({}, po, { mode: "fill", items: true }));
        if (t.equip[slot.id].item !== e.item) { const it = C.itemById(db, t.equip[slot.id].item); push(slot, "item", slot.name + " tauschen: " + it.name + " +" + t.equip[slot.id].up, "statt " + (item ? item.name : "–") + ", passende Boni bleiben erhalten", t); }
      }
    });
    out.sort((a, b) => b.gain - a.gain);
    return out;
  };

  O.pathAsync = function (srcBuild, db, steps, onProgress, opts) {
    let build = clone(srcBuild);
    const start = O.score(build, db);
    const path = [];
    return new Promise((resolve) => {
      let i = 0;
      function step() {
        const c = O.candidates(build, db, opts);
        if (!c.length || i >= steps) return resolve({ path, start, end: O.score(build, db), build });
        const best = c[0];
        const prev = build;
        build = best.build;
        path.push({ title: best.title, detail: best.detail, slot: best.slot, gain: best.gain, total: O.score(build, db) / start - 1, build: clone(build), prev: clone(prev) });
        i++;
        if (onProgress) onProgress(i / steps);
        setTimeout(step, 0);
      }
      step();
    });
  };

  window.Opt = O;
})();
