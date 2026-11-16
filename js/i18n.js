/* Sprache: Die Oberfläche ist auf Deutsch geschrieben. Für andere Sprachen wird der fertige Seiteninhalt übersetzt
   (Textknoten und Tooltips), sobald er im Dokument landet. Zahlen in Texten stehen im Wörterbuch als „#“.
   Fehlt eine Übersetzung, bleibt der deutsche Text stehen. */
(function () {
  "use strict";
  const LS = "m2b_lang_v1";
  const SEPS = [" | ", " · ", " → "];
  const I = { lang: "de", dicts: {}, rules: {}, missing: new Set(), langs: ["de", "en"] };
  try { I.lang = localStorage.getItem(LS) || ((navigator.language || "de").toLowerCase().indexOf("de") === 0 ? "de" : "en"); } catch (e) { /* Standard */ }
  if (I.langs.indexOf(I.lang) < 0) I.lang = "de";

  const NUM = /\d+(?:[.,]\d+)*/g;
  const LETTER = /[A-Za-zÄÖÜäöüß]/;
  let exact = null, phraseRe = null;

  I.add = function (lang, dict) { I.dicts[lang] = Object.assign(I.dicts[lang] || {}, dict); if (lang === I.lang) build(); };
  I.addRules = function (lang, rules) { I.rules[lang] = (I.rules[lang] || []).concat(rules); };
  I.set = function (lang) { try { localStorage.setItem(LS, lang); } catch (e) { /* egal */ } location.reload(); };

  function build() {
    exact = I.dicts[I.lang] || null;
    if (!exact) { phraseRe = null; return; }
    const keys = Object.keys(exact).filter((k) => k.length >= 3 && k.indexOf("#") < 0).sort((a, b) => b.length - a.length);
    const L = "A-Za-zÄÖÜäöüß";
    phraseRe = keys.length ? new RegExp("(?<![" + L + "])(?:" + keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?![" + L + "])", "g") : null;
  }

  // 1.234,5 → 1,234.5
  function numFmt(n) {
    if (I.lang === "de") return n;
    if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(n)) return n.replace(/\./g, "§").replace(",", ".").replace(/§/g, ",");
    if (/^\d+,\d+$/.test(n)) return n.replace(",", ".");
    return n;
  }

  function core(s) {
    if (Object.prototype.hasOwnProperty.call(exact, s)) return exact[s];
    const nums = [];
    const pat = s.replace(NUM, (m) => { nums.push(m); return "#"; });
    if (nums.length && Object.prototype.hasOwnProperty.call(exact, pat)) {
      let i = 0;
      return exact[pat].replace(/#(\d)?/g, (m, d) => numFmt(nums[d ? Number(d) - 1 : i++] || ""));
    }
    const rules = I.rules[I.lang] || [];
    for (let r = 0; r < rules.length; r++) {
      const m = rules[r][0].exec(s);
      if (m) return rules[r][1].replace(/\$(\d)/g, (x, d) => core(m[Number(d)] || ""));
    }
    // Aufzählungen Teil für Teil übersetzen
    for (let k = 0; k < SEPS.length; k++) {
      if (s.indexOf(SEPS[k]) > 0) return s.split(SEPS[k]).map((p) => (LETTER.test(p) ? core(p.trim()) : p.replace(NUM, numFmt))).join(SEPS[k]);
    }
    I.missing.add(pat);
    let out = phraseRe ? s.replace(phraseRe, (m) => exact[m]) : s;
    out = out.replace(NUM, numFmt);
    return out;
  }

  I.tr = function (s) {
    if (I.lang === "de" || !exact || s == null) return s;
    s = String(s);
    if (!LETTER.test(s)) return s.replace(NUM, numFmt);
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    if (!m[2]) return s;
    return m[1] + core(m[2].replace(/\s+/g, " ")) + m[3];
  };

  /* ---------- Dokument übersetzen ---------- */
  const ATTRS = ["data-tip", "placeholder", "title", "aria-label"];
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CANVAS: 1 };
  const done = new WeakMap();

  function text(n) {
    const v = n.nodeValue;
    if (!v || done.get(n) === v) return;
    const p = n.parentNode;
    if (p && (SKIP[p.nodeName] || (p.closest && p.closest("[data-noi18n]")))) return;
    const t = I.tr(v);
    done.set(n, t);
    if (t !== v) n.nodeValue = t;
  }
  function attrs(el) {
    for (let i = 0; i < ATTRS.length; i++) {
      const a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a), key = "__i18n_" + a;
      if (el[key] === v) continue;
      const t = I.tr(v);
      el[key] = t;
      if (t !== v) el.setAttribute(a, t);
    }
  }
  function walk(root) {
    if (root.nodeType === 3) return text(root);
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    attrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) text(n); else attrs(n); }
  }

  I.start = function () {
    document.documentElement.lang = I.lang;
    if (I.lang === "de") return;
    build();
    if (!exact) return;
    document.title = I.tr(document.title);
    walk(document.body);
    new MutationObserver((list) => {
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m.type === "childList") m.addedNodes.forEach(walk);
        else if (m.type === "characterData") text(m.target);
        else if (m.type === "attributes") attrs(m.target);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    ["confirm", "alert", "prompt"].forEach((fn) => { const orig = window[fn]; window[fn] = function (msg, def) { return orig.call(window, I.tr(msg), def); }; });
  };

  window.I18N = I;
})();
