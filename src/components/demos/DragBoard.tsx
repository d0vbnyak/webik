import { useRef } from "react";
import { motion } from "motion/react";

const STICKERS = [
  { text: "сайт", color: "#9fff00", rotate: -4 },
  { text: "бот", color: "#c7b9ff", rotate: 3 },
  { text: "seo", color: "#ffd6a5", rotate: -2 },
  { text: "ai", color: "#a5d8ff", rotate: 5 },
];

export default function DragBoard() {
  const boardRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={boardRef}
      className="relative h-[240px] rounded-xl bg-white border border-dashed border-black/15 overflow-hidden"
    >
      <span className="absolute top-3 left-3 text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
        перетащите стикеры
      </span>
      <div className="absolute inset-0 flex items-center justify-center gap-3 flex-wrap p-8">
        {STICKERS.map((s) => (
          <motion.div
            key={s.text}
            drag
            dragConstraints={boardRef}
            dragElastic={0.15}
            whileDrag={{ scale: 1.12, zIndex: 10 }}
            whileHover={{ scale: 1.05 }}
            initial={{ rotate: s.rotate }}
            style={{ backgroundColor: s.color }}
            className="w-16 h-16 rounded-2xl shadow-md flex items-center justify-center font-display font-medium text-sm text-[#1a1a1a] cursor-grab active:cursor-grabbing select-none"
          >
            {s.text}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
