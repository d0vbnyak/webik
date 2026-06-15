import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

const W = 320;
const H = 170;
const PRIZE = "промокод WEBIK15";
const SUBTITLE = "−15% на разработку сайта";
const REVEAL_THRESHOLD = 0.5; // 50% стёрто → авто-дораскрытие

// Поведение кисти
const BRUSH_R = 26; // радиус мягкого ядра
const LAG = 0.18; // отставание: кисть догоняет палец на 18% за кадр
const SPACING = 6; // шаг штамповки вдоль траектории (без дырок на свайпе)
const SPRAY = 6; // капель рассеивания на штамп

type Pointer = { x: number; y: number; down: boolean };

/** Мягкая кисть-спрайт: радиальная альфа от центра к краю (для destination-out). */
function makeBrush(size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (g) {
    const r = size / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(0.45, "rgba(0,0,0,0.65)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return c;
}

export default function ScratchCard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const brushSprite = useRef<HTMLCanvasElement | null>(null);
  const sampleCanvas = useRef<HTMLCanvasElement | null>(null); // даунскейл для подсчёта стёртого
  const pointer = useRef<Pointer>({ x: 0, y: 0, down: false });
  const brush = useRef({ x: 0, y: 0, init: false });
  const rafRef = useRef(0);
  const frame = useRef(0);
  const [revealed, setRevealed] = useState(false);
  const [nonce, setNonce] = useState(0); // сброс карты

  // (пере)рисовать серебристый слой
  const paintCover = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#c9ccd6");
    grad.addColorStop(0.5, "#a7abb8");
    grad.addColorStop(1, "#cfd2db");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // лёгкая «крошка» для фактуры
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 90; i++) {
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }

    ctx.fillStyle = "rgba(26,26,26,0.4)";
    ctx.font = "600 13px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("сотрите защитный слой", W / 2, H / 2);
  }, []);

  useEffect(() => {
    brushSprite.current ??= makeBrush(64);
    paintCover();
    setRevealed(false);
    brush.current.init = false;
    pointer.current.down = false;
    frame.current = 0;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [paintCover, nonce]);

  // Даунскейл-замер: ужимаем слой в маленький буфер ~64×34 и считаем альфу там.
  // getImageData по крошечной площади дёшев и не зависит от DPR/размера канваса.
  const SAMPLE_W = 64;
  const SAMPLE_H = Math.round((SAMPLE_W * H) / W);
  const erasedRatio = (canvas: HTMLCanvasElement) => {
    let s = sampleCanvas.current;
    if (!s) {
      s = document.createElement("canvas");
      s.width = SAMPLE_W;
      s.height = SAMPLE_H;
      sampleCanvas.current = s;
    }
    const sctx = s.getContext("2d");
    if (!sctx) return 0;
    sctx.clearRect(0, 0, SAMPLE_W, SAMPLE_H);
    sctx.drawImage(canvas, 0, 0, SAMPLE_W, SAMPLE_H);
    const { data } = sctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
    let clear = 0;
    let total = 0;
    // каждый пиксель уменьшенной копии по альфа-каналу; мягкая кисть → считаем полупрозрачное
    for (let i = 3; i < data.length; i += 4) {
      total++;
      if (data[i] < 120) clear++;
    }
    return total ? clear / total : 0;
  };

  /** Один мягкий «отпечаток» + рассеивание мелкими каплями вокруг. */
  const stamp = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const sprite = brushSprite.current;
    if (!sprite) return;
    ctx.globalCompositeOperation = "destination-out";
    // мягкое ядро
    ctx.globalAlpha = 0.85;
    ctx.drawImage(sprite, x - BRUSH_R, y - BRUSH_R, BRUSH_R * 2, BRUSH_R * 2);
    // рассеивание: разбросанные полупрозрачные капельки по краю
    for (let i = 0; i < SPRAY; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = BRUSH_R * (0.45 + Math.random() * 0.95);
      const rr = 4 + Math.random() * 8;
      ctx.globalAlpha = 0.18 + Math.random() * 0.22;
      ctx.drawImage(sprite, x + Math.cos(a) * d - rr, y + Math.sin(a) * d - rr, rr * 2, rr * 2);
    }
    ctx.globalAlpha = 1;
  };

  /** Штамповка по отрезку — без дырок при быстром движении. */
  const stampSegment = (
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(1, Math.floor(Math.hypot(dx, dy) / SPACING));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      stamp(ctx, x0 + dx * t, y0 + dy * t);
    }
  };

  const finishReveal = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setRevealed(true);
  };

  const tick = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) {
      rafRef.current = 0;
      return;
    }
    const p = pointer.current;
    const b = brush.current;

    // отставание: кисть плавно тянется к пальцу
    const px = b.x;
    const py = b.y;
    b.x += (p.x - b.x) * LAG;
    b.y += (p.y - b.y) * LAG;
    stampSegment(ctx, px, py, b.x, b.y);

    frame.current++;
    if (frame.current % 12 === 0 && erasedRatio(canvas) >= REVEAL_THRESHOLD) {
      rafRef.current = 0;
      finishReveal(ctx, canvas);
      return;
    }

    const settled = Math.hypot(p.x - b.x, p.y - b.y) < 0.6;
    if (p.down || !settled) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      // палец отпущен и кисть догнала — финальная проверка
      rafRef.current = 0;
      if (erasedRatio(canvas) >= REVEAL_THRESHOLD) finishReveal(ctx, canvas);
    }
  }, []);

  const localPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (revealed) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = localPoint(e);
    pointer.current = { x, y, down: true };
    // снап кисти к точке касания — без соединительной полосы между касаниями
    brush.current = { x, y, init: true };
    const ctx = ctxRef.current;
    if (ctx) stamp(ctx, x, y);
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointer.current.down || revealed) return;
    const { x, y } = localPoint(e);
    pointer.current.x = x;
    pointer.current.y = y;
  };

  const onUp = () => {
    pointer.current.down = false; // rAF доведёт отставание и проверит раскрытие
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-[320px] aspect-[32/17] rounded-xl overflow-hidden border border-black/[0.05] shadow-sm select-none">
        {/* Приз под слоем */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white gap-1">
          <span className="text-2xl">🎁</span>
          <span className="font-display font-medium text-lg text-[#1a1a1a]">
            {PRIZE}
          </span>
          <span className="text-[11px] text-[#1a1a1a]/50">{SUBTITLE}</span>
          {revealed && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mt-1 rounded-full bg-brand-green px-3 py-1 text-[10px] lowercase font-medium text-[#1a1a1a]"
            >
              вы выиграли!
            </motion.span>
          )}
        </div>

        {/* Стираемый слой */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
          style={{ pointerEvents: revealed ? "none" : "auto" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label="Скретч-карта: сотрите слой, чтобы увидеть приз"
        />
      </div>

      <button
        type="button"
        onClick={() => setNonce((n) => n + 1)}
        className="rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-xs lowercase text-[#1a1a1a]/70 transition-colors hover:border-black/20"
      >
        ↺ стереть ещё раз
      </button>
    </div>
  );
}
