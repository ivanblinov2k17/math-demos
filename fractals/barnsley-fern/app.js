// Папоротник Барнсли: таблица коэффициентов + игра хаоса через IFSView (с приближением).
(function () {
  const $ = id => document.getElementById(id), F = Fractal;
  const MAP_COLORS = [[224, 160, 80], [98, 214, 152], [94, 168, 255], [255, 143, 163]];
  const PRESETS = {
    "Папоротник Барнсли": [[0, 0, 0, 0.16, 0, 0, 0.01], [0.85, 0.04, -0.04, 0.85, 0, 1.6, 0.85], [0.2, -0.26, 0.23, 0.22, 0, 1.6, 0.07], [-0.15, 0.28, 0.26, 0.24, 0, 0.44, 0.07]],
    "Циклосорус": [[0, 0, 0, 0.25, 0, -0.4, 0.02], [0.95, 0.005, -0.005, 0.93, -0.002, 0.5, 0.84], [0.035, -0.2, 0.16, 0.04, -0.09, 0.02, 0.07], [-0.04, 0.2, 0.16, 0.04, 0.083, 0.12, 0.07]],
    "Без листьев": [[0, 0, 0, 0.16, 0, 0, 0.05], [0.85, 0.04, -0.04, 0.85, 0, 1.6, 0.95], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]],
    "Только левые листья": [[0, 0, 0, 0.16, 0, 0, 0.01], [0.85, 0.04, -0.04, 0.85, 0, 1.6, 0.85], [0.2, -0.26, 0.23, 0.22, 0, 1.6, 0.14], [0, 0, 0, 0, 0, 0, 0]],
  };
  let maps = PRESETS["Папоротник Барнсли"].map(r => r.slice());
  let byMap = true, problem = null;

  const view = IFSView.create({
    canvas: $("cv"),
    onView: api => {
      if (problem) { $("info").textContent = problem === "diverge" ? "Точки улетают: одно из преобразований не сжимает. Уменьшите коэффициенты." : "Фигура вырождается в точку или линию."; return; }
      const z = api.zoom;
      $("info").textContent = `точек: ${api.total.toLocaleString("ru-RU")}` + (z > 1.05 ? ` · увеличение ×${z < 1000 ? F.fmt(z, 1) : z.toExponential(1).replace(".", ",").replace("e+", "·10^")}` : "");
    },
  });
  // Ненулевые вероятности только у преобразований, которые что-то делают
  function system() {
    return {
      maps: maps.map(m => ({ m: m.slice(0, 6), p: m[6] })),
      colors: MAP_COLORS, colorMode: byMap ? "map" : "mono", mono: [70, 220, 110],
    };
  }
  function restart(refit = true) { problem = view.setSystem(system(), { refit }); stats(); }

  // Таблица коэффициентов
  const COLS = ["a", "b", "c", "d", "e", "f", "p"];
  function renderTable() {
    $("ifs").innerHTML = `<tr><th></th>${COLS.map(c => `<th>${c}</th>`).join("")}</tr>` +
      maps.map((m, i) => `<tr><td><span class="dot" style="background:rgb(${MAP_COLORS[i]})"></span>f${"₁₂₃₄"[i]}</td>${m.map((v, j) =>
        `<td><input type="number" step="0.01" id="m${i}${j}" value="${+v.toFixed(4)}" aria-label="f${i + 1}, ${COLS[j]}"></td>`).join("")}</tr>`).join("");
    $("ifs").querySelectorAll("input").forEach(inp => inp.addEventListener("input", () => {
      const i = +inp.id[1], j = +inp.id[2], v = parseFloat(inp.value);
      maps[i][j] = Number.isFinite(v) ? v : 0;
      if (i === 1) syncSliders();
      restart(j < 6);
    }));
  }
  function syncSliders() {
    const [a, b] = maps[1];
    const s = Math.hypot(a, b), ang = Math.atan2(b, a) * 180 / Math.PI;
    $("bend").value = ang; $("bendOut").textContent = F.fmt(ang, 1) + "°";
    $("dense").value = s; $("denseOut").textContent = F.fmt(s, 3);
  }
  // f₂ = поворот на угол φ и сжатие в s раз
  function setF2FromSliders() {
    const ang = +$("bend").value * Math.PI / 180, s = +$("dense").value;
    maps[1][0] = s * Math.cos(ang); maps[1][1] = s * Math.sin(ang); maps[1][2] = -s * Math.sin(ang); maps[1][3] = s * Math.cos(ang);
    $("bendOut").textContent = F.fmt(+$("bend").value, 1) + "°"; $("denseOut").textContent = F.fmt(s, 3);
    [0, 1, 2, 3].forEach(j => { $("m1" + j).value = +maps[1][j].toFixed(4); });
    restart();
  }
  $("bend").addEventListener("input", setF2FromSliders);
  $("dense").addEventListener("input", setF2FromSliders);

  function stats() {
    const det = maps.map(m => Math.abs(m[0] * m[3] - m[1] * m[2]));
    $("stats").innerHTML = maps.map((m, i) =>
      `<span class="k"><span class="dot" style="background:rgb(${MAP_COLORS[i]})"></span>f${"₁₂₃₄"[i]}: площадь умножается на</span><span class="v">${F.fmt(det[i], 3)}</span>`).join("") +
      `<span class="k">Сумма вероятностей</span><span class="v">${F.fmt(maps.reduce((s, m) => s + Math.max(0, m[6]), 0), 3)}</span>`;
  }

  Object.keys(PRESETS).forEach(n => {
    const b = Object.assign(document.createElement("button"), { className: "btn", type: "button", textContent: n });
    b.addEventListener("click", () => { maps = PRESETS[n].map(r => r.slice()); renderTable(); syncSliders(); restart(); });
    $("presets").appendChild(b);
  });
  $("byMap").addEventListener("change", e => { byMap = e.target.checked; restart(false); });
  $("reset").addEventListener("click", () => view.fitView());

  renderTable(); syncSliders(); restart();
})();
