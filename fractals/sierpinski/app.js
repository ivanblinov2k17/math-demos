// Треугольник Серпинского: игра хаоса (через IFSView, с приближением) и вырезание треугольников.
(function () {
  const $ = id => document.getElementById(id), F = Fractal;
  const COLORS = [[255,107,107],[94,168,255],[255,207,77],[98,214,152],[196,140,255],[255,150,72],[86,214,230],[255,130,200],[200,200,210]];
  const st = { mode: "chaos", k: 3, r: 0.5, norep: false, mids: false, color: true, running: true, speed: 4, depth: 5 };
  let verts = [], lastStep = null;

  function regular(k) {
    if (k === 4) { verts = [[0, 0], [1, 0], [1, 1], [0, 1]]; return; }
    verts = [...Array(k)].map((_, i) => { const a = Math.PI / 2 + 2 * Math.PI * i / k; return [0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)]; });
  }
  function targets() {
    if (!st.mids) return verts;
    const t = [];
    verts.forEach((v, i) => { const w = verts[(i + 1) % verts.length]; t.push(v, [(v[0] + w[0]) / 2, (v[1] + w[1]) / 2]); });
    return t;
  }
  // Каждая вершина V даёт сжатие к ней: P → (1 − r)·P + r·V
  function system() {
    const s = 1 - st.r;
    return {
      maps: targets().map(([vx, vy]) => ({ m: [s, 0, 0, s, st.r * vx, st.r * vy], p: 1 })),
      colors: COLORS, colorMode: st.color ? "map" : "mono", mono: [220, 230, 245],
      rule: st.norep ? "norep" : null,
    };
  }

  const near = (api, sx, sy) => {
    const list = st.mode === "cut" ? verts.slice(0, 3) : verts, R = 18 * api.dpr;
    return list.findIndex(v => { const [px, py] = api.toScreen(v[0], v[1]); return Math.hypot(px - sx, py - sy) < R; });
  };

  const view = IFSView.create({
    canvas: $("cv"),
    grab: (sx, sy, api) => { const i = near(api, sx, sy); return i >= 0 ? i : null; },
    hover: (sx, sy, api) => near(api, sx, sy) >= 0,
    drag: (i, wx, wy, api) => {
      verts[i] = [wx, wy]; lastStep = null;
      if (st.mode === "chaos") api.setSystem(system(), { refit: false }); else api.redraw();
    },
    overlay: (g, api) => drawHandles(g, api),
    custom: (g, api) => { drawCut(g, api); drawHandles(g, api); },
    onView: api => info(api),
  });

  function drawHandles(g, api) {
    const dpr = api.dpr, T = st.mode === "cut" ? verts.slice(0, 3) : targets();
    if (lastStep && st.mode === "chaos") {
      const a = api.toScreen(...lastStep.from), b = api.toScreen(...T[lastStep.i]), p = api.toScreen(...lastStep.to);
      g.strokeStyle = "rgba(255,255,255,0.65)"; g.lineWidth = 1.5 * dpr; g.setLineDash([5 * dpr, 4 * dpr]);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
      g.fillStyle = "#fff"; g.beginPath(); g.arc(p[0], p[1], 4.5 * dpr, 0, 7); g.fill();
      g.strokeStyle = "#fff"; g.lineWidth = 1.5 * dpr; g.beginPath(); g.arc(a[0], a[1], 3.5 * dpr, 0, 7); g.stroke();
    }
    T.forEach((v, i) => {
      const [x, y] = api.toScreen(v[0], v[1]), c = st.mode === "cut" ? [255, 207, 77] : COLORS[i % COLORS.length], big = verts.includes(v);
      g.fillStyle = `rgb(${c})`; g.strokeStyle = "#0d1117"; g.lineWidth = 2 * dpr;
      g.beginPath(); g.arc(x, y, (big ? 8 : 5) * dpr, 0, 7); g.fill(); g.stroke();
      if (lastStep && lastStep.i === i && st.mode === "chaos") { g.strokeStyle = "#fff"; g.beginPath(); g.arc(x, y, 13 * dpr, 0, 7); g.stroke(); }
    });
  }

  // Вырезание: рекурсия только по видимым треугольникам и не мельче пикселя
  let cutCount = 0;
  function drawCut(g, api) {
    const [W, H] = api.size, P = verts.slice(0, 3).map(v => api.toScreen(v[0], v[1]));
    g.fillStyle = "#8fc2ff"; cutCount = 0;
    const rec = (a, b, c, d) => {
      const x0 = Math.min(a[0], b[0], c[0]), x1 = Math.max(a[0], b[0], c[0]), y0 = Math.min(a[1], b[1], c[1]), y1 = Math.max(a[1], b[1], c[1]);
      if (x1 < 0 || y1 < 0 || x0 > W || y0 > H) return;
      if (d === 0 || Math.max(x1 - x0, y1 - y0) < 1.5) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.closePath(); g.fill(); cutCount++; return; }
      const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const ab = m(a, b), bc = m(b, c), ca = m(c, a);
      rec(a, ab, ca, d - 1); rec(ab, b, bc, d - 1); rec(ca, bc, c, d - 1);
    };
    rec(P[0], P[1], P[2], st.depth);
  }

  function info(api) {
    const z = api.zoom, zs = z > 1.05 ? ` · увеличение ×${z < 1000 ? F.fmt(z, 1) : z.toExponential(1).replace(".", ",").replace("e+", "·10^")}` : "";
    if (st.mode === "cut") {
      $("info").textContent = `видно треугольников: ${cutCount.toLocaleString("ru-RU")}${zs}`;
      $("stats").innerHTML = `
        <span class="k">Треугольников на шаге n</span><span class="v">${Math.pow(3, st.depth).toLocaleString("ru-RU")}</span>
        <span class="k">Осталось площади</span><span class="v">${F.fmt(100 * Math.pow(0.75, st.depth), 3)} %</span>
        <span class="k">Периметр</span><span class="v">${F.fmt(Math.pow(1.5, st.depth), 2)} × исходного</span>
        <span class="k">Размерность</span><span class="v">1,585</span>`;
      return;
    }
    $("info").textContent = `точек: ${api.total.toLocaleString("ru-RU")}${zs}`;
    const T = targets().length, dim = Math.log(T) / Math.log(1 / (1 - st.r));
    $("stats").innerHTML = `
      <span class="k">Точек-целей</span><span class="v">${T}</span>
      <span class="k">Каждый кусок меньше целого в</span><span class="v">${F.fmt(1 / (1 - st.r), 3)} раза</span>
      <span class="k">Размерность (если куски не перекрываются)</span><span class="v">${st.norep ? "для правила с запретом формула не подходит" : dim >= 2 ? "≥ 2: куски перекрываются" : F.fmt(dim, 4)}</span>`;
  }

  // ---------- управление ----------
  const SPEEDS = [0, 1, 10, 200, 3000, Infinity];
  function applySpeed() { view.setSpeed(st.running ? SPEEDS[st.speed] : 0); }
  function rebuild(refit) { lastStep = null; view.setSystem(system(), { refit }); }
  function syncInputs() {
    $("k").value = st.k; $("kOut").textContent = st.k; $("r").value = st.r; $("rOut").textContent = F.fmt(st.r, 3);
    $("norep").checked = st.norep; $("mids").checked = st.mids;
  }
  const PRESETS = [
    ["Треугольник", { k: 3, r: 0.5, norep: false, mids: false }],
    ["Пятиугольник", { k: 5, r: 0.618, norep: false, mids: false }],
    ["Шестиугольник", { k: 6, r: 0.667, norep: false, mids: false }],
    ["Квадрат без повторов", { k: 4, r: 0.5, norep: true, mids: false }],
    ["Ковёр", { k: 4, r: 0.667, norep: false, mids: true }],
  ];
  PRESETS.forEach(([n, p]) => {
    const b = Object.assign(document.createElement("button"), { className: "btn", type: "button", textContent: n });
    b.addEventListener("click", () => { Object.assign(st, p); regular(st.k); syncInputs(); rebuild(true); });
    $("presets").appendChild(b);
  });
  $("k").addEventListener("input", e => { st.k = +e.target.value; $("kOut").textContent = st.k; regular(st.k); rebuild(true); });
  F.bindSlider("r", v => { st.r = v; rebuild(true); }, v => F.fmt(v, 3));
  $("norep").addEventListener("change", e => { st.norep = e.target.checked; rebuild(false); });
  $("mids").addEventListener("change", e => { st.mids = e.target.checked; rebuild(true); });
  $("color").addEventListener("change", e => { st.color = e.target.checked; rebuild(false); });
  F.bindSlider("speed", v => { st.speed = v; applySpeed(); }, v => ["стоп", "1 точка", "10", "200", "3 000", "максимум"][v] + (v > 1 && v < 5 ? " за кадр" : ""));
  $("run").addEventListener("click", () => { st.running = !st.running; $("run").textContent = st.running ? "Пауза" : "Продолжить"; applySpeed(); });
  $("step1").addEventListener("click", () => {
    st.running = false; $("run").textContent = "Продолжить"; applySpeed();
    lastStep = view.step();
  });
  $("clear").addEventListener("click", () => { lastStep = null; view.clear(); });
  $("reset").addEventListener("click", () => view.fitView());
  F.bindSlider("depth", v => { st.depth = v; view.redraw(); info(view); });

  [["chaos", "Игра хаоса"], ["cut", "Вырезание треугольников"]].forEach(([m, t]) => {
    const b = Object.assign(document.createElement("button"), { className: "btn", type: "button", textContent: t });
    b.dataset.m = m; b.setAttribute("aria-pressed", String(m === st.mode));
    b.addEventListener("click", () => {
      st.mode = m;
      $("modes").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.m === m)));
      $("chaosBox").hidden = m !== "chaos"; $("cutBox").hidden = m !== "cut";
      if (m === "cut" && (verts.length !== 3 || st.mids)) { Object.assign(st, { k: 3, r: 0.5, mids: false, norep: false }); regular(3); syncInputs(); }
      view.setMode(m === "cut" ? "custom" : "points");
      rebuild(true);
    });
    $("modes").appendChild(b);
  });

  regular(3); syncInputs(); applySpeed(); rebuild(true);
})();
