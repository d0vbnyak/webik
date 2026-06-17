import { describe, expect, it } from "vitest";
import {
  clamp,
  lerp,
  smoothstep,
  easeOutCubic,
  mapRange,
  pluralRu,
  mat4Identity,
  mat4Multiply,
  mat4Perspective,
  mat4RotationY,
  spherePoints,
  torusPoints,
  wavePoints,
  magneticOffset,
} from "./lib";

describe("scalar helpers", () => {
  it("clamp ограничивает значение диапазоном", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it("lerp интерполирует линейно", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(4, 8, 0.25)).toBe(5);
  });

  it("smoothstep даёт сглаженный 0..1 с плоскими краями", () => {
    expect(smoothstep(0, 1, 0)).toBe(0);
    expect(smoothstep(0, 1, 1)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 5);
    // значения за краями зажимаются
    expect(smoothstep(0, 1, -2)).toBe(0);
    expect(smoothstep(0, 1, 3)).toBe(1);
    // монотонно возрастает
    expect(smoothstep(0, 1, 0.25)).toBeLessThan(smoothstep(0, 1, 0.75));
  });

  it("easeOutCubic в границах 0 и 1", () => {
    expect(easeOutCubic(0)).toBeCloseTo(0, 6);
    expect(easeOutCubic(1)).toBeCloseTo(1, 6);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5); // ease-out обгоняет линейный
  });

  it("mapRange переносит значение между диапазонами", () => {
    expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
    expect(mapRange(0, 0, 10, -1, 1)).toBe(-1);
    expect(mapRange(10, 0, 10, -1, 1)).toBe(1);
  });

  it("pluralRu склоняет по русским правилам", () => {
    const f: [string, string, string] = ["проект", "проекта", "проектов"];
    expect(pluralRu(1, f)).toBe("проект");
    expect(pluralRu(2, f)).toBe("проекта");
    expect(pluralRu(4, f)).toBe("проекта");
    expect(pluralRu(5, f)).toBe("проектов");
    expect(pluralRu(11, f)).toBe("проектов"); // 11–14 — исключение
    expect(pluralRu(21, f)).toBe("проект");
    expect(pluralRu(22, f)).toBe("проекта");
    expect(pluralRu(25, f)).toBe("проектов");
  });
});

describe("mat4", () => {
  it("identity — единичная матрица 4x4", () => {
    const m = mat4Identity();
    expect(m.length).toBe(16);
    [0, 5, 10, 15].forEach((i) => expect(m[i]).toBe(1));
    [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14].forEach((i) => expect(m[i]).toBe(0));
  });

  it("умножение на identity не меняет матрицу", () => {
    const id = mat4Identity();
    const r = mat4RotationY(0.7);
    const a = mat4Multiply(r, id);
    const b = mat4Multiply(id, r);
    for (let i = 0; i < 16; i++) {
      expect(a[i]).toBeCloseTo(r[i], 6);
      expect(b[i]).toBeCloseTo(r[i], 6);
    }
  });

  it("perspective имеет ожидаемую структуру проекции", () => {
    const fov = Math.PI / 3; // 60°
    const aspect = 16 / 9;
    const near = 0.1;
    const far = 100;
    const m = mat4Perspective(fov, aspect, near, far);
    const f = 1 / Math.tan(fov / 2);
    expect(m[0]).toBeCloseTo(f / aspect, 5);
    expect(m[5]).toBeCloseTo(f, 5);
    expect(m[11]).toBe(-1); // перспективное деление
    expect(m[15]).toBe(0);
    expect(m[10]).toBeCloseTo((far + near) / (near - far), 5);
  });

  it("rotationY(0) == identity", () => {
    const m = mat4RotationY(0);
    const id = mat4Identity();
    for (let i = 0; i < 16; i++) expect(m[i]).toBeCloseTo(id[i], 6);
  });
});

describe("генераторы форм (point clouds)", () => {
  it("spherePoints возвращает n*3 чисел на заданном радиусе", () => {
    const n = 200;
    const radius = 1.4;
    const pts = spherePoints(n, radius);
    expect(pts.length).toBe(n * 3);
    for (let i = 0; i < n; i++) {
      const x = pts[i * 3];
      const y = pts[i * 3 + 1];
      const z = pts[i * 3 + 2];
      const r = Math.sqrt(x * x + y * y + z * z);
      expect(r).toBeCloseTo(radius, 4);
    }
  });

  it("torusPoints кладёт точки точно на трубу радиуса r", () => {
    const n = 200;
    const R = 0.9;
    const r = 0.32;
    const pts = torusPoints(n, R, r);
    expect(pts.length).toBe(n * 3);
    for (let i = 0; i < n; i++) {
      const x = pts[i * 3];
      const y = pts[i * 3 + 1];
      const z = pts[i * 3 + 2];
      const d = Math.sqrt((Math.sqrt(x * x + y * y) - R) ** 2 + z * z);
      expect(d).toBeCloseTo(r, 4);
    }
  });

  it("wavePoints держит точки в плоскости [-1,1] по X/Y", () => {
    const n = 256;
    const pts = wavePoints(n, 1);
    expect(pts.length).toBe(n * 3);
    for (let i = 0; i < n; i++) {
      expect(pts[i * 3]).toBeGreaterThanOrEqual(-1.001);
      expect(pts[i * 3]).toBeLessThanOrEqual(1.001);
      expect(pts[i * 3 + 1]).toBeGreaterThanOrEqual(-1.001);
      expect(pts[i * 3 + 1]).toBeLessThanOrEqual(1.001);
    }
  });
});

describe("magneticOffset", () => {
  const rect = { left: 100, top: 100, width: 200, height: 80 };
  it("в центре кнопки сдвиг равен нулю", () => {
    const o = magneticOffset(200, 140, rect, 0.4);
    expect(o.x).toBeCloseTo(0, 6);
    expect(o.y).toBeCloseTo(0, 6);
  });

  it("сдвиг пропорционален смещению курсора и силе", () => {
    const o = magneticOffset(250, 140, rect, 0.4);
    expect(o.x).toBeCloseTo(50 * 0.4, 6); // (250 - центр 200) * 0.4
    expect(o.y).toBeCloseTo(0, 6);
  });
});
