import { useRef } from "react";
import { useCanvasLoop } from "./useCanvasLoop";

type Particle = { x: number; y: number; vx: number; vy: number };

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useCanvasLoop(canvasRef, (ctx, size) => {
    const canvas = ctx.canvas;
    const particles: Particle[] = Array.from({ length: 45 }, () => ({
      x: Math.random() * size.width,
      y: Math.random() * size.height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
    }));

    const mouse = { x: -1000, y: -1000 };
    // pointer-события покрывают и мышь, и палец на сенсоре
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerup", onLeave);
    canvas.addEventListener("pointercancel", onLeave);

    const frame = () => {
      const w = size.width;
      const h = size.height;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        // отталкивание от курсора
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 80 && dist > 0) {
          p.vx += (dx / dist) * 0.15;
          p.vy += (dy / dist) * 0.15;
        }
        p.vx = Math.max(-1.2, Math.min(1.2, p.vx));
        p.vy = Math.max(-1.2, Math.min(1.2, p.vy));
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      ctx.strokeStyle = "rgba(26,26,26,0.12)";
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 70) {
            ctx.globalAlpha = 1 - d / 70;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#1a1a1a";
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    return {
      frame,
      cleanup: () => {
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerdown", onMove);
        canvas.removeEventListener("pointerleave", onLeave);
        canvas.removeEventListener("pointerup", onLeave);
        canvas.removeEventListener("pointercancel", onLeave);
      },
    };
  });

  return (
    <div className="relative">
      {/* touch-pan-y: палец двигает частицы, но вертикальный скролл страницы сохраняется */}
      <canvas ref={canvasRef} className="w-full h-[240px] rounded-xl bg-white touch-pan-y" />
      <span className="absolute bottom-3 left-3 text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
        проведите курсором или пальцем
      </span>
    </div>
  );
}
