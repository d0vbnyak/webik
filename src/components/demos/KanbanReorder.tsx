import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type ColId = "queue" | "work" | "done";

type Task = { id: number; text: string; color: string; col: ColId };

const COLUMNS: { id: ColId; title: string }[] = [
  { id: "queue", title: "очередь" },
  { id: "work", title: "в работе" },
  { id: "done", title: "готово" },
];

const ORDER: ColId[] = ["queue", "work", "done"];

const INITIAL: Task[] = [
  { id: 1, text: "макет главной", color: "#c7b9ff", col: "queue" },
  { id: 2, text: "вёрстка хедера", color: "#a5d8ff", col: "queue" },
  { id: 3, text: "анимации", color: "#ffd6a5", col: "work" },
  { id: 4, text: "интеграция api", color: "#ffadad", col: "work" },
  { id: 5, text: "деплой", color: "#caffbf", col: "done" },
];

export default function KanbanReorder() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL);
  // На тач-устройствах нативный motion-drag перехватывает вертикальный скролл
  // страницы — там полагаемся только на кнопки ← →.
  const [isTouch, setIsTouch] = useState(false);
  const colRefs = useRef<Record<ColId, HTMLDivElement | null>>({
    queue: null,
    work: null,
    done: null,
  });

  useEffect(() => {
    setIsTouch(
      typeof window !== "undefined" &&
        window.matchMedia("(pointer: coarse)").matches,
    );
  }, []);

  const move = (id: number, col: ColId) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, col } : t)));

  const step = (id: number, dir: -1 | 1) => {
    setTasks((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        const idx = ORDER.indexOf(t.col);
        const next = Math.max(0, Math.min(ORDER.length - 1, idx + dir));
        return { ...t, col: ORDER[next] };
      })
    );
  };

  // куда отпустили карточку — ближайшая по X колонка (drop в gap между
  // колонками не теряется, выбирается соседняя с минимальным расстоянием)
  const dropInto = (id: number, point: { x: number; y: number }) => {
    let nearest: ColId | null = null;
    let best = Infinity;
    for (const c of COLUMNS) {
      const el = colRefs.current[c.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      // расстояние от точки до интервала [left, right] колонки по X
      const dx =
        point.x < r.left
          ? r.left - point.x
          : point.x > r.right
            ? point.x - r.right
            : 0;
      if (dx < best) {
        best = dx;
        nearest = c.id;
      }
    }
    if (nearest) move(id, nearest);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-2">
        {COLUMNS.map((c) => {
          const items = tasks.filter((t) => t.col === c.id);
          return (
            <div
              key={c.id}
              ref={(el) => {
                colRefs.current[c.id] = el;
              }}
              className="flex flex-col rounded-xl bg-white border border-black/[0.05] shadow-sm p-2 min-h-[230px]"
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
                  {c.title}
                </span>
                <span className="text-[10px] text-[#1a1a1a]/30">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {items.map((t) => {
                    const idx = ORDER.indexOf(t.col);
                    return (
                      <motion.div
                        key={t.id}
                        layout
                        layoutId={`k-${t.id}`}
                        drag={isTouch ? false : true}
                        dragSnapToOrigin
                        onDragEnd={(_e, info) => dropInto(t.id, info.point)}
                        whileDrag={{ scale: 1.06, zIndex: 20, cursor: "grabbing" }}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 500, damping: 34 }}
                        style={{ backgroundColor: t.color }}
                        className={`rounded-lg px-2 py-2 shadow-sm select-none ${
                          isTouch ? "" : "cursor-grab touch-none"
                        }`}
                      >
                        <div className="text-[11px] font-medium text-[#1a1a1a] leading-tight">
                          {t.text}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <button
                            type="button"
                            aria-label="влево"
                            disabled={idx === 0}
                            onClick={() => step(t.id, -1)}
                            className="w-5 h-5 rounded-md bg-black/10 text-[#1a1a1a] text-[11px] leading-none flex items-center justify-center disabled:opacity-25 hover:bg-black/20 transition-colors"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            aria-label="вправо"
                            disabled={idx === ORDER.length - 1}
                            onClick={() => step(t.id, 1)}
                            className="w-5 h-5 rounded-md bg-black/10 text-[#1a1a1a] text-[11px] leading-none flex items-center justify-center disabled:opacity-25 hover:bg-black/20 transition-colors"
                          >
                            →
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
      <span className="mt-2 block text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
        {isTouch ? "жмите ← →" : "перетащите карточку или жмите ← →"}
      </span>
    </div>
  );
}
