// Рисование множеств Мандельброта и Жюлиа на видеокарте (WebGL) с перемещением и масштабом.
// z ← z^p + c; для Мандельброта z₀ = 0 и c = точка экрана, для Жюлиа z₀ = точка экрана и c — параметр.
(function () {
  const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
  const FS = `
    precision highp float;
    uniform vec2 uRes; uniform vec2 uCenter; uniform float uPix;
    uniform int uIter; uniform int uPow; uniform int uJulia; uniform vec2 uC;
    uniform vec3 pa; uniform vec3 pb; uniform vec3 pc; uniform vec3 pd;
    uniform float uDensity; uniform float uOffset; uniform vec3 uInside;
    vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
    void main(){
      vec2 q = uCenter + (gl_FragCoord.xy - 0.5*uRes) * uPix;
      vec2 z = uJulia == 1 ? q : vec2(0.0);
      vec2 c = uJulia == 1 ? uC : q;
      float n = 0.0; bool esc = false;
      for (int i = 0; i < 5000; i++) {
        if (i >= uIter) break;
        vec2 w = z;
        for (int k = 1; k < 8; k++) { if (k >= uPow) break; w = cmul(w, z); }
        z = w + c;
        if (dot(z, z) > 256.0) { esc = true; break; }
        n += 1.0;
      }
      if (!esc) { gl_FragColor = vec4(uInside, 1.0); return; }
      float mu = n + 1.0 - log(log(length(z))) / log(float(uPow));     // плавная раскраска
      float t = uDensity * log(mu + 1.0) + uOffset;
      gl_FragColor = vec4(clamp(pa + pb * cos(6.28318 * (pc * t + pd)), 0.0, 1.0), 1.0);
    }`;

  function create({ canvas, julia = false, onView = () => {}, onHover = () => {} }) {
    const gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL недоступен");
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ["uRes","uCenter","uPix","uIter","uPow","uJulia","uC","pa","pb","pc","pd","uDensity","uOffset","uInside"].forEach(n => U[n] = gl.getUniformLocation(prog, n));

    // halfH — половина высоты видимой области в единицах комплексной плоскости
    const s = { cx: julia ? 0 : -0.6, cy: 0, halfH: julia ? 1.5 : 1.3, iter: 300, pow: 2, c: [-0.8, 0.156],
                palette: "Океан", density: 0.35, offset: 0.0, inside: [0.03, 0.035, 0.05] };
    let dpr = 1, pending = false;

    function render() {
      pending = false;
      const P = Fractal.PALETTES[s.palette];
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform2f(U.uCenter, s.cx, s.cy);
      gl.uniform1f(U.uPix, 2 * s.halfH / canvas.height);
      gl.uniform1i(U.uIter, s.iter); gl.uniform1i(U.uPow, s.pow); gl.uniform1i(U.uJulia, julia ? 1 : 0);
      gl.uniform2f(U.uC, s.c[0], s.c[1]);
      gl.uniform3fv(U.pa, P.a); gl.uniform3fv(U.pb, P.b); gl.uniform3fv(U.pc, P.c); gl.uniform3fv(U.pd, P.d);
      gl.uniform1f(U.uDensity, s.density); gl.uniform1f(U.uOffset, s.offset); gl.uniform3fv(U.uInside, s.inside);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      onView(s);
    }
    const request = () => { if (!pending) { pending = true; requestAnimationFrame(render); } };
    Fractal.fitCanvas(canvas, (w, h, d) => { dpr = d; request(); });

    // экран → комплексная точка
    const toC = (x, y) => {
      const r = canvas.getBoundingClientRect(), k = 2 * s.halfH / r.height;
      return [s.cx + (x - r.left - r.width / 2) * k, s.cy - (y - r.top - r.height / 2) * k];
    };
    function zoomAt(x, y, f) {
      const [a, b] = toC(x, y);
      s.halfH = Math.min(4, Math.max(1e-6, s.halfH * f));
      const [a2, b2] = toC(x, y);
      s.cx += a - a2; s.cy += b - b2; request();
    }
    canvas.addEventListener("wheel", e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015)); }, { passive: false });
    canvas.addEventListener("dblclick", e => zoomAt(e.clientX, e.clientY, e.shiftKey ? 2 : 0.5));
    const pts = new Map(); let pinch = null;
    canvas.addEventListener("pointerdown", e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); pinch = null; });
    canvas.addEventListener("pointermove", e => {
      onHover(toC(e.clientX, e.clientY));
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) {
        const k = 2 * s.halfH / canvas.getBoundingClientRect().height;
        s.cx -= (e.clientX - prev[0]) * k; s.cy += (e.clientY - prev[1]) * k; request();
      } else if (pts.size === 2) {
        const [p, q] = [...pts.values()], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (pinch) zoomAt((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, pinch / d);
        pinch = d;
      }
    });
    const up = e => { pts.delete(e.pointerId); pinch = null; };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", () => onHover(null));

    return { state: s, request, setView(cx, cy, halfH) { s.cx = cx; s.cy = cy; s.halfH = halfH; request(); } };
  }

  // Принадлежит ли c множеству Мандельброта (орбита нуля не уходит за |z| > 2 за n шагов)
  function inMandelbrot(cr, ci, n = 1000, p = 2) {
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) {
      let wx = x, wy = y;
      for (let k = 1; k < p; k++) { const t = wx * x - wy * y; wy = wx * y + wy * x; wx = t; }
      x = wx + cr; y = wy + ci;
      if (x * x + y * y > 4) return false;
    }
    return true;
  }

  window.EscapeFractal = { create, inMandelbrot };
})();
