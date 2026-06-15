import { useEffect, useRef, useState } from "react";

export default function SignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;

    const dpr = window.devicePixelRatio || 1;
    const setup = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#1a1a1a";
    };
    setup();

    // запоминаем текущую ширину, чтобы игнорировать ресайзы только по высоте
    // (показ/скрытие URL-бара на мобильных меняет высоту вьюпорта, не ширину)
    let lastWidth = canvas.getBoundingClientRect().width;
    let debounceId: number | undefined;

    const redraw = () => {
      // не перерисовываем во время штриха — иначе мигание и обрыв линии
      if (drawing.current) return;
      const { width } = canvas.getBoundingClientRect();
      // ширина не изменилась — перерисовка не нужна
      if (width === lastWidth) return;
      lastWidth = width;
      // сохраняем рисунок при ресайзе
      const snapshot = canvas.toDataURL();
      const img = new Image();
      img.onload = () => {
        setup();
        const r = canvas.getBoundingClientRect();
        ctx.drawImage(img, 0, 0, r.width, r.height);
      };
      img.src = snapshot;
    };

    const onResize = () => {
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(redraw, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(debounceId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ctxRef.current;
    const prev = last.current;
    if (!ctx || !prev) return;
    const p = pos(e);
    // сглаживание квадратичной кривой через середину отрезка
    const mid = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
    ctx.stroke();
    last.current = p;
    if (empty) setEmpty(false);
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = false;
    last.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    setEmpty(true);
  };

  return (
    <div className="w-full">
      <div className="relative rounded-xl bg-white border border-black/[0.05] shadow-sm overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="w-full h-[200px] touch-none cursor-crosshair block"
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] lowercase tracking-wide text-[#1a1a1a]/30">
            распишитесь здесь
          </span>
        )}
        {/* линия-плашка «подпись» */}
        <div className="pointer-events-none absolute bottom-7 left-6 right-6 border-t border-dashed border-black/15" />
        <span className="pointer-events-none absolute bottom-2 left-6 text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
          подпись
        </span>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={clear}
          disabled={empty}
          className="text-[11px] lowercase rounded-full px-3.5 py-1.5 border border-black/[0.08] text-[#1a1a1a]/70 hover:border-black/20 disabled:opacity-30 transition-colors"
        >
          очистить
        </button>
      </div>
    </div>
  );
}
