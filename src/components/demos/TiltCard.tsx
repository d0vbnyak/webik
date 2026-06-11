import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

export default function TiltCard() {
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(y, [0, 1], [12, -12]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(x, [0, 1], [-14, 14]), { stiffness: 200, damping: 20 });

  return (
    <div
      className="flex justify-center py-4"
      style={{ perspective: 700 }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - rect.left) / rect.width);
        y.set((e.clientY - rect.top) / rect.height);
      }}
      onMouseLeave={() => {
        x.set(0.5);
        y.set(0.5);
      }}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
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
            наведите курсор ↗
          </div>
        </div>
      </motion.div>
    </div>
  );
}
