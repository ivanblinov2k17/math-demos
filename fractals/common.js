// Общие помощники раздела «Фракталы»: навигация между страницами, размер холста, палитры.
(function () {
  const PAGES = [
    { slug: "mandelbrot", title: "Множество Мандельброта" },
    { slug: "julia", title: "Множество Жюлиа" },
    { slug: "koch", title: "Снежинка Коха" },
    { slug: "sierpinski", title: "Треугольник Серпинского" },
    { slug: "barnsley-fern", title: "Папоротник Барнсли" },
    { slug: "pythagoras-tree", title: "Дерево Пифагора" },
    { slug: "dragon", title: "Кривая дракона" },
    { slug: "newton", title: "Фрактал Ньютона" },
    { slug: "hilbert", title: "Кривая Гильберта" },
    { slug: "menger", title: "Губка Менгера" },
  ];

  // Ссылки на соседние фракталы внизу страницы: <nav class="more" data-current="koch"></nav>
  function renderNav() {
    document.querySelectorAll("nav.more").forEach(nav => {
      const cur = nav.dataset.current;
      nav.innerHTML = PAGES.map(p =>
        `<a href="../${p.slug}/"${p.slug === cur ? ' aria-current="page"' : ""}>${p.title}</a>`).join("");
    });
  }

  // Подгоняет буфер холста под CSS-размер и плотность пикселей; вызывает onResize(w, h, dpr).
  function fitCanvas(canvas, onResize, maxDpr = 2) {
    const apply = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      onResize(w, h, dpr);
    };
    new ResizeObserver(apply).observe(canvas);
    apply();
  }

  // Косинусные палитры: цвет(t) = a + b·cos(2π(c·t + d)), t ∈ [0, 1]
  const PALETTES = {
    "Океан":   { a: [0.50, 0.50, 0.55], b: [0.50, 0.45, 0.45], c: [1.0, 1.0, 1.0], d: [0.00, 0.10, 0.20] },
    "Пламя":   { a: [0.55, 0.35, 0.20], b: [0.45, 0.40, 0.25], c: [1.0, 1.0, 1.0], d: [0.00, 0.08, 0.15] },
    "Радуга":  { a: [0.50, 0.50, 0.50], b: [0.50, 0.50, 0.50], c: [1.0, 1.0, 1.0], d: [0.00, 0.33, 0.67] },
    "Лёд":     { a: [0.60, 0.70, 0.80], b: [0.40, 0.30, 0.25], c: [1.0, 1.0, 1.0], d: [0.50, 0.55, 0.60] },
    "Графит":  { a: [0.50, 0.50, 0.50], b: [0.50, 0.50, 0.50], c: [1.0, 1.0, 1.0], d: [0.00, 0.00, 0.00] },
  };

  const fmt = (x, d = 3) => Number(x.toFixed(d)).toLocaleString("ru-RU", { maximumFractionDigits: d });

  function bindSlider(id, onInput, format = v => v) {
    const el = document.getElementById(id), out = document.getElementById(id + "Out");
    const upd = () => { if (out) out.textContent = format(+el.value); onInput(+el.value); };
    el.addEventListener("input", upd);
    if (out) out.textContent = format(+el.value);
    return el;
  }

  window.Fractal = { PAGES, renderNav, fitCanvas, PALETTES, fmt, bindSlider };
  document.addEventListener("DOMContentLoaded", renderNav);
})();
