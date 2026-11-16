/* Inventar: Spielfenster aufnehmen, Tooltips erkennen und auslesen, Items sammeln, ausprobieren, Bestes berechnen.
   Die Texterkennung läuft vollständig im Browser. Es wird kein Bild hochgeladen. */
(function () {
  "use strict";
  const App = window.App, C = window.Calc, O = window.Opt, FX = window.FX;
  const esc = App.esc, $ = App.$, nf = App.nf, pf = App.pf;
  const LS_INV = "m2b_inv_v1", LS_SET = "m2b_scan_v1";
  const TESS_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } };

  const I = {
    items: load(LS_INV) || [],
    set: Object.assign({ thr: 64, lang: "deu", auto: true }, load(LS_SET) || {}),
    cap: { on: false, stream: null, video: null, grab: null, ticker: null, busy: false, lastHash: null, stable: 0, doneHash: null, frames: 0, reads: 0, found: 0, box: null },
    log: [], best: null, filter: "all", worker: null, workerLang: null, loading: null, status: "",
  };
  I.save = () => save(LS_INV, I.items);

  /* ---------- Textvergleich ---------- */
  const norm = (s) => String(s).toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss").replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u").replace(/[^a-z]/g, "");
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = new Array(n + 1), cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      const ca = a.charCodeAt(i - 1);
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca === b.charCodeAt(j - 1) ? 0 : 1));
      const t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }
  const sim = (a, b) => (!a.length || !b.length ? 0 : 1 - lev(a, b) / Math.max(a.length, b.length));
  I.norm = norm; I.sim = sim;

  // Wortlaut im Spiel je Bonus. Im Admin-Menü unter „Erkennung" erweiterbar.
  const DEFAULT_ALIASES = {
    crit: "chance auf kritischen treffer; chance auf krit treffer; kritischer treffer", pierce: "chance auf durchbohrenden treffer; chance auf durchb treffer; durchbohrender treffer",
    avgDmg: "durchschnittsschaden; durchschn schaden; durchschnittlicher schaden", skillDmg: "fertigkeitsschaden",
    monster: "stark gegen monster; staerke gegen monster", stone: "stark gegen metinsteine; stark gegen metin",
    human: "stark gegen halbmenschen", animal: "stark gegen tiere", orc: "stark gegen orks", mystic: "stark gegen esoterische", undead: "stark gegen untote", devil: "stark gegen teufel",
    insect: "stark gegen insekten", desert: "stark gegen wuestenmonster", zodiac: "stark gegen zodiakmonster",
    vsWarrior: "stark gegen krieger", vsNinja: "stark gegen ninjas; stark gegen ninja", vsSura: "stark gegen sura", vsShaman: "stark gegen schamanen", vsLycan: "stark gegen lykaner",
    hp: "max tp; maximale tp; trefferpunkte", sp: "max mp; maximale mp", str: "staerke; str", dex: "beweglichkeit; dex", vit: "vitalitaet; vit", int: "intelligenz; int",
    av: "angriffswert", mav: "magischer angriffswert", def: "verteidigung",
    elFire: "kraft des feuers", elIce: "kraft des eises", elWind: "kraft des windes", elLightning: "kraft der blitze; kraft des blitzes", elEarth: "kraft der erde", elDark: "kraft der dunkelheit",
    poison: "vergiftungschance", stun: "ohnmachtschance", slow: "verlangsamungschance", castSpeed: "zaubergeschwindigkeit", atkSpeed: "angriffsgeschwindigkeit", moveSpeed: "bewegungsgeschwindigkeit",
    exp: "chance auf exp bonus", yang: "doppelte menge yang", itemDrop: "doppelte menge von gegenstaenden; doppelte menge gegenstaende",
    hpAbsorb: "schaden wird von tp absorbiert", spAbsorb: "schaden wird von mp absorbiert", reflect: "nahkampftreffer zu reflektieren", block: "nahkampf angriff abzublocken; nahkampfangriff abzublocken",
    dodge: "pfeilangriff auszuweichen", hpRegen: "tp regeneration", spRegen: "mp regeneration", manaSteal: "chance auf manaraub; manaraub",
    bossDmg: "angriffsschaden gegen bosse", skillBoss: "fertigkeitsschaden gegen bosse",
    resAvg: "widerstand gegen durchschnittsschaden; durchschn schadenswiderstand", resSkill: "widerstand gegen fertigkeitsschaden; widerstand gegen fertigkeiten",
    resHuman: "widerstand gegen halbmenschen", resMonster: "widerstand gegen monster angriffe", sungma: "sungma wille", precision: "praezision",
    meleeMagic: "magie nahkampfangriff", defPct: "verteidigung prozent", blockPen: "blockdurchdringung", antiMagic: "magiebruch",
    resSword: "schwertverteidigung", resTwohand: "zweihandverteidigung; zweihaenderverteidigung", resDagger: "dolchverteidigung", resBell: "glockenverteidigung", resFan: "faecherverteidigung",
    resArrow: "pfeilwiderstand", resClaw: "abwehrchance gegen krallen; krallenverteidigung", resMagic: "magiewiderstand", resFire: "feuerwiderstand", resIce: "eiswiderstand", resWind: "windwiderstand",
    resLightning: "blitzwiderstand", resEarth: "erdwiderstand", resDark: "widerstand gegen dunkelheit", poisonRes: "giftwiderstand",
    resWarrior: "abwehr gegen krieger; abwehrchance gegen krieger", resNinja: "abwehr gegen ninja; abwehrchance gegen ninja", resSura: "abwehr gegen sura; abwehrchance gegen sura",
    resShaman: "abwehr gegen schamanen; abwehrchance gegen schamanen", resLycan: "abwehr gegen lykaner; abwehrchance gegen lykaner", resCrit: "widerstand gegen kritische treffer", resPierce: "widerstand gegen durchbohrende treffer",
  };
  I.DEFAULT_ALIASES = DEFAULT_ALIASES;
  I.aliases = function () {
    const db = App.db, src = db.ocrAliases || {}, out = [];
    Object.keys(db.bonusTypes).forEach((bid) => {
      const list = String(src[bid] != null ? src[bid] : (DEFAULT_ALIASES[bid] || "")).split(";").map((x) => norm(x)).filter(Boolean);
      const own = norm(db.bonusTypes[bid].name);
      if (own && list.indexOf(own) < 0) list.push(own);
      list.forEach((a) => out.push({ b: bid, a }));
    });
    return out;
  };

  /* ---------- Erkannten Text in ein Item übersetzen ---------- */
  const IGNORE = /^(ablevel|ablvl|ablul|ablv|level|lvl|lv|tragbar|ausrustbar|kannnicht|verkauf|preis|sockel|fassung|handelbar|nichthandelbar|typ|art|gewicht|restzeit|verbleibend|gearscore|rechtsklick|linksklick|altklick|strgklick|keineauswirkung)/;
  const MARKER = /^(ablevel|ablvl|ablul|ablv|tragbar|ausrustbar|gearscore)/;
  const BASE_MULT =/grund\s*werte?\s*[:+]?\s*\+?\s*(\d{1,3})\s*%?/i;
  function matchBonus(textNorm, aliases) {
    let best = null;
    aliases.forEach((x) => {
      let s;
      if (textNorm === x.a) s = 2;
      else if (x.a.length >= 6 && textNorm.indexOf(x.a) >= 0) s = 0.9 + x.a.length / textNorm.length / 10;
      else s = sim(textNorm, x.a);
      if (!best || s > best.s) best = { s, b: x.b };
    });
    return best && best.s >= 0.72 ? best : null;
  }
  // Passen die festen Werte eines Gegenstands (feste Boni, Verteidigung, Angriffswert) bei Stufe "up" zum gelesenen Tooltip?
  function statFit(item, p, up) {
    const f = 1 + (p.bm || 0) / 100;
    let m = 0, miss = 0;
    const vals = (b) => (p.boni || []).filter((x) => x.b === b).map((x) => x.v);
    Object.keys(item.fixed || {}).forEach((b) => {
      const fv = Math.round(C.kp(item.fixed[b], up) * f);
      if (!fv) return;
      if (vals(b).some((v) => Math.abs(v - fv) <= Math.max(1, Math.abs(fv) * 0.02))) m++; else miss++;
    });
    if (item.def && typeof C.firstVal(item.def) === "number") {
      const dv = Math.round(C.kp(item.def, up) * f), vs = vals("def");
      if (vs.length) { if (vs.some((v) => Math.abs(v - dv) <= 1)) m++; else miss++; }
    }
    if (item.atk && p.atk) { const r = C.kpRange(item.atk, up); if (Math.abs(r[0] * f - p.atk[0]) + Math.abs(r[1] * f - p.atk[1]) <= 3) m++; else miss++; }
    return { m, miss };
  }
  // Alle Verbesserungsstufen, bei denen die festen Werte am besten passen
  function bestUps(item, p) {
    let best = 0, ups = [];
    const maxUp = C.itemMaxUp(item);
    for (let u = 0; u <= maxUp; u++) {
      const s = statFit(item, p, u);
      if (s.miss || !s.m) continue;
      if (s.m > best) { best = s.m; ups = [u]; } else if (s.m === best) ups.push(u);
    }
    return { m: best, ups };
  }
  const pickUp = (ups, want) => (want != null && ups.indexOf(want) >= 0 ? want : ups[ups.length - 1]);
  // Gegenstand ohne lesbaren Namen über seine festen Werte bestimmen (z. B. Verteidigung 207 + Abwehr gegen Sura 27 = Löwenkantenschild +9, Episch)
  I.identify = function (p) {
    const db = App.db;
    const rawN = norm((p.nameGuess && p.nameGuess.name) || p.rawName || "");
    // Wurde die Zeile „Grundwerte +x %" nicht gelesen, werden übliche Stufen durchprobiert
    const bms = p.bm ? [p.bm] : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 100];
    const cands = [];
    db.items.forEach((it) => {
      const ns = rawN.length >= 3 ? sim(rawN, norm(it.name)) : 0;
      let best = null;
      bms.forEach((bm) => { const b = bestUps(it, Object.assign({}, p, { bm })); if (b.m && (!best || b.m > best.m)) best = { m: b.m, ups: b.ups, bm }; });
      if (best) cands.push({ it, m: best.m, ups: best.ups, bm: best.bm, ns });
    });
    if (!cands.length) return null;
    cands.sort((a, b) => b.m - a.m || b.ns - a.ns);
    const top = cands[0], second = cands[1];
    const clear = !second || top.m > second.m || top.ns > second.ns + 0.12;
    if (!clear) return null;
    // ein einzelner passender Wert reicht nur zusammen mit einem halbwegs passenden Namen
    if (top.m < 2 && top.ns < 0.5) return null;
    if (!p.bm && top.bm && top.m < 2) return null;
    return { item: top.it, up: pickUp(top.ups, p.up), bm: top.bm };
  };

  I.parse = function (text) {
    const db = App.db;
    const lines = String(text).split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length >= 3);
    const names = db.items.map((it) => ({ it, n: norm(it.name) }));
    let hit = null;
    lines.forEach((ln, i) => {
      const m = ln.match(/^(.{4,}?)\s*\+\s*(\d{1,3})(?!\s*%)(?!\d)/);
      const n = norm(m ? m[1] : ln);
      if (n.length < 5) return;
      names.forEach((x) => {
        let s = sim(n, x.n);
        if (s < 0.8 && x.n.length >= 8 && n.indexOf(x.n) >= 0) s = 0.8 + x.n.length / 1000;
        // lange Namen vertragen ein, zwei verlesene Buchstaben mehr
        if (s >= (x.n.length >= 12 ? 0.74 : 0.8) && (!hit || s > hit.s)) hit = { s, it: x.it, i, up: m ? Number(m[2]) : null, raw: ln };
      });
    });
    const aliases = I.aliases();
    const stones = db.stones.map((s) => ({ s, n: norm(s.name) }));
    const out = { item: hit ? hit.it : null, up: hit ? hit.up : null, rawName: hit ? hit.raw : (lines[0] || ""), nameLine: hit ? hit.i : -1, boni: [], stones: [], unknown: [], atk: null, markers: 0, lvl: null, nameGuess: null };
    // Namenszeile eines (noch) unbekannten Gegenstands: „Name+Zahl" in den ersten Zeilen
    if (!hit) for (let i = 0; i < Math.min(3, lines.length); i++) {
      const m = lines[i].match(/^[^A-Za-zÄÖÜäöü]*([A-Za-zÄÖÜäöüß][^+\d]{3,40}?)\s*\+\s*(\d{1,3})/);
      if (m && !BASE_MULT.test(lines[i])) { const nm = m[1].trim(); out.nameGuess = { name: nm, digits: m[2], clean: /^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .'\-]{3,}$/.test(nm), line: i }; out.rawName = lines[i]; break; }
    }
    lines.forEach((ln, i) => {
      if (hit && i <= hit.i) return;
      if (!hit && out.nameGuess && i === out.nameGuess.line) return;
      // typische Tooltip-Zeilen: daran erkennt man, dass es wirklich ein Item-Tooltip ist und kein Chat
      if (MARKER.test(norm(ln))) out.markers++;
      const lm = ln.match(/^\W*ab\s*l\w{0,4}\s*[:.]?\s*(\d{1,3})/i);
      if (lm) out.lvl = Number(lm[1]);
      const bmm = ln.match(BASE_MULT);
      if (bmm) { out.bm = Number(bmm[1]); out.markers++; return; }
      const nums = ln.match(/[-−–]?\s*\d[\d.]*/g);
      if (!nums) return;
      const tn = norm(ln);
      if (tn.length < 3 || IGNORE.test(tn)) return;
      const range = ln.match(/(\d+)\s*[-–—~]\s*(\d+)/);
      if (range && /angriffswert/.test(tn.replace("magischer", ""))) { if (tn.indexOf("magisch") < 0) out.atk = [Number(range[1]), Number(range[2])]; else out.matk = [Number(range[1]), Number(range[2])]; return; }
      if (range && /magisch/.test(tn)) return;
      const st = stones.map((x) => ({ x, s: sim(tn, x.n) })).sort((a, b) => b.s - a.s)[0];
      const val = Number(String(nums[nums.length - 1]).replace(/[^\d]/g, "")) * (/[-−–]/.test(nums[nums.length - 1]) && !range ? -1 : 1);
      if (st && st.s >= 0.82) { out.stones.push({ s: st.x.s.id, l: Math.max(0, Math.min(st.x.s.values.length - 1, Math.abs(val))) }); return; }
      const mb = matchBonus(tn, aliases);
      // derselbe Bonus darf mehrfach vorkommen (fester Wert des Gegenstands plus zusätzlicher Bonus)
      if (mb && isFinite(val) && val !== 0) out.boni.push({ b: mb.b, v: val, raw: ln });
      else out.unknown.push(ln);
    });
    if (!out.item && (out.boni.length || out.atk)) {
      const g = I.identify(out);
      if (g) { out.item = g.item; out.up = g.up; out.byStats = true; if (!out.bm && g.bm) out.bm = g.bm; }
    }
    return out;
  };

  // Boni auf feste Werte, Zufallsboni, Zeilen 1-5 und 6/7 verteilen
  I.toEntry = function (p, item) {
    const db = App.db, slot = C.slotById(db, item.slot);
    const maxUp = C.itemMaxUp(item);
    let up = p.up;
    const bmf = 1 + (p.bm || 0) / 100;
    // Verbesserungsstufe gegen die festen Werte prüfen (Angriffswert, Verteidigung, feste Boni):
    // passt die gelesene Stufe nicht dazu, eine andere aber genau, gilt diese
    const bu = bestUps(item, p);
    if (bu.m && (up == null || bu.ups.indexOf(up) < 0)) up = pickUp(bu.ups, up);
    if (up != null && up > maxUp) { const d = String(up); up = Number(d[0]) <= maxUp && d.length > 1 ? Number(d[d.length - 1]) <= maxUp ? Number(d[d.length - 1]) : Number(d[0]) : maxUp; }
    if (up == null) up = Math.min(9, maxUp);
    up = Math.max(0, Math.min(maxUp, up));
    const e = { item: item.id, up, lines: [], rare: [], innate: [], stones: (p.stones || []).slice(0, O.sockets(slot, item) || 0), on: false };
    if (p.bm) e.bm = p.bm;
    const pool = db.pools[slot.pool] || {}, rpool = db.pools[slot.rarePool] || {};
    const left = [];
    const fixedUsed = {};
    (p.boni || []).forEach((x) => {
      // fester Wert des Gegenstands (mit Grundwerte-Bonus): kein zusätzlicher Bonus. Jeder feste Wert nur einmal.
      if (item.fixed && item.fixed[x.b] != null && !fixedUsed[x.b]) { const fv = Math.round(C.kp(item.fixed[x.b], up) * bmf); if (Math.abs(x.v - fv) <= Math.max(1, Math.abs(fv) * 0.06)) { fixedUsed[x.b] = true; return; } }
      if (x.b === "def" && item.def) return;
      // Grundwerte des Gegenstands sind keine Boni: Angriffsgeschwindigkeit der Waffe, Lauftempo von Rüstung und Schuhen
      const inInnate = (item.innate || []).some((pid) => db.pools[pid] && db.pools[pid][x.b] != null);
      if (x.b === "atkSpeed" && item.slot === "weapon" && !inInnate) return;
      if (x.b === "moveSpeed" && (item.slot === "armor" || item.slot === "shoes") && !inInnate && !item.learned) return;
      if (x.b === "av" && item.atk) { if (!(rpool.av != null)) return; }
      if (item.innate) { const idx = item.innate.findIndex((pid, i) => !e.innate[i] && db.pools[pid] && db.pools[pid][x.b] != null); if (idx >= 0) { e.innate[idx] = { b: x.b, v: x.v }; return; } }
      const same = e.lines.find((l) => l.b === x.b);
      if (!same && pool[x.b] != null && e.lines.length < (slot.lines || 0)) { e.lines.push({ b: x.b, v: x.v }); return; }
      if (rpool[x.b] != null && e.rare.length < (slot.rare || 0) && !e.rare.some((l) => l.b === x.b)) { e.rare.push({ b: x.b, v: x.v }); return; }
      // steht derselbe Bonus mehrfach im Tooltip, zählt die Summe
      if (same) { same.v += x.v; return; }
      if (e.lines.length < (slot.lines || 0)) { e.lines.push({ b: x.b, v: x.v }); return; }
      const any = e.rare.find((l) => l.b === x.b);
      if (any) { any.v += x.v; return; }
      if (e.rare.length < (slot.rare || 0)) { e.rare.push({ b: x.b, v: x.v }); return; }
      left.push(x.raw || x.b);
    });
    for (let i = 0; i < e.innate.length; i++) if (!e.innate[i]) e.innate[i] = null;
    return { entry: e, left };
  };

  /* ---------- Unbekannte Server-Items lernen ---------- */
  const SLOT_WORDS = [
    ["earrings", /ohrring/], ["necklace", /halskette|kette$|amulett|collier/], ["bracelet", /armband|armreif/], ["shield", /schild$/], ["shoes", /schuhe?$|stiefel$|sandalen$/],
    ["helmet", /helm$|haube$|maske$|kapuze$|hut$|schaller$|krone$/], ["belt", /gurtel$/], ["gloves", /handschuh/], ["talisman", /talisman/],
    ["armor", /panzer$|rustung$|anzug$|kleidung$|kleid$|mantel$|harnisch$|wams$|robe$|gewand$/],
  ];
  const WTYPE_WORDS = [["dagger", /dolch|messer|chakram/], ["bow", /bogen$/], ["bell", /glocke$/], ["fan", /facher$/], ["claw", /kralle$|klaue$|fang$|spiess$/], ["twohand", /glefe$|zweihander|axt$|hellebarde|partisane|picke$|heugabel/], ["sword", /schwert$|klinge$|schneide$|sabel$/]];
  I.guessSlot = function (name, p) {
    const n = norm(name);
    for (const [slot, re] of SLOT_WORDS) if (re.test(n)) return { slot };
    for (const [wt, re] of WTYPE_WORDS) if (re.test(n)) return { slot: "weapon", wtype: wt };
    if (p && p.atk) return { slot: "weapon", wtype: "sword", unsure: true };
    return null;
  };
  // Legt einen neuen Gegenstand aus den gelesenen Werten an. Grundwerte werden auf die Stufe ohne Seltenheits-Bonus zurückgerechnet.
  I.learnItem = function (p, name, slotId, wtype) {
    const db = App.db, f = 1 + (p.bm || 0) / 100;
    let up = p.up;
    if (up == null && p.nameGuess) { const d = p.nameGuess.digits; up = Number(d) <= 15 ? Number(d) : Number(d[d.length - 1]); }
    if (up == null || !isFinite(up)) up = 0;
    const it = { id: "srv_" + norm(name) + "_" + Date.now().toString(36).slice(-4), slot: slotId, name: name.trim(), lvl: p.lvl || 1, maxUp: Math.max(9, up), learned: true };
    if (slotId === "weapon") {
      it.wtype = wtype || "sword";
      it.atk = { [up]: p.atk ? [Math.round(p.atk[0] / f), Math.round(p.atk[1] / f)] : [0, 0] };
      if (p.matk) it.matk = { [up]: [Math.round(p.matk[0] / f), Math.round(p.matk[1] / f)] };
      it.sockets = 3;
    } else {
      const d = (p.boni || []).find((x) => x.b === "def");
      if (d) it.def = { [up]: Math.round(d.v / f) };
      if (slotId === "armor") it.sockets = 3;
    }
    App.master.items.push(it); App.refreshDb(); App.saveDb();
    return { item: it, up };
  };

  const sigOf = (r) => (r.entry ? r.entry.item + "|" + r.entry.up + "|" + (r.entry.bm || 0) + "|" + ["innate", "lines", "rare"].map((k) => (r.entry[k] || []).filter((l) => l && l.b).map((l) => l.b + l.v).sort().join(",")).join("|") + "|" + (r.entry.stones || []).map((s) => s.s + s.l).sort().join(",") : "?" + norm(r.parsed.rawName) + (r.parsed.boni || []).map((x) => x.b + x.v).sort().join(","));

  // Ziffern, die die Texterkennung in Pixelschrift gern verwechselt
  const CONF = { "3": "98", "9": "38", "8": "3906", "5": "6", "6": "58", "0": "8", "1": "7", "7": "1" };
  function confusable(a, b) {
    if (a === b) return true;
    const x = String(Math.abs(a)), y = String(Math.abs(b));
    if (x.length !== y.length || (a < 0) !== (b < 0)) return false;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i] && (CONF[x[i]] || "").indexOf(y[i]) < 0) return false;
    return true;
  }
  const flatBoni = (e) => { const m = {}; ["innate", "lines", "rare"].forEach((k) => (e[k] || []).forEach((l) => { if (l && l.b) m[l.b] = l.v; })); return m; };
  // Dasselbe Stück, nur mit verlesenen Ziffern? Gleicher Gegenstand, gleiche Bonus-Arten, Werte gleich oder verwechselbar
  function sameItem(a, b) {
    if (!a || !b || a.item !== b.item) return false;
    if (!confusable(a.up || 0, b.up || 0) || !confusable(a.bm || 0, b.bm || 0)) return false;
    const x = flatBoni(a), y = flatBoni(b), kx = Object.keys(x), ky = Object.keys(y);
    if (kx.length !== ky.length) return false;
    for (const k of kx) if (y[k] == null || !confusable(x[k], y[k])) return false;
    return (a.stones || []).map((s) => s.s).sort().join() === (b.stones || []).map((s) => s.s).sort().join();
  }
  // Mehrfach gelesene Varianten zählen; die am häufigsten gelesene gilt
  function vote(rec, entry) {
    const sg = sigOf({ entry });
    rec.alts = rec.alts || [{ sig: sigOf(rec), entry: O.clone(rec.entry), n: 1 }];
    const a = rec.alts.find((x) => x.sig === sg);
    if (a) a.n++; else rec.alts.push({ sig: sg, entry: O.clone(entry), n: 1 });
    const best = rec.alts.slice().sort((p, q) => q.n - p.n)[0];
    if (best.sig !== sigOf(rec) && best.n > (rec.alts.find((x) => x.sig === sigOf(rec)) || { n: 0 }).n) { rec.entry = O.clone(best.entry); return true; }
    return false;
  }
  // Bereits vorhandene Doppelte im Inventar zusammenführen (das zuletzt gelesene bleibt)
  I.mergeDups = function () {
    const out = [];
    let removed = 0;
    I.items.forEach((r) => {
      const twin = out.find((o) => (r.entry && o.entry ? sameItem(o.entry, r.entry) : !r.entry && !o.entry && sigOf(o) === sigOf(r)));
      if (twin) { removed++; if (r.entry && twin.entry) vote(twin, r.entry); } else out.push(r);
    });
    if (removed) { I.items = out; I.save(); }
    return removed;
  };

  I.addParsed = function (p, source) {
    // nur echte Item-Tooltips: Gegenstand plus Bonus, Angriffswert oder typische Tooltip-Zeile
    if (p.item ? !(p.boni.length || p.atk || p.markers) : !(p.boni.length >= 2 && p.markers)) return null;
    // Unbekannter Gegenstand mit sauber gelesenem Namen und erkennbarem Slot: als Server-Item lernen
    let learned = false;
    if (!p.item && p.nameGuess && p.nameGuess.clean && p.markers) {
      const g = I.guessSlot(p.nameGuess.name, p);
      if (g && !g.unsure) { const r = I.learnItem(p, p.nameGuess.name, g.slot, g.wtype); p.item = r.item; p.up = r.up; learned = true; }
    }
    const rec = { id: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), parsed: { rawName: p.rawName, up: p.up, boni: p.boni, stones: p.stones, unknown: p.unknown, atk: p.atk, matk: p.matk, bm: p.bm, lvl: p.lvl, nameGuess: p.nameGuess, markers: p.markers }, entry: null, slot: null, isNew: true, ts: Date.now(), source: source || "" };
    if (learned) rec.learned = true;
    if (p.byStats) rec.byStats = true;
    if (p.item) { const r = I.toEntry(p, p.item); rec.entry = r.entry; rec.slot = p.item.slot; rec.left = r.left; }
    const sg = sigOf(rec);
    if (I.items.some((x) => sigOf(x) === sg)) { const ex = I.items.find((x) => sigOf(x) === sg); if (ex.entry && ex.alts) { vote(ex, rec.entry); I.save(); } return { dup: true }; }
    if (rec.entry) {
      const twin = I.items.find((x) => x.entry && sameItem(x.entry, rec.entry));
      if (twin) { const changed = vote(twin, rec.entry); I.save(); return { dup: true, corrected: changed }; }
    }
    I.items.unshift(rec); I.save();
    return rec;
  };
  I.addEntry = function (slotId, entry) {
    const it = C.itemById(App.db, entry.item); if (!it) { FX.toast("Leerer Slot, nichts zum Ablegen"); return; }
    const rec = { id: "i" + Date.now().toString(36), parsed: { rawName: it.name, boni: [], stones: [], unknown: [] }, entry: O.clone(entry), slot: slotId, isNew: true, ts: Date.now(), source: "manuell" };
    if (I.items.some((x) => sigOf(x) === sigOf(rec))) { FX.toast("Liegt schon im Inventar"); return; }
    I.items.unshift(rec); I.save(); FX.toast(it.name + " ins Inventar gelegt");
  };

  // Unerkannte Einträge erneut prüfen: Name gegen die (inzwischen größere) Gegenstandsliste, sonst über die festen Werte
  I.reidentify = function () {
    const db = App.db;
    let n = 0;
    I.items.forEach((rec) => {
      if (rec.entry) return;
      const p = Object.assign({ boni: [], stones: [], unknown: [] }, rec.parsed);
      const raw = String(p.rawName || "");
      const m = raw.match(/^(.{4,}?)\s*\+\s*(\d{1,3})/);
      const nn = norm(m ? m[1] : raw);
      let hit = null;
      if (nn.length >= 5) db.items.forEach((it) => { const x = norm(it.name), s = sim(nn, x); if (s >= (x.length >= 12 ? 0.74 : 0.8) && (!hit || s > hit.s)) hit = { s, it }; });
      let item = hit ? hit.it : null, up = m ? Number(m[2]) : p.up;
      if (!item) { const g = I.identify(Object.assign({}, p, { up })); if (g) { item = g.item; up = g.up; rec.byStats = true; if (!p.bm && g.bm) { p.bm = g.bm; rec.parsed.bm = g.bm; } } }
      if (!item) return;
      const r = I.toEntry(Object.assign({}, p, { up }), item);
      rec.entry = r.entry; rec.slot = item.slot; rec.left = r.left; n++;
    });
    if (n) I.save();
    return n;
  };

  /* ---------- Tooltip im Bild finden ---------- */
  // Sucht dunkle, rechteckige Flächen mit heller Schrift (so sehen Item-Tooltips aus)
  // Variante 1: deckende Tooltips mit einfarbigem, dunklem Hintergrund (auch wenn drumherum ebenfalls dunkle Fenster liegen).
  // Sucht die häufigsten einfarbigen dunklen Flächen und nimmt die rechteckigen mit Schrift darin.
  I.detectFlat = function (data, w, h) {
    const B = 8, gw = Math.floor(w / B), gh = Math.floor(h / B), N = gw * gh;
    const col = new Uint8Array(N * 3), flat = new Uint8Array(N);
    const sr = new Uint8Array(16), sg = new Uint8Array(16), sb = new Uint8Array(16);
    const hist = new Map();
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      let n = 0;
      for (let y = gy * B; y < gy * B + B; y += 2) for (let x = gx * B; x < gx * B + B; x += 2) { const o = (y * w + x) * 4; sr[n] = data[o]; sg[n] = data[o + 1]; sb[n] = data[o + 2]; n++; }
      let ok = false, pr = 0, pg = 0, pb = 0;
      for (const pv of [5, 10, 0]) {
        pr = sr[pv]; pg = sg[pv]; pb = sb[pv];
        if (Math.max(pr, pg, pb) > 100) continue;
        let c = 0;
        for (let i = 0; i < 16; i++) if (Math.abs(sr[i] - pr) <= 5 && Math.abs(sg[i] - pg) <= 5 && Math.abs(sb[i] - pb) <= 5) c++;
        if (c >= 9) { ok = true; break; }
      }
      if (!ok) continue;
      const i = gy * gw + gx;
      flat[i] = 1; col[i * 3] = pr; col[i * 3 + 1] = pg; col[i * 3 + 2] = pb;
      const key = ((pr >> 3) << 10) | ((pg >> 3) << 5) | (pb >> 3);
      const hv = hist.get(key);
      if (hv) { hv[0]++; hv[1] += pr; hv[2] += pg; hv[3] += pb; } else hist.set(key, [1, pr, pg, pb]);
    }
    const top = Array.from(hist.entries()).filter((e) => e[1][0] >= 40).sort((a, b) => b[1][0] - a[1][0]).slice(0, 6);
    const small = w * h < 700 * 700;
    const boxes = [], mask = new Uint8Array(N), seen = new Uint8Array(N), stack = [];
    top.forEach(([key, hv]) => {
      // genauer Farbton dieser Fläche; enge Toleranz, damit ein Tooltip nicht mit fast gleich dunklen Nachbarflächen verschmilzt
      const kr = hv[1] / hv[0], kg = hv[2] / hv[0], kb = hv[3] / hv[0];
      for (let i = 0; i < N; i++) { mask[i] = flat[i] && Math.abs(col[i * 3] - kr) <= 6 && Math.abs(col[i * 3 + 1] - kg) <= 6 && Math.abs(col[i * 3 + 2] - kb) <= 6 ? 1 : 0; seen[i] = 0; }
      for (let s = 0; s < N; s++) {
        if (!mask[s] || seen[s]) continue;
        let x0 = gw, x1 = 0, y0 = gh, y1 = 0, cnt = 0;
        stack.push(s); seen[s] = 1;
        while (stack.length) {
          const c = stack.pop(), cx = c % gw, cy = (c - cx) / gw;
          cnt++; if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
          if (cx > 0 && mask[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; stack.push(c - 1); }
          if (cx < gw - 1 && mask[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; stack.push(c + 1); }
          if (cy > 0 && mask[c - gw] && !seen[c - gw]) { seen[c - gw] = 1; stack.push(c - gw); }
          if (cy < gh - 1 && mask[c + gw] && !seen[c + gw]) { seen[c + gw] = 1; stack.push(c + gw); }
        }
        const bw = (x1 - x0 + 1) * B, bh = (y1 - y0 + 1) * B;
        // ein Tooltip ist nie bildschirmfüllend: große dunkle Flächen (Bildrand, Chat über die halbe Breite) fallen heraus
        if (bw < 136 || bh < 72 || (!small && (bw > w * 0.4 || bw * bh > w * h * 0.28))) continue;
        if (cnt / ((x1 - x0 + 1) * (y1 - y0 + 1)) < 0.5) continue;
        let bright = 0, tot = 0;
        for (let y = y0 * B; y < y0 * B + bh; y += 3) for (let x = x0 * B; x < x0 * B + bw; x += 3) { const o = (y * w + x) * 4; if (Math.max(data[o], data[o + 1], data[o + 2]) > 140) bright++; tot++; }
        const fr = bright / tot;
        if (fr < 0.01 || fr > 0.35) continue;
        const bx = Math.max(0, x0 * B - 6), by = Math.max(0, y0 * B - 6);
        boxes.push({ x: bx, y: by, w: Math.min(w - bx, bw + 12), h: Math.min(h - by, bh + 12), area: bw * bh, fr, key, fill: cnt / ((x1 - x0 + 1) * (y1 - y0 + 1)) });
      }
    });
    // Überlappende Treffer (benachbarte Farbtöne derselben Fläche): den mit der dichtesten Füllung behalten
    const pref = I.set.bgKey;
    boxes.sort((a, b) => (b.key === pref) - (a.key === pref) || b.fill - a.fill);
    const keep = [];
    boxes.forEach((b) => {
      const clash = keep.some((o) => { const ix = Math.max(0, Math.min(o.x + o.w, b.x + b.w) - Math.max(o.x, b.x)), iy = Math.max(0, Math.min(o.y + o.h, b.y + b.h) - Math.max(o.y, b.y)); return ix * iy > 0.5 * Math.min(o.w * o.h, b.w * b.h); });
      if (!clash) keep.push(b);
    });
    return keep.slice(0, 6);
  };
  const geomKey = (b) => [b.x, b.y, b.w, b.h].map((v) => Math.round(v / 24)).join(",");
  // Flächen, die schon zweimal gelesen wurden und kein Item waren (Chat, Inventar …), werden übersprungen
  I.detect = function (data, w, h, thr) {
    const rej = I.cap.rej || {};
    const ok = (b) => (rej[geomKey(b)] || 0) < 2;
    const f = I.detectFlat(data, w, h).filter(ok);
    return (f.length ? f : I.detectDark(data, w, h, thr).filter(ok)).slice(0, 2);
  };
  // Variante 2: halbtransparente Tooltips (offizieller Client): dunkle Fläche vor hellerer Umgebung
  I.detectDark = function (data, w, h, thr) {
    const B = 8, gw = Math.floor(w / B), gh = Math.floor(h / B);
    const grid = new Uint8Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      let dark = 0, n = 0;
      for (let y = gy * B; y < gy * B + B; y += 2) for (let x = gx * B; x < gx * B + B; x += 2) { const o = (y * w + x) * 4; if (Math.max(data[o], data[o + 1], data[o + 2]) < thr) dark++; n++; }
      grid[gy * gw + gx] = dark / n >= 0.55 ? 1 : 0;
    }
    const seen = new Uint8Array(gw * gh), boxes = [], stack = [];
    for (let s = 0; s < grid.length; s++) {
      if (!grid[s] || seen[s]) continue;
      let x0 = gw, x1 = 0, y0 = gh, y1 = 0, cnt = 0;
      stack.push(s); seen[s] = 1;
      while (stack.length) {
        const c = stack.pop(), cx = c % gw, cy = (c - cx) / gw;
        cnt++; if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
        if (cx > 0 && grid[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; stack.push(c - 1); }
        if (cx < gw - 1 && grid[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; stack.push(c + 1); }
        if (cy > 0 && grid[c - gw] && !seen[c - gw]) { seen[c - gw] = 1; stack.push(c - gw); }
        if (cy < gh - 1 && grid[c + gw] && !seen[c + gw]) { seen[c + gw] = 1; stack.push(c + gw); }
      }
      const bw = (x1 - x0 + 1) * B, bh = (y1 - y0 + 1) * B;
      if (bw < 120 || bh < 56 || bw * bh > w * h * 0.4) continue;
      if (cnt / ((x1 - x0 + 1) * (y1 - y0 + 1)) < 0.68) continue;
      // helle Schrift vorhanden?
      let bright = 0, tot = 0;
      for (let y = y0 * B; y < y0 * B + bh; y += 3) for (let x = x0 * B; x < x0 * B + bw; x += 3) { const o = (y * w + x) * 4; if (Math.max(data[o], data[o + 1], data[o + 2]) > 140) bright++; tot++; }
      const fr = bright / tot;
      if (fr < 0.008 || fr > 0.3) continue;
      boxes.push({ x: Math.max(0, x0 * B - 4), y: Math.max(0, y0 * B - 4), w: Math.min(w, bw + 8), h: Math.min(h, bh + 8), area: bw * bh, fr });
    }
    boxes.sort((a, b) => b.area - a.area);
    return boxes.slice(0, 2);
  };
  function hashBox(data, w, b) {
    let hsh = 0;
    const sx = Math.max(1, Math.floor(b.w / 24)), sy = Math.max(1, Math.floor(b.h / 24));
    for (let y = b.y; y < b.y + b.h; y += sy) for (let x = b.x; x < b.x + b.w; x += sx) { const o = (y * w + x) * 4; hsh = (hsh * 31 + (Math.max(data[o], data[o + 1], data[o + 2]) > 140 ? 1 : 0)) | 0; }
    return hsh + ":" + Math.round(b.w / 16) + "x" + Math.round(b.h / 16);
  }
  // Ausschnitt vergrößern und in dunkle Schrift auf hellem Grund umwandeln
  function prep(src, b) {
    const sc = Math.max(1.5, Math.min(3, 1500 / b.w));
    const cv = document.createElement("canvas"); cv.width = Math.round(b.w * sc); cv.height = Math.round(b.h * sc);
    cv._sc = sc; cv._box = b; cv._src = src;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = "high";
    cx.drawImage(src, b.x, b.y, b.w, b.h, 0, 0, cv.width, cv.height);
    const im = cx.getImageData(0, 0, cv.width, cv.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.max(d[i], d[i + 1], d[i + 2]); const o = Math.max(0, Math.min(255, 255 - (v - 75) * 2.6)); d[i] = d[i + 1] = d[i + 2] = o; d[i + 3] = 255; }
    cx.putImageData(im, 0, 0);
    return cv;
  }

  I.prep = prep;

  /* ---------- Texterkennung ---------- */
  function setStatus(s) { I.status = s; const el = $("#inv-status"); if (el) el.textContent = s; }
  I.ensureWorker = function () {
    if (I.worker && I.workerLang === I.set.lang) return Promise.resolve(I.worker);
    if (I.loading) return I.loading;
    setStatus("Texterkennung wird geladen …");
    I.loading = new Promise((resolve, reject) => {
      const go = () => window.Tesseract.createWorker(I.set.lang, 1, { logger: (m) => { if (m.status && m.progress != null && !I.worker) setStatus("Texterkennung wird geladen … " + Math.round(m.progress * 100) + " %"); } })
        .then((w) => { if (I.worker) I.worker.terminate(); I.worker = w; I.workerLang = I.set.lang; I.loading = null; setStatus("Texterkennung bereit"); resolve(w); })
        .catch((e) => { I.loading = null; reject(e); });
      if (window.Tesseract) return go();
      const s = document.createElement("script"); s.src = TESS_URL; s.onload = go; s.onerror = () => { I.loading = null; reject(new Error("load")); };
      document.head.appendChild(s);
    }).catch((e) => { setStatus("Texterkennung konnte nicht geladen werden. Dafür ist einmalig Internet nötig."); throw e; });
    return I.loading;
  };
  // 3 oder 9? In Pixelschriften unterscheiden sich beide nur links in der Mitte: Die 9 hat dort Tinte
  // (der Bogen ist geschlossen und der Mittelstrich reicht bis zum linken Rand), die 3 ist dort leer.
  // Geprüft wird am unvergrößerten Originalbild (helle Schrift auf dunklem Grund), weil die Zeichen dort scharf sind.
  // Die Zeichenrahmen der Texterkennung sind ungenau, deshalb wird das Wort selbst in Zeichenzellen zerlegt.
  function fixWord(wd, img, lineBox, dbg) {
    const syms = wd.symbols, plain = syms.map((s) => s.text).join("");
    if (!/[39]/.test(plain)) return plain;
    const k = img.sc || 1, W = img.width, Hh = img.height;
    const inkAt = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= Hh) return false; const o = (y * W + x) * 4; return Math.max(img.data[o], img.data[o + 1], img.data[o + 2]) > 110; };
    const X0 = Math.max(0, Math.floor(wd.bbox.x0 / k) - 2), X1 = Math.min(W - 1, Math.ceil(wd.bbox.x1 / k) + 2);
    let y0 = Math.floor(Math.max(wd.bbox.y0, lineBox ? lineBox.y0 : wd.bbox.y0) / k), y1 = Math.ceil(Math.min(wd.bbox.y1, lineBox ? lineBox.y1 : wd.bbox.y1) / k);
    const rowInk = (y, a, b) => { for (let x = a; x <= b; x++) if (inkAt(x, y)) return true; return false; };
    while (y0 < y1 && !rowInk(y0, X0, X1)) y0++;
    while (y1 > y0 && !rowInk(y1, X0, X1)) y1--;
    const H = y1 - y0 + 1;
    if (H < 7 || H > 48) return plain;
    const cnt = [];
    for (let x = X0; x <= X1; x++) { let c = 0; for (let y = y0; y <= y1; y++) if (inkAt(x, y)) c++; cnt[x] = c; }
    // zusammenhängende Tintenstücke; breite Stücke sind mehrere aneinanderstoßende Zeichen und werden an der dünnsten Stelle geteilt
    const cells = [];
    const gw = 0.72 * H;
    const midA = Math.round(y0 + H * 0.43), midB = Math.round(y0 + H * 0.6);
    let x = X0;
    while (x <= X1) {
      if (!cnt[x]) { x++; continue; }
      let a = x; while (x <= X1 && cnt[x]) x++;
      const b = x - 1, w = b - a + 1, n = Math.max(1, Math.round(w / gw));
      if (n === 1) { cells.push({ a, b, safe: true }); continue; }
      let start = a, prevOk = true;
      for (let i = 1; i < n; i++) {
        const e = Math.round(a + (i * w) / n);
        let v = e, best = 1e9;
        for (let q = e - 2; q <= e + 2; q++) if (q > start + 2 && q < b - 2 && cnt[q] < best) { best = cnt[q]; v = q; }
        // sauber getrennt nur, wenn an der Trennstelle in der Zeichenmitte keine Tinte liegt
        let midInk = false; for (let y = midA; y <= midB; y++) if (inkAt(v, y)) midInk = true;
        // Geprüft wird nur der linke Rand eines Zeichens: entscheidend ist also, ob der Schnitt DAVOR sauber war
        cells.push({ a: start, b: v - 1, safe: prevOk });
        prevOk = !midInk;
        start = midInk ? v : v + 1;
        if (i === n - 1) cells.push({ a: start, b, safe: prevOk });
      }
    }
    const N = syms.length;
    if (dbg) dbg.cells = cells.length + "/" + N;
    const classify = (c) => {
      let ya = y0, yb = y1;
      while (ya < yb && !rowInk(ya, c.a, c.b)) ya++;
      while (yb > ya && !rowInk(yb, c.a, c.b)) yb--;
      let xa = c.a, xb = c.b;
      const colInk = (q) => { for (let y = ya; y <= yb; y++) if (inkAt(q, y)) return true; return false; };
      while (xa < xb && !colInk(xa)) xa++;
      while (xb > xa && !colInk(xb)) xb--;
      const bw = xb - xa + 1, bh = yb - ya + 1;
      if (bh < 7 || bw < 4 || bw > bh * 1.1 || bh > bw * 2.6) return null;
      const lx = Math.max(xa + 1, Math.round(xa + bw * 0.26));
      const ra = Math.round(ya + bh * 0.43), rb = Math.round(ya + bh * 0.6);
      let rows = 0, hit = 0;
      for (let y = ra; y <= rb; y++) { rows++; let ink = 0; for (let q = xa; q <= lx; q++) if (inkAt(q, y)) ink++; if (ink >= Math.max(1, (lx - xa + 1) * 0.34)) hit++; }
      const f = hit / rows;
      if (dbg) (dbg.f = dbg.f || []).push(+f.toFixed(2));
      return f >= 0.5 ? "9" : f <= 0.2 ? "3" : null;
    };
    return syms.map((s, i) => {
      if (s.text !== "3" && s.text !== "9") return s.text;
      let c = null;
      if (cells.length === N) c = cells[i];
      else {
        // Anzahl passt nicht (z. B. verschmolzene Buchstaben): Ziffern am Wortende von rechts zuordnen,
        // aber nur, wenn auch der Rahmen der Texterkennung auf dieselbe Zelle zeigt
        const fromEnd = N - 1 - i, cand = cells[cells.length - 1 - fromEnd];
        const sx0 = s.bbox.x0 / k, sx1 = s.bbox.x1 / k, cxm = (sx0 + sx1) / 2;
        if (fromEnd < 4 && cand && sx1 - sx0 <= (cand.b - cand.a + 1) * 1.4 && cxm >= cand.a - 1 && cxm <= cand.b + 1) c = cand;
      }
      if (!c || !c.safe) return s.text;
      return classify(c) || s.text;
    }).join("");
  }
  I.fixWord = fixWord;
  async function ocr(canvas, sparse) {
    const w = await I.ensureWorker();
    await w.setParameters({ tessedit_pageseg_mode: sparse ? "11" : "6", preserve_interword_spaces: "1" });
    const r = await w.recognize(canvas, {}, { text: true, blocks: true, hocr: false, tsv: false });
    const d = r.data;
    if (!d.lines || !d.lines.length) return d.text || "";
    let img = null;
    try {
      const b = canvas._box, src = canvas._src;
      if (!b || !src) return d.text || "";
      img = src.getContext("2d", { willReadFrequently: true }).getImageData(b.x, b.y, b.w, b.h);
      img.sc = canvas._sc;
    } catch (e) { return d.text || ""; }
    return d.lines.map((ln) => (ln.words || []).map((wd) => (wd.symbols && wd.symbols.length ? fixWord(wd, img, ln.bbox) : wd.text)).join(" ")).join("\n");
  }

  // Ein Bild (Canvas) verarbeiten: Tooltip suchen, lesen, ins Inventar legen
  I.processCanvas = async function (src, opts) {
    opts = opts || {};
    const w = src.width, h = src.height;
    const cx = src.getContext("2d", { willReadFrequently: true });
    const data = cx.getImageData(0, 0, w, h).data;
    let boxes = opts.whole ? [] : I.detect(data, w, h, I.set.thr);
    const whole = !boxes.length;
    if (whole) boxes = [{ x: 0, y: 0, w, h }];
    const results = [];
    for (const b of boxes) {
      // kleine Bilder sind meist schon ein ausgeschnittener Tooltip: als Textblock lesen
      const text = await ocr(prep(src, b), whole && w * h > 700 * 700);
      I.cap.reads++;
      const p = I.parse(text);
      const rec = I.addParsed(p, opts.source || "Bild");
      if (rec && !rec.dup && b.key != null) { I.set.bgKey = b.key; save(LS_SET, I.set); }
      results.push({ box: b, text, parsed: p, rec });
      if (rec && rec.corrected) logLine("✎ Wert korrigiert: " + (p.item ? p.item.name : p.rawName));
      if (rec && !rec.dup) { I.cap.found++; logLine("✅ " + (p.item ? p.item.name + (rec.entry ? " +" + rec.entry.up : "") : "Unbekanntes Item") + " · " + p.boni.length + " Boni"); FX.toast("Erkannt: " + (p.item ? p.item.name : "unbekanntes Item")); }
      else if (rec && rec.dup) logLine("↺ schon im Inventar: " + (p.item ? p.item.name : p.rawName));
      else if (!opts.quiet) logLine("– kein Item erkannt" + (text.trim() ? " („" + text.trim().split("\n")[0].slice(0, 40) + "…“)" : ""));
    }
    return results;
  };
  function logLine(s) { I.log.unshift(new Date().toLocaleTimeString("de-DE") + "  " + s); I.log = I.log.slice(0, 30); const el = $("#inv-log"); if (el) el.innerHTML = I.log.map((x) => `<div>${esc(x)}</div>`).join(""); }

  /* ---------- Aufnahme ---------- */
  I.start = async function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { FX.toast("Dieser Browser kann den Bildschirm nicht aufnehmen"); return; }
    const cap = I.cap;
    try { cap.stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false }); }
    catch (e) { setStatus("Aufnahme abgebrochen"); return; }
    const track = cap.stream.getVideoTracks()[0];
    track.addEventListener("ended", I.stop);
    cap.grab = window.ImageCapture ? new window.ImageCapture(track) : null;
    cap.video = document.createElement("video"); cap.video.muted = true; cap.video.playsInline = true; cap.video.srcObject = cap.stream;
    try { await cap.video.play(); } catch (e) { /* Bild holen wir notfalls über ImageCapture */ }
    cap.on = true; cap.track = {}; cap.done = new Set(); cap.rej = {};
    // Taktgeber im Worker: läuft auch weiter, wenn das Browserfenster im Hintergrund ist
    const blob = new Blob(["setInterval(()=>postMessage(0)," + 450 + ")"], { type: "text/javascript" });
    cap.ticker = new Worker(URL.createObjectURL(blob));
    cap.ticker.onmessage = tick;
    I.ensureWorker().catch(() => {});
    setStatus("Aufnahme läuft. Fahre im Spiel über deine Items.");
    I.render();
  };
  I.stop = function () {
    const cap = I.cap;
    if (cap.ticker) { cap.ticker.terminate(); cap.ticker = null; }
    if (cap.stream) cap.stream.getTracks().forEach((t) => t.stop());
    cap.stream = null; cap.video = null; cap.grab = null; cap.on = false; cap.busy = false;
    setStatus("Aufnahme beendet");
    if (App.view === "inv") I.render();
  };
  async function frameCanvas() {
    const cap = I.cap;
    let src = null, w = 0, h = 0;
    if (cap.grab) { try { src = await cap.grab.grabFrame(); w = src.width; h = src.height; } catch (e) { src = null; } }
    if (!src && cap.video && cap.video.videoWidth) { src = cap.video; w = cap.video.videoWidth; h = cap.video.videoHeight; }
    if (!src || !w) return null;
    const cv = cap.canvas || (cap.canvas = document.createElement("canvas"));
    cv.width = w; cv.height = h;
    cv.getContext("2d", { willReadFrequently: true }).drawImage(src, 0, 0);
    if (src.close) src.close();
    return cv;
  }
  async function tick() {
    const cap = I.cap;
    if (!cap.on || cap.busy) return;
    cap.busy = true;
    try {
      const cv = await frameCanvas();
      if (!cv) return;
      cap.frames++;
      const cx = cv.getContext("2d", { willReadFrequently: true });
      const data = cx.getImageData(0, 0, cv.width, cv.height).data;
      const boxes = I.detect(data, cv.width, cv.height, I.set.thr);
      cap.box = boxes[0] || null;
      paintPreview(cv, boxes);
      const st = boxes.length ? "Aufnahme läuft · Tooltip gefunden (grüner Rahmen)" : "Aufnahme läuft · gerade kein Tooltip im Bild";
      if (I.status !== st && I.status.indexOf("Texterkennung wird") < 0 && I.status.indexOf("konnte nicht") < 0) setStatus(st);
      if (!boxes.length || !I.set.auto) return;
      // Jede Fläche einzeln verfolgen: erst lesen, wenn sie einen Moment ruhig steht, und jeden Inhalt nur einmal
      cap.track = cap.track || {}; cap.done = cap.done || new Set(); cap.rej = cap.rej || {};
      if (Object.keys(cap.track).length > 300) cap.track = {};
      if (cap.done.size > 500) cap.done = new Set();
      const todo = [];
      boxes.forEach((b) => {
        const g = geomKey(b), hs = g + "#" + hashBox(data, cv.width, b);
        const t = cap.track[g];
        if (t && t.hash === hs) t.n++; else cap.track[g] = { hash: hs, n: 0 };
        if (cap.track[g].n >= 1 && !cap.done.has(hs)) todo.push({ b, g, hs });
      });
      if (!todo.length) return;
      let changed = false;
      for (const job of todo) {
        cap.done.add(job.hs);
        const text = await ocr(prep(cv, job.b), false);
        cap.reads++;
        const p = I.parse(text);
        const rec = I.addParsed(p, "Aufnahme");
        if (!rec) {
          cap.rej[job.g] = (cap.rej[job.g] || 0) + 1;
          const miss = text.trim().split("\n").filter((x) => x.trim().length > 3).slice(0, 2).join(" / ").slice(0, 70);
          if (miss && cap.rej[job.g] === 1) logLine("– gelesen, aber kein Item: „" + miss + "“");
          continue;
        }
        if (job.b.key != null && I.set.bgKey !== job.b.key) { I.set.bgKey = job.b.key; save(LS_SET, I.set); }
        if (!rec.dup) { cap.found++; changed = true; logLine("✅ " + (p.item ? p.item.name + (rec.entry ? " +" + rec.entry.up : "") : "Unbekanntes Item") + " · " + p.boni.length + " Boni"); }
        else if (rec.corrected) { changed = true; logLine("✎ Wert korrigiert: " + (p.item ? p.item.name : p.rawName)); }
      }
      if (changed && App.view === "inv") renderList();
      counters();
    } catch (e) { /* einzelnes Bild überspringen */ } finally { cap.busy = false; }
  }
  function paintPreview(cv, boxes) {
    const el = $("#inv-preview"); if (!el) return;
    const sc = el.width / cv.width; el.height = Math.round(cv.height * sc);
    const cx = el.getContext("2d"); cx.drawImage(cv, 0, 0, el.width, el.height);
    cx.lineWidth = 2; cx.strokeStyle = "#3ecf8e"; cx.shadowColor = "#3ecf8e"; cx.shadowBlur = 8;
    boxes.forEach((b) => cx.strokeRect(b.x * sc, b.y * sc, b.w * sc, b.h * sc));
    cx.shadowBlur = 0;
  }
  function counters() { const el = $("#inv-counters"); if (el) el.innerHTML = `<span class="chip">${I.cap.reads} gelesen</span><span class="chip green">${I.cap.found} neue Items</span><span class="chip gold">${I.items.length} im Inventar</span>`; }

  function fileToCanvas(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(blob);
      img.onload = () => { const cv = document.createElement("canvas"); cv.width = img.naturalWidth; cv.height = img.naturalHeight; cv.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0); URL.revokeObjectURL(url); resolve(cv); };
      img.onerror = reject; img.src = url;
    });
  }
  I.readImage = async function (blob) {
    setStatus("Bild wird gelesen …");
    try { const cv = await fileToCanvas(blob); paintPreview(cv, I.detect(cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, I.set.thr)); await I.processCanvas(cv, { source: "Bild" }); setStatus("Bild gelesen"); }
    catch (e) { setStatus("Das Bild konnte nicht gelesen werden"); }
    if (App.view === "inv") { renderList(); counters(); }
  };

  /* ---------- Bestes aus dem Inventar ---------- */
  function usable(rec, build) {
    if (!rec.entry) return false;
    const it = C.itemById(App.db, rec.entry.item);
    return !!it && (!it.cls || it.cls.indexOf(build.cls) >= 0) && (it.lvl || 0) <= build.level;
  }
  I.bestFromInventory = function (build) {
    const db = App.db;
    const bySlot = {};
    I.items.forEach((r) => { if (usable(r, build)) (bySlot[r.slot] = bySlot[r.slot] || []).push(r); });
    const slots = Object.keys(bySlot);
    const run = (start) => {
      const b = O.clone(start);
      const chosen = {};
      for (let pass = 0; pass < 6; pass++) {
        let changed = false;
        slots.forEach((sid) => {
          let bestS = O.score(b, db), bestR = null;
          const keep = b.equip[sid] ? O.clone(b.equip[sid]) : null;
          bySlot[sid].forEach((r) => { b.equip[sid] = O.clone(r.entry); const s = O.score(b, db); if (s > bestS * (1 + 1e-6)) { bestS = s; bestR = r; } });
          if (bestR) { b.equip[sid] = O.clone(bestR.entry); chosen[sid] = bestR.id; changed = true; } else if (keep) b.equip[sid] = keep; else delete b.equip[sid];
        });
        if (!changed) break;
      }
      return { build: b, chosen, score: O.score(b, db) };
    };
    const a = run(build);
    // zweiter Anlauf ohne die bisherigen Stücke, falls der erste in einer Sackgasse landet
    const empty = O.clone(build); slots.forEach((sid) => { delete empty.equip[sid]; });
    const c = run(empty);
    const before = O.score(build, db);
    const best = c.score > a.score * (1 + 1e-6) ? c : a;
    return { before, after: best.score, build: best.build, chosen: best.chosen, slots: slots.length };
  };

  /* ---------- Anzeige ---------- */
  function deltaOf(rec) {
    const b = App.build, db = App.db;
    if (!usable(rec, b)) return null;
    const cur = O.score(b, db);
    const t = O.clone(b); t.equip[rec.slot] = O.clone(rec.entry);
    const s = O.score(t, db);
    return cur > 0 ? s / cur - 1 : (s > 0 ? 1 : 0);
  }
  const isEquipped = (rec) => { const e = App.build.equip[rec.slot]; return !!(rec.entry && e && sigOf({ entry: e }) === sigOf(rec)); };
  function card(rec) {
    const db = App.db;
    const bn = (id) => (db.bonusTypes[id] ? db.bonusTypes[id].name : id), bu = (id) => (db.bonusTypes[id] ? db.bonusTypes[id].u : "");
    if (!rec.entry) {
      const cands = db.items.slice().sort((a, b) => a.name.localeCompare(b.name));
      const ng = rec.parsed.nameGuess, nm = ng ? ng.name : String(rec.parsed.rawName || "").replace(/\+.*$/, "").replace(/[^A-Za-zÄÖÜäöüß .'\-]/g, "").trim();
      const g = I.guessSlot(nm, rec.parsed) || {};
      return `<div class="panel inv-card" data-id="${rec.id}"><div class="panel-head"><div class="slot-ico">❔</div><div style="min-width:0"><div class="slot-name">Gegenstand nicht erkannt</div><div class="slot-item">${esc(rec.parsed.rawName || "?")}</div></div><div class="spacer"></div><button class="btn btn-sm btn-danger" data-inv="del">🗑</button></div>
        <div class="slot-boni">${rec.parsed.boni.map((x) => `<span><b>${x.v > 0 ? "+" : ""}${nf(x.v)}${bu(x.b)}</b> ${esc(bn(x.b))}</span>`).join("")}</div>
        <div class="field" style="margin-top:8px"><label>Vorhandener Gegenstand</label><select data-inv="assign"><option value="">– auswählen –</option>${cands.map((it) => `<option value="${it.id}">${esc(it.name)} (${esc(C.slotById(db, it.slot).name)}, Lv ${it.lvl})</option>`).join("")}</select></div>
        <div class="sect-title" style="margin-top:10px">oder als neues Server-Item anlegen</div>
        <div class="stack" style="gap:6px"><input type="text" data-role="learn-name" value="${esc(nm)}" placeholder="Name des Gegenstands">
          <div class="row c2"><select data-role="learn-slot">${db.slots.filter((s) => s.kind === "item").map((s) => `<option value="${s.id}" ${g.slot === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
            <select data-role="learn-wtype" data-tip="Nur bei Waffen wichtig">${Object.keys(C.WTYPE_NAME).map((t) => `<option value="${t}" ${g.wtype === t ? "selected" : ""}>${C.WTYPE_NAME[t]}</option>`).join("")}</select></div>
          <button class="btn btn-sm btn-primary" data-inv="learn">Neu anlegen</button></div></div>`;
    }
    const e = rec.entry, it = C.itemById(db, e.item), slot = C.slotById(db, rec.slot);
    if (!it || !slot) return "";
    const d = deltaOf(rec), eq = isEquipped(rec);
    const rows = [];
    ["innate", "lines", "rare"].forEach((k) => (e[k] || []).forEach((l, i) => { if (l && l.b) rows.push(`<span><b>${l.v > 0 ? "+" : ""}${nf(l.v)}${bu(l.b)}</b> ${esc(bn(l.b))}${k === "rare" ? " <i class=\"dim\">6/7</i>" : ""} <a href="#" data-inv="rm" data-k="${k}" data-i="${i}" class="dim" data-tip="Falsch erkannt? Entfernen">✕</a></span>`); }));
    (e.stones || []).forEach((s) => { const st = C.stoneById(db, s.s); if (st) rows.push(`<span class="dim">◆ ${esc(st.name)} +${st.values.length > 1 ? s.l : 4}</span>`); });
    const fixed = Object.keys(it.fixed || {}).map((bid) => `${bn(bid)} ${Math.round(C.kp(it.fixed[bid], e.up) * (1 + (e.bm || 0) / 100))}${bu(bid)}`);
    if (it.def && typeof C.firstVal(it.def) === "number") fixed.unshift("Verteidigung " + Math.round(C.kp(it.def, e.up) * (1 + (e.bm || 0) / 100)));
    if (it.atk) { const r = C.kpRange(it.atk, e.up), f = 1 + (e.bm || 0) / 100; fixed.unshift("Angriffswert " + Math.round(r[0] * f) + " – " + Math.round(r[1] * f)); }
    if (e.bm) fixed.push("Grundwerte +" + e.bm + " %");
    const note = (rec.parsed.unknown || []).concat(rec.left || []);
    return `<div class="panel inv-card ${eq ? "equipped" : ""}" data-id="${rec.id}">
      <div class="panel-head"><div class="slot-ico">${slot.icon}</div><div style="min-width:0"><div class="slot-name">${esc(slot.name)}${rec.isNew ? ` <span class="chip green">neu</span>` : ""}${it.learned ? ` <span class="chip blue" data-tip="Dieses Item kannte die Seite nicht. Es wurde aus dem Tooltip gelernt. Name und Werte im Admin-Menü änderbar.">gelernt</span>` : ""}${rec.byStats ? ` <span class="chip" data-tip="Der Name war nicht lesbar. Erkannt über die festen Werte des Gegenstands.">über Werte erkannt</span>` : ""}</div><div class="slot-item">${esc(it.name)} <span class="plus">+${e.up}</span></div></div><div class="spacer"></div>
        ${d == null ? `<span class="chip" data-tip="Nicht für deine Klasse oder dein Level">passt nicht</span>` : eq ? `<span class="chip blue">angelegt</span>` : `<span class="chip ${d > 0.0005 ? "green" : d < -0.0005 ? "red" : ""}" data-tip="Schaden gegenüber dem, was gerade im Slot liegt">${d >= 0 ? "+" : "−"}${pf(Math.abs(d))}</span>`}</div>
      ${fixed.length ? `<div class="panel-note" style="margin-bottom:4px">fest: ${esc(fixed.join(", "))}</div>` : ""}
      <div class="slot-boni" style="gap:2px">${rows.join("") || `<span class="dim">keine Boni erkannt</span>`}</div>
      ${note.length ? `<div class="hint warn" style="margin-top:8px" data-tip="${esc(note.join(" | "))}">${note.length} Zeile${note.length > 1 ? "n" : ""} nicht zugeordnet</div>` : ""}
      <div class="inline" style="margin-top:10px"><label class="lbl">+</label><input type="number" min="0" max="${C.itemMaxUp(it)}" value="${e.up}" data-inv="up" style="width:64px">
        <div class="spacer" style="flex:1"></div><button class="btn btn-sm" data-inv="edit" data-tip="Anlegen und im Slot-Editor nachbessern">✎</button><button class="btn btn-sm btn-danger" data-inv="del">🗑</button>
        <button class="btn btn-sm ${eq ? "" : "btn-primary"}" data-inv="equip" ${d == null || eq ? "disabled" : ""}>Anlegen</button></div></div>`;
  }
  function renderList() {
    const el = $("#inv-list"); if (!el) return;
    const db = App.db;
    let list = I.items.filter((r) => I.filter === "all" || (I.filter === "unknown" ? !r.entry : r.slot === I.filter));
    const order = {}; db.slots.forEach((s, i) => { order[s.id] = i; });
    const dl = {}; list.forEach((r) => { dl[r.id] = r.entry ? deltaOf(r) : null; });
    list = list.slice().sort((a, b) => (a.entry ? order[a.slot] : -1) - (b.entry ? order[b.slot] : -1) || (dl[b.id] == null ? -9 : dl[b.id]) - (dl[a.id] == null ? -9 : dl[a.id]));
    el.innerHTML = list.length ? list.map(card).join("") : `<div class="empty-state" style="grid-column:1/-1">Noch keine Items. Starte links die Aufnahme und fahre im Spiel mit der Maus über deine Items, oder füge einen Screenshot mit Strg+V ein.</div>`;
  }
  I.render = function () {
    const db = App.db, cap = I.cap, b = App.build;
    // bisher unerkannte Einträge mit dem aktuellen Wissen erneut prüfen
    const fixedNow = I.reidentify();
    if (!I.merged || fixedNow) { I.merged = true; const n = I.mergeDups(); if (n) FX.toast(n + " doppelte Items zusammengeführt"); }
    if (fixedNow) FX.toast(fixedNow + " bisher unbekannte Items jetzt erkannt");
    const counts = {}; I.items.forEach((r) => { const k = r.entry ? r.slot : "unknown"; counts[k] = (counts[k] || 0) + 1; });
    const best = I.best;
    let bestHtml = "";
    if (best) {
      const rows = Object.keys(best.chosen).map((sid) => { const slot = C.slotById(db, sid), it = C.itemById(db, best.build.equip[sid].item); const old = b.equip[sid] && C.itemById(db, b.equip[sid].item); return `<div class="sugg" style="grid-template-columns:34px 1fr"><div class="rank">${slot.icon}</div><div><div class="t">${esc(slot.name)}: ${esc(it.name)} +${best.build.equip[sid].up}</div><div class="d">${old ? "statt " + esc(old.name) + " +" + (b.equip[sid].up || 0) : "Slot war leer"}</div></div></div>`; });
      bestHtml = `<div class="panel" style="margin-bottom:16px"><div class="panel-head"><div class="panel-title">Bestes aus deinem Inventar</div><div class="spacer"></div>${rows.length ? `<button class="btn btn-sm btn-primary" data-inv="best-apply">Übernehmen</button>` : ""}<button class="btn btn-sm" data-inv="best-close">✕</button></div>
        <div class="row c3"><div class="stat"><div class="k">Jetzt</div><div class="v">${nf(best.before)}</div></div><div class="stat good"><div class="k">Beste Kombination</div><div class="v">${nf(best.after)}</div></div><div class="stat"><div class="k">Gewinn</div><div class="v">${best.before > 0 ? (best.after >= best.before ? "+" : "−") + pf(Math.abs(best.after / best.before - 1)) : "–"}</div></div></div>
        <div class="stack" style="margin-top:10px">${rows.join("") || `<div class="empty-state">Du trägst bereits die beste Kombination für dieses Ziel.</div>`}</div></div>`;
    }
    $("#view-inv").innerHTML = `<div class="opt-grid">
      <div class="col">
        <div class="panel"><div class="panel-head"><div class="panel-title">Items einlesen</div><div class="spacer"></div>${cap.on ? `<span class="chip red">● Aufnahme</span>` : ""}</div>
          <div class="stack">
            ${cap.on ? `<button class="btn btn-danger" data-inv="stop">■ Aufnahme beenden</button>` : `<button class="btn btn-primary" data-inv="start">● Spielfenster aufnehmen</button>`}
            <canvas id="inv-preview" width="330" height="186" style="width:100%;border-radius:10px;border:1px solid var(--line);background:#06070c"></canvas>
            <div class="panel-note" id="inv-status">${esc(I.status || "Wähle nach dem Klick das Fenster deines Spiels aus.")}</div>
            <div class="inline" id="inv-counters"></div>
            <div class="inline"><label class="btn btn-sm">🖼 Screenshot laden<input type="file" accept="image/*" data-inv="file" style="display:none"></label><button class="btn btn-sm" data-inv="whole" ${cap.on ? "" : "disabled"} data-tip="Liest das ganze aktuelle Bild, falls der Tooltip nicht von selbst gefunden wird">Jetzt ganzes Bild lesen</button></div>
            <div class="hint">So geht es: Aufnahme starten, das Spielfenster wählen und im Spiel mit der Maus über jedes Item fahren. Bleib kurz stehen, bis der grüne Rahmen erscheint. Jedes Item landet rechts in der Liste. Ein Screenshot per Strg+V geht hier ebenfalls.</div>
            <details><summary class="lbl" style="cursor:pointer">Erkennung einstellen</summary><div class="stack" style="margin-top:8px">
              <div class="field"><label>Tooltip-Dunkelheit: <span id="inv-thr-v">${I.set.thr}</span></label><input type="range" min="30" max="130" value="${I.set.thr}" data-inv="thr">
                <div class="panel-note">Höher stellen, wenn kein grüner Rahmen um den Tooltip erscheint. Niedriger, wenn andere Fenster markiert werden.</div></div>
              <div class="field"><label>Sprache im Spiel</label><select data-inv="lang">${[["deu", "Deutsch"], ["eng", "Englisch"], ["tur", "Türkisch"], ["pol", "Polnisch"], ["ron", "Rumänisch"], ["ita", "Italienisch"], ["spa", "Spanisch"], ["fra", "Französisch"]].map((l) => `<option value="${l[0]}" ${l[0] === I.set.lang ? "selected" : ""}>${l[1]}</option>`).join("")}</select></div>
              <label class="inline"><input type="checkbox" data-inv="auto" ${I.set.auto ? "checked" : ""}> <span>Tooltips automatisch lesen</span></label>
            </div></details>
            <div class="sect-title">Protokoll</div><div id="inv-log" class="mono" style="max-height:170px;overflow:auto;color:var(--muted);font-size:11px">${I.log.map((x) => `<div>${esc(x)}</div>`).join("")}</div>
          </div></div>
      </div>
      <div class="col">
        ${bestHtml}
        <div class="panel"><div class="panel-head"><div class="panel-title">Mein Inventar</div><div class="spacer"></div>
            <span class="panel-note">Prozentwert = Schaden gegen <b style="color:var(--text)">${esc(C.resolveTarget(b, db).name)}</b> im Vergleich zum angelegten Stück</span></div>
          <div class="toolbar"><select data-inv="filter" style="width:220px"><option value="all">Alle Slots (${I.items.length})</option>${db.slots.filter((s) => counts[s.id]).map((s) => `<option value="${s.id}" ${I.filter === s.id ? "selected" : ""}>${esc(s.name)} (${counts[s.id]})</option>`).join("")}${counts.unknown ? `<option value="unknown" ${I.filter === "unknown" ? "selected" : ""}>Nicht erkannt (${counts.unknown})</option>` : ""}</select>
            <div class="spacer"></div><button class="btn btn-danger btn-sm" data-inv="clear" ${I.items.length ? "" : "disabled"}>Inventar leeren</button>
            <button class="btn btn-primary" data-inv="best" ${I.items.some((r) => r.entry) ? "" : "disabled"}>⚡ Bestes aus meinem Inventar</button></div>
          <div class="cmp-grid" id="inv-list" style="grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px"></div></div>
      </div></div>`;
    renderList(); counters();
  };

  /* ---------- Ereignisse ---------- */
  const recOf = (el) => { const c = el.closest(".inv-card"); return c ? I.items.find((r) => r.id === c.dataset.id) : null; };
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest("[data-inv]"); if (!a || a.tagName === "INPUT" || a.tagName === "SELECT") return;
    if (a.tagName === "A") ev.preventDefault();
    const act = a.dataset.inv, rec = recOf(a), b = App.build;
    switch (act) {
      case "start": I.start(); break;
      case "stop": I.stop(); break;
      case "whole": if (I.cap.on) { setStatus("Ganzes Bild wird gelesen …"); frameCanvas().then((cv) => cv && I.processCanvas(cv, { whole: true, source: "Aufnahme" })).then(() => { setStatus("Aufnahme läuft"); renderList(); counters(); }).catch(() => setStatus("Lesen fehlgeschlagen")); } break;
      case "equip": if (rec && rec.entry) { b.equip[rec.slot] = O.clone(rec.entry); rec.isNew = false; I.save(); I.best = null; App.saveBuilds(); I.render(); FX.toast("Angelegt"); } break;
      case "edit": if (rec && rec.entry) { b.equip[rec.slot] = O.clone(rec.entry); App.saveBuilds(); App.setView("build"); App.openDrawer(rec.slot); } break;
      case "learn": if (rec && !rec.entry) {
        const cardEl = a.closest(".inv-card"), q = (r) => cardEl.querySelector('[data-role="' + r + '"]');
        const name = q("learn-name").value.trim();
        if (name.length < 3) { FX.toast("Bitte einen Namen eintragen"); break; }
        const p = Object.assign({ boni: [], stones: [], unknown: [] }, rec.parsed);
        const r = I.learnItem(p, name, q("learn-slot").value, q("learn-wtype").value);
        const t = I.toEntry(Object.assign({}, p, { up: r.up }), r.item);
        rec.entry = t.entry; rec.slot = r.item.slot; rec.left = t.left; rec.learned = true;
        I.save(); I.render(); FX.toast("„" + name + "“ als Server-Item angelegt");
      } break;
      case "del": if (rec) { I.items = I.items.filter((r) => r !== rec); I.save(); I.best = null; I.render(); } break;
      case "rm": if (rec && rec.entry) { const k = a.dataset.k, i = Number(a.dataset.i); if (k === "innate") rec.entry.innate[i] = null; else rec.entry[k].splice(i, 1); I.save(); renderList(); } break;
      case "clear": if (confirm("Wirklich alle " + I.items.length + " Items aus dem Inventar entfernen?")) { I.items = []; I.best = null; I.save(); I.render(); } break;
      case "best": I.best = I.bestFromInventory(b); I.render(); FX.toast(I.best.after > I.best.before * 1.0005 ? "Beste Kombination gefunden" : "Du trägst schon das Beste"); break;
      case "best-apply": if (I.best) { Object.keys(I.best.chosen).forEach((sid) => { b.equip[sid] = O.clone(I.best.build.equip[sid]); }); I.best = null; App.saveBuilds(); I.render(); FX.toast("Beste Kombination angelegt"); } break;
      case "best-close": I.best = null; I.render(); break;
    }
  });
  document.addEventListener("change", (ev) => {
    const el = ev.target, act = el.dataset.inv; if (!act) return;
    const rec = recOf(el);
    switch (act) {
      case "file": if (el.files && el.files[0]) I.readImage(el.files[0]); el.value = ""; break;
      case "thr": I.set.thr = Number(el.value); save(LS_SET, I.set); break;
      case "lang": I.set.lang = el.value; save(LS_SET, I.set); if (I.worker) I.ensureWorker().catch(() => {}); break;
      case "auto": I.set.auto = el.checked; save(LS_SET, I.set); break;
      case "filter": I.filter = el.value; renderList(); break;
      case "up": if (rec && rec.entry) { const it = C.itemById(App.db, rec.entry.item); const old = rec.entry.up; rec.entry.up = Math.max(0, Math.min(C.itemMaxUp(it), Number(el.value) || 0)); (rec.entry.innate || []).forEach((l, i) => { if (l && l.b && it.innate && l.v === O.tierValue(App.db.pools[it.innate[i]], l.b, old, "max")) l.v = O.tierValue(App.db.pools[it.innate[i]], l.b, rec.entry.up, "max"); }); I.save(); renderList(); } break;
      case "assign": if (rec && el.value) { const it = C.itemById(App.db, el.value); const r = I.toEntry(Object.assign({ boni: [], stones: [] }, rec.parsed), it); rec.entry = r.entry; rec.slot = it.slot; rec.left = r.left; I.save(); I.render(); } break;
    }
  });
  document.addEventListener("input", (ev) => { if (ev.target.dataset.inv === "thr") { const v = $("#inv-thr-v"); if (v) v.textContent = ev.target.value; I.set.thr = Number(ev.target.value); } });
  document.addEventListener("paste", (ev) => {
    if (App.view !== "inv" || !ev.clipboardData) return;
    const it = Array.from(ev.clipboardData.items || []).find((x) => x.type && x.type.indexOf("image/") === 0);
    if (it) { ev.preventDefault(); I.readImage(it.getAsFile()); }
  });

  window.Inv = I;
})();
