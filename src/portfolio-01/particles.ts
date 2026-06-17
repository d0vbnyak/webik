/* ──────────────────────────────────────────────────────────────────────────
   portfolio-01 · WebGL-движок героя
   Точечное облако (gl.POINTS, аддитивное свечение на тёмной базе), которое
   плавно морфит между формами (сфера → тор → волна), медленно вращается,
   живёт органическим дрейфом (никогда не повторяется в точности) и
   отталкивается от курсора в плоскости экрана с инерцией.

   Сырой WebGL1 — без внешних зависимостей. Если контекст недоступен или
   включён reduced-motion, движок ведёт себя бережно (фолбэк/один кадр).
   Вся математика — из ./lib (покрыта тестами).
   ────────────────────────────────────────────────────────────────────────── */

import {
  mat4Multiply,
  mat4Perspective,
  mat4RotationX,
  mat4RotationY,
  mat4Translation,
  spherePoints,
  torusPoints,
  wavePoints,
  type Mat4,
} from "./lib";

export interface ParticleSceneOptions {
  count?: number;
  reducedMotion?: boolean;
  /** Ближний акцент (RGB 0..1). По умолчанию — лаймовый бренда WebIK. */
  colorNear?: [number, number, number];
  /** Дальний акцент (RGB 0..1). По умолчанию — мягкий фиолетовый. */
  colorFar?: [number, number, number];
}

export interface ParticleScene {
  /** Целевая позиция курсора в NDC (-1..1, y вверх). */
  setPointer(nx: number, ny: number): void;
  /** Усиление реакции на курсор (0 — спокойно, 1 — активно). */
  setActive(active: boolean): void;
  /** Перейти к следующей форме немедленно. */
  nextShape(): void;
  dispose(): void;
}

const VERT_SRC = `
attribute vec3 aPosA;
attribute vec3 aPosB;
attribute float aSeed;

uniform mat4 uProj;
uniform mat4 uView;
uniform float uMorph;
uniform float uTime;
uniform vec2 uPointer;
uniform float uActive;
uniform float uDpr;

varying float vDepth;
varying float vSeed;

void main() {
  vec3 p = mix(aPosA, aPosB, uMorph);

  // органический дрейф — сцена «дышит» и не зацикливается ровно
  float ph = aSeed * 6.2831853;
  p.x += sin(uTime * 0.5 + ph) * 0.035;
  p.y += cos(uTime * 0.43 + ph * 1.3) * 0.035;
  p.z += sin(uTime * 0.61 + ph * 0.7) * 0.035;

  vec4 mv = uView * vec4(p, 1.0);
  vec4 clip = uProj * mv;

  // отталкивание от курсора в плоскости экрана (в NDC)
  vec2 ndc = clip.xy / clip.w;
  vec2 d = ndc - uPointer;
  float dist = length(d);
  float force = uActive * (1.0 - smoothstep(0.0, 0.38, dist)) * 0.28;
  clip.xy += normalize(d + vec2(0.0001)) * force * clip.w;

  gl_Position = clip;

  float depth = -mv.z;
  float size = (2.3 + aSeed * 3.4) * uDpr;
  gl_PointSize = size * (3.4 / max(0.25, depth));
  vDepth = depth;
  vSeed = aSeed;
}
`;

