import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "motion/react";

// Цифры — замеры на демо-кейсах WebIK, а не выдуманные «довольные клиенты»
const STATS = [
  { target: 14, suffix: "", label: "заявок разбирается за 30 секунд" },
  { target: 8, suffix: " сек", label: "на счёт от фото до таблицы" },
  { target: 24, suffix: "/7", label: "отвечает ai-бот" },
];

function Counter({ target, suffix, label }: (typeof STATS)[number]) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, target, {
      duration: 1.6,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, target]);

  return (
    <div ref={ref} className="bg-white rounded-xl border border-black/[0.05] p-4 text-center">
      <div className="font-display font-medium text-2xl md:text-3xl text-[#1a1a1a]">
        {value}
        <span className="text-brand-green [text-shadow:0_0_1px_#1a1a1a]">{suffix}</span>
      </div>
      <div className="mt-1.5 text-[11px] lowercase text-[#1a1a1a]/50">{label}</div>
    </div>
  );
}

export default function StatsCounter() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 py-6">
      {STATS.map((stat) => (
        <Counter key={stat.label} {...stat} />
      ))}
    </div>
  );
}
