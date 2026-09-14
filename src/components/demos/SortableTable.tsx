import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

type Project = {
  id: string;
  name: string;
  days: number;
  budget: number;
};

const PROJECTS: Project[] = [
  { id: "r1", name: "лендинг кофейни", days: 7, budget: 65000 },
  { id: "r2", name: "ai-агент для заявок", days: 30, budget: 200000 },
  { id: "r3", name: "сценарный бот", days: 10, budget: 60000 },
  { id: "r4", name: "бот поддержки с ии", days: 21, budget: 120000 },
  { id: "r5", name: "голосовой робот", days: 21, budget: 90000 },
  { id: "r6", name: "ocr счетов в excel", days: 14, budget: 50000 },
  { id: "r7", name: "email-цепочка", days: 5, budget: 15000 },
];

type Key = keyof Omit<Project, "id">;
type Dir = "asc" | "desc";

// коллатор для строкового сравнения создаём один раз на модуль, не на каждый рендер
const collator = new Intl.Collator("ru");

const COLUMNS: { key: Key; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "проект", align: "left" },
  { key: "days", label: "срок, дн.", align: "right" },
  { key: "budget", label: "бюджет, ₽", align: "right" },
];

export default function SortableTable() {
  const reduce = useReducedMotion();
  const [sortKey, setSortKey] = useState<Key>("budget");
  const [dir, setDir] = useState<Dir>("desc");

  const sorted = useMemo(() => {
    const copy = [...PROJECTS];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      let cmp: number;
      if (typeof va === "number" && typeof vb === "number") {
        cmp = va - vb;
      } else {
        cmp = collator.compare(String(va), String(vb));
      }
      return dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [sortKey, dir]);

  const handleSort = (key: Key) => {
    if (key === sortKey) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDir("asc");
    }
  };

  const ariaSort = (key: Key): "ascending" | "descending" | "none" =>
    key === sortKey ? (dir === "asc" ? "ascending" : "descending") : "none";

  return (
    <div className="bg-white rounded-xl border border-black/[0.05] shadow-sm overflow-hidden">
      <div className="overflow-y-auto max-h-[260px]">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/[0.08]">
              {COLUMNS.map((col) => {
                const sortedBy = col.key === sortKey;
                return (
                  <th
                    key={col.key}
                    aria-sort={ariaSort(col.key)}
                    className={`p-0 ${col.align === "right" ? "text-right" : "text-left"}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={`w-full px-3 py-2.5 flex items-center gap-1 text-[10px] lowercase tracking-wide hover:text-[#1a1a1a] transition-colors ${
                        col.align === "right" ? "justify-end" : "justify-start"
                      } ${sortedBy ? "text-[#1a1a1a]" : "text-[#1a1a1a]/40"}`}
                    >
                      {col.label}
                      <span
                        aria-hidden="true"
                        className={`transition-opacity ${sortedBy ? "opacity-100 text-[#1a1a1a]" : "opacity-0"}`}
                      >
                        {dir === "asc" ? "↑" : "↓"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <motion.tr
                key={p.id}
                layout={reduce ? false : true}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="border-b border-black/[0.04] last:border-0"
              >
                <td className="px-3 py-2.5 text-[#1a1a1a]">{p.name}</td>
                <td className="px-3 py-2.5 text-right font-display tabular-nums text-[#1a1a1a]/70">
                  {p.days}
                </td>
                <td className="px-3 py-2.5 text-right font-display tabular-nums text-[#1a1a1a]">
                  {p.budget.toLocaleString("ru-RU")}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
