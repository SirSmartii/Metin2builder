/* Oberfläche: Zustand, Build-Ansicht, Slot-Editor, Optimierer, Vergleich */
(function () {
  "use strict";
  const C = window.Calc, O = window.Opt, FX = window.FX;
  const App = { db: null, build: null, builds: [], view: "build", res: null, pot: {}, sugg: [], pin: null, lastExp: null, drawerSlot: null };
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf = (v) => Math.round(v).toLocaleString("de-DE");
  const pf = (x, d) => (x * 100).toLocaleString("de-DE", { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }) + " %";
  const sign = (x) => (x >= 0 ? "+" : "−") + Math.abs(x * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
  App.esc = esc; App.nf = nf; App.pf = pf; App.$ = $; App.$$ = $$;
  const bname = (id) => (App.db.bonusTypes[id] ? App.db.bonusTypes[id].name : id);
  const bunit = (id) => (App.db.bonusTypes[id] ? App.db.bonusTypes[id].u : "");
  const bfmt = (id, v) => bname(id) + " " + (v > 0 ? "+" : "") + nf(v) + bunit(id);

  /* ---------- Speicher ---------- */
  const LS = { db: "m2b_db_v1", builds: "m2b_builds_v1", cur: "m2b_cur_v1" };
  const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* Speicher nicht verfügbar */ } };
  App.saveBuilds = function () { save(LS.builds, App.builds); save(LS.cur, App.build.id); };
  App.saveDb = function () { const d = Object.assign({}, App.db); delete d._itemIdx; delete d._itemIdxSrc; save(LS.db, d); };
  App.resetDb = function () { try { localStorage.removeItem(LS.db); } catch (e) { /* egal */ } App.db = window.M2DEFAULTS(); };
  App.dbIsCustom = function () { try { return !!localStorage.getItem(LS.db); } catch (e) { return false; } };

  App.newBuild = function (cls, name) {
    const c = App.db.classes[cls];
    const b = {
      id: "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name || c.name + "-Build", cls, branch: Object.keys(c.branches)[0], level: 120,
      stats: { str: 90, dex: 90, vit: 90, int: 90 }, mode: "pvm", targetId: "st_metin_verwunschener_wald_lv_120", targetOverride: {},
      attack: "hit", skillLevel: 40, weaponType: "any", equip: {}, toggles: {},
    };
    // Startausrüstung mit Luft nach oben, damit die Analyse sofort etwas zeigt
    ["weapon", "armor", "helmet", "shoes", "bracelet", "earrings", "necklace"].forEach((id) => O.optimizeSlot(b, App.db, id, { mode: "replace", items: true }));
    Object.keys(b.equip).forEach((id) => {
      const e = b.equip[id];
      e.lines = (e.lines || []).slice(0, 3); e.rare = [];
      const it = C.itemById(App.db, e.item);
      if (it && C.itemMaxUp(it) > 9) { e.up = 9; (e.innate || []).forEach((l, i) => { if (l && it.innate) l.v = O.tierValue(App.db.pools[it.innate[i]], l.b, 9, "max"); }); }
      e.stones = (e.stones || []).slice(0, 1);
    });
    return b;
  };

  App.init = function () {
    const def = window.M2DEFAULTS();
    const stored = load(LS.db);
    App.db = stored && stored.version === def.version ? stored : def;
    if (App.db !== def) {
      // neu hinzugekommene Standard-Gegenstände in angepasste Daten nachtragen (ohne eigene Änderungen zu überschreiben)
      const have = new Set(App.db.items.map((it) => it.id));
      const gone = new Set(App.db.removedItems || []);
      def.items.forEach((it) => { if (!have.has(it.id) && !gone.has(it.id)) App.db.items.push(it); });
    }
    App.builds = load(LS.builds) || [];
    if (!App.builds.length) App.builds = [App.newBuild("warrior", "Mein Krieger")];
    const cur = load(LS.cur);
    App.build = App.builds.find((b) => b.id === cur) || App.builds[0];
    bindGlobal();
    App.renderAll();
  };

  /* ---------- Rendern ---------- */
  App.renderAll = function () {
    renderHeader(); renderChar(); renderTarget(); renderBuffs();
    App.update(true);
    if (App.view === "opt") renderOpt();
    if (App.view === "inv" && window.Inv) window.Inv.render();
    if (App.view === "compare") renderCompare();
    if (App.view === "admin" && window.Admin) window.Admin.render();
    FX.reveal();
  };

  App.update = function (noSave) {
    const b = App.build, db = App.db;
    App.res = C.evaluate(b, db);
    App.levers = O.levers(b, db, App.res, App.planOpts());
    App.diag = O.diagnostics(b, db, App.res);
    renderResult(); renderEquip(); renderTotals(); renderBottleneck(); renderBreakdown(); renderDefense();
    if (!noSave) App.saveBuilds();
    scheduleAnalysis();
  };

  let anaTimer = null, anaToken = 0;
  function scheduleAnalysis() {
    clearTimeout(anaTimer);
    const token = ++anaToken;
    anaTimer = setTimeout(() => {
      const b = O.clone(App.build), db = App.db;
      const ids = db.slots.filter((s) => !s.free).map((s) => s.id);
      const pot = {};
      let i = 0;
      (function step() {
        if (token !== anaToken) return;
        const t0 = performance.now();
        while (i < ids.length && performance.now() - t0 < 14) { Object.assign(pot, O.slotPotential(b, db, [ids[i]], App.planOpts())); i++; }
        if (i < ids.length) return setTimeout(step, 0);
        App.pot = pot;
        paintHeat();
        setTimeout(() => { if (token !== anaToken) return; App.sugg = O.candidates(b, db, App.planOpts()).slice(0, 6); renderSuggestions(); }, 0);
      })();
    }, 260);
  }

  function renderHeader() {
    const b = App.build;
    $("#header-actions").innerHTML = `
      <div class="seg" data-tip="Schaltet Ziele und Formeln zwischen Monstern und Spielern um">
        <button data-act="mode" data-v="pvm" class="${b.mode === "pvm" ? "active" : ""}">PvM</button>
        <button data-act="mode" data-v="pvp" class="${b.mode === "pvp" ? "active" : ""}">PvP</button>
      </div>
      <select id="build-select" data-f="build-select" style="width:190px">${App.builds.map((x) => `<option value="${x.id}" ${x.id === b.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
      <button class="btn btn-sm" data-act="build-new" data-tip="Neuer Build">＋</button>
      <button class="btn btn-sm" data-act="build-copy" data-tip="Build kopieren">⧉</button>
      <button class="btn btn-sm" data-act="build-rename" data-tip="Umbenennen">✎</button>
      <button class="btn btn-sm btn-danger" data-act="build-del" data-tip="Build löschen">🗑</button>`;
  }

  function renderChar() {
    const b = App.build, db = App.db, cls = db.classes[b.cls];
    const skills = C.skillList(b.cls, b.branch);
    const lv = b.skillLevel == null ? 40 : b.skillLevel;
    const lvOpts = [1, 10, 17, 20, 25, 29, 30, 35, 39, 40];
    $("#panel-char").innerHTML = `
      <div class="panel-head"><div class="panel-title">Charakter</div></div>
      <div class="stack">
        <div class="class-grid">${Object.keys(db.classes).map((id) => `<button class="class-btn ${id === b.cls ? "active" : ""}" data-act="cls" data-v="${id}"><span class="ico">${db.classes[id].icon}</span>${esc(db.classes[id].name)}</button>`).join("")}</div>
        <div class="seg wide">${Object.keys(cls.branches).map((id) => `<button data-act="branch" data-v="${id}" class="${id === b.branch ? "active" : ""}">${esc(cls.branches[id])}</button>`).join("")}</div>
        <div class="row c2">
          <div class="field"><label>Level</label><input type="number" min="1" max="200" data-f="level" value="${b.level}"></div>
          <div class="field"><label>Statuspunkte</label><button class="btn" data-act="stats-max">Alle auf ${db.params.maxStat}</button></div>
        </div>
        <div class="row c4">${["str", "dex", "vit", "int"].map((s) => `<div class="field"><label>${s.toUpperCase()}</label><input type="number" min="1" max="999" data-f="stat" data-k="${s}" value="${b.stats[s]}"></div>`).join("")}</div>
        <div class="field"><label>Angriff, der bewertet wird</label>
          <select data-f="attack"><option value="hit">Normaler Treffer</option>${skills.map((s) => `<option value="${s.id}" ${b.attack === s.id ? "selected" : ""}>${esc(s.name)}${s.magic ? " (Magie)" : ""}${s.unsure ? " ?" : ""}</option>`).join("")}</select></div>
        ${b.attack !== "hit" ? `<div class="field"><label>Fertigkeitsstufe</label><select data-f="skillLevel">${lvOpts.map((l) => `<option value="${l}" ${l === lv ? "selected" : ""}>${C.skillLevelName(l)}${l < 20 ? " (Stufe)" : ""}</option>`).join("")}</select></div>` : ""}
      </div>`;
  }

  function targetList() { const pvp = App.build.mode === "pvp"; return App.db.targets.filter((t) => (t.kind === "player") === pvp); }
  function renderTarget() {
    const b = App.build, db = App.db;
    const list = targetList();
    if (!list.find((t) => t.id === b.targetId)) { b.targetId = list[0] ? list[0].id : null; b.targetOverride = {}; }
    const T = C.resolveTarget(b, db);
    const grp = (k, label) => { const l = list.filter((t) => (k === "boss" ? t.kind === "monster" && t.boss : k === "mob" ? t.kind === "monster" && !t.boss : t.kind === k)); return l.length ? `<optgroup label="${label}">${l.map((t) => `<option value="${t.id}" ${t.id === b.targetId ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</optgroup>` : ""; };
    const el = C.ELEMENTS.filter((e) => T.elem && T.elem[e]);
    const wt = (App.res && App.res.ctx.w.type) || null;
    const ov = b.targetOverride || {};
    const num = (label, key, val, tip) => `<div class="field"><label ${tip ? `data-tip="${esc(tip)}"` : ""}>${label}</label><input type="number" data-f="tov" data-k="${key}" value="${val == null ? "" : val}"></div>`;
    const R = T.res || {};
    $("#panel-target").innerHTML = `
      <div class="panel-head"><div class="panel-title">Ziel</div><div class="spacer"></div>${Object.keys(ov).length ? `<button class="btn btn-sm" data-act="tov-reset">Zurücksetzen</button>` : ""}</div>
      <div class="stack">
        <select data-f="target">${grp("stone", "Metinsteine")}${grp("boss", "Bosse")}${grp("mob", "Monster")}${grp("player", "Spieler")}</select>
        <div class="inline">
          <span class="chip gold">Lv ${T.lvl}</span>
          <span class="chip">DEF ${nf(T.def || 0)}</span>
          ${T.kind === "player" ? `<span class="chip blue">${esc(db.classes[T.cls].name)}</span>` : `<span class="chip blue">${esc(C.TYPE_NAME[T.type || "none"])}</span>`}
          ${T.boss ? `<span class="chip red">Boss</span>` : ""}
          ${el.map((e) => `<span class="chip green" data-tip="Trägt dieses Element. Kraft des Elements wirkt voll, Widerstand ${(T.eres && T.eres[e]) || 0}">${C.EL_NAME[e]} ${(T.eres && T.eres[e]) || 0}</span>`).join("")}
          ${wt && T.wres && T.wres[C.WRES_KEY[wt]] ? `<span class="chip red" data-tip="Verteidigung gegen deinen Waffentyp">${C.WTYPE_NAME[wt]} −${T.wres[C.WRES_KEY[wt]]} %</span>` : ""}
          ${T.magicRes ? `<span class="chip">Magie −${T.magicRes}</span>` : ""}
          ${T.est ? `<span class="chip" data-tip="Richtwerte, keine Wiki-Daten. Bitte an dein Ziel anpassen.">Schablone</span>` : ""}
        </div>
        <details ${Object.keys(ov).length ? "open" : ""}><summary class="lbl" style="cursor:pointer">Ziel anpassen</summary>
          <div class="stack" style="margin-top:8px">
            <div class="row c3">${num("Level", "lvl", T.lvl)}${num("Verteidigung", "def", T.def)}${num("DEX", "dex", T.dex)}</div>
            <div class="row c3">${num("TP (optional)", "hp", T.hp, "Für die Anzeige Treffer bis zum Tod")}${num("Magiewiderst.", "magicRes", T.magicRes)}${wt ? num(C.WTYPE_NAME[wt] + "-Vert.", "wres." + C.WRES_KEY[wt], (T.wres && T.wres[C.WRES_KEY[wt]]) || 0) : ""}</div>
            ${T.kind === "player" ? `
            <div class="field"><label>Klasse des Gegners</label><select data-f="tov" data-k="cls">${Object.keys(db.classes).map((c) => `<option value="${c}" ${c === T.cls ? "selected" : ""}>${esc(db.classes[c].name)}</option>`).join("")}</select></div>
            <div class="row c3">${num("Halbm.-Wid.", "res.human", R.human, "Widerstand gegen Halbmenschen")}${num("Abwehr Klasse", "res.cls", R.cls, "Abwehr gegen deine Klasse")}${num("Block %", "res.block", R.block)}</div>
            <div class="row c4">${num("DSS-Wid.", "res.avg", R.avg)}${num("FKS-Wid.", "res.skill", R.skill)}${num("Krit-Wid.", "res.crit", R.crit)}${num("Durchb.-Wid.", "res.pierce", R.pierce)}</div>` : `
            <div class="field"><label>Typ</label><select data-f="tov" data-k="type">${Object.keys(C.TYPE_NAME).map((c) => `<option value="${c}" ${c === (T.type || "none") ? "selected" : ""}>${esc(C.TYPE_NAME[c])}</option>`).join("")}</select></div>`}
          </div>
        </details>
      </div>`;
  }

  function renderBuffs() {
    const b = App.build, db = App.db;
    const groups = {};
    (db.toggles || []).forEach((t) => { (groups[t.group] = groups[t.group] || []).push(t); });
    const on = (db.toggles || []).filter((t) => b.toggles[t.id]).length;
    $("#panel-buffs").innerHTML = `
      <div class="panel-head"><div class="panel-title">Biologe &amp; Buffs</div><div class="spacer"></div><span class="chip ${on ? "gold" : ""}">${on} aktiv</span></div>
      <div class="stack">${Object.keys(groups).map((g) => `
        <details ${groups[g].some((t) => b.toggles[t.id]) ? "open" : ""}><summary class="lbl" style="cursor:pointer">${esc(g)}</summary>
          <div class="stack" style="gap:5px;margin-top:6px">${groups[g].map((t) => `<label class="inline" style="flex-wrap:nowrap;font-size:12.5px;cursor:pointer"><input type="checkbox" data-f="toggle" data-k="${t.id}" ${b.toggles[t.id] ? "checked" : ""}><span>${esc(t.name)}</span></label>`).join("")}</div>
        </details>`).join("")}</div>`;
  }

  /* ---------- Ausrüstung ---------- */
  function slotSummary(slot) {
    const b = App.build, db = App.db, e = b.equip[slot.id];
    const active = O.slotActive(b, db, slot);
    if (!active) return { active, title: slot.kind === "bonus" ? "nicht eingetragen" : "leer", boni: [] };
    const item = C.itemById(db, e.item);
    const all = [];
    (e.innate || []).forEach((l) => l && l.b && all.push(l));
    (e.lines || []).forEach((l) => l.b && all.push(l));
    (e.rare || []).forEach((l) => l.b && all.push(l));
    const lev = {}; (App.levers || []).forEach((l) => { lev[l.id] = l; });
    all.sort((x, y) => ((lev[y.b] || {}).share || 0) - ((lev[x.b] || {}).share || 0));
    return { active, item, title: item ? item.name : "aktiv", up: item ? e.up || 0 : null, boni: all.slice(0, 3), count: all.length };
  }
  function renderEquip() {
    const db = App.db;
    const card = (slot) => {
      const s = slotSummary(slot);
      return `<button class="slot-card ${s.active ? "" : "empty"}" data-act="slot" data-v="${slot.id}" id="slot-${slot.id}">
        <div class="slot-top"><div class="slot-ico">${slot.icon}</div><div style="min-width:0"><div class="slot-name">${esc(slot.name)}</div>
          <div class="slot-item">${esc(s.title)}${s.up != null ? ` <span class="plus">+${s.up}</span>` : ""}</div></div></div>
        <div class="slot-boni">${s.boni.map((l) => `<span><b>${l.v > 0 ? "+" : ""}${nf(l.v)}${bunit(l.b)}</b> ${esc(bname(l.b))}</span>`).join("")}${s.count > 3 ? `<span class="dim">+${s.count - 3} weitere</span>` : ""}</div>
        <span class="slot-badge"></span><div class="slot-heatbar"><i></i></div></button>`;
    };
    const grp = (g) => db.slots.filter((s) => s.group === g).map(card).join("");
    $("#panel-equip").innerHTML = `
      <div class="panel-head"><div class="panel-title">Ausrüstung</div><div class="spacer"></div>
        <span class="panel-note">Rand und Balken zeigen, wie viel Schaden im Slot noch steckt</span></div>
      <div class="slot-grid">${grp("gear")}</div>
      <div class="sect-title" style="margin-top:16px">Kostüme, Schulterband, Pet &amp; mehr</div><div class="slot-grid">${grp("extra")}</div>
      <div class="sect-title" style="margin-top:16px">Drachensteinalchemie</div><div class="slot-grid">${grp("alchemy")}</div>`;
    paintHeat();
  }
  function heatLevel(g) { return g >= 0.15 ? 3 : g >= 0.06 ? 2 : g >= 0.015 ? 1 : 0; }
  function paintHeat() {
    const vals = Object.values(App.pot || {}).map((p) => Math.max(p.gain, p.itemGain || 0));
    const max = Math.max(0.0001, ...vals);
    App.db.slots.forEach((slot) => {
      const el = $("#slot-" + slot.id); if (!el) return;
      const p = App.pot[slot.id];
      el.classList.remove("heat-0", "heat-1", "heat-2", "heat-3");
      const badge = $(".slot-badge", el), bar = $(".slot-heatbar i", el);
      if (!p) { badge.textContent = ""; bar.style.width = "0%"; return; }
      const g = Math.max(p.gain, p.itemGain || 0);
      const hl = heatLevel(g);
      el.classList.add("heat-" + hl);
      badge.textContent = g < 0.005 ? (p.empty ? "" : "✓ ausgereizt") : (p.empty ? "leer · " : "") + "+" + pf(g) + " möglich";
      if (g < 0.005 && p.empty) el.classList.remove("heat-0");
      bar.style.width = Math.round((g / max) * 100) + "%";
      bar.style.backgroundPosition = (hl >= 3 ? 100 : hl === 2 ? 60 : hl === 1 ? 30 : 0) + "% 0";
      el.dataset.tip2 = p.itemGain != null && p.itemGain > p.gain + 0.005 ? "Mit besserem Gegenstand +" + pf(p.itemGain) : "";
    });
  }

  /* ---------- Ergebnis ---------- */
  function renderResult() {
    const r = App.res, b = App.build, ctx = r.ctx;
    const root = $("#panel-result");
    if (!root.dataset.built) {
      root.dataset.built = "1";
      root.innerHTML = `
        <div class="panel-head"><div class="panel-title">Schaden</div><div class="spacer"></div>
          <button class="btn btn-sm" data-act="pin" data-tip="Aktuellen Wert als Vergleich merken">📌 Referenz</button></div>
        <div class="hero"><div class="hero-label" id="hero-label"></div><div class="hero-value" id="hero-value">0</div><div class="hero-sub" id="hero-sub"></div></div>
        <div id="result-body"></div>`;
    }
    $("#hero-label").textContent = "Ø Schaden pro " + (r.isSkill ? "Fertigkeit: " + r.attack.name : "normalem Treffer");
    const changed = App.lastExp != null && Math.abs(r.exp - App.lastExp) > 0.5;
    FX.countTo($("#hero-value"), r.exp, { bump: changed });
    let sub = "";
    if (changed && App.lastExp > 0) sub += `<span class="delta ${r.exp >= App.lastExp ? "up" : "down"}">${r.exp >= App.lastExp ? "▲" : "▼"} ${sign(r.exp / App.lastExp - 1)}</span> zur letzten Änderung`;
    if (App.pin) sub += `${sub ? " · " : ""}<span class="delta ${r.exp >= App.pin ? "up" : "down"}">${sign(r.exp / App.pin - 1)}</span> zur Referenz (${nf(App.pin)})`;
    $("#hero-sub").innerHTML = sub || "inkl. Krit- und Durchbohrer-Chance";
    if (changed && r.exp > App.lastExp) { const bb = $("#hero-value").getBoundingClientRect(); FX.burst(bb.left + bb.width / 2, bb.top + bb.height / 2, 22); }
    App.lastExp = r.exp;
    const c = r.chances.crit / 100, p = r.chances.pierce / 100;
    const probs = [[(1 - c) * (1 - p), r.normal, "Normal", "rgba(230,185,85,.75)"], [c * (1 - p), r.crit, "Kritisch", "#ef4d56"], [(1 - c) * p, r.pierce, "Durchbohrt", "#5aa9ff"], [c * p, r.critPierce, "Krit + Durchb.", "#a78bfa"]];
    const afBad = ctx.af.K1 < 90;
    $("#result-body").innerHTML = `
      <div style="display:flex;height:14px;border-radius:7px;overflow:hidden;margin-top:12px;border:1px solid var(--line)">${probs.map((x) => `<div data-w="${(x[0] * 100).toFixed(2)}" style="width:0;background:${x[3]};transition:width .7s" data-tip="${x[2]}: ${pf(x[0])} · ${nf(x[1])}"></div>`).join("")}</div>
      <div class="legend">${probs.map((x) => `<span><i style="background:${x[3]}"></i>${x[2]} ${pf(x[0], 0)} · <b style="color:var(--text)">${nf(x[1])}</b></span>`).join("")}</div>
      <div class="stat-grid">
        <div class="stat"><div class="k">Spanne ohne Krit</div><div class="v">${nf(r.min)} – ${nf(r.max)}</div><div class="s">je nach Waffenwurf</div></div>
        <div class="stat"><div class="k">Höchstschaden</div><div class="v">${nf(r.maxAll)}</div><div class="s">Krit + Durchbohrer</div></div>
        <div class="stat ${r.chances.crit < 20 ? "warn" : "good"}"><div class="k">Krit-Chance</div><div class="v">${r.chances.crit} %</div><div class="s">${r.isSkill || ctx.pvp ? "angezeigt " + r.chances.rawCrit + " %" : "kritisch = ×2"}</div></div>
        <div class="stat"><div class="k">Durchbohrer-Chance</div><div class="v">${r.chances.pierce} %</div><div class="s">${r.isSkill ? "angezeigt " + r.chances.rawPierce + " %" : "+ Verteidigung des Ziels"}</div></div>
        <div class="stat ${afBad ? "warn" : "good"}"><div class="k" data-tip="Aus deiner DEX und der DEX des Ziels. Skaliert den Großteil des Angriffswerts.">Angriffsfaktor</div><div class="v">${(ctx.AF * 100).toFixed(1).replace(".", ",")} %</div><div class="s">Trefferwert ${ctx.af.K1}/90</div></div>
        <div class="stat"><div class="k">${r.hitsToKill ? "Treffer bis zum Tod" : "Waffe"}</div><div class="v">${r.hitsToKill ? nf(r.hitsToKill) : (ctx.w.type ? nf(ctx.w.dMin) + " – " + nf(ctx.w.dMax) : "–")}</div><div class="s">${r.hitsToKill ? "bei " + nf(ctx.T.hp) + " TP" : "Angriffswert +" + ctx.w.up}</div></div>
        ${ctx.pvp && !r.isSkill && r.block ? `<div class="stat warn"><div class="k">Geblockt</div><div class="v">${r.block} %</div><div class="s">Block des Gegners</div></div>` : ""}
      </div>`;
    FX.fillBars($("#result-body"));
  }

  /* ---------- Flaschenhälse ---------- */
  function renderBottleneck() {
    const diag = App.diag || [], lev = (App.levers || []).filter((l) => !l.wasted);
    const top = lev.filter((l) => l.maxGain > 0.004).slice(0, 7);
    const maxG = Math.max(0.0001, ...top.map((l) => l.maxGain));
    const sevOf = (g) => (g >= 0.2 ? 3 : g >= 0.08 ? 2 : g >= 0.02 ? 1 : 0);
    const wasted = (App.levers || []).filter((l) => l.wasted);
    $("#panel-bottleneck").innerHTML = `
      <div class="panel-head"><div class="panel-title">Flaschenhälse</div><div class="spacer"></div><span class="chip ${diag.filter((d) => d.sev >= 2).length ? "red" : "green"}">${diag.filter((d) => d.sev >= 2).length} kritisch</span></div>
      <div class="bn-list">
        ${diag.filter((d) => d.sev >= 1).map((d) => `<div class="bn-item sev-${d.sev}"><div class="bn-head"><span>${d.icon}</span><span class="bn-name">${esc(d.title)}</span>${d.gain ? `<span class="bn-gain">+${pf(d.gain)}</span>` : ""}</div><div class="bn-desc">${esc(d.text)}</div></div>`).join("")}
        ${top.length ? `<div class="sect-title" style="margin:6px 0 0">Größte ungenutzte Boni</div>` : ""}
        ${top.map((l) => `<div class="bn-item sev-${sevOf(l.maxGain)}" data-tip="Jetzt ${nf(l.have)}${l.unit}, in deiner Ausrüstung erreichbar ${nf(l.reach)}${l.unit}. +${l.step}${l.unit} bringen ${pf(l.stepGain)}.">
          <div class="bn-head"><span class="bn-name">${esc(l.name)}</span><span class="bn-gain">+${pf(l.maxGain)}</span></div>
          <div class="bn-bar"><div class="bn-fill" data-w="${Math.max(3, Math.round((l.maxGain / maxG) * 100))}"></div></div>
          <div class="bn-meta"><span>${nf(l.have)}${l.unit} von ${nf(l.reach)}${l.unit} erreichbar</span><span>je +${l.step}${l.unit}: ${pf(l.stepGain)}</span></div></div>`).join("")}
        ${!diag.filter((d) => d.sev >= 1).length && !top.length ? `<div class="empty-state">Keine Flaschenhälse gefunden. Dieser Build ist für dieses Ziel ausgereizt.</div>` : ""}
        ${wasted.length ? `<div class="hint warn">Wirkt gegen dieses Ziel nicht: ${wasted.map((l) => esc(l.name) + " " + nf(l.have) + l.unit).join(", ")}</div>` : ""}
        ${diag.filter((d) => d.sev === 0).map((d) => `<div class="hint">${d.icon} <b>${esc(d.title)}.</b> ${esc(d.text)}</div>`).join("")}
        <div class="sect-title" style="margin:8px 0 0">Nächste beste Schritte</div>
        <div class="panel-note">Gerechnet mit: ${esc(App.planText())}. <a href="#" data-act="goto-opt">Einstellungen ändern</a></div>
        <div class="sugg-list" id="sugg-list"><div class="panel-note">wird berechnet …</div></div>
      </div>`;
    FX.fillBars($("#panel-bottleneck"));
    renderSuggestions();
  }
  function renderSuggestions() {
    const el = $("#sugg-list"); if (!el) return;
    if (!App.sugg) return;
    el.innerHTML = App.sugg.length ? App.sugg.map((s, i) => `<div class="sugg"><div class="rank">${i + 1}</div><div style="min-width:0"><div class="t">${esc(s.title)}</div><div class="d">${esc(s.detail)}</div></div>
      <div class="g">+${pf(s.gain)}<small><button class="btn btn-sm" data-act="apply-sugg" data-v="${i}" style="margin-top:3px">Übernehmen</button></small></div></div>`).join("") : `<div class="panel-note">Keine Einzeländerung bringt noch etwas.</div>`;
  }

  /* ---------- Aufschlüsselung ---------- */
  function renderBreakdown() {
    const r = App.res, tr = r.trace;
    const maxV = Math.max(1, ...tr.map((t) => t.after), r.exp);
    const rows = tr.map((t) => {
      const first = t.key === "base" || t.before === 0;
      const up = t.after >= t.before;
      const f = first ? "" : (t.key === "def" || t.key === "crit" || t.key === "pierce" ? (t.after - t.before >= 0 ? "+" : "−") + nf(Math.abs(t.after - t.before)) : "×" + (t.after / t.before).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      const neutral = !first && Math.abs(t.after - t.before) < 0.5;
      return `<div style="display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:center;opacity:${neutral ? 0.5 : 1}">
        <div style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</div>
        <div style="font-size:12px;font-weight:700;font-variant-numeric:tabular-nums" class="${first || neutral ? "muted" : up ? "green" : "red"}">${f} <span style="color:var(--text)">→ ${nf(t.after)}</span></div>
        <div class="bn-bar" style="grid-column:1/-1;margin-top:0;height:6px"><div data-w="${Math.max(1, (t.after / maxV) * 100).toFixed(1)}" style="height:100%;width:0;border-radius:6px;transition:width .7s cubic-bezier(.2,.8,.2,1);background:${first ? "var(--azure)" : up ? "linear-gradient(90deg,#1f8f5f,var(--jade))" : "linear-gradient(90deg,#a8252d,var(--crimson))"}"></div></div></div>`;
    }).join("");
    const last = tr.length ? tr[tr.length - 1].after : 0;
    $("#panel-breakdown").innerHTML = `
      <div class="panel-head"><div class="panel-title">So entsteht der Schaden</div><div class="spacer"></div><span class="panel-note">ein mittlerer Treffer ohne Krit</span></div>
      <div class="stack" style="gap:9px">${rows}
        <div style="display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:center">
          <div style="font-size:12px">Krit- und Durchbohrer-Chance eingerechnet</div>
          <div style="font-size:12px;font-weight:700" class="gold">${last > 0 ? "×" + (r.exp / last).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""} → ${nf(r.exp)}</div>
          <div class="bn-bar" style="grid-column:1/-1;margin-top:0;height:6px"><div data-w="${Math.max(1, (r.exp / maxV) * 100).toFixed(1)}" style="height:100%;width:0;border-radius:6px;transition:width .7s;background:linear-gradient(90deg,var(--gold),var(--ember))"></div></div>
        </div>
      </div>`;
    FX.fillBars($("#panel-breakdown"));
  }

  /* ---------- Summen ---------- */
  function renderTotals() {
    const col = App.res.col, db = App.db;
    const lev = {}; (App.levers || []).forEach((l) => { lev[l.id] = l; });
    const ids = Object.keys(col.B).filter((id) => col.B[id]);
    const order = { off: 0, def: 1, util: 2 };
    ids.sort((a, b) => (order[(db.bonusTypes[a] || {}).g] - order[(db.bonusTypes[b] || {}).g]) || ((lev[b] || {}).share || 0) - ((lev[a] || {}).share || 0));
    $("#panel-totals").innerHTML = `
      <div class="panel-head"><div class="panel-title">Alle Boni zusammen</div><div class="spacer"></div><span class="panel-note">Prozentwert rechts = Anteil am aktuellen Schaden</span></div>
      <div class="totals">${ids.map((id) => {
        const t = db.bonusTypes[id] || { g: "util", u: "" }; const l = lev[id];
        const tip = (col.src[id] || []).map((s) => s.from + ": " + (s.v > 0 ? "+" : "") + nf(s.v)).join(" · ");
        return `<div class="total-row ${t.g} ${l && l.wasted ? "unused" : ""}" data-tip="${esc(tip)}"><span class="n">${esc(bname(id))}</span>${l && l.wasted ? `<span class="tag">wirkt nicht</span>` : ""}${l && l.share > 0.001 ? `<span class="dim" style="font-size:11px">${pf(l.share, 0)}</span>` : ""}<span class="v">${nf(col.B[id])}${t.u}</span></div>`;
      }).join("") || `<div class="empty-state">Noch keine Boni.</div>`}</div>`;
  }

  function renderDefense() {
    const b = App.build, db = App.db, col = App.res.col, g = (id) => col.B[id] || 0;
    const d = C.defense(b, db, col);
    const bar = (id, cap) => { const v = g(id); return `<div class="total-row def" style="border:0;padding:2px 0"><span class="n">${esc(bname(id))}</span><span class="v">${nf(v)}${bunit(id)}</span></div><div class="progress" style="height:5px"><i data-w="${Math.min(100, (v / cap) * 100).toFixed(0)}" style="background:linear-gradient(90deg,#2b6cb0,var(--azure))"></i></div>`; };
    const keys = b.mode === "pvp"
      ? ["resSword", "resTwohand", "resDagger", "resBell", "resFan", "resArrow", "resClaw", "resMagic", "resHuman", "resAvg", "resSkill", "block"]
      : ["resMonster", "resMagic", "resAvg", "resSkill", "block", "dodge", "resFire", "resIce", "resLightning", "resWind", "resEarth", "resDark"];
    $("#panel-defense").innerHTML = `
      <div class="panel-head"><div class="panel-title">Verteidigung</div><div class="spacer"></div><span class="panel-note" data-tip="Die Formeln für eigene Verteidigung und TP sind im Wiki nicht belegt. Koeffizienten im Admin-Menü anpassbar.">Schätzung</span></div>
      <div class="stat-grid" style="margin-top:0">
        <div class="stat"><div class="k">Verteidigung</div><div class="v">${nf(d.def)}</div><div class="s">Level + VIT + Ausrüstung</div></div>
        <div class="stat"><div class="k">Trefferpunkte</div><div class="v">${nf(d.hp)}</div><div class="s">VIT ${d.vit}</div></div>
      </div>
      <div class="stack" style="gap:3px;margin-top:10px">${keys.filter((k) => g(k) || ["resMagic", "resAvg", "resSkill", "block"].indexOf(k) >= 0).map((k) => bar(k, 100)).join("")}</div>`;
    FX.fillBars($("#panel-defense"));
  }

  /* ---------- Slot-Editor ---------- */
  function lineGains(slot, grp, idx) {
    // Gewinn je Bonus, wenn er (zum Höchstwert) in dieser Zeile stünde, gegenüber leerer Zeile
    const b = O.clone(App.build), db = App.db, e = b.equip[slot.id];
    if (grp.key === "innate") e.innate[grp.index] = null; else e[grp.key] = (e[grp.key] || []).filter((_, i) => i !== idx);
    const base = O.score(b, db);
    const out = {};
    Object.keys(grp.pool).forEach((bid) => {
      const v = O.tierValue(grp.pool, bid, grp.up, "max");
      if (grp.key === "innate") e.innate[grp.index] = { b: bid, v }; else e[grp.key].push({ b: bid, v });
      out[bid] = base > 0 ? O.score(b, db) / base - 1 : 0;
      if (grp.key === "innate") e.innate[grp.index] = null; else e[grp.key].pop();
    });
    return out;
  }
  function lineRow(slot, grp, idx, line) {
    const gains = lineGains(slot, grp, idx);
    const arr = grp.key === "innate" ? [] : (App.build.equip[slot.id][grp.key] || []);
    const used = new Set(arr.filter((_, i) => i !== idx).map((l) => l.b).concat(grp.blocked));
    const ids = Object.keys(grp.pool).filter((id) => !used.has(id) || (line && line.b === id)).sort((a, b) => gains[b] - gains[a] || bname(a).localeCompare(bname(b)));
    const steps = line && line.b ? C.poolSteps(grp.pool, line.b, grp.up) : [];
    const max = steps.length ? steps[steps.length - 1] : 0;
    const gi = grp.key === "innate" ? grp.index : idx;
    const cur = line && line.b ? gains[line.b] : 0;
    const scaled = line && line.b && max ? cur * ((line.v || 0) / max) : 0;
    return `<div class="bonus-row" data-grp="${grp.key}" data-i="${gi}">
      <select data-f="line-b"><option value="">– frei –</option>${ids.map((id) => `<option value="${id}" ${line && line.b === id ? "selected" : ""}>${esc(bname(id))} (max ${O.tierValue(grp.pool, id, grp.up, "max")}${bunit(id)})${gains[id] > 0.0005 ? " · +" + pf(gains[id]) : ""}</option>`).join("")}</select>
      <input type="number" data-f="line-v" value="${line && line.b ? line.v : ""}" ${line && line.b ? "" : "disabled"} list="dl-${slot.id}-${grp.key}-${gi}">
      <datalist id="dl-${slot.id}-${grp.key}-${gi}">${steps.map((s) => `<option value="${s}">`).join("")}</datalist>
      <button class="btn btn-sm btn-icon" data-act="line-lock" data-tip="Sperren: der Optimierer lässt diese Zeile in Ruhe" ${line && line.b ? "" : "disabled"}>${line && line.lock ? "🔒" : "🔓"}</button>
      ${line && line.b ? `<div class="gain">${scaled > 0.0005 ? `trägt <b>+${pf(scaled)}</b> zum Schaden bei` : "kein Einfluss auf den Schaden gegen dieses Ziel"}${max && line.v < max ? ` · <a href="#" data-act="line-max">auf ${max}${bunit(line.b)} setzen</a>` : ""}</div>` : ""}
    </div>`;
  }
  App.openDrawer = function (slotId) {
    App.drawerSlot = slotId;
    renderDrawer();
    $("#drawer").classList.add("open"); $("#drawer-backdrop").classList.add("open");
    $("#drawer").setAttribute("aria-hidden", "false");
  };
  App.closeDrawer = function () { App.drawerSlot = null; $("#drawer").classList.remove("open"); $("#drawer-backdrop").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); };
  function renderDrawer() {
    const slotId = App.drawerSlot; if (!slotId) return;
    const b = App.build, db = App.db, slot = C.slotById(db, slotId);
    const e = O.entry(b, slotId);
    const item = C.itemById(db, e.item);
    const body = [];
    const scroll = $(".drawer-body") ? $(".drawer-body").scrollTop : 0;
    if (slot.kind === "item") {
      const cands = db.items.filter((it) => it.slot === slot.id && (!it.cls || it.cls.indexOf(b.cls) >= 0)).sort((x, y) => (y.lvl || 0) - (x.lvl || 0) || x.name.localeCompare(y.name));
      const maxUp = item ? C.itemMaxUp(item) : 9;
      const chips = [];
      if (item) {
        const bmf = 1 + (Number(e.bm) || 0) / 100;
        if (item.atk) { const r = C.kpRange(item.atk, e.up || 0); chips.push(`<span class="chip gold">Angriffswert ${Math.round(r[0] * bmf)} – ${Math.round(r[1] * bmf)}</span>`); }
        if (item.matk) { const r = C.kpRange(item.matk, e.up || 0); chips.push(`<span class="chip blue">Mag. Angriffswert ${Math.round(r[0] * bmf)} – ${Math.round(r[1] * bmf)}</span>`); }
        if (item.def) chips.push(`<span class="chip">Verteidigung ${Math.round(C.kp(item.def, e.up || 0) * bmf)}</span>`);
        Object.keys(item.fixed || {}).forEach((bid) => chips.push(`<span class="chip green">${esc(bfmt(bid, Math.round(C.kp(item.fixed[bid], e.up || 0) * bmf)))}</span>`));
        if (item.learned) chips.push(`<span class="chip blue" data-tip="Dieses Item wurde aus einem Tooltip deines Servers gelernt. Werte im Admin-Menü änderbar.">vom Server gelernt</span>`);
        if (item.champ) chips.push(`<span class="chip">Championlevel ${item.champ}</span>`);
        if (item.est) chips.push(`<span class="chip red" data-tip="Das Wiki nennt für diesen Gegenstand noch keine Werte. Im Admin-Menü anpassbar.">Werte geschätzt</span>`);
        if ((item.lvl || 0) > b.level) chips.push(`<span class="chip red">ab Level ${item.lvl}</span>`);
      }
      body.push(`<div><div class="sect-title">Gegenstand</div>
        <div class="stack"><select data-f="item"><option value="">– leer –</option>${cands.map((it) => `<option value="${it.id}" ${e.item === it.id ? "selected" : ""}>${esc(it.name)} (Lv ${it.lvl}${it.wtype ? ", " + C.WTYPE_NAME[it.wtype] : ""})</option>`).join("")}</select>
        ${item ? `<div class="field"><label>Verbesserung: +${e.up || 0} von +${maxUp}</label><input type="range" min="0" max="${maxUp}" step="1" value="${e.up || 0}" data-f="up"></div>
          ${item.atk || item.matk || item.def || item.fixed ? `<div class="field" style="max-width:220px"><label data-tip="Seltenheits-Bonus mancher Server, z. B. Episch: Grundwerte +35 %. Erhöht Angriffswert, Verteidigung und die festen Boni des Stücks.">Grundwerte + %</label><input type="number" min="0" max="500" data-f="bm" value="${e.bm || 0}"></div>` : ""}
          <div class="item-stats">${chips.join("")}</div>` : ""}</div></div>`);
    } else {
      body.push(`<div><div class="sect-title">${esc(slot.name)}</div>
        <label class="inline" style="cursor:pointer"><input type="checkbox" data-f="on" ${e.on ? "checked" : ""}> <span>Ich nutze das</span></label>
        ${slot.note ? `<div class="hint" style="margin-top:8px">${esc(slot.note)}</div>` : ""}
        ${slot.base ? `<div class="item-stats" style="margin-top:8px">${Object.keys(slot.base).map((bid) => `<span class="chip green">${esc(bfmt(bid, slot.base[bid]))}</span>`).join("")}</div>` : ""}</div>`);
    }
    const groups = O.groups(b, db, slot);
    const inn = groups.filter((g) => g.key === "innate");
    if (inn.length) body.push(`<div><div class="sect-title">Eingebaute Zufallsboni</div><div class="stack">${inn.map((g) => lineRow(slot, g, g.index, e.innate[g.index])).join("")}</div></div>`);
    groups.filter((g) => g.key !== "innate").forEach((g) => {
      const arr = e[g.key] || [];
      const rows = [];
      for (let i = 0; i < g.count; i++) rows.push(lineRow(slot, g, i, arr[i]));
      body.push(`<div><div class="sect-title">${g.key === "rare" ? "6. und 7. Bonus" : slot.kind === "bonus" ? "Boni" : "Bonus 1 bis " + g.count}</div><div class="stack">${rows.join("")}</div></div>`);
    });
    const n = O.sockets(slot, item);
    if (n) {
      const st = db.stones.filter((s) => s.kind === slot.stoneKind);
      const rows = [];
      for (let i = 0; i < n; i++) {
        const cur = (e.stones || [])[i]; const cs = cur && C.stoneById(db, cur.s);
        rows.push(`<div class="bonus-row" data-grp="stones" data-i="${i}"><select data-f="stone"><option value="">– leer –</option>${st.map((s) => `<option value="${s.id}" ${cur && cur.s === s.id ? "selected" : ""}>${esc(s.name)} · ${esc(bname(s.bonus))}</option>`).join("")}</select>
          <select data-f="stone-l" ${cs ? "" : "disabled"}>${cs ? cs.values.map((v, l) => `<option value="${l}" ${cur.l === l ? "selected" : ""}>${cs.values.length > 1 ? "+" + l : "+4"} (${v}${bunit(cs.bonus)})</option>`).join("") : ""}</select><span></span></div>`);
      }
      body.push(`<div><div class="sect-title">Geiststeine</div><div class="stack">${rows.join("")}</div></div>`);
    }
    const p = App.pot[slotId];
    $("#drawer").innerHTML = `
      <div class="drawer-head"><div class="slot-ico">${slot.icon}</div><div class="drawer-title">${esc(slot.name)}</div><div style="flex:1"></div>
        ${p && Math.max(p.gain, p.itemGain || 0) > 0.005 ? `<span class="chip red">+${pf(Math.max(p.gain, p.itemGain || 0))} möglich</span>` : p ? `<span class="chip green">ausgereizt</span>` : ""}
        <button class="btn btn-sm" data-act="drawer-close">✕</button></div>
      <div class="drawer-body">${body.join("")}</div>
      <div class="drawer-foot"><button class="btn btn-danger" data-act="slot-clear">Leeren</button><div style="flex:1"></div>
        ${slot.kind === "item" && item ? `<button class="btn" data-act="slot-to-inv" data-tip="Legt dieses Stück mit seinen Boni in dein Inventar">📥</button>` : ""}
        ${slot.kind === "item" ? `<button class="btn" data-act="slot-opt-item" data-tip="Wählt auch den besten Gegenstand für Klasse und Level">Bester Gegenstand</button>` : ""}
        <button class="btn btn-primary" data-act="slot-opt" data-tip="Füllt freie Zeilen, Steine und Verbesserung. Gesperrte Zeilen bleiben.">Slot optimieren</button></div>`;
    $(".drawer-body").scrollTop = scroll;
  }
  App.renderDrawer = renderDrawer;

  /* ---------- Optimierer-Ansicht ---------- */
  // Planungs-Einstellungen: gelten für Optimierer, Upgrade-Pfad, „Nächste beste Schritte", Slot-Potenzial und „erreichbar"-Werte
  const LS_PLAN = "m2b_plan_v1";
  const optState = Object.assign({ mode: "fill", tier: "good", extras: false, rare: false, upgrade: true, items: false, wtype: "same" }, load(LS_PLAN) || {}, { result: null, path: null, busy: false });
  const savePlan = () => { const o = optState; save(LS_PLAN, { mode: o.mode, tier: o.tier, extras: o.extras, rare: o.rare, upgrade: o.upgrade, items: o.items, wtype: o.wtype }); o.result = null; o.path = null; };
  App.plan = optState;
  App.planOpts = () => ({ tier: optState.tier, noRare: !optState.rare, upgrade: optState.upgrade, extras: optState.extras, items: optState.items || optState.mode === "max", wtype: optState.wtype });
  App.planText = () => [optState.tier === "good" ? "realistische Werte" : "Höchstwerte", optState.rare ? "mit 6./7. Bonus" : "ohne 6./7. Bonus", optState.extras ? "mit Kostümen & Co." : "ohne Kostüme & Co.", App.planOpts().items ? "mit Gegenstandstausch" : "ohne Gegenstandstausch"].join(", ");
  function diffBuilds(a, b) {
    const db = App.db, out = [];
    db.slots.forEach((slot) => {
      const x = a.equip[slot.id] || {}, y = b.equip[slot.id] || {};
      const ch = [];
      const ix = C.itemById(db, x.item), iy = C.itemById(db, y.item);
      if ((x.item || null) !== (y.item || null)) ch.push(`<b>${esc(iy ? iy.name : "leer")}</b>${ix ? " statt " + esc(ix.name) : ""}`);
      if (slot.kind === "bonus" && !x.on && y.on) ch.push("<b>aktivieren</b>");
      if (iy && (x.up || 0) !== (y.up || 0)) ch.push(`Verbesserung +${x.up || 0} → <b>+${y.up || 0}</b>`);
      const flat = (e) => { const m = {}; ["innate", "lines", "rare"].forEach((k) => (e[k] || []).forEach((l) => { if (l && l.b) m[k + ":" + l.b] = l.v; })); return m; };
      const mx = flat(x), my = flat(y);
      Object.keys(my).forEach((k) => { const bid = k.split(":")[1]; if (mx[k] == null) ch.push(`<span class="green">+ ${esc(bfmt(bid, my[k]))}</span>`); else if (mx[k] !== my[k]) ch.push(`${esc(bname(bid))} ${mx[k]} → <b>${my[k]}</b>`); });
      Object.keys(mx).forEach((k) => { if (my[k] == null) ch.push(`<span class="red">− ${esc(bfmt(k.split(":")[1], mx[k]))}</span>`); });
      const sx = (x.stones || []).map((s) => s.s + s.l).join(), sy = (y.stones || []).map((s) => s.s + s.l).join();
      if (sx !== sy && (y.stones || []).length) ch.push("Steine: " + y.stones.map((s) => { const st = C.stoneById(db, s.s); return st ? esc(st.name) : ""; }).join(", "));
      if (ch.length) out.push({ slot, ch });
    });
    return out;
  }
  /* ---------- Detailansicht eines Slots: vorher/nachher, Höchstwerte, Beitrag, Luft nach oben ---------- */
  function openDetail(slotId, A, B, title) {
    const db = App.db, slot = C.slotById(db, slotId), po = App.planOpts();
    if (!slot) return;
    const eA = A.equip[slotId] || {}, eB = B.equip[slotId] || null;
    const iA = C.itemById(db, eA.item), iB = eB ? C.itemById(db, eB.item) : null;
    // T = jetziger Build, bei dem nur dieser eine Slot geändert ist
    const T = O.clone(A);
    if (eB) T.equip[slotId] = O.clone(eB); else delete T.equip[slotId];
    const sA = O.score(A, db), sT = O.score(T, db), sB = O.score(B, db);
    const eT = T.equip[slotId] || {};
    const maxUp = iB ? C.itemMaxUp(iB) : 0;
    const bmf = (e) => 1 + (Number(e.bm) || 0) / 100;
    const GN = { innate: "Eingebauter Zufallsbonus", lines: slot.kind === "bonus" ? "Boni" : "Bonus 1 bis " + (slot.lines || 5), rare: "6. und 7. Bonus" };
    const oldVal = (key, bid, idx) => { if (key === "innate") { const l = (eA.innate || [])[idx]; return l && l.b === bid ? l.v : null; } const l = (eA[key] || []).find((x) => x.b === bid); return l ? l.v : null; };
    const contrib = (key, idx) => { const t = O.clone(T), e = t.equip[slotId]; if (key === "innate") e.innate[idx] = null; else e[key].splice(idx, 1); const s0 = O.score(t, db); return s0 > 0 ? sT / s0 - 1 : 0; };
    App.detail = { slotId, entry: eB ? O.clone(eB) : null };

    // Zeilen nach der Änderung
    const groups = eB ? O.groups(T, db, slot) : [];
    let tbl = "";
    ["innate", "lines", "rare"].forEach((key) => {
      const gs = groups.filter((g) => g.key === key);
      if (!gs.length) return;
      const rows = [];
      gs.forEach((g) => {
        const list = key === "innate" ? [[eT.innate[g.index], g.index]] : (eT[key] || []).map((l, i) => [l, i]);
        list.forEach(([l, i]) => {
          if (!l || !l.b) return;
          const ov = oldVal(key, l.b, i);
          const mx = O.tierValue(g.pool, l.b, maxUp || g.up, "max", key === "innate"), rl = O.tierValue(g.pool, l.b, maxUp || g.up, "good", key === "innate");
          const c = contrib(key, i);
          const state = ov == null ? `<span class="chip green">neu</span>` : ov !== l.v ? `<span class="chip gold">geändert</span>` : "";
          const fill = mx > 0 ? Math.max(0, Math.min(100, (l.v / mx) * 100)) : 100;
          rows.push(`<tr><td>${esc(bname(l.b))} ${state}${l.lock ? " 🔒" : ""}</td><td class="muted">${ov == null ? "–" : nf(ov) + bunit(l.b)}</td><td><b>${nf(l.v)}${bunit(l.b)}</b></td>
            <td>${mx ? nf(mx) + bunit(l.b) : `<span class="dim" data-tip="Dieser Bonus steht nicht im normalen Pool dieses Slots. Er gehört fest zum Stück.">fest</span>`}${mx && rl !== mx ? `<div class="dim" style="font-size:10.5px">realistisch ${nf(rl)}</div>` : ""}<div class="progress" style="height:4px;margin-top:3px"><i style="width:${fill.toFixed(0)}%"></i></div></td>
            <td class="${c > 0.0005 ? "green" : c < -0.0005 ? "red" : "dim"}" style="text-align:right;font-weight:700">${c > 0.0005 ? "+" + pf(c) : c < -0.0005 ? "−" + pf(-c) : "0 %"}</td></tr>`);
        });
        const used = key === "innate" ? (eT.innate[g.index] && eT.innate[g.index].b ? 1 : 0) : (eT[key] || []).filter((l) => l.b).length;
        if (key !== "innate" && used < g.count) rows.push(`<tr><td colspan="5" class="dim">${g.count - used} Zeile${g.count - used > 1 ? "n" : ""} frei</td></tr>`);
        if (key === "innate" && !used) rows.push(`<tr><td colspan="5" class="dim">frei</td></tr>`);
      });
      tbl += `<div><div class="sect-title">${GN[key]}</div><div class="table-wrap" style="max-height:none"><table class="tbl"><thead><tr><th>Bonus</th><th>Vorher</th><th>Nachher</th><th>Maximum</th><th style="text-align:right">trägt bei</th></tr></thead><tbody>${rows.join("")}</tbody></table></div></div>`;
    });

    // Was wegfällt
    const removed = [];
    ["innate", "lines", "rare"].forEach((key) => (eA[key] || []).forEach((l, i) => {
      if (!l || !l.b) return;
      const still = key === "innate" ? (eT.innate || [])[i] && eT.innate[i].b === l.b : (eT[key] || []).some((x) => x.b === l.b);
      if (still) return;
      const t = O.clone(A), e = t.equip[slotId]; if (key === "innate") e.innate[i] = null; else e[key].splice(i, 1);
      const s0 = O.score(t, db), loss = sA > 0 ? 1 - s0 / sA : 0;
      removed.push({ l, loss, def: (db.bonusTypes[l.b] || {}).g === "def" });
    }));

    // Steine
    const stoneTxt = (e) => (e.stones || []).map((x) => { const st = C.stoneById(db, x.s); return st ? st.name + " +" + (st.values.length > 1 ? x.l : 4) + " (" + st.values[Math.min(x.l, st.values.length - 1)] + bunit(st.bonus) + " " + bname(st.bonus) + ")" : ""; });
    const sockets = iB ? O.sockets(slot, iB) : 0;

    // Luft nach oben in diesem Slot
    let potHtml = "";
    if (eB) {
      const M = O.clone(T); O.optimizeSlot(M, db, slotId, { mode: "replace", tier: "max", upgrade: true, innate: "keep", items: false });
      const sM = O.score(M, db);
      const M6 = O.clone(T); O.optimizeSlot(M6, db, slotId, { mode: "replace", tier: "max", upgrade: true, innate: "keep", items: false, noRare: true });
      const sM6 = O.score(M6, db);
      const lines = [];
      const freeL = (slot.lines || 0) - (eT.lines || []).filter((l) => l.b).length, freeR = (slot.rare || 0) - (eT.rare || []).filter((l) => l.b).length, freeS = sockets - (eT.stones || []).filter((x) => x && x.s).length;
      if (iB && (eT.up || 0) < maxUp) lines.push("Verbesserung +" + (eT.up || 0) + " von +" + maxUp);
      if (freeL > 0) lines.push(freeL + " freie Bonus-Zeile" + (freeL > 1 ? "n" : ""));
      if (freeR > 0 && slot.rare) lines.push(freeR + " freie" + (freeR > 1 ? "" : "r") + " 6./7. Bonus");
      if (freeS > 0) lines.push(freeS + " freie" + (freeS > 1 ? "" : "r") + " Stein-Sockel");
      let itemLine = "";
      if (slot.kind === "item") {
        const MI = O.clone(T); O.optimizeSlot(MI, db, slotId, { mode: "replace", tier: "max", upgrade: true, innate: "opt", items: true, wtype: po.wtype });
        const bi = C.itemById(db, MI.equip[slotId].item), sMI = O.score(MI, db);
        if (bi && bi.id !== eT.item && sMI > sM * 1.001) itemLine = `<div class="total-row off" style="border:0"><span class="n">Bester Gegenstand für diesen Slot: <b style="color:var(--text)">${esc(bi.name)} +${MI.equip[slotId].up}</b>, alles am Maximum</span><span class="v">+${pf(sMI / sT - 1)}</span></div>`;
      }
      potHtml = `<div><div class="sect-title">Luft nach oben in diesem Slot</div>
        <div class="total-row off" style="border:0"><span class="n">Alle Boni und Steine am Höchstwert, ohne 6./7. Bonus</span><span class="v">${sM6 > sT * 1.0005 ? "+" + pf(sM6 / sT - 1) : "ausgereizt"}</span></div>
        <div class="total-row off" style="border:0"><span class="n">Zusätzlich mit 6. und 7. Bonus</span><span class="v">${sM > sT * 1.0005 ? "+" + pf(sM / sT - 1) : "ausgereizt"}</span></div>
        ${itemLine}
        ${lines.length ? `<div class="hint" style="margin-top:6px">Noch offen: ${esc(lines.join(" · "))}</div>` : ""}
        <div class="panel-note" style="margin-top:6px">Gewürfelte Zufallsboni (z. B. Durchschnittsschaden) sind dabei nicht hochgerechnet.</div></div>`;
    }

    // Alternativen: was eine weitere Zeile bringen würde
    let altHtml = "";
    const gl = groups.find((g) => g.key === "lines");
    if (gl) {
      const used = new Set((eT.lines || []).map((l) => l.b).concat(gl.blocked));
      const alts = [];
      Object.keys(gl.pool).forEach((bid) => {
        if (used.has(bid)) return;
        const v = O.tierValue(gl.pool, bid, gl.up, po.tier);
        if (!v) return;
        const t = O.clone(T); t.equip[slotId].lines.push({ b: bid, v });
        const g = sT > 0 ? O.score(t, db) / sT - 1 : 0;
        if (g > 0.0005) alts.push({ bid, v, g });
      });
      alts.sort((x, y) => y.g - x.g);
      if (alts.length) altHtml = `<div><div class="sect-title">Was eine weitere Zeile bringen würde</div>${alts.slice(0, 5).map((x) => `<div class="total-row off" style="border:0"><span class="n">${esc(bfmt(x.bid, x.v))}</span><span class="v">+${pf(x.g)}</span></div>`).join("")}
        <div class="panel-note">${po.tier === "good" ? "mit realistischen Werten" : "mit Höchstwerten"}, jeweils einzeln gerechnet</div></div>`;
    }

    // Kopf: Gegenstand vorher/nachher
    const itemInfo = (it, e) => {
      if (!it) return slot.kind === "bonus" ? (e.on ? "aktiv" : "nicht eingetragen") : "leer";
      const parts = [esc(it.name) + " +" + (e.up || 0)];
      if (it.atk) { const r = C.kpRange(it.atk, e.up || 0), f = bmf(e); parts.push("Angriffswert " + Math.round(r[0] * f) + "–" + Math.round(r[1] * f)); }
      if (it.def && typeof C.firstVal(it.def) === "number") parts.push("Verteidigung " + Math.round(C.kp(it.def, e.up || 0) * bmf(e)));
      if (e.bm) parts.push("Grundwerte +" + e.bm + " %");
      return parts.join(" · ");
    };
    const share = sB > sA * 1.0005 ? (sT - sA) / (sB - sA) : null;
    let maxLine = "";
    if (iB) {
      const bits = [];
      if (iB.atk) { const r = C.kpRange(iB.atk, maxUp), f = bmf(eT); bits.push("Angriffswert " + Math.round(r[0] * f) + "–" + Math.round(r[1] * f)); }
      if (iB.def && typeof C.firstVal(iB.def) === "number") bits.push("Verteidigung " + Math.round(C.kp(iB.def, maxUp) * bmf(eT)));
      Object.keys(iB.fixed || {}).forEach((bid) => bits.push(bfmt(bid, Math.round(C.kp(iB.fixed[bid], maxUp) * bmf(eT)))));
      if (bits.length) maxLine = `<div class="total-row" style="border:0"><span class="n">Bei +${maxUp} (Maximum)</span><span class="v" style="font-weight:500;text-align:right">${esc(bits.join(" · "))}</span></div>`;
    }
    const sb = stoneTxt(eA), sa = eB ? stoneTxt(eT) : [];

    $("#drawer").innerHTML = `
      <div class="drawer-head"><div class="slot-ico">${slot.icon}</div><div style="min-width:0"><div class="drawer-title">${esc(slot.name)}</div><div class="panel-note">${esc(title || "")}</div></div><div style="flex:1"></div><button class="btn btn-sm" data-act="drawer-close">✕</button></div>
      <div class="drawer-body">
        <div class="stat-grid" style="margin-top:0">
          <div class="stat ${sT > sA * 1.0005 ? "good" : ""}"><div class="k" data-tip="Schaden, wenn du nur diesen einen Slot änderst und alles andere lässt">Dieser Slot allein</div><div class="v">${sA > 0 ? (sT >= sA ? "+" : "−") + pf(Math.abs(sT / sA - 1)) : "–"}</div><div class="s">${nf(sA)} → ${nf(sT)}</div></div>
          <div class="stat"><div class="k">Anteil am Gesamtgewinn</div><div class="v">${share == null ? "–" : pf(Math.max(0, Math.min(1, share)), 0)}</div><div class="s">${share == null ? "" : "gesamt " + nf(sA) + " → " + nf(sB)}</div></div>
        </div>
        <div><div class="sect-title">Gegenstand</div>
          <div class="total-row" style="border:0"><span class="n">Vorher</span><span class="v" style="font-weight:500;text-align:right">${itemInfo(iA, eA)}</span></div>
          <div class="total-row" style="border:0"><span class="n">Nachher</span><span class="v" style="text-align:right">${itemInfo(iB, eT)}</span></div>
          ${maxLine}
          ${iB && iB.learned ? `<div class="hint">Vom Server gelernt: Die Werte anderer Verbesserungsstufen sind nicht bekannt.</div>` : ""}</div>
        ${tbl}
        ${removed.length ? `<div><div class="sect-title">Das fällt weg</div>${removed.map((r) => `<div class="total-row ${r.def ? "def" : "off"}" style="border:0"><span class="n">${esc(bfmt(r.l.b, r.l.v))}${r.def ? ` <span class="tag">Verteidigung</span>` : ""}</span><span class="v ${r.loss > 0.0005 ? "red" : "dim"}">${r.loss > 0.0005 ? "−" + pf(r.loss) + " Schaden" : "kein Schaden"}</span></div>`).join("")}
          ${removed.some((r) => r.def) ? `<div class="hint warn" style="margin-top:6px">Dabei gehen Verteidigungs-Boni verloren. Sperre sie im Slot-Editor mit 🔒, wenn du sie behalten willst.</div>` : ""}</div>` : ""}
        ${sockets ? `<div><div class="sect-title">Geiststeine (${sa.length} von ${sockets} Sockeln)</div>
          <div class="total-row" style="border:0"><span class="n">Vorher</span><span class="v" style="font-weight:500;text-align:right">${esc(sb.join(", ") || "keine")}</span></div>
          <div class="total-row" style="border:0"><span class="n">Nachher</span><span class="v" style="text-align:right">${esc(sa.join(", ") || "keine")}</span></div></div>` : ""}
        ${potHtml}
        ${altHtml}
      </div>
      <div class="drawer-foot"><button class="btn" data-act="detail-edit" data-tip="Öffnet den Slot deines aktuellen Builds im Editor">Im Slot-Editor öffnen</button><div style="flex:1"></div>
        <button class="btn btn-primary" data-act="detail-apply">Nur diesen Slot übernehmen</button></div>`;
    App.drawerSlot = null;
    $("#drawer").classList.add("open"); $("#drawer-backdrop").classList.add("open");
    $("#drawer").setAttribute("aria-hidden", "false");
  }
  App.openDetail = openDetail;

  function renderOpt() {
    const b = App.build, db = App.db, s = optState, cls = db.classes[b.cls];
    const cur = O.score(b, db);
    const r = s.result;
    const diff = r ? diffBuilds(b, r.build) : [];
    const p = s.path;
    let chart = "";
    if (p && p.path.length) {
      const W = 640, H = 150, pad = 28, n = p.path.length, maxT = Math.max(0.01, p.path[n - 1].total);
      const pts = [[pad, H - pad]].concat(p.path.map((st, i) => [pad + ((i + 1) / n) * (W - pad * 2), H - pad - (st.total / maxT) * (H - pad * 2)]));
      chart = `<svg class="chart" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="gpath" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="rgba(230,185,85,.45)"/><stop offset="1" stop-color="rgba(230,185,85,0)"/></linearGradient></defs>
        <path d="M${pts.map((q) => q.join(",")).join(" L")} L${W - pad},${H - pad} L${pad},${H - pad} Z" fill="url(#gpath)"/>
        <path d="M${pts.map((q) => q.join(",")).join(" L")}" fill="none" stroke="#e6b955" stroke-width="2.5" stroke-linejoin="round"/>
        ${pts.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="4" fill="#0e111b" stroke="#f6d98a" stroke-width="2"/>${i ? `<text x="${q[0]}" y="${H - 8}" text-anchor="middle">${i}</text>` : ""}`).join("")}
        <text x="${W - pad}" y="${pts[n][1] - 9}" text-anchor="end" class="val">+${pf(p.path[n - 1].total)}</text></svg>`;
    }
    $("#view-opt").innerHTML = `<div class="opt-grid">
      <div class="col">
        <div class="panel"><div class="panel-head"><div class="panel-title">Optimierer</div></div>
          <div class="stack">
            <div class="hint">Ziel: <b>${esc(C.resolveTarget(b, db).name)}</b> · Angriff: <b>${esc(App.res.isSkill ? App.res.attack.name : "Normaler Treffer")}</b>. Beides stellst du im Tab Build ein.</div>
            <div class="field"><label>Was soll optimiert werden?</label>
              <select data-f="opt-mode">
                <option value="fill" ${s.mode === "fill" ? "selected" : ""}>Mein Stand: nur freie Zeilen und Sockel füllen</option>
                <option value="replace" ${s.mode === "replace" ? "selected" : ""}>Mein Stand: Boni neu verteilen (Gegenstände bleiben)</option>
                <option value="max" ${s.mode === "max" ? "selected" : ""}>Theoretisches Maximum: auch beste Gegenstände</option>
              </select></div>
            <div class="field"><label>Bonus-Werte</label>
              <div class="seg wide"><button data-act="opt-tier" data-v="max" class="${s.tier === "max" ? "active" : ""}">Höchstwerte</button><button data-act="opt-tier" data-v="good" class="${s.tier === "good" ? "active" : ""}" data-tip="Neue Boni mit der zweithöchsten Wertstufe statt mit perfekten Würfen. Was du schon hast, behält seinen echten Wert.">Realistisch</button></div></div>
            <div class="field"><label data-tip="Gilt überall, wo ein anderer Gegenstand vorgeschlagen wird">Waffentyp bei Vorschlägen</label><select data-f="opt-wtype"><option value="same" ${s.wtype === "same" ? "selected" : ""}>wie meine aktuelle Waffe</option><option value="any" ${s.wtype === "any" ? "selected" : ""}>egal, der beste</option>${cls.wtypes.map((t) => `<option value="${t}" ${s.wtype === t ? "selected" : ""}>${C.WTYPE_NAME[t]}</option>`).join("")}</select></div>
            <label class="inline" style="cursor:pointer"><input type="checkbox" data-f="opt-upgrade" ${s.upgrade ? "checked" : ""}> <span>Verbesserungsstufen bis zum Maximum einplanen</span></label>
            <label class="inline" style="cursor:pointer"><input type="checkbox" data-f="opt-rare" ${s.rare ? "checked" : ""}> <span>6. und 7. Bonus einplanen</span></label>
            <label class="inline" style="cursor:pointer"><input type="checkbox" data-f="opt-extras" ${s.extras ? "checked" : ""}> <span>Auch Kostüme, Schulterband, Pet, Alchemie einplanen</span></label>
            <label class="inline" style="cursor:pointer"><input type="checkbox" data-f="opt-items" ${s.items || s.mode === "max" ? "checked" : ""} ${s.mode === "max" ? "disabled" : ""}> <span>Vorschläge und Upgrade-Pfad: auch andere Gegenstände (Tausch, leere Slots)</span></label>
            <div class="hint">Diese Einstellungen gelten überall: für „Optimieren", den Upgrade-Pfad, die Vorschläge im Build-Tab und die „+x % möglich"-Anzeige der Slots.</div>
            <div class="hint">Eingebaute Zufallsboni wie Durchschnittsschaden bleiben, wie sie sind. Nur das theoretische Maximum rechnet sie hoch.</div>
            <div class="hint">Gesperrte Zeilen (🔒 im Slot-Editor) bleiben immer erhalten. So hältst du z. B. deine Verteidigungs-Boni fest.</div>
            <button class="btn btn-primary" data-act="opt-run" ${s.busy ? "disabled" : ""}>⚡ Optimieren</button>
            <button class="btn" data-act="opt-path" ${s.busy ? "disabled" : ""}>🧭 Upgrade-Pfad berechnen (12 Schritte)</button>
            <div class="progress"><i id="opt-prog"></i></div>
          </div></div>
      </div>
      <div class="col">
        <div class="panel"><div class="panel-head"><div class="panel-title">Ergebnis</div><div class="spacer"></div>
          ${r ? `<button class="btn btn-sm" data-act="opt-saveas">Als neuen Build speichern</button><button class="btn btn-sm btn-primary" data-act="opt-apply">Übernehmen</button>` : ""}</div>
          ${r ? `<div class="row c3">
              <div class="stat"><div class="k">Jetzt</div><div class="v">${nf(r.before)}</div></div>
              <div class="stat good"><div class="k">Optimiert</div><div class="v">${nf(r.after)}</div></div>
              <div class="stat ${r.after > r.before * 1.001 ? "good" : ""}"><div class="k">Gewinn</div><div class="v">${r.before > 0 ? sign(r.after / r.before - 1) : "–"}</div></div></div>
            <div class="stack" style="margin-top:12px">${diff.length ? diff.map((d) => `<div class="sugg clickable" data-act="detail" data-src="opt" data-v="${d.slot.id}" style="grid-template-columns:34px 1fr auto"><div class="rank">${d.slot.icon}</div><div><div class="t">${esc(d.slot.name)}</div><div class="d" style="font-size:12.5px;line-height:1.6">${d.ch.join(" · ")}</div></div><div class="g" style="color:var(--gold-2)">Details ›</div></div>`).join("") : `<div class="empty-state">Keine Änderung nötig. Der Build ist für diese Einstellungen bereits optimal.</div>`}</div>`
          : `<div class="empty-state">Aktueller Schaden: <b class="gold">${nf(cur)}</b>.<br>Starte links die Optimierung, dann siehst du hier jede einzelne Änderung.</div>`}
        </div>
        <div class="panel"><div class="panel-head"><div class="panel-title">Upgrade-Pfad</div><div class="spacer"></div><span class="panel-note">immer der Schritt mit dem größten Gewinn zuerst</span></div>
          ${p ? (p.path.length ? chart + `<div class="sugg-list" style="margin-top:10px">${p.path.map((st, i) => `<div class="sugg clickable" data-act="detail" data-src="path" data-v="${i}"><div class="rank">${i + 1}</div><div style="min-width:0"><div class="t">${esc(st.title)}</div><div class="d">${esc(st.detail)}</div></div><div class="g">+${pf(st.gain)}<small>gesamt +${pf(st.total)} · <a href="#" data-act="path-apply" data-v="${i}">bis hier übernehmen</a></small></div></div>`).join("")}</div>` : `<div class="empty-state">Kein Einzelschritt bringt noch etwas.</div>`)
          : `<div class="empty-state">Zeigt dir die Reihenfolge, in der sich Verbesserungen am meisten lohnen.</div>`}
        </div>
      </div></div>`;
  }
  function runOpt() {
    const s = optState, b = O.clone(App.build), db = App.db;
    s.busy = true; renderOpt();
    // „Optimieren" tauscht Gegenstände nur im Modus „Theoretisches Maximum". Alles andere kommt aus den Einstellungen.
    const opts = Object.assign({}, App.planOpts(), { mode: s.mode === "fill" ? "fill" : "replace", innate: s.mode === "max" ? "opt" : "keep", items: s.mode === "max", enableExtras: s.extras, passes: s.mode === "fill" ? 1 : 3 });
    if (!s.extras) opts.slots = db.slots.filter((x) => x.group === "gear").map((x) => x.id);
    O.optimizeAllAsync(b, db, opts, (p) => { const el = $("#opt-prog"); if (el) el.style.width = Math.round(p * 100) + "%"; }).then((res) => {
      s.busy = false; s.result = res; renderOpt();
      FX.toast(res.after > res.before * 1.001 ? "Optimierung fertig: " + sign(res.after / res.before - 1) : "Schon optimal für diese Einstellungen");
    });
  }
  function runPath() {
    const s = optState;
    s.busy = true; renderOpt();
    O.pathAsync(App.build, App.db, 12, (p) => { const el = $("#opt-prog"); if (el) el.style.width = Math.round(p * 100) + "%"; }, App.planOpts()).then((res) => { s.busy = false; s.path = res; renderOpt(); });
  }

  /* ---------- Vergleich ---------- */
  function renderCompare() {
    const db = App.db, cur = App.build;
    const T = C.resolveTarget(cur, db);
    const rows = App.builds.map((b) => {
      const t = O.clone(b); t.mode = cur.mode; t.targetId = cur.targetId; t.targetOverride = cur.targetOverride;
      const hit = C.evaluate(t, db, { light: true, attack: null }).exp;
      const skills = C.skillList(b.cls, b.branch).filter((s) => !s.unsure);
      let bestS = null, bestV = 0;
      skills.forEach((s) => { const v = C.evaluate(t, db, { light: true, attack: s }).exp; if (v > bestV) { bestV = v; bestS = s; } });
      const own = C.evaluate(t, db, { light: true }).exp;
      const d = C.defense(b, db);
      return { b, hit, bestS, bestV, own, d };
    });
    const maxHit = Math.max(1, ...rows.map((r) => r.hit)), maxSk = Math.max(1, ...rows.map((r) => r.bestV));
    const bestId = rows.slice().sort((x, y) => y.own - x.own)[0].b.id;
    $("#view-compare").innerHTML = `
      <div class="panel" style="margin-bottom:18px"><div class="panel-head"><div class="panel-title">Build-Vergleich</div><div class="spacer"></div><span class="panel-note">alle gespeicherten Builds gegen dasselbe Ziel: <b style="color:var(--text)">${esc(T.name)}</b></span></div>
        <div class="hint">Lege im Kopf der Seite mit ＋ oder ⧉ weitere Builds an. Hier treten sie gegeneinander an.</div></div>
      <div class="cmp-grid">${rows.map((r) => `
        <div class="panel cmp-card ${r.b.id === bestId && rows.length > 1 ? "best" : ""}">
          <div class="panel-head"><div style="font-size:22px">${db.classes[r.b.cls].icon}</div><div><div style="font-weight:700">${esc(r.b.name)}</div><div class="panel-note">${esc(db.classes[r.b.cls].name)} · ${esc(db.classes[r.b.cls].branches[r.b.branch])} · Lv ${r.b.level}</div></div><div class="spacer"></div>
            ${r.b.id === bestId && rows.length > 1 ? `<span class="chip gold">Bester</span>` : ""}${r.b.id === cur.id ? `<span class="chip blue">aktiv</span>` : `<button class="btn btn-sm" data-act="build-load" data-v="${r.b.id}">Laden</button>`}</div>
          <div class="stack">
            <div><div class="total-row off" style="border:0"><span class="n">Normaler Treffer</span><span class="v">${nf(r.hit)}</span></div><div class="progress"><i data-w="${((r.hit / maxHit) * 100).toFixed(0)}"></i></div></div>
            <div><div class="total-row off" style="border:0"><span class="n">Stärkste Fertigkeit${r.bestS ? ": " + esc(r.bestS.name) : ""}</span><span class="v">${nf(r.bestV)}</span></div><div class="progress"><i data-w="${((r.bestV / maxSk) * 100).toFixed(0)}"></i></div></div>
            <div class="row c2"><div class="stat"><div class="k">Verteidigung</div><div class="v">${nf(r.d.def)}</div></div><div class="stat"><div class="k">TP</div><div class="v">${nf(r.d.hp)}</div></div></div>
          </div></div>`).join("")}</div>`;
    FX.fillBars($("#view-compare"));
  }

  /* ---------- Ereignisse ---------- */
  App.setView = function (v) {
    App.view = v;
    $$("#tabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.view === v));
    $$("main .view").forEach((s) => s.classList.toggle("active", s.id === "view-" + v));
    if (v === "opt") renderOpt();
    if (v === "inv" && window.Inv) window.Inv.render();
    if (v === "compare") renderCompare();
    if (v === "admin" && window.Admin) window.Admin.render();
    if (v === "build") App.update(true);
  };
  function setPath(obj, path, val) { const ks = path.split("."); let o = obj; for (let i = 0; i < ks.length - 1; i++) { o[ks[i]] = o[ks[i]] || {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = val; }

  function bindGlobal() {
    $("#tabs").addEventListener("click", (ev) => { const t = ev.target.closest(".tab"); if (t) App.setView(t.dataset.view); });
    $("#drawer-backdrop").addEventListener("click", App.closeDrawer);
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") App.closeDrawer(); });

    document.addEventListener("click", (ev) => {
      const a = ev.target.closest("[data-act]"); if (!a || a.closest("#view-admin")) return;
      const act = a.dataset.act, v = a.dataset.v, b = App.build, db = App.db;
      if (a.tagName === "A") ev.preventDefault();
      switch (act) {
        case "mode": b.mode = v; b.targetOverride = {}; b.targetId = null; App.renderAll(); App.saveBuilds(); break;
        case "cls": {
          if (b.cls === v) break;
          const nb = App.newBuild(v, b.name); nb.id = b.id; nb.mode = b.mode; nb.targetId = b.targetId; nb.level = b.level;
          App.builds[App.builds.indexOf(b)] = nb; App.build = nb; App.pot = {}; App.sugg = null; App.renderAll(); App.saveBuilds(); break;
        }
        case "branch": b.branch = v; b.attack = "hit"; renderChar(); App.update(); break;
        case "stats-max": ["str", "dex", "vit", "int"].forEach((s) => { b.stats[s] = db.params.maxStat; }); renderChar(); App.update(); break;
        case "tov-reset": b.targetOverride = {}; renderTarget(); App.update(); renderTarget(); break;
        case "slot": App.openDrawer(v); break;
        case "drawer-close": App.closeDrawer(); break;
        case "pin": App.pin = App.res.exp; renderResult(); FX.toast("Referenz gesetzt: " + nf(App.pin)); break;
        case "apply-sugg": { const s = App.sugg[Number(v)]; if (s) { b.equip = O.clone(s.build.equip); App.sugg = null; App.update(); FX.toast("Übernommen: +" + pf(s.gain)); } break; }
        case "build-new": { const nb = App.newBuild(b.cls, "Neuer Build " + (App.builds.length + 1)); App.builds.push(nb); App.build = nb; App.pot = {}; App.renderAll(); App.saveBuilds(); break; }
        case "build-copy": { const nb = O.clone(b); nb.id = "b" + Date.now().toString(36); nb.name = b.name + " (Kopie)"; App.builds.push(nb); App.build = nb; App.renderAll(); App.saveBuilds(); FX.toast("Kopie angelegt"); break; }
        case "build-rename": { const n = prompt("Name des Builds", b.name); if (n) { b.name = n.trim().slice(0, 60); renderHeader(); App.saveBuilds(); } break; }
        case "build-del": if (App.builds.length > 1 && confirm("Build „" + b.name + "“ wirklich löschen?")) { App.builds.splice(App.builds.indexOf(b), 1); App.build = App.builds[0]; App.renderAll(); App.saveBuilds(); } else if (App.builds.length <= 1) FX.toast("Der letzte Build kann nicht gelöscht werden"); break;
        case "build-load": App.build = App.builds.find((x) => x.id === v) || b; App.pot = {}; App.renderAll(); App.saveBuilds(); break;
        case "slot-to-inv": if (window.Inv && b.equip[App.drawerSlot]) window.Inv.addEntry(App.drawerSlot, b.equip[App.drawerSlot]); break;
        case "slot-clear": delete b.equip[App.drawerSlot]; App.update(); renderDrawer(); break;
        case "slot-opt": { const before = O.score(b, db); O.optimizeSlot(b, db, App.drawerSlot, Object.assign({}, App.planOpts(), { mode: "fill", items: false, enableExtras: true })); const after = O.score(b, db); App.update(); renderDrawer(); FX.toast(after > before * 1.0001 ? "Slot optimiert: " + sign(after / before - 1) : "Nichts mehr zu holen. Gesperrte und belegte Zeilen bleiben."); break; }
        case "slot-opt-item": { const before = O.score(b, db); O.optimizeSlot(b, db, App.drawerSlot, Object.assign({}, App.planOpts(), { mode: "fill", items: true })); const after = O.score(b, db); App.update(); renderDrawer(); FX.toast(before > 0 ? "Bester Gegenstand gewählt: " + sign(after / before - 1) : "Gegenstand gewählt"); break; }
        case "line-lock": case "line-max": {
          const row = a.closest(".bonus-row"), e = O.entry(b, App.drawerSlot), k = row.dataset.grp, i = Number(row.dataset.i);
          const l = e[k][i]; if (!l) break;
          if (act === "line-lock") l.lock = !l.lock;
          else { const slot = C.slotById(db, App.drawerSlot); const g = O.groups(b, db, slot).find((x) => x.key === k && (k !== "innate" || x.index === i)); l.v = O.tierValue(g.pool, l.b, g.up, "max"); }
          App.update(); renderDrawer(); break;
        }
        case "opt-tier": optState.tier = v; savePlan(); renderOpt(); break;
        case "goto-opt": App.setView("opt"); break;
        case "detail": {
          if (ev.target.closest("a, button")) break;
          if (a.dataset.src === "opt" && optState.result) openDetail(v, b, optState.result.build, "Ergebnis der Optimierung");
          else if (a.dataset.src === "path" && optState.path) { const st = optState.path.path[Number(v)]; if (st) openDetail(st.slot, st.prev || b, st.build, "Schritt " + (Number(v) + 1) + ": " + st.title); }
          break;
        }
        case "detail-apply": if (App.detail) { if (App.detail.entry) b.equip[App.detail.slotId] = O.clone(App.detail.entry); else delete b.equip[App.detail.slotId]; optState.result = null; optState.path = null; App.closeDrawer(); App.saveBuilds(); App.update(true); if (App.view === "opt") renderOpt(); FX.toast("Für diesen Slot übernommen"); } break;
        case "detail-edit": if (App.detail) { const sid = App.detail.slotId; App.closeDrawer(); App.setView("build"); App.openDrawer(sid); } break;
        case "opt-run": runOpt(); break;
        case "opt-path": runPath(); break;
        case "opt-apply": if (optState.result) { b.equip = O.clone(optState.result.build.equip); optState.result = null; optState.path = null; App.saveBuilds(); App.update(true); renderOpt(); FX.toast("Optimierter Build übernommen"); } break;
        case "opt-saveas": if (optState.result) { const nb = O.clone(optState.result.build); nb.id = "b" + Date.now().toString(36); nb.name = b.name + " (optimiert)"; nb.weaponType = "any"; App.builds.push(nb); App.saveBuilds(); renderHeader(); FX.toast("Als „" + nb.name + "“ gespeichert"); } break;
        case "path-apply": { const st = optState.path && optState.path.path[Number(v)]; if (st) { b.equip = O.clone(st.build.equip); optState.path = null; optState.result = null; App.saveBuilds(); App.update(true); renderOpt(); FX.toast("Schritte 1 bis " + (Number(v) + 1) + " übernommen"); } break; }
      }
    });

    document.addEventListener("change", (ev) => {
      const el = ev.target, f = el.dataset.f; if (!f || el.closest("#view-admin")) return;
      const b = App.build, db = App.db;
      const num = (x, d) => { const n = Number(x); return isFinite(n) && x !== "" ? n : d; };
      switch (f) {
        case "level": b.level = Math.max(1, Math.min(250, num(el.value, 1))); App.update(); break;
        case "stat": b.stats[el.dataset.k] = Math.max(1, num(el.value, 1)); App.update(); break;
        case "attack": b.attack = el.value; renderChar(); App.update(); break;
        case "skillLevel": b.skillLevel = num(el.value, 40); App.update(); break;
        case "target": b.targetId = el.value; b.targetOverride = {}; App.update(); renderTarget(); break;
        case "tov": {
          const T = C.resolveTarget(b, db), k = el.dataset.k;
          const ov = b.targetOverride = b.targetOverride || {};
          if (k.indexOf(".") > 0) { const top = k.split(".")[0]; if (!ov[top]) ov[top] = O.clone(T[top] || {}); }
          setPath(ov, k, el.tagName === "SELECT" ? el.value : (el.value === "" ? undefined : num(el.value, 0)));
          App.update(); renderTarget(); break;
        }
        case "toggle": b.toggles[el.dataset.k] = el.checked; if (!el.checked) delete b.toggles[el.dataset.k]; App.update(); renderBuffs(); break;
        case "build-select": App.build = App.builds.find((x) => x.id === el.value) || b; App.pot = {}; App.sugg = null; App.lastExp = null; App.renderAll(); App.saveBuilds(); break;
        case "item": {
          const e = O.entry(b, App.drawerSlot), slot = C.slotById(db, App.drawerSlot);
          const old = C.itemById(db, e.item), it = C.itemById(db, el.value);
          e.item = el.value || null;
          if (it) { e.up = Math.min(C.itemMaxUp(it), Math.max(e.up || 0, 9)); if ((it.innate || []).join() !== ((old || {}).innate || []).join()) e.innate = []; e.stones = (e.stones || []).slice(0, O.sockets(slot, it)); const pool = db.pools[slot.pool] || {}; e.lines = (e.lines || []).filter((l) => pool[l.b] != null && !(it.fixed && !it.innate && it.fixed[l.b])); }
          App.update(); renderDrawer(); break;
        }
        case "up": { const e = O.entry(b, App.drawerSlot); e.up = num(el.value, 0); const it = C.itemById(db, e.item); (e.innate || []).forEach((l, i) => { if (l && l.b && it && it.innate) l.v = O.tierValue(db.pools[it.innate[i]], l.b, e.up, "max"); }); App.update(); renderDrawer(); break; }
        case "bm": { const e = O.entry(b, App.drawerSlot); e.bm = Math.max(0, num(el.value, 0)); if (!e.bm) delete e.bm; App.update(); renderDrawer(); break; }
        case "on": { const e = O.entry(b, App.drawerSlot); e.on = el.checked; App.update(); renderDrawer(); break; }
        case "line-b": case "line-v": {
          const row = el.closest(".bonus-row"), e = O.entry(b, App.drawerSlot), k = row.dataset.grp, i = Number(row.dataset.i);
          const slot = C.slotById(db, App.drawerSlot);
          const g = O.groups(b, db, slot).find((x) => x.key === k && (k !== "innate" || x.index === i));
          if (f === "line-b") {
            if (k === "innate") e.innate[i] = el.value ? { b: el.value, v: O.tierValue(g.pool, el.value, g.up, "max") } : null;
            else { const arr = e[k].filter((l) => l.b); if (!el.value) arr.splice(i, 1); else if (arr[i]) { arr[i].b = el.value; arr[i].v = O.tierValue(g.pool, el.value, g.up, "max"); } else arr.push({ b: el.value, v: O.tierValue(g.pool, el.value, g.up, "max") }); e[k] = arr; }
          } else if (e[k][i]) e[k][i].v = num(el.value, 0);
          App.update(); renderDrawer(); break;
        }
        case "stone": case "stone-l": {
          const row = el.closest(".bonus-row"), e = O.entry(b, App.drawerSlot), i = Number(row.dataset.i);
          const arr = e.stones = (e.stones || []).filter((s) => s && s.s);
          if (f === "stone") { if (!el.value) arr.splice(i, 1); else { const st = C.stoneById(db, el.value); const v = { s: el.value, l: st.values.length - 1 }; if (arr[i]) arr[i] = v; else arr.push(v); } }
          else if (arr[i]) arr[i].l = num(el.value, 0);
          App.update(); renderDrawer(); break;
        }
        case "opt-mode": optState.mode = el.value; savePlan(); renderOpt(); break;
        case "opt-wtype": optState.wtype = el.value; savePlan(); renderOpt(); break;
        case "opt-extras": optState.extras = el.checked; savePlan(); renderOpt(); break;
        case "opt-rare": optState.rare = el.checked; savePlan(); renderOpt(); break;
        case "opt-upgrade": optState.upgrade = el.checked; savePlan(); renderOpt(); break;
        case "opt-items": optState.items = el.checked; savePlan(); renderOpt(); break;
      }
    });
    // Schieberegler live mitziehen
    document.addEventListener("input", (ev) => {
      const el = ev.target;
      if (el.dataset.f === "up" && App.drawerSlot) { const lab = el.closest(".field").querySelector("label"); const e = O.entry(App.build, App.drawerSlot); const it = C.itemById(App.db, e.item); lab.textContent = "Verbesserung: +" + el.value + " von +" + (it ? C.itemMaxUp(it) : 9); }
    });
  }

  window.App = App;
})();
