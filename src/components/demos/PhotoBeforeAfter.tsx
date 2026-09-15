import { useCallback, useId, useRef, useState } from "react";

/** «Тусклое» исходное фото: приглушённый закат, бледные холмы */
function DullPhoto({ gradId }: { gradId: string }) {
  return (
    <svg viewBox="0 0 480 240" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id={`${gradId}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b9b2a6" />
          <stop offset="100%" stopColor="#d7d0c4" />
        </linearGradient>
      </defs>
      <rect width="480" height="240" fill={`url(#${gradId}-sky)`} />
      <circle cx="350" cy="78" r="34" fill="#cabfa6" />
      <path d="M0 168 L120 124 L210 158 L320 118 L480 162 L480 240 L0 240 Z" fill="#9d9a8a" opacity="0.7" />
      <path d="M0 188 L150 150 L280 184 L400 150 L480 180 L480 240 L0 240 Z" fill="#86826f" opacity="0.7" />
      <rect width="480" height="240" fill="#7a7361" opacity="0.18" />
    </svg>
  );
}

/** «Обработанное» яркое фото: насыщенный закат, контрастные холмы */
function BrightPhoto({ gradId }: { gradId: string }) {
  return (
    <svg viewBox="0 0 480 240" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id={`${gradId}-sky2`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd6a5" />
          <stop offset="55%" stopColor="#ffadad" />
          <stop offset="100%" stopColor="#c7b9ff" />
        </linearGradient>
        <radialGradient id={`${gradId}-sun`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fffdf2" />
          <stop offset="100%" stopColor="#ffe7a3" />
        </radialGradient>
      </defs>
      <rect width="480" height="240" fill={`url(#${gradId}-sky2)`} />
      <circle cx="350" cy="78" r="34" fill={`url(#${gradId}-sun)`} />
      <path d="M0 168 L120 124 L210 158 L320 118 L480 162 L480 240 L0 240 Z" fill="#7d6fb0" />
      <path d="M0 188 L150 150 L280 184 L400 150 L480 180 L480 240 L0 240 Z" fill="#4a3f6b" />
    </svg>
  );
}

export default function PhotoBeforeAfter() {
  const uid = useId();
  const gradId = `pba-${uid}`;
  const frameRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, ratio)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    // Пальцем разделитель едет только за движением: касание в начале вертикальной
    // прокрутки страницы не должно дёргать его на место пальца
    if (e.pointerType === "mouse") updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    updateFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 4));
    if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 4));
  };

  return (
    <div
      ref={frameRef}
      className="relative h-[240px] w-full touch-pan-y select-none overflow-hidden rounded-xl border border-black/[0.05] shadow-sm"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <DullPhoto gradId={gradId} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <BrightPhoto gradId={gradId} />
      </div>

      {/* Линия-разделитель + перетаскиваемая ручка */}
      <div className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_0_1px_rgba(26,26,26,0.25)]" style={{ left: `${pos}%` }}>
        <button
          type="button"
          aria-label="Перетащите, чтобы сравнить было и стало"
          onKeyDown={onKeyDown}
          className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-[#1a1a1a] shadow-lg outline-none ring-brand-green focus-visible:ring-2"
        >
          <span className="text-[12px] leading-none">⇄</span>
        </button>
      </div>

      <span className="pointer-events-none absolute bottom-2 left-3 rounded-full bg-black/30 px-2 py-0.5 text-[10px] lowercase tracking-wide text-white/90">
        было
      </span>
      <span className="pointer-events-none absolute bottom-2 right-3 rounded-full bg-black/30 px-2 py-0.5 text-[10px] lowercase tracking-wide text-white/90">
        стало
      </span>
    </div>
  );
}