const FRAG_SRC = `
precision mediump float;

varying float vDepth;
varying float vSeed;

uniform vec3 uColorNear;
uniform vec3 uColorFar;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.06, d); // мягкий круглый диск

  // цвет от ближнего акцента (спереди) к дальнему (в глубину)
  float depthMix = clamp((vDepth - 2.6) / 4.2, 0.0, 1.0);
  vec3 col = mix(uColorNear, uColorFar, depthMix);
  col += vSeed * 0.05; // лёгкая искра по части частиц

  // дальние частицы тусклее и прозрачнее — глубина без пересвета
  float fade = mix(1.0, 0.4, depthMix);
  gl_FragColor = vec4(col * fade, alpha * mix(0.95, 0.45, depthMix));
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/** Детерминированный «шум» 0..1 по индексу — стабильные сид-значения частиц. */
function hash01(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function createParticleScene(
  canvas: HTMLCanvasElement,
  opts: ParticleSceneOptions = {},
): ParticleScene | null {
  const ctx =
    canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    }) || canvas.getContext("experimental-webgl");
  if (!ctx) return null;
  const gl = ctx as WebGLRenderingContext;

  const reduced = opts.reducedMotion ?? false;
  const count = Math.max(64, Math.floor(opts.count ?? 6000));
  const colorNear = opts.colorNear ?? [0.78, 1.0, 0.0]; // лайм #c6ff00
  const colorFar = opts.colorFar ?? [0.62, 0.5, 0.95]; // фиолет

  // ── формы и сиды: CPU-данные, переживают потерю GL-контекста ────────────────
  const shapes: Float32Array[] = [
    spherePoints(count, 1.75),
    torusPoints(count, 1.3, 0.52),
    wavePoints(count, 2.1, 0.38),
    spherePoints(count, 1.45), // возврат к сфере замыкает цикл мягко
  ];

  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = hash01(i);

  let cur = 0;
  const next = () => (cur + 1) % shapes.length;

  // ── GL-ресурсы: пересоздаются при восстановлении контекста ───────────────────
  let vs: WebGLShader | null = null;
  let fs: WebGLShader | null = null;
  let prog: WebGLProgram | null = null;
  let bufA: WebGLBuffer | null = null;
  let bufB: WebGLBuffer | null = null;
  let bufSeed: WebGLBuffer | null = null;
  let aPosA = -1;
  let aPosB = -1;
  let aSeed = -1;
  let uProj: WebGLUniformLocation | null = null;
  let uView: WebGLUniformLocation | null = null;
  let uMorph: WebGLUniformLocation | null = null;
  let uTime: WebGLUniformLocation | null = null;
  let uPointer: WebGLUniformLocation | null = null;
  let uActive: WebGLUniformLocation | null = null;
  let uDpr: WebGLUniformLocation | null = null;
  let uColorNear: WebGLUniformLocation | null = null;
  let uColorFar: WebGLUniformLocation | null = null;

  /** Создаёт программу, буферы и локации. Вызывается при инициализации и при
   *  webglcontextrestored. Возвращает false при неудаче. */
  function buildGLResources(): boolean {
    vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return false;
    const p = gl.createProgram();
    if (!p) return false;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return false;
    prog = p;
    gl.useProgram(prog);

    bufA = gl.createBuffer();
    bufB = gl.createBuffer();
    bufSeed = gl.createBuffer();
    if (!bufA || !bufB || !bufSeed) return false;

    gl.bindBuffer(gl.ARRAY_BUFFER, bufA);
    gl.bufferData(gl.ARRAY_BUFFER, shapes[cur], gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufB);
    gl.bufferData(gl.ARRAY_BUFFER, shapes[next()], gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufSeed);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);

    aPosA = gl.getAttribLocation(prog, "aPosA");
    aPosB = gl.getAttribLocation(prog, "aPosB");
    aSeed = gl.getAttribLocation(prog, "aSeed");

    uProj = gl.getUniformLocation(prog, "uProj");
    uView = gl.getUniformLocation(prog, "uView");
    uMorph = gl.getUniformLocation(prog, "uMorph");
    uTime = gl.getUniformLocation(prog, "uTime");
    uPointer = gl.getUniformLocation(prog, "uPointer");
    uActive = gl.getUniformLocation(prog, "uActive");
    uDpr = gl.getUniformLocation(prog, "uDpr");
    uColorNear = gl.getUniformLocation(prog, "uColorNear");
    uColorFar = gl.getUniformLocation(prog, "uColorFar");

    gl.uniform3fv(uColorNear, colorNear);
    gl.uniform3fv(uColorFar, colorFar);

    gl.enable(gl.BLEND);
    // обычный альфа-блендинг: чёткие точки без пересвета в белое
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    return true;
  }

  if (!buildGLResources()) return null;

  // ── состояние ──────────────────────────────────────────────────────────────
  let dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  let proj: Mat4 = mat4Perspective(Math.PI / 3.4, 1, 0.1, 100);

  const ptrTarget = { x: 0, y: 0 };
  const ptr = { x: 0, y: 0 };
  const activeUniform = reduced ? 0 : 1; // сила реакции на курсор (константа)

  const MORPH_DUR = 2.7;
  const DWELL = 3.6;
  let phaseStart = 0;
  let started = false;
  let raf = 0;
  let running = false;
  let disposed = false;
  let contextLost = false;

  function resize() {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const pw = Math.floor(w * dpr);
    const ph = Math.floor(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    gl.viewport(0, 0, pw, ph);
    proj = mat4Perspective(Math.PI / 3.4, w / h, 0.1, 100);
  }

  function bindAttribs() {
    gl.bindBuffer(gl.ARRAY_BUFFER, bufA);
    gl.enableVertexAttribArray(aPosA);
    gl.vertexAttribPointer(aPosA, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufB);
    gl.enableVertexAttribArray(aPosB);
    gl.vertexAttribPointer(aPosB, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufSeed);
    gl.enableVertexAttribArray(aSeed);
    gl.vertexAttribPointer(aSeed, 1, gl.FLOAT, false, 0, 0);
  }

  function advance() {
    cur = next();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufA);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, shapes[cur]);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufB);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, shapes[next()]);
  }

  function viewMatrix(time: number): Mat4 {
    const ry = mat4RotationY(reduced ? 0.5 : time * 0.08 + ptr.x * 0.45);
    const rx = mat4RotationX(reduced ? -0.15 : ptr.y * 0.3);
    const t = mat4Translation(0, 0, -4.6);
    return mat4Multiply(t, mat4Multiply(rx, ry));
  }

  function draw(time: number, morph: number) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    bindAttribs();
    gl.uniformMatrix4fv(uProj, false, proj);
    gl.uniformMatrix4fv(uView, false, viewMatrix(time));
    gl.uniform1f(uMorph, morph);
    gl.uniform1f(uTime, reduced ? 0 : time);
    gl.uniform2f(uPointer, ptr.x, ptr.y);
    gl.uniform1f(uActive, activeUniform);
    gl.uniform1f(uDpr, dpr);
    gl.drawArrays(gl.POINTS, 0, count);
  }

  function frame(nowMs: number) {
    if (disposed || contextLost || gl.isContextLost()) {
      running = false;
      return;
    }
    const time = nowMs / 1000;
    if (!started) {
      started = true;
      phaseStart = time;
    }

    // инерция указателя — «жидкое» поведение, след от курсора затухает сам
    ptr.x += (ptrTarget.x - ptr.x) * 0.07;
    ptr.y += (ptrTarget.y - ptr.y) * 0.07;

    const elapsed = time - phaseStart;
    const m = Math.min(1, Math.max(0, elapsed / MORPH_DUR));
    const morph = m * m * (3 - 2 * m); // smoothstep
    if (elapsed > MORPH_DUR + DWELL) {
      advance();
      phaseStart = time;
    }

    draw(time, morph);
    raf = requestAnimationFrame(frame);
  }

  // потеря/восстановление контекста — герой переживает спящий GPU и т.п.
  const onLost = (e: Event) => {
    e.preventDefault(); // обязательно, иначе контекст не восстановят
    contextLost = true;
    running = false;
    cancelAnimationFrame(raf);
  };
  const onRestored = () => {
    contextLost = false;
    if (disposed) return;
    if (!buildGLResources()) return; // не вышло — останется прозрачный фолбэк
    resize();
    if (reduced) {
      draw(0, 0);
    } else if (!running) {
      running = true;
      started = false;
      raf = requestAnimationFrame(frame);
    }
  };
  canvas.addEventListener("webglcontextlost", onLost, false);
  canvas.addEventListener("webglcontextrestored", onRestored, false);

  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
  }
  resize();

  if (reduced) {
    // спокойный режим: один статичный кадр, без цикла анимации
    draw(0, 0);
  } else {
    running = true;
    raf = requestAnimationFrame(frame);
  }

  return {
    setPointer(nx: number, ny: number) {
      ptrTarget.x = nx;
      ptrTarget.y = ny;
    },
    setActive(on: boolean) {
      // пауза/возобновление цикла по видимости героя (экономия батареи)
      if (reduced || disposed || contextLost) return;
      if (on && !running) {
        running = true;
        started = false;
        raf = requestAnimationFrame(frame);
      } else if (!on && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    },
    nextShape() {
      advance();
      phaseStart = -Infinity; // мгновенно завершить текущий морф
    },
    dispose() {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", onLost, false);
      canvas.removeEventListener("webglcontextrestored", onRestored, false);
      ro?.disconnect();
      gl.deleteBuffer(bufA);
      gl.deleteBuffer(bufB);
      gl.deleteBuffer(bufSeed);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}
