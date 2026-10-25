// Игра хаоса для систем итерированных функций (IFS) с приближением.
// Обычная игра хаоса при сильном увеличении почти не попадает в кадр. Поэтому мы заранее находим
// «адреса» — композиции F = f_a1 ∘ … ∘ f_ak, образы которых покрывают видимую область, и каждую
// точку аттрактора отображаем одной из них. Так все точки ложатся в кадр на любой глубине.
(function () {
  const ID = [1, 0, 0, 1, 0, 0];
  // аффинное отображение m = [a, b, c, d, e, f]: (x, y) → (a·x + b·y + e, c·x + d·y + f)
  const compose = (F, g) => [                       // F ∘ g
    F[0] * g[0] + F[1] * g[2], F[0] * g[1] + F[1] * g[3],
    F[2] * g[0] + F[3] * g[2], F[2] * g[1] + F[3] * g[3],
    F[0] * g[4] + F[1] * g[5] + F[4], F[2] * g[4] + F[3] * g[5] + F[5]];

  function create({ canvas, onView = () => {}, overlay = null, grab = null, drag = null, hover = null, custom = null }) {
    const g = canvas.getContext("2d");
    let W = 0, H = 0, dpr = 1;
    let sys = null, cum = [], bbox = null, prefixes = [{ M: ID, first: -1, w: 1 }], pcum = [1];
    let cnt, sr, sg, sb, img, total = 0, x = 0, y = 0, dirty = true, lastI = 0;
    const view = { cx: 0, cy: 0, scale: 100 };       // scale — экранных пикселей (буфера) на единицу
    let mode = "points", speed = Infinity, cap = 8e6;

    const toScreen = (wx, wy) => [W / 2 + (wx - view.cx) * view.scale, H / 2 - (wy - view.cy) * view.scale];
    const toWorld = (sx, sy) => [view.cx + (sx - W / 2) / view.scale, view.cy - (sy - H / 2) / view.scale];

    function setSystem(s, { refit = true } = {}) {
      sys = s;
      const ps = s.maps.map(m => Math.max(0, m.p)), sum = ps.reduce((a, b) => a + b, 0);
      let acc = 0; cum = ps.map(p => (acc += (sum > 0 ? p / sum : 1 / ps.length)));
      // границы аттрактора по пробному прогону
      x = 0; y = 0; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, bad = false;
      for (let k = 0; k < 30000; k++) {
        applyMap(pick());
        if (!Number.isFinite(x) || Math.abs(x) > 1e7 || Math.abs(y) > 1e7) { bad = true; break; }
        if (k > 60) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      bbox = bad || !(x1 >= x0) ? null : { x0, x1, y0, y1 };
      if (bbox && (x1 - x0) + (y1 - y0) < 1e-9) bbox = null;
      if (refit) fitView(); else viewChanged();
      return bbox ? null : (bad ? "diverge" : "degenerate");
    }
    function fitView() {
      if (!bbox || !W) return viewChanged();
      const bw = Math.max(bbox.x1 - bbox.x0, 1e-6), bh = Math.max(bbox.y1 - bbox.y0, 1e-6);
      view.scale = Math.min(W * 0.9 / bw, H * 0.9 / bh);
      view.cx = (bbox.x0 + bbox.x1) / 2; view.cy = (bbox.y0 + bbox.y1) / 2;
      viewChanged();
    }
    function pick() { const r = Math.random(); for (let i = 0; i < cum.length; i++) if (r < cum[i]) return i; return cum.length - 1; }
    function applyMap(i) { const m = sys.maps[i].m; const nx = m[0] * x + m[1] * y + m[4]; y = m[2] * x + m[3] * y + m[5]; x = nx; lastI = i; }

    // Подбираем адреса, чьи образы пересекают кадр и не больше кадра
    function findPrefixes() {
      prefixes = [{ M: ID, first: -1, w: 1 }];
      if (!bbox || sys.rule === "norep") { pcum = [1]; return; }
      const [vx0, vy1] = toWorld(0, 0), [vx1, vy0] = toWorld(W, H);
      const target = Math.max(vx1 - vx0, vy1 - vy0);
      const corners = [[bbox.x0, bbox.y0], [bbox.x1, bbox.y0], [bbox.x0, bbox.y1], [bbox.x1, bbox.y1]];
      const boxOf = M => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
        corners.forEach(([px, py]) => { const qx = M[0] * px + M[1] * py + M[4], qy = M[2] * px + M[3] * py + M[5];
          a = Math.min(a, qx); b = Math.max(b, qx); c = Math.min(c, qy); d = Math.max(d, qy); }); return { a, b, c, d }; };
      const probs = sys.maps.map(m => Math.max(0, m.p)), ps = probs.reduce((s, v) => s + v, 0) || 1;
      const out = [], stack = [{ M: ID, first: -1, w: 1, depth: 0 }];
      while (stack.length) {
        const n = stack.pop(), b = boxOf(n.M);
        if (b.b < vx0 || b.a > vx1 || b.d < vy0 || b.c > vy1) continue;
        if (Math.max(b.b - b.a, b.d - b.c) <= target || n.depth >= 48 || out.length + stack.length > 3000) { out.push(n); continue; }
        sys.maps.forEach((mp, i) => { if (probs[i] > 0) stack.push({ M: compose(n.M, mp.m), first: n.first < 0 ? i : n.first, w: n.w * probs[i] / ps, depth: n.depth + 1 }); });
      }
      prefixes = out.length ? out : [{ M: ID, first: -1, w: 1 }];
      const sw = prefixes.reduce((s, p) => s + p.w, 0) || 1;
      let acc = 0; pcum = prefixes.map(p => (acc += p.w / sw));
    }

    function clear() {
      total = 0; cnt = new Uint32Array(W * H); sr = new Float32Array(W * H); sg = new Float32Array(W * H); sb = new Float32Array(W * H);
      img = g.createImageData(W, H); dirty = true;
      x = 0; y = 0; for (let k = 0; k < 60 && sys; k++) applyMap(pick());
    }
    function viewChanged() {
      if (!W) return;
      if (mode === "points" && sys) { findPrefixes(); clear(); }
      dirty = true;
      onView(api);
    }

    function plotOne() {
      const i = pick(); applyMap(i);
      let px = x, py = y, ci = i;
      if (prefixes.length > 1 || prefixes[0].first >= 0) {
        const r = Math.random(); let k = 0; while (k < pcum.length - 1 && r > pcum[k]) k++;
        const P = prefixes[k], M = P.M; px = M[0] * x + M[1] * y + M[4]; py = M[2] * x + M[3] * y + M[5];
        if (P.first >= 0) ci = P.first;
      }
      const sx = (W / 2 + (px - view.cx) * view.scale) | 0, sy = (H / 2 - (py - view.cy) * view.scale) | 0;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
      const o = sy * W + sx, c = sys.colorMode === "mono" ? sys.mono : sys.colors[ci % sys.colors.length];
      cnt[o]++; sr[o] += c[0]; sg[o] += c[1]; sb[o] += c[2];
    }
    // Правило «нельзя дважды одну вершину» — уже не IFS, считаем без адресов
    function plotNoRep() {
      let i; do { i = pick(); } while (i === lastI && sys.maps.length > 1);
      applyMap(i);
      const sx = (W / 2 + (x - view.cx) * view.scale) | 0, sy = (H / 2 - (y - view.cy) * view.scale) | 0;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
      const o = sy * W + sx, c = sys.colorMode === "mono" ? sys.mono : sys.colors[i % sys.colors.length];
      cnt[o]++; sr[o] += c[0]; sg[o] += c[1]; sb[o] += c[2];
    }
    function paint() {
      const d = img.data; let mx = 1;
      for (let o = 0; o < cnt.length; o++) if (cnt[o] > mx) mx = cnt[o];
      const lm = Math.log(1 + mx);
      for (let o = 0, p = 0; o < cnt.length; o++, p += 4) {
        const n = cnt[o];
        if (!n) { d[p] = 13; d[p + 1] = 17; d[p + 2] = 23; d[p + 3] = 255; continue; }
        const v = 0.4 + 0.6 * Math.log(1 + n) / lm;
        d[p] = sr[o] / n * v; d[p + 1] = sg[o] / n * v; d[p + 2] = sb[o] / n * v; d[p + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }

    function frame() {
      if (mode === "custom") {
        if (dirty && custom) { dirty = false; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "#0d1117"; g.fillRect(0, 0, W, H); custom(g, api); onView(api); }
      } else if (sys && bbox && W) {
        let made = 0;
        if (total < cap && speed > 0) {
          const t0 = performance.now(), plot = sys.rule === "norep" ? plotNoRep : plotOne;
          const want = Number.isFinite(speed) ? speed : Infinity;
          while (made < want && (made & 1023 || performance.now() - t0 < 14)) { plot(); made++; }
          total += made;
        }
        if (made || dirty) { paint(); if (overlay) overlay(g, api); dirty = false; onView(api); }
      } else if (dirty) {
        g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "#0d1117"; g.fillRect(0, 0, W, H); dirty = false; onView(api);
      }
      requestAnimationFrame(frame);
    }

    // Одна итерация «по-честному» (без адресов) — для режима «Один шаг»
    function step() {
      const from = [x, y];
      if (sys.rule === "norep") plotNoRep(); else { const i = pick(); applyMap(i);
        const [sx, sy] = toScreen(x, y);
        if (sx >= 0 && sy >= 0 && sx < W && sy < H) { const o = (sy | 0) * W + (sx | 0), c = sys.colorMode === "mono" ? sys.mono : sys.colors[i % sys.colors.length]; cnt[o]++; sr[o] += c[0]; sg[o] += c[1]; sb[o] += c[2]; } }
      total++; dirty = true;
      return { from, to: [x, y], i: lastI };
    }

    // ---------- масштаб и сдвиг ----------
    const local = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr]; };
    function zoomAt(sx, sy, f) {
      const [wx, wy] = toWorld(sx, sy);
      view.scale = Math.max(1e-3, Math.min(1e15, view.scale * f));
      const [wx2, wy2] = toWorld(sx, sy);
      view.cx += wx - wx2; view.cy += wy - wy2; viewChanged();
    }
    let zoomTimer = null, pendingZoom = 1, zoomPt = null;
    canvas.addEventListener("wheel", e => {
      e.preventDefault(); pendingZoom *= Math.exp(-e.deltaY * 0.0015); zoomPt = local(e);
      if (!zoomTimer) zoomTimer = requestAnimationFrame(() => { zoomTimer = null; zoomAt(zoomPt[0], zoomPt[1], pendingZoom); pendingZoom = 1; });
    }, { passive: false });
    canvas.addEventListener("dblclick", e => { const [sx, sy] = local(e); zoomAt(sx, sy, e.shiftKey ? 0.5 : 2); });
    const ptrs = new Map(); let pinch = null, handle = null;
    canvas.addEventListener("pointerdown", e => {
      canvas.setPointerCapture(e.pointerId);
      const [sx, sy] = local(e);
      if (grab && ptrs.size === 0) { handle = grab(sx, sy, api); if (handle !== null && handle !== undefined) return; }
      ptrs.set(e.pointerId, [sx, sy]); pinch = null;
    });
    canvas.addEventListener("pointermove", e => {
      const [sx, sy] = local(e);
      if (handle !== null && handle !== undefined) { const [wx, wy] = toWorld(sx, sy); drag(handle, wx, wy, api); return; }
      if (!ptrs.has(e.pointerId)) { if (hover) canvas.style.cursor = hover(sx, sy, api) ? "grab" : ""; return; }
      const p = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [sx, sy]);
      if (ptrs.size === 1) { view.cx -= (sx - p[0]) / view.scale; view.cy += (sy - p[1]) / view.scale; viewChanged(); }
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch); pinch = d; }
    });
    const up = e => { ptrs.delete(e.pointerId); pinch = null; handle = null; };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);

    const api = {
      setSystem, fitView, clear: () => { clear(); onView(api); }, step,
      setSpeed: s => { speed = s; }, setMode: m => { mode = m; viewChanged(); }, redraw: () => { dirty = true; },
      toScreen, toWorld, view, get total() { return total; }, get dpr() { return dpr; }, get size() { return [W, H]; },
      get zoom() { if (!bbox) return 1; const bw = Math.max(bbox.x1 - bbox.x0, 1e-6), bh = Math.max(bbox.y1 - bbox.y0, 1e-6); return view.scale / Math.min(W * 0.9 / bw, H * 0.9 / bh); },
      get prefixCount() { return prefixes.length; }, get ok() { return !!bbox; },
    };
    Fractal.fitCanvas(canvas, (w, h, d) => {
      const first = !W; dpr = d; W = canvas.width; H = canvas.height;
      if (first) fitView(); else viewChanged();
    }, 1.5);
    requestAnimationFrame(frame);
    return api;
  }

  window.IFSView = { create };
})();
