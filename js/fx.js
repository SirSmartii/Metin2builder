/* Visuelle Effekte: Glut-Partikel, Zähler-Animation, Karten-Neigung, Einblenden */
(function () {
  "use strict";
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FX = {};

  /* ---- Glut-Partikel im Hintergrund ---- */
  FX.initBackground = function () {
    const cv = document.getElementById("fx-bg");
    if (!cv || reduce) return;
    const ctx = cv.getContext("2d");
    let w = 0, h = 0, dpr = 1, parts = [], burst = [];
    const COLORS = ["255,122,60", "230,185,85", "239,77,86", "246,217,138"];
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, (w * h) / 26000));
      parts = Array.from({ length: n }, () => spawn(true));
    }
    function spawn(anywhere) {
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : h + 10,
        r: 0.6 + Math.random() * 1.9,
        vy: 0.15 + Math.random() * 0.55,
        vx: (Math.random() - 0.5) * 0.25,
        ph: Math.random() * Math.PI * 2,
        a: 0.15 + Math.random() * 0.55,
        c: COLORS[(Math.random() * COLORS.length) | 0],
      };
    }
    let mx = -999, my = -999;
    window.addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    function frame(t) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.y -= p.vy; p.x += p.vx + Math.sin(t / 1400 + p.ph) * 0.18;
        const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
        if (d2 < 14000) { const f = (1 - d2 / 14000) * 0.9; p.x += (dx / Math.sqrt(d2 + 1)) * f; p.y += (dy / Math.sqrt(d2 + 1)) * f; }
        if (p.y < -12 || p.x < -12 || p.x > w + 12) parts[i] = spawn(false);
        const fl = p.a * (0.65 + 0.35 * Math.sin(t / 420 + p.ph));
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        g.addColorStop(0, "rgba(" + p.c + "," + fl + ")");
        g.addColorStop(1, "rgba(" + p.c + ",0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.2832); ctx.fill();
      }
      for (let i = burst.length - 1; i >= 0; i--) {
        const b = burst[i];
        b.x += b.vx; b.y += b.vy; b.vy += 0.05; b.life -= 0.02;
        if (b.life <= 0) { burst.splice(i, 1); continue; }
        ctx.fillStyle = "rgba(" + b.c + "," + b.life + ")";
        ctx.beginPath(); ctx.arc(b.x, b.y, 1.6, 0, 6.2832); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      requestAnimationFrame(frame);
    }
    FX.burst = function (x, y, n) {
      for (let i = 0; i < (n || 26); i++) {
        const a = Math.random() * 6.2832, s = 1 + Math.random() * 3.4;
        burst.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 1, c: COLORS[(Math.random() * COLORS.length) | 0] });
      }
    };
    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(frame);
  };
  FX.burst = function () {};

  /* ---- Zahlen hochzählen ---- */
  const running = new WeakMap();
  FX.countTo = function (el, to, opts) {
    if (!el) return;
    opts = opts || {};
    const fmt = opts.format || ((v) => Math.round(v).toLocaleString("de-DE"));
    const from = Number(el.dataset.val || 0);
    el.dataset.val = String(to);
    if (reduce || !isFinite(from) || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = opts.duration || 550;
    const id = {};
    running.set(el, id);
    function step(t) {
      if (running.get(el) !== id) return;
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    // Falls der Browser gerade keine Bilder zeichnet (Hintergrund-Tab), steht am Ende trotzdem der richtige Wert da
    setTimeout(() => { if (running.get(el) === id) { running.delete(el); el.textContent = fmt(to); } }, dur + 150);
    if (opts.bump) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  };

  /* ---- Lichtpunkt folgt der Maus, Karten neigen sich ---- */
  FX.initPointerGlow = function () {
    document.addEventListener("pointermove", (e) => {
      const t = e.target.closest ? e.target.closest(".panel, .slot-card") : null;
      if (!t) return;
      const r = t.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      t.style.setProperty("--mx", x + "px");
      t.style.setProperty("--my", y + "px");
      if (!reduce && t.classList.contains("slot-card")) {
        const rx = ((y / r.height) - 0.5) * -7, ry = ((x / r.width) - 0.5) * 9;
        t.style.transform = "perspective(700px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) translateY(-3px)";
      }
    }, { passive: true });
    document.addEventListener("pointerout", (e) => {
      const t = e.target.closest ? e.target.closest(".slot-card") : null;
      if (t && !t.contains(e.relatedTarget)) t.style.transform = "";
    });
  };

  /* ---- Einblenden beim Scrollen ---- */
  // Das Einblenden läuft rein über CSS (.reveal), damit nie etwas unsichtbar hängen bleibt
  FX.reveal = function () {};

  /* ---- Balken nach dem Rendern animiert füllen ---- */
  FX.fillBars = function (root) {
    const els = (root || document).querySelectorAll("[data-w]");
    requestAnimationFrame(() => requestAnimationFrame(() => els.forEach((e) => { e.style.width = e.dataset.w + "%"; })));
  };

  FX.toast = function (msg) {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 320); }, 2600);
  };

  window.FX = FX;
})();
