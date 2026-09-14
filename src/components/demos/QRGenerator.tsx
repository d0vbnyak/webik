import { useDeferredValue, useId, useMemo, useState } from "react";

const SIZE = 25; // модулей в стороне (демо-матрица)

/** Простой детерминированный строковый хэш (xfnv-1a-подобный). */
function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // подмешиваем длину, чтобы пустая строка тоже давала паттерн
  h ^= text.length * 0x9e3779b1;
  return h >>> 0;
}

/** mulberry32 — воспроизводимый ГПСЧ из seed. */
function rng(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inFinder(r: number, c: number): boolean {
  // три «глаза» 7×7 в углах с защитной рамкой 8×8
  const corners: [number, number][] = [
    [0, 0],
    [0, SIZE - 7],
    [SIZE - 7, 0],
  ];
  for (const [fr, fc] of corners) {
    if (r >= fr - 1 && r <= fr + 7 && c >= fc - 1 && c <= fc + 7) return true;
  }
  return false;
}

function finderModule(r: number, c: number): boolean {
  const corners: [number, number][] = [
    [0, 0],
    [0, SIZE - 7],
    [SIZE - 7, 0],
  ];
  for (const [fr, fc] of corners) {
    if (r >= fr && r <= fr + 6 && c >= fc && c <= fc + 6) {
      const rr = r - fr;
      const cc = c - fc;
      const edge = rr === 0 || rr === 6 || cc === 0 || cc === 6;
      const core = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
      return edge || core; // рамка 7×7 + ядро 3×3
    }
  }
  return false;
}

function buildMatrix(text: string): boolean[][] {
  const rand = rng(seedFrom(text));
  const grid: boolean[][] = [];
  for (let r = 0; r < SIZE; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < SIZE; c++) {
      if (finderModule(r, c)) {
        row.push(true);
      } else if (inFinder(r, c)) {
        row.push(false); // защитная зона глаз
      } else if (r === 6 || c === 6) {
        // timing-линии — чередование
        row.push((r + c) % 2 === 0);
      } else {
        row.push(rand() > 0.5);
      }
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Собираем все включённые модули в одну d-строку <path> — вместо сотен <rect>.
 * Каждый модуль — относительный прямоугольник (M x y h … v … h … z).
 */
function buildPath(matrix: boolean[][], cell: number, pad: number): string {
  let d = "";
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    for (let c = 0; c < row.length; c++) {
      if (!row[c]) continue;
      const x = pad + c * cell;
      const y = pad + r * cell;
      d += `M${x} ${y}h${cell}v${cell}h-${cell}z`;
    }
  }
  return d;
}

export default function QRGenerator() {
  const [text, setText] = useState("webik.ru");
  const rawId = useId();
  const inputId = `qr-${rawId.replace(/:/g, "")}`;
  // ввод остаётся отзывчивым, тяжёлый пересчёт матрицы откладывается
  const deferredText = useDeferredValue(text);

  const cell = 4;
  const pad = 4;
  const dim = SIZE * cell + pad * 2;

  const path = useMemo(
    () => buildPath(buildMatrix(deferredText), cell, pad),
    [deferredText],
  );

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 w-full">
      <div className="rounded-xl bg-white border border-black/[0.05] shadow-sm p-3 shrink-0">
        <svg
          width={dim * 2}
          height={dim * 2}
          viewBox={`0 0 ${dim} ${dim}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label="демо-визуализация qr-кода"
          className="block w-40 h-40 sm:w-[216px] sm:h-[216px]"
        >
          <rect width={dim} height={dim} fill="#ffffff" />
          <path d={path} fill="#1a1a1a" />
        </svg>
      </div>

      <div className="w-full sm:flex-1 min-w-0">
        <label
          htmlFor={inputId}
          className="block text-[10px] lowercase tracking-wide text-[#1a1a1a]/40 mb-1.5"
        >
          текст или ссылка
        </label>
        <input
          id={inputId}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="webik.ru"
          className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#1a1a1a] outline-none focus:border-[#1a1a1a]/40 transition-colors"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["webik.ru", "лендинг за неделю", "+7 999 000-00-00"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setText(p)}
              className="text-[10px] lowercase rounded-full px-2.5 py-1 border border-black/[0.08] text-[#1a1a1a]/60 hover:border-black/20 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
          код меняется на лету. это демо-визуализация — не сканируется
        </p>
      </div>
    </div>
  );
}
