/* ──────────────────────────────────────────────────────────────────────────
   portfolio-01 · чистая математика
   Векторно-матричная база для WebGL-героя, генераторы облаков точек (формы,
   между которыми морфит частичная сцена) и расчёт «магнитного» сдвига кнопок.
   Никаких сайд-эффектов и DOM — всё детерминировано и покрыто vitest (lib.test).
   ────────────────────────────────────────────────────────────────────────── */

// ── Скаляры / easing ───────────────────────────────────────────────────────

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Классический smoothstep Хермита: 0 у edge0, 1 у edge1, плоские края. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const mapRange = (
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);

// ── mat4 (column-major, как в WebGL) ───────────────────────────────────────

export type Mat4 = Float32Array;

export function mat4Identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

/** Произведение a·b (сначала применяется b, затем a). */
export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

export function mat4Perspective(
  fovYRad: number,
  aspect: number,
  near: number,
  far: number,
): Mat4 {
  const f = 1 / Math.tan(fovYRad / 2);
  const nf = 1 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) * nf;
  m[11] = -1;
  m[14] = 2 * far * near * nf;
  return m;
}

export function mat4RotationY(rad: number): Mat4 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const m = mat4Identity();
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}

export function mat4RotationX(rad: number): Mat4 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const m = mat4Identity();
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}

export function mat4Translation(x: number, y: number, z: number): Mat4 {
  const m = mat4Identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

// ── Генераторы облаков точек ────────────────────────────────────────────────
// Все детерминированы (без Math.random): и тесты точные, и сцена воспроизводима.

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Равномерная сфера (спираль Фибоначчи) — точки строго на радиусе. */
export function spherePoints(n: number, radius = 1): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = n <= 1 ? 0 : 1 - (i / (n - 1)) * 2; // 1 → -1
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * GOLDEN_ANGLE;
    out[i * 3] = Math.cos(theta) * r * radius;
    out[i * 3 + 1] = y * radius;
    out[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  return out;
}

/** Тор: каждая точка лежит ровно на трубе радиуса r вокруг кольца радиуса R. */
export function torusPoints(n: number, R = 0.9, r = 0.32): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = i * GOLDEN_ANGLE; // вдоль большого кольца
    const v = i * GOLDEN_ANGLE * 2.0; // вдоль трубы
    const ring = R + r * Math.cos(v);
    out[i * 3] = ring * Math.cos(u);
    out[i * 3 + 1] = ring * Math.sin(u);
    out[i * 3 + 2] = r * Math.sin(v);
  }
  return out;
}

/** Волновая плоскость: квадратная сетка в [-1,1] по X/Y, синус-рельеф по Z. */
export function wavePoints(n: number, extent = 1, amp = 0.28): Float32Array {
  const out = new Float32Array(n * 3);
  const side = Math.max(1, Math.round(Math.sqrt(n)));
  for (let i = 0; i < n; i++) {
    const gx = i % side;
    const gy = Math.floor(i / side) % side;
    const x = side > 1 ? (gx / (side - 1)) * 2 - 1 : 0;
    const y = side > 1 ? (gy / (side - 1)) * 2 - 1 : 0;
    out[i * 3] = x * extent;
    out[i * 3 + 1] = y * extent;
    out[i * 3 + 2] = Math.sin(x * 3.0) * Math.cos(y * 3.0) * amp;
  }
  return out;
}

// ── Магнитная кнопка ────────────────────────────────────────────────────────

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Сдвиг элемента к курсору: 0 в центре, линейно растёт к краям, ×strength. */
export function magneticOffset(
  pointerX: number,
  pointerY: number,
  rect: Rect,
  strength = 0.35,
): { x: number; y: number } {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return { x: (pointerX - cx) * strength, y: (pointerY - cy) * strength };
}
