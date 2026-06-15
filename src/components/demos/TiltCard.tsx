import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

export default function TiltCard() {
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(y, [0, 1], [12, -12]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(x, [0, 1], [-14, 14]), { stiffness: 200, damping: 20 });

  // курсор и палец отрабатываются одним кодом через pointer-события
  const track = (clientX: number, clientY: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    x.set((clientX - rect.left) / rect.width);
    y.set((clientY - rect.top) / rect.height);
  };
  const reset = () => {
    x.set(0.5);
    y.set(0.5);
  };

  return (
    <div className="flex justify-center py-4" style={{ perspective: 700 }}>
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d", touchAction: "none" }}
        onPointerMove={(e) => track(e.clientX, e.clientY, e.currentTarget)}
        onPointerDown={(e) => {
          // захват указателя — палец не «теряется» при выходе за карточку
          e.currentTarget.setPointerCapture(e.pointerId);
          track(e.clientX, e.clientY, e.currentTarget);
        }}
        onPointerUp={reset}
        onPointerCancel={reset}
        onPointerLeave={reset}
        className="w-56 rounded-2xl bg-[#1a1a1a] p-5 text-white shadow-xl"
      >
        <div style={{ transform: "translateZ(30px)" }}>
          <div className="w-8 h-8 rounded-full bg-brand-green flex items-center justify-center text-[#1a1a1a] text-sm font-bold">
            ✦
          </div>
          <div className="mt-4 font-display font-medium">Тариф «Бизнес»</div>
          <div className="mt-1 text-xs text-white/50">сайт + бот + SEO</div>
          <div className="mt-4 text-2xl font-display font-medium">
            89 000 ₽
          </div>
          <div className="mt-3 inline-block text-[10px] lowercase tracking-wide rounded-full bg-white/10 px-2.5 py-1">
            наведите или коснитесь ↗
          </div>
        </div>
      </motion.div>
    </div>
  );
}
