import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

type Dot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  green: boolean;
};

export default function ParticleCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const W = () => canvas.getBoundingClientRect().width;
    const H = () => canvas.getBoundingClientRect().height;

    const resize = () => {
      const width = W();
      const height = H();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // клампим частицы в новые границы, чтобы они не «застряли» за кадром
      for (const d of dots) {
        if (d.x < 0) d.x = 0;
        else if (d.x > width) d.x = width;
        if (d.y < 0) d.y = 0;
        else if (d.y > height) d.y = height;
      }
    };

    // спрайт-градиент частицы: рисуем один раз в офскрин-canvas, далее drawImage
    const SPRITE = 64; // px стороны спрайта (радиус = SPRITE/2)
    const makeSprite = (core: string) => {
      const s = document.createElement("canvas");
      s.width = s.height = SPRITE;
      const sctx = s.getContext("2d");
      if (sctx) {
        const r = SPRITE / 2;
        const grad = sctx.createRadialGradient(r, r, 0, r, r, r);
        grad.addColorStop(0, `rgba(${core},1)`);
        grad.addColorStop(1, `rgba(${core},0)`);
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, SPRITE, SPRITE);
      }
      return s;
    };
    const spriteDark = makeSprite("26,26,26");
    const spriteGreen = makeSprite("159,255,0");

    const dots: Dot[] = Array.from({ length: 90 }, () => ({
      x: Math.random() * W(),
      y: Math.random() * H(),
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: 0.8 + Math.random() * 2.4,
      alpha: 0.2 + Math.random() * 0.5,
      green: Math.random() < 0.12,
    }));

    resize();

    // воронка по умолчанию в центре
    const pointer = { x: W() / 2, y: H() / 2, active: false };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
      pointer.x = W() / 2;
      pointer.y = H() / 2;
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", resize);

    let raf = 0;
    const tick = () => {
      const w = W();
      const h = H();
      ctx.clearRect(0, 0, w, h);

      const pull = pointer.active ? 1 : 0.35;

      for (const d of dots) {
        const dx = pointer.x - d.x;
        const dy = pointer.y - d.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const nx = dx / dist;
        const ny = dy / dist;

        if (!reduce) {
          // притяжение к курсору (гравитация)
          const grav = Math.min(0.06, 40 / (dist * dist)) * pull;
          d.vx += nx * grav;
          d.vy += ny * grav;
          // закручивание — тангенциальная составляющая
          const swirl = (dist < 130 ? 0.05 : 0.012) * pull;
          d.vx += -ny * swirl;
          d.vy += nx * swirl;
        }

        d.vx *= 0.94;
        d.vy *= 0.94;
        d.x += d.vx;
        d.y += d.vy;

        // мягкий возврат в поле при вылете
        if (d.x < -10) d.x = w + 10;
        if (d.x > w + 10) d.x = -10;
        if (d.y < -10) d.y = h + 10;
        if (d.y > h + 10) d.y = -10;

        // рисуем закэшированный спрайт, масштабируя по радиусу (drawImage дёшев)
        const size = d.r * 6; // d.r * 3 — радиус свечения, *2 — диаметр спрайта
        ctx.globalAlpha = d.alpha;
        ctx.drawImage(
          d.green ? spriteGreen : spriteDark,
          d.x - size / 2,
          d.y - size / 2,
          size,
          size,
        );
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
    };
  }, [reduce]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full h-[240px] rounded-xl bg-white touch-none"
      />
      <span className="absolute bottom-3 left-3 text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
        наведите — частицы притянутся
      </span>
    </div>
  );
}
