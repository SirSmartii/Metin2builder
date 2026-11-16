/* Admin-Menü: alle Daten und Formel-Parameter an den eigenen Server anpassen */
(function () {
  "use strict";
  const App = window.App, C = window.Calc, FX = window.FX;
  const esc = App.esc, $ = App.$, $$ = App.$$;
  const A = { section: "items", slot: "weapon", q: "", pool: "weapon", edit: null };
  const SECTIONS = [["era", "🕰️ Zeitalter & Features"], ["items", "🗡️ Gegenstände"], ["pools", "🎲 Bonus-Pools"], ["slots", "🧩 Slots & Zeilen"], ["stones", "💠 Geiststeine"], ["targets", "🎯 Ziele"], ["toggles", "🧪 Biologe & Buffs"], ["bonus", "🏷️ Bonus-Namen"], ["ocr", "🔎 Erkennung"],["params", "⚙️ Formel-Parameter"], ["data", "💾 Sichern & Laden"]];

  const fmtVals = (v) => (Array.isArray(v) ? v.join(", ") : typeof v === "object" && v ? Object.keys(v).map((k) => k + ":" + v[k]).join(", ") : String(v == null ? "" : v));
  const parseVals = (s) => {
    s = String(s).trim();
    if (!s) return [];
    if (s.indexOf(":") >= 0) { const o = {}; s.split(",").forEach((p) => { const [k, v] = p.split(":").map((x) => x.trim()); if (k !== "" && isFinite(Number(v))) o[Number(k)] = Number(v); }); return o; }
    return s.split(",").map((x) => Number(x.trim())).filter((x) => isFinite(x));
  };
  const fmtMap = (o) => Object.keys(o || {}).map((k) => k + ":" + o[k]).join(", ");
  const parseMap = (s) => { const o = {}; String(s).split(",").forEach((p) => { const [k, v] = p.split(":").map((x) => x.trim()); if (k && isFinite(Number(v))) o[k] = Number(v); }); return o; };
  const bonusOpts = (sel) => Object.keys(App.master.bonusTypes).sort((a, b) => App.master.bonusTypes[a].name.localeCompare(App.master.bonusTypes[b].name)).map((id) => `<option value="${id}" ${id === sel ? "selected" : ""}>${esc(App.master.bonusTypes[id].name)}</option>`).join("");
  const slotName = (id) => { const s = C.slotById(App.master, id); return s ? s.name : id; };
  const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  A.commit = function (msg) { App.refreshDb(); App.saveDb(); if (msg) FX.toast(msg); const c = $("#adm-custom"); if (c) c.style.display = ""; };

  A.render = function () {
    const db = App.master;
    $("#view-admin").innerHTML = `<div class="admin-layout">
      <div class="panel"><div class="panel-head"><div class="panel-title">Admin</div></div>
        <div class="admin-nav">${SECTIONS.map((s) => `<button data-adm="section" data-v="${s[0]}" class="${A.section === s[0] ? "active" : ""}">${s[1]}</button>`).join("")}</div>
        <div class="hint" style="margin-top:12px">Alle Änderungen gelten sofort und bleiben in diesem Browser gespeichert. Grundlage sind die offiziellen Werte.</div>
        <span class="chip gold" id="adm-custom" style="margin-top:10px;${App.dbIsCustom() ? "" : "display:none"}">Daten angepasst</span>
      </div>
      <div class="panel" id="adm-body">${body(db)}</div></div>`;
  };

  function body(db) {
    switch (A.section) {
      case "era": {
        const E = window.Era, v = App.db, era = db.era;
        const years = [2008, 2010, 2012, 2014, 2016, 2018, 2021, E.NOW_YEAR];
        const what = (f) => {
          const p = [];
          if (f.cap) p.push("Höchstlevel " + f.cap);
          if (f.rare) p.push("Zeilen 6 und 7");
          (f.slots || []).forEach((id) => { const s = db.slots.find((x) => x.id === id); if (s) p.push("Slot " + s.name); });
          (f.classes || []).forEach((c) => { if (db.classes[c]) p.push("Klasse " + db.classes[c].name); });
          if (f.itemRe) p.push(db.items.filter((it) => new RegExp(f.itemRe, "i").test(it.id)).length + " Gegenstände");
          if (f.bonus && f.bonus.length) p.push(f.bonus.length + " Boni");
          const tg = (f.toggles || []).length + db.toggles.filter((t) => (f.toggleGroups || []).indexOf(t.group) >= 0).length;
          if (tg) p.push(tg + " Schalter");
          return p.join(" · ");
        };
        const conf = E.conflicts(App.build, db, v);
        const list = db.features.slice().sort((a, b) => a.year - b.year);
        return `<div class="stack">
          <div class="sect-title">Stand des Servers</div>
          <div class="hint">Wähle das Jahr, auf dem dein Server steht. Alles, was es damals noch nicht gab, wird ausgeblendet: Slots, Klassen, Gegenstände, Boni und Schalter. Darunter kannst du einzelne Features dazu- oder abwählen, falls dein Server Inhalte aus mehreren Jahren mischt.</div>
          <div class="inline" style="flex-wrap:wrap"><div class="seg">${years.map((y) => `<button data-adm="era-year" data-v="${y}" class="${era.year === y ? "active" : ""}">${y === E.NOW_YEAR ? "Aktuell" : y}</button>`).join("")}</div>
            <div class="field" style="width:110px"><label>Jahr</label><input type="number" min="${E.BASE_YEAR}" max="${E.NOW_YEAR}" value="${era.year}" data-adm="era-year-f"></div>
            <button class="btn btn-sm" data-adm="era-clear" ${Object.keys(era.over).length ? "" : "disabled"}>Abweichungen zurücksetzen</button></div>
          <div class="inline" style="flex-wrap:wrap"><span class="chip gold">Stand: ${esc(v.eraLabel)}</span><span class="chip">Höchstlevel ${v.maxLevel}</span><span class="chip">${v.slots.length} von ${db.slots.length} Slots</span><span class="chip">${v.items.length} von ${db.items.length} Gegenständen</span><span class="chip">${Object.keys(db.classes).length - Object.keys(v.classOff).length} Klassen</span></div>
          ${conf.length ? `<div class="hint" style="color:#ffb37a">Dein Build „${esc(App.build.name)}“ nutzt Dinge, die es in diesem Stand nicht gibt: ${conf.map(esc).join(", ")}. Sie bleiben gespeichert, ausgeblendete Slots zählen aber nicht mehr mit.</div>` : ""}
          <div class="table-wrap" style="max-height:none"><table class="tbl"><thead><tr><th>Aktiv</th><th>Feature</th><th>Seit (Jahr)</th><th>Umfasst</th><th></th></tr></thead><tbody>
          <tr><td><input type="checkbox" checked disabled></td><td><b>Grundspiel</b></td><td>${E.BASE_YEAR}</td><td>Krieger, Ninja, Sura, Schamane · Waffe bis Halskette · 5 Boni · Geiststeine · Höchstlevel ${E.BASE_CAP}</td><td></td></tr>
          ${list.map((f) => { const on = E.isOn(db, f), byYear = f.year <= era.year, o = era.over[f.id] != null && on !== byYear;
            return `<tr><td><input type="checkbox" data-adm="era-feat" data-id="${f.id}" ${on ? "checked" : ""}></td><td><b>${esc(f.name)}</b>${f.note ? `<div class="panel-note">${esc(f.note)}</div>` : ""}</td>
              <td><input type="number" min="2004" max="2099" data-adm="era-feat-year" data-id="${f.id}" value="${f.year}" style="width:80px"></td><td>${esc(what(f))}</td>
              <td>${o ? `<span class="chip ${on ? "green" : "red"}">${on ? "zusätzlich an" : "abgewählt"}</span>` : ""}</td></tr>`; }).join("")}
          </tbody></table></div>
          <div class="hint">Die Jahreszahlen sind ungefähre Angaben für die offiziellen deutschen Server und lassen sich hier ändern. Werte einzelner Gegenstände haben sich über die Jahre ebenfalls geändert; hinterlegt sind die heutigen. Abweichungen deines Servers trägst du unter „Gegenstände“ und „Bonus-Pools“ ein.</div>
        </div>`;
      }
      case "items": {
        const list = db.items.filter((it) => it.slot === A.slot && (!A.q || it.name.toLowerCase().indexOf(A.q.toLowerCase()) >= 0)).sort((x, y) => (x.lvl || 0) - (y.lvl || 0));
        const sum = (it) => {
          const p = [];
          if (it.atk) p.push("AW " + Object.keys(it.atk).map((k) => "+" + k + ": " + it.atk[k].join("–")).join(" · "));
          if (it.matk) p.push("MAW " + Object.keys(it.matk).map((k) => "+" + k + ": " + it.matk[k].join("–")).join(" · "));
          if (it.def) p.push("DEF " + fmtVals(it.def));
          if (it.fixed) p.push(Object.keys(it.fixed).map((b) => (db.bonusTypes[b] || { name: b }).name + " " + fmtVals(it.fixed[b])).join(" · "));
          if (it.innate) p.push("Zufallsboni: " + it.innate.join(", "));
          return p.join(" | ");
        };
        return `<div class="toolbar"><select data-adm="slot" style="width:170px">${db.slots.filter((s) => s.kind === "item").map((s) => `<option value="${s.id}" ${s.id === A.slot ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
            <input type="search" placeholder="Suchen …" data-adm="q" value="${esc(A.q)}" style="width:200px"><div class="spacer"></div>
            <button class="btn btn-primary" data-adm="item-new">＋ Neuer Gegenstand</button></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Lv</th><th>Klassen</th><th>Werte</th><th></th></tr></thead><tbody>
          ${list.map((it) => `<tr><td><b>${esc(it.name)}</b>${it.est ? ` <span class="chip red">geschätzt</span>` : ""}</td><td>${it.lvl || 0}</td><td>${it.cls ? it.cls.map((c) => esc(db.classes[c].name)).join(", ") : "alle"}</td><td class="muted" style="font-size:11.5px">${esc(sum(it))}</td>
            <td style="white-space:nowrap"><button class="btn btn-sm" data-adm="item-edit" data-v="${it.id}">Bearbeiten</button> <button class="btn btn-sm" data-adm="item-dup" data-v="${it.id}">⧉</button> <button class="btn btn-sm btn-danger" data-adm="item-del" data-v="${it.id}">🗑</button></td></tr>`).join("") || `<tr><td colspan="5" class="empty-state">Keine Gegenstände.</td></tr>`}
          </tbody></table></div>`;
      }
      case "pools": {
        const pool = db.pools[A.pool] || {};
        const usedBy = db.slots.filter((s) => s.pool === A.pool || s.rarePool === A.pool).map((s) => s.name + (s.rarePool === A.pool ? " (6/7)" : ""));
        return `<div class="toolbar"><select data-adm="pool" style="width:240px">${Object.keys(db.pools).sort().map((p) => `<option value="${p}" ${p === A.pool ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
            <span class="panel-note">${usedBy.length ? "genutzt von: " + esc(usedBy.join(", ")) : "eingebaute Zufallsboni eines Gegenstands"}</span><div class="spacer"></div>
            <button class="btn" data-adm="pool-scale" data-tip="Multipliziert alle Werte dieses Pools">× Faktor</button><button class="btn btn-primary" data-adm="pool-add">＋ Bonus</button></div>
          <div class="hint" style="margin-bottom:10px">Werte als Stufen (<span class="mono">1, 2, 3, 5, 10</span>) oder je Verbesserungsstufe (<span class="mono">0:4, 9:19, 15:40</span>). Der letzte bzw. höchste Wert gilt als Maximum.</div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Bonus</th><th style="width:55%">Werte</th><th></th></tr></thead><tbody>
          ${Object.keys(pool).map((bid) => `<tr><td>${esc((db.bonusTypes[bid] || { name: bid }).name)}</td><td><input type="text" data-adm="pool-val" data-k="${bid}" value="${esc(fmtVals(pool[bid]))}"></td><td><button class="btn btn-sm btn-danger" data-adm="pool-del" data-v="${bid}">🗑</button></td></tr>`).join("")}
          </tbody></table></div>`;
      }
      case "slots":
        return `<div class="hint" style="margin-bottom:10px">Hat dein Server mehr Bonus-Zeilen oder andere Pools? Hier einstellen.</div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Slot</th><th>Zeilen</th><th>Pool</th><th>6/7-Zeilen</th><th>6/7-Pool</th></tr></thead><tbody>
          ${db.slots.map((s) => `<tr><td>${s.icon} <input type="text" data-adm="slot-f" data-id="${s.id}" data-k="name" value="${esc(s.name)}" style="width:170px"></td>
            <td><input type="number" min="0" max="20" data-adm="slot-f" data-id="${s.id}" data-k="lines" value="${s.lines || 0}"></td>
            <td><select data-adm="slot-f" data-id="${s.id}" data-k="pool"><option value="">–</option>${Object.keys(db.pools).sort().map((p) => `<option ${p === s.pool ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></td>
            <td><input type="number" min="0" max="10" data-adm="slot-f" data-id="${s.id}" data-k="rare" value="${s.rare || 0}"></td>
            <td><select data-adm="slot-f" data-id="${s.id}" data-k="rarePool"><option value="">–</option>${Object.keys(db.pools).sort().map((p) => `<option ${p === s.rarePool ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></td></tr>`).join("")}
          </tbody></table></div>`;
      case "stones":
        return `<div class="toolbar"><div class="hint">Werte je Stufe ab +0. Für +5/+6-Steine einfach Werte anhängen.</div><div class="spacer"></div><button class="btn btn-primary" data-adm="stone-add">＋ Geiststein</button></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Slot</th><th>Bonus</th><th>Werte (+0 …)</th><th></th></tr></thead><tbody>
          ${db.stones.map((s, i) => `<tr><td><input type="text" data-adm="stone-f" data-i="${i}" data-k="name" value="${esc(s.name)}"></td>
            <td><select data-adm="stone-f" data-i="${i}" data-k="kind">${["weapon", "armor", "shoes", "gloves"].map((k) => `<option value="${k}" ${k === s.kind ? "selected" : ""}>${esc(slotName(k))}</option>`).join("")}</select></td>
            <td><select data-adm="stone-f" data-i="${i}" data-k="bonus">${bonusOpts(s.bonus)}</select></td>
            <td><input type="text" data-adm="stone-f" data-i="${i}" data-k="values" value="${esc(s.values.join(", "))}"></td>
            <td><button class="btn btn-sm btn-danger" data-adm="stone-del" data-v="${i}">🗑</button></td></tr>`).join("")}
          </tbody></table></div>`;
      case "targets":
        return `<div class="toolbar"><div class="hint">Verteidigung = Rohwert + Level + VIT des Monsters.</div><div class="spacer"></div><button class="btn btn-primary" data-adm="target-new">＋ Neues Ziel</button></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Art</th><th>Lv</th><th>DEF</th><th>DEX</th><th>Typ</th><th>Boss</th><th></th></tr></thead><tbody>
          ${db.targets.map((t, i) => `<tr><td><input type="text" data-adm="target-f" data-i="${i}" data-k="name" value="${esc(t.name)}" style="min-width:230px"></td>
            <td>${t.kind === "stone" ? "Metin" : t.kind === "player" ? "Spieler" : "Monster"}</td>
            <td><input type="number" data-adm="target-f" data-i="${i}" data-k="lvl" value="${t.lvl}"></td>
            <td><input type="number" data-adm="target-f" data-i="${i}" data-k="def" value="${t.def}"></td>
            <td><input type="number" data-adm="target-f" data-i="${i}" data-k="dex" value="${t.dex || 0}"></td>
            <td>${t.kind === "player" ? esc(db.classes[t.cls].name) : esc(C.TYPE_NAME[t.type || "none"])}</td>
            <td><input type="checkbox" data-adm="target-f" data-i="${i}" data-k="boss" ${t.boss ? "checked" : ""}></td>
            <td style="white-space:nowrap"><button class="btn btn-sm" data-adm="target-edit" data-v="${i}">Details</button> <button class="btn btn-sm btn-danger" data-adm="target-del" data-v="${i}">🗑</button></td></tr>`).join("")}
          </tbody></table></div>`;
      case "toggles":
        return `<div class="toolbar"><div class="hint">Boni als <span class="mono">kennung:wert</span>, z. B. <span class="mono">av:50, crit:10</span>. Kennungen stehen unter Bonus-Namen.</div><div class="spacer"></div><button class="btn btn-primary" data-adm="toggle-add">＋ Schalter</button></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Gruppe</th><th>Name</th><th>Boni</th><th></th></tr></thead><tbody>
          ${db.toggles.map((t, i) => `<tr><td><input type="text" data-adm="toggle-f" data-i="${i}" data-k="group" value="${esc(t.group)}" style="width:130px"></td>
            <td><input type="text" data-adm="toggle-f" data-i="${i}" data-k="name" value="${esc(t.name)}" style="min-width:280px"></td>
            <td><input type="text" data-adm="toggle-f" data-i="${i}" data-k="b" value="${esc(fmtMap(t.b))}" style="min-width:200px"></td>
            <td><button class="btn btn-sm btn-danger" data-adm="toggle-del" data-v="${i}">🗑</button></td></tr>`).join("")}
          </tbody></table></div>`;
      case "bonus":
        return `<div class="hint" style="margin-bottom:10px">Nur die Anzeige. Die Kennung links nutzt du in Pools und Schaltern.</div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Kennung</th><th>Anzeigename</th><th>Einheit</th><th>Gruppe</th></tr></thead><tbody>
          ${Object.keys(db.bonusTypes).map((id) => { const t = db.bonusTypes[id]; return `<tr><td class="mono">${id}</td><td><input type="text" data-adm="bonus-f" data-id="${id}" data-k="name" value="${esc(t.name)}"></td>
            <td><select data-adm="bonus-f" data-id="${id}" data-k="u"><option value="%" ${t.u === "%" ? "selected" : ""}>%</option><option value="" ${t.u === "" ? "selected" : ""}>Punkte</option></select></td>
            <td><select data-adm="bonus-f" data-id="${id}" data-k="g">${[["off", "offensiv"], ["def", "defensiv"], ["util", "sonstiges"]].map((g) => `<option value="${g[0]}" ${t.g === g[0] ? "selected" : ""}>${g[1]}</option>`).join("")}</select></td></tr>`; }).join("")}
          </tbody></table></div>`;
      case "ocr": {
        const al = db.ocrAliases || {}, def = (window.Inv && window.Inv.DEFAULT_ALIASES) || {};
        return `<div class="hint" style="margin-bottom:10px">So heißen die Boni im Tooltip deines Servers. Mehrere Schreibweisen mit Semikolon trennen, Zahlen und Zeichen weglassen. Wird ein Bonus beim Einlesen nicht erkannt, trage hier seinen Wortlaut ein.</div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Bonus</th><th style="width:65%">Wortlaut im Spiel</th></tr></thead><tbody>
          ${Object.keys(db.bonusTypes).map((id) => `<tr><td>${esc(db.bonusTypes[id].name)}</td><td><input type="text" data-adm="ocr-f" data-id="${id}" value="${esc(al[id] != null ? al[id] : (def[id] || ""))}"></td></tr>`).join("")}
          </tbody></table></div>`;
      }
      case "params": {
        const P = db.params;
        const row = (k, label, help) => `<tr><td><b>${label}</b><div class="muted" style="font-size:11.5px">${help}</div></td><td><input type="number" step="any" data-adm="param" data-k="${k}" value="${P[k]}"></td></tr>`;
        return `<div class="table-wrap" style="max-height:none"><table class="tbl"><thead><tr><th>Parameter</th><th>Wert</th></tr></thead><tbody>
          ${row("finalMult", "Server-Multiplikator auf den Endschaden", "1 = offiziell. Für Server mit generell erhöhtem oder gesenktem Schaden.")}
          ${row("skillPowerMult", "Multiplikator auf die Fertigkeitskraft", "1 = offiziell (P = 1,25).")}
          ${row("elemMatch", "Element gegen passendes Monster", "Je Punkt (Kraft − Widerstand) in Zehntausendstel. 50 = 0,5 % je Punkt.")}
          ${row("elemOff", "Element ohne passendes Monster", "5 = 0,05 % je Punkt.")}
          ${row("dmgBonusCapPct", "Schaden (Bonus): Obergrenze in %", "Offiziell 20.")}
          ${row("dmgBonusCapFlat", "Schaden (Bonus): Obergrenze absolut", "Offiziell +300.")}
          ${row("maxStat", "Höchstwert je Statuspunkt", "Offiziell 90.")}
          ${row("defPerVit", "Eigene Verteidigung je VIT", "Schätzung für die Verteidigungs-Anzeige.")}
          </tbody></table></div>
          <div class="sect-title" style="margin-top:16px">Trefferpunkte je Klasse (Schätzung)</div>
          <div class="table-wrap" style="max-height:none"><table class="tbl"><thead><tr><th>Klasse</th><th>Grundwert</th><th>je Level</th><th>je VIT</th></tr></thead><tbody>
          ${Object.keys(P.classes).map((c) => `<tr><td>${db.classes[c].icon} ${esc(db.classes[c].name)}</td>${["hpBase", "hpPerLv", "hpPerVit"].map((k) => `<td><input type="number" data-adm="param-cls" data-c="${c}" data-k="${k}" value="${P.classes[c][k]}"></td>`).join("")}</tr>`).join("")}
          </tbody></table></div>`;
      }
      case "data":
        return `<div class="stack">
          <div class="sect-title">Server-Daten</div>
          <div class="inline"><button class="btn btn-primary" data-adm="export-db">⬇ Daten als Datei sichern</button>
            <label class="btn">⬆ Daten laden<input type="file" accept="application/json,.json" data-adm="import-db" style="display:none"></label>
            <button class="btn btn-danger" data-adm="reset-db">Auf offizielle Werte zurücksetzen</button></div>
          <div class="hint">Die Datei enthält alle Gegenstände, Pools, Ziele und Parameter. Damit kannst du deine Server-Anpassung weitergeben oder auf einem anderen Rechner laden.</div>
          <div class="sect-title" style="margin-top:8px">Builds</div>
          <div class="inline"><button class="btn" data-adm="export-builds">⬇ Builds sichern</button>
            <label class="btn">⬆ Builds laden<input type="file" accept="application/json,.json" data-adm="import-builds" style="display:none"></label></div>
          <div class="sect-title" style="margin-top:8px">Stand der Daten</div>
          <div class="hint">Gegenstände und Boni: offizielles deutsches Wiki, Stand November 2026 (inkl. Mondschein-Waffen und Patch 26.2). Formeln: Schadenssimulator des Wikis, Version 1.1. Geschätzt sind Mondschein-Klaue, die meisten Mondschein-Zufallsboni über +0, die Spieler-Schablonen im PvP sowie eigene Verteidigung und TP. Yin-/Yang-Talente (26.2) fehlen, weil es dafür noch keine Werte gibt. Trage sie bei Bedarf unter „Eigene Boni“ ein.</div>
        </div>`;
    }
    return "";
  }

  /* ---------- Formulare im Seitenfach ---------- */
  function openForm(title, html, onSave) {
    A.onSave = onSave;
    $("#drawer").innerHTML = `<div class="drawer-head"><div class="drawer-title">${esc(title)}</div><div style="flex:1"></div><button class="btn btn-sm" data-adm="form-close">✕</button></div>
      <div class="drawer-body">${html}</div><div class="drawer-foot"><button class="btn" data-adm="form-close">Abbrechen</button><button class="btn btn-primary" data-adm="form-save">Speichern</button></div>`;
    $("#drawer").classList.add("open"); $("#drawer-backdrop").classList.add("open");
  }
  const val = (n) => { const e = $(`#drawer [name="${n}"]`); return e ? (e.type === "checkbox" ? e.checked : e.value) : ""; };
  const numv = (n) => { const v = val(n); return v === "" ? null : Number(v); };

  function itemForm(it) {
    const db = App.master, isW = it.slot === "weapon";
    const r3 = (name, obj) => [0, 9, 15].map((u) => { const r = obj && obj[u]; return `<div class="field"><label>+${u} min</label><input type="number" name="${name}_${u}_a" value="${r ? r[0] : ""}"></div><div class="field"><label>+${u} max</label><input type="number" name="${name}_${u}_b" value="${r ? r[1] : ""}"></div>`; }).join("");
    const fixed = Object.keys(it.fixed || {});
    openForm(it.name || "Neuer Gegenstand", `
      <div class="field"><label>Name</label><input type="text" name="name" value="${esc(it.name || "")}"></div>
      <div class="row c3"><div class="field"><label>Slot</label><select name="slot">${db.slots.filter((s) => s.kind === "item").map((s) => `<option value="${s.id}" ${s.id === it.slot ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
        <div class="field"><label>Level</label><input type="number" name="lvl" value="${it.lvl || 1}"></div>
        <div class="field"><label>Max. Verbesserung</label><input type="number" name="maxUp" value="${C.itemMaxUp(it)}"></div></div>
      <div class="field"><label>Klassen (keine Auswahl = alle)</label><div class="inline">${Object.keys(db.classes).map((c) => `<label class="inline" style="gap:4px"><input type="checkbox" name="cls_${c}" ${it.cls && it.cls.indexOf(c) >= 0 ? "checked" : ""}>${esc(db.classes[c].name)}</label>`).join("")}</div></div>
      <div class="row c2"><div class="field"><label>Waffentyp</label><select name="wtype"><option value="">–</option>${Object.keys(C.WTYPE_NAME).map((t) => `<option value="${t}" ${t === it.wtype ? "selected" : ""}>${C.WTYPE_NAME[t]}</option>`).join("")}</select></div>
        <div class="field"><label>Geiststein-Sockel</label><input type="number" name="sockets" value="${it.sockets == null ? "" : it.sockets}"></div></div>
      ${isW || it.atk ? `<div><div class="sect-title">Angriffswert</div><div class="row" style="grid-template-columns:repeat(6,1fr)">${r3("atk", it.atk)}</div></div>
      <div><div class="sect-title">Magischer Angriffswert</div><div class="row" style="grid-template-columns:repeat(6,1fr)">${r3("matk", it.matk)}</div></div>` : ""}
      <div><div class="sect-title">Verteidigung</div><div class="row c3">${[0, 9, 15].map((u) => `<div class="field"><label>+${u}</label><input type="number" name="def_${u}" value="${it.def && it.def[u] != null ? it.def[u] : ""}"></div>`).join("")}</div></div>
      <div><div class="sect-title">Feste Boni (Wert bei +0 / +9 / +15)</div><div class="stack" id="adm-fixed">${fixed.concat([""]).map((bid, i) => fixedRow(i, bid, it.fixed && it.fixed[bid])).join("")}</div>
        <button class="btn btn-sm" data-adm="fixed-add" style="margin-top:8px">＋ Bonus</button></div>
      <div class="field"><label>Eingebaute Zufallsboni: Pool-Namen, mit Komma getrennt</label><input type="text" name="innate" value="${esc((it.innate || []).join(", "))}" placeholder="z. B. serpW1, serpW2, serpW3"></div>
      <label class="inline"><input type="checkbox" name="est" ${it.est ? "checked" : ""}> Werte sind geschätzt</label>`,
      () => {
        const o = { id: it.id || newId("x_"), slot: val("slot"), name: String(val("name")).trim() || "Unbenannt", lvl: numv("lvl") || 1, maxUp: numv("maxUp") || 9 };
        const cls = Object.keys(db.classes).filter((c) => val("cls_" + c)); if (cls.length) o.cls = cls;
        if (val("wtype")) o.wtype = val("wtype");
        if (numv("sockets") != null) o.sockets = numv("sockets");
        ["atk", "matk"].forEach((n) => { const k = {}; [0, 9, 15].forEach((u) => { const a = numv(n + "_" + u + "_a"), b = numv(n + "_" + u + "_b"); if (a != null && b != null && u <= o.maxUp) k[u] = [a, b]; }); if (Object.keys(k).length) o[n] = k; });
        const d = {}; [0, 9, 15].forEach((u) => { const v = numv("def_" + u); if (v != null && u <= o.maxUp) d[u] = v; }); if (Object.keys(d).length) o.def = d;
        const fx = {};
        $$("#adm-fixed .bonus-row").forEach((row) => { const bid = row.querySelector("select").value; if (!bid) return; const k = {}; $$("input", row).forEach((inp) => { if (inp.value !== "") k[Number(inp.dataset.u)] = Number(inp.value); }); if (Object.keys(k).length) fx[bid] = k; });
        if (Object.keys(fx).length) o.fixed = fx;
        const inn = String(val("innate")).split(",").map((x) => x.trim()).filter((x) => db.pools[x]); if (inn.length) o.innate = inn;
        if (val("est")) o.est = true;
        if (it.champ) o.champ = it.champ;
        const i = db.items.findIndex((x) => x.id === o.id);
        if (i >= 0) db.items[i] = o; else db.items.push(o);
        A.slot = o.slot;
        A.commit("Gegenstand gespeichert");
      });
  }
  function fixedRow(i, bid, kp) {
    const v = (u) => (kp == null ? "" : typeof kp === "number" ? kp : (kp[u] != null ? kp[u] : ""));
    return `<div class="bonus-row" style="grid-template-columns:minmax(0,1fr) 62px 62px 62px"><select><option value="">– kein –</option>${bonusOpts(bid)}</select>${[0, 9, 15].map((u) => `<input type="number" data-u="${u}" placeholder="+${u}" value="${v(u)}">`).join("")}</div>`;
  }
  function targetForm(i) {
    const db = App.master, t = i == null ? { id: newId("t_"), name: "Neues Ziel", kind: "monster", lvl: 100, dex: 50, def: 300, type: "none", wres: {}, elem: {}, eres: {}, magicRes: 0 } : db.targets[i];
    const js = (o) => esc(fmtMap(o || {}));
    openForm(t.name, `
      <div class="field"><label>Name</label><input type="text" name="name" value="${esc(t.name)}"></div>
      <div class="row c3"><div class="field"><label>Art</label><select name="kind">${[["monster", "Monster"], ["stone", "Metinstein"], ["player", "Spieler"]].map((k) => `<option value="${k[0]}" ${k[0] === t.kind ? "selected" : ""}>${k[1]}</option>`).join("")}</select></div>
        <div class="field"><label>Typ</label><select name="type">${Object.keys(C.TYPE_NAME).map((k) => `<option value="${k}" ${k === (t.type || "none") ? "selected" : ""}>${C.TYPE_NAME[k]}</option>`).join("")}</select></div>
        <div class="field"><label>Klasse (Spieler)</label><select name="cls">${Object.keys(db.classes).map((c) => `<option value="${c}" ${c === t.cls ? "selected" : ""}>${esc(db.classes[c].name)}</option>`).join("")}</select></div></div>
      <div class="row c4"><div class="field"><label>Level</label><input type="number" name="lvl" value="${t.lvl}"></div><div class="field"><label>Verteidigung</label><input type="number" name="def" value="${t.def}"></div>
        <div class="field"><label>DEX</label><input type="number" name="dex" value="${t.dex || 0}"></div><div class="field"><label>TP</label><input type="number" name="hp" value="${t.hp || ""}"></div></div>
      <div class="row c2"><div class="field"><label>Magiewiderstand</label><input type="number" name="magicRes" value="${t.magicRes || 0}"></div>
        <label class="inline" style="align-self:end"><input type="checkbox" name="boss" ${t.boss ? "checked" : ""}> Boss</label></div>
      <div class="field"><label>Waffenverteidigung in % (sword, twohand, dagger, bell, fan, arrow, claw)</label><input type="text" name="wres" value="${js(t.wres)}" placeholder="sword:40, twohand:35"></div>
      <div class="field"><label>Trägt Element (fire, ice, wind, lightning, earth, dark)</label><input type="text" name="elem" value="${js(t.elem)}" placeholder="fire:10"></div>
      <div class="field"><label>Elementwiderstand</label><input type="text" name="eres" value="${js(t.eres)}" placeholder="fire:-30"></div>
      <div class="field"><label>Spieler-Widerstände (human, cls, avg, skill, crit, pierce, block)</label><input type="text" name="res" value="${js(t.res)}" placeholder="human:30, avg:15"></div>`,
      () => {
        const o = { id: t.id, name: String(val("name")).trim() || "Ziel", kind: val("kind"), lvl: numv("lvl") || 1, def: numv("def") || 0, dex: numv("dex") || 0, type: val("type"), magicRes: numv("magicRes") || 0, boss: !!val("boss"), wres: parseMap(val("wres")), elem: parseMap(val("elem")), eres: parseMap(val("eres")) };
        if (numv("hp")) o.hp = numv("hp");
        if (o.kind === "player") { o.cls = val("cls"); o.res = parseMap(val("res")); o.bio = true; }
        if (i == null) db.targets.push(o); else db.targets[i] = o;
        A.commit("Ziel gespeichert");
      });
  }

  function download(name, obj) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: "application/json" }));
    a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function readFile(input, cb) {
    const f = input.files && input.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { cb(JSON.parse(r.result)); } catch (e) { FX.toast("Die Datei konnte nicht gelesen werden"); } input.value = ""; };
    r.readAsText(f);
  }

  /* ---------- Ereignisse ---------- */
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest("[data-adm]"); if (!a || a.tagName === "INPUT" || a.tagName === "SELECT") return;
    const act = a.dataset.adm, v = a.dataset.v, db = App.master;
    let rerender = true;
    switch (act) {
      case "section": A.section = v; break;
      case "era-year": db.era.year = Number(v); db.era.over = {}; A.commit("Stand: " + (Number(v) === window.Era.NOW_YEAR ? "aktuell" : v)); App.renderAll(); rerender = false; break;
      case "era-clear": db.era.over = {}; A.commit(); App.renderAll(); rerender = false; break;
      case "item-new": itemForm({ slot: A.slot, lvl: 1, maxUp: 9, atk: A.slot === "weapon" ? {} : undefined }); rerender = false; break;
      case "item-edit": itemForm(db.items.find((x) => x.id === v)); rerender = false; break;
      case "item-dup": { const it = JSON.parse(JSON.stringify(db.items.find((x) => x.id === v))); it.id = newId("x_"); it.name += " (Kopie)"; db.items.push(it); A.commit("Kopie angelegt"); break; }
      case "item-del": if (confirm("Gegenstand wirklich löschen?")) { db.items = db.items.filter((x) => x.id !== v); db.removedItems = (db.removedItems || []).concat(v); A.commit("Gelöscht"); } break;
      case "fixed-add": $("#adm-fixed").insertAdjacentHTML("beforeend", fixedRow(0, "", null)); rerender = false; break;
      case "pool-add": { const free = Object.keys(db.bonusTypes).find((b) => db.pools[A.pool][b] == null); if (free) { const n = prompt("Kennung des Bonus (siehe Bonus-Namen)", free); if (n && db.bonusTypes[n]) { db.pools[A.pool][n] = [1, 2, 3, 5, 10]; A.commit(); } else if (n) FX.toast("Unbekannte Kennung"); } break; }
      case "pool-del": delete db.pools[A.pool][v]; A.commit(); break;
      case "pool-scale": { const f = Number(String(prompt("Alle Werte dieses Pools multiplizieren mit:", "1.5") || "").replace(",", ".")); if (f > 0) { const p = db.pools[A.pool]; Object.keys(p).forEach((b) => { if (Array.isArray(p[b])) p[b] = p[b].map((x) => Math.round(x * f)); else Object.keys(p[b]).forEach((k) => { p[b][k] = Math.round(p[b][k] * f); }); }); A.commit("Pool skaliert"); } break; }
      case "stone-add": db.stones.push({ id: newId("s_"), name: "Neuer Stein", kind: "weapon", bonus: "monster", values: [1, 2, 3, 5, 8] }); A.commit(); break;
      case "stone-del": db.stones.splice(Number(v), 1); A.commit(); break;
      case "target-new": targetForm(null); rerender = false; break;
      case "target-edit": targetForm(Number(v)); rerender = false; break;
      case "target-del": if (db.targets.length > 2 && confirm("Ziel wirklich löschen?")) { db.targets.splice(Number(v), 1); A.commit("Gelöscht"); } break;
      case "toggle-add": db.toggles.push({ id: newId("tg_"), group: "Eigene", name: "Neuer Schalter", b: {} }); A.commit(); break;
      case "toggle-del": db.toggles.splice(Number(v), 1); A.commit(); break;
      case "form-close": App.closeDrawer(); rerender = false; break;
      case "form-save": if (A.onSave) A.onSave(); App.closeDrawer(); break;
      case "export-db": { const d = Object.assign({}, db); delete d._itemIdx; delete d._itemIdxSrc; download("metin2builder-daten.json", d); rerender = false; break; }
      case "export-builds": download("metin2builder-builds.json", App.builds); rerender = false; break;
      case "reset-db": if (confirm("Alle Anpassungen verwerfen und die offiziellen Werte laden?")) { App.resetDb(); FX.toast("Offizielle Werte geladen"); } break;
      default: rerender = false;
    }
    if (rerender) A.render();
  });
  document.addEventListener("change", (ev) => {
    const el = ev.target, act = el.dataset.adm; if (!act) return;
    const db = App.master, k = el.dataset.k;
    const v = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
    switch (act) {
      case "slot": A.slot = el.value; A.render(); break;
      case "era-year-f": db.era.year = Math.max(window.Era.BASE_YEAR, Math.min(window.Era.NOW_YEAR, Math.round(Number(el.value)) || window.Era.NOW_YEAR)); db.era.over = {}; A.commit(); App.renderAll(); break;
      case "era-feat": { const f = db.features.find((x) => x.id === el.dataset.id); if (f) { if (el.checked === (f.year <= db.era.year)) delete db.era.over[f.id]; else db.era.over[f.id] = el.checked; A.commit(); App.renderAll(); } break; }
      case "era-feat-year": { const f = db.features.find((x) => x.id === el.dataset.id); if (f) { f.year = Math.round(Number(el.value)) || f.year; A.commit(); App.renderAll(); } break; }
      case "q": A.q = el.value; A.render(); break;
      case "pool": A.pool = el.value; A.render(); break;
      case "pool-val": db.pools[A.pool][k] = parseVals(el.value); A.commit(); break;
      case "slot-f": { const s = C.slotById(db, el.dataset.id); s[k] = v; A.commit(); break; }
      case "stone-f": { const s = db.stones[Number(el.dataset.i)]; s[k] = k === "values" ? parseVals(el.value) : v; A.commit(); break; }
      case "target-f": db.targets[Number(el.dataset.i)][k] = v; A.commit(); break;
      case "toggle-f": db.toggles[Number(el.dataset.i)][k] = k === "b" ? parseMap(el.value) : v; A.commit(); break;
      case "bonus-f": db.bonusTypes[el.dataset.id][k] = v; A.commit(); break;
      case "ocr-f": db.ocrAliases = db.ocrAliases || {}; db.ocrAliases[el.dataset.id] = el.value; A.commit(); break;
      case "param": db.params[k] = Number(el.value); A.commit(); break;
      case "param-cls": db.params.classes[el.dataset.c][k] = Number(el.value); A.commit(); break;
      case "import-db": readFile(el, (d) => { if (d && d.items && d.pools && d.slots && d.targets) { d.version = window.M2DEFAULTS().version; App.master = d; A.commit("Daten geladen"); A.render(); } else FX.toast("Das ist keine Daten-Datei dieses Rechners"); }); break;
      case "import-builds": readFile(el, (d) => { if (Array.isArray(d) && d.length && d[0].equip) { d.forEach((b) => { b.id = newId("b"); App.builds.push(b); }); App.saveBuilds(); FX.toast(d.length + " Builds geladen"); App.renderAll(); } else FX.toast("Das ist keine Build-Datei"); }); break;
    }
  });

  window.Admin = A;
})();
