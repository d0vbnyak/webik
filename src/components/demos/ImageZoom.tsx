import { useId, useRef, useState } from "react";

const ZOOM = 2.4;
const LENS = 96; // диаметр лупы для мыши, px
const LENS_TOUCH = 120; // на сенсоре лупа крупнее — лучше видно
const FINGER_GAP = 26; // зазор: лупу поднимаем над пальцем на эту высоту

/** Детализированная «фото-сцена»: витрина с мелким товаром и подписями */
function Scene({ gradId }: { gradId: string }) {
  const swatches = ["#c7b9ff", "#ffd6a5", "#a5d8ff", "#ffadad", "#caffbf", "#fdffb6"];
  return (
    <svg viewBox="0 0 480 280" preserveAspectRatio="xMidYMid slice" className="block h-full w-full">
      <defs>
        <linearGradient id={`${gradId}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4f4f7" />
          <stop offset="100%" stopColor="#e3e4ec" />
        </linearGradient>
      </defs>
      <rect width="480" height="280" fill={`url(#${gradId}-bg)`} />

      {/* витрина 3×2 с мелкими деталями */}
      {swatches.map((c, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 30 + col * 150;
        const y = 28 + row * 120;
        return (
          <g key={i}>
            <rect x={x} y={y} width="124" height="98" rx="10" fill="#ffffff" stroke="#1a1a1a" strokeOpacity="0.06" />
            <circle cx={x + 38} cy={y + 38} r="22" fill={c} />
            <circle cx={x + 38} cy={y + 38} r="9" fill="#ffffff" opacity="0.5" />
            {/* мелкий текст-детали, ради которых нужен зум */}
            <rect x={x + 70} y={y + 24} width="42" height="5" rx="2.5" fill="#1a1a1a" opacity="0.7" />
            <rect x={x + 70} y={y + 34} width="32" height="4" rx="2" fill="#1a1a1a" opacity="0.3" />
            <rect x={x + 70} y={y + 42} width="38" height="4" rx="2" fill="#1a1a1a" opacity="0.3" />
            <text x={x + 14} y={y + 84} fontSize="9" fill="#1a1a1a" fillOpacity="0.55" fontFamily="sans-serif">
              артикул {1000 + i * 7}
            </text>
            <circle cx={x + 108} cy={y + 80} r="6" fill="#9fff00" />
          </g>
        );
      })}
    </svg>
  );
}

export default function ImageZoom() {
  const uid = useId();
  const gradId = `iz-${uid}`;
  const boxRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [lifted, setLifted] = useState(false); // палец/перо → лупу поднимаем над касанием
  const [pt, setPt] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const move = (clientX: number, clientY: number) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, clientX - r.left));
    const y = Math.max(0, Math.min(r.height, clientY - r.top));
    setPt({ x, y, w: r.width, h: r.height });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setLifted(e.pointerType !== "mouse");
    setActive(true);
    move(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || active) {
      setLifted(e.pointerType !== "mouse");
      move(e.clientX, e.clientY);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setActive(false);
  };

  // на сенсоре лупа крупнее
  const lens = lifted ? LENS_TOUCH : LENS;
  // увеличенная сцена позиционируется так, чтобы точка касания была В ЦЕНТРЕ лупы
  const bigW = pt.w * ZOOM;
  const bigH = pt.h * ZOOM;
  const bigLeft = lens / 2 - pt.x * ZOOM;
  const bigTop = lens / 2 - pt.y * ZOOM;

  // положение самой лупы: для мыши — под курсором; для пальца — приподнята над ним
  let lensLeft = pt.x - lens / 2;
  let lensTop = pt.y - lens / 2;
  if (lifted) {
    lensTop = pt.y - lens - FINGER_GAP; // поднимаем над пальцем
    if (lensTop < 4) lensTop = pt.y + FINGER_GAP; // у верхнего края — показываем под пальцем
    lensLeft = Math.max(4, Math.min(pt.w - lens - 4, lensLeft)); // держим в пределах кадра
  }

  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      className="relative h-[240px] w-full touch-none cursor-crosshair select-none overflow-hidden rounded-xl border border-black/[0.05] shadow-sm"
    >
      <Scene gradId={gradId} />

      {/* Лупа */}
      {active && pt.w > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 overflow-hidden rounded-full border-2 border-white shadow-xl"
          style={{
            width: lens,
            height: lens,
            left: lensLeft,
            top: lensTop,
          }}
        >
          <div style={{ position: "absolute", left: bigLeft, top: bigTop, width: bigW, height: bigH }}>
            <Scene gradId={`${gradId}-zoom`} />
          </div>
          <div className="absolute inset-0 rounded-full ring-1 ring-black/10" />
        </div>
      )}

      <span className="pointer-events-none absolute bottom-2 left-3 rounded-full bg-black/25 px-2 py-0.5 text-[10px] lowercase tracking-wide text-white/90">
        наведите или коснитесь для зума
      </span>
    </div>
  );
}
