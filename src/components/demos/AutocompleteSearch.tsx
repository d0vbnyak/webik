import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const SERVICES = [
  "ai-агент для бизнеса",
  "голосовой робот",
  "лендинг под ключ",
  "транскрибация встреч",
  "telegram-бот",
  "чат-бот поддержки",
  "скоринг лидов",
  "ai-аватар для видео",
  "ocr-оцифровка документов",
  "анализ договоров",
  "генерация изображений",
  "ведение канала",
  "поддержка лендинга",
  "интеграция с crm",
  "копирайтинг",
  "парсинг и дашборды",
  "анализ отзывов",
  "автогенерация кп",
];

/** Подсветка совпавшей части подсказки */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold bg-brand-green/40 rounded-sm">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function AutocompleteSearch() {
  const uid = useId();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SERVICES;
    return SERVICES.filter((s) => s.toLowerCase().includes(q));
  }, [query]);

  const choose = (value: string) => {
    setQuery(value);
    setOpen(false);
    setHighlighted(0);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (matches.length ? (h + 1) % matches.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) =>
        matches.length ? (h - 1 + matches.length) % matches.length : 0,
      );
    } else if (e.key === "Enter") {
      if (open && matches[highlighted]) {
        e.preventDefault();
        choose(matches[highlighted]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const listId = `${uid}-list`;
  const optionId = (i: number) => `${uid}-opt-${i}`;

  // прокручиваем подсвеченный пункт в видимую зону при навигации стрелками
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLLIElement>(
      `#${CSS.escape(optionId(highlighted))}`,
    );
    el?.scrollIntoView({ block: "nearest" });
    // optionId стабилен и зависит только от uid — пересчёт по highlighted/open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted, open]);

  return (
    <div className="space-y-2">
      <span className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
        какая услуга вам нужна?
      </span>

      <div className="relative">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1a1a1a]/40 pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && matches[highlighted] ? optionId(highlighted) : undefined
            }
            value={query}
            placeholder="начните вводить…"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setHighlighted(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKeyDown}
            className="w-full bg-white rounded-xl border border-black/[0.08] shadow-sm pl-9 pr-3 py-2.5 text-[13px] text-[#1a1a1a] placeholder:text-[#1a1a1a]/30 outline-none focus:border-[#1a1a1a]/30 transition-colors"
          />
        </div>

        <AnimatePresence>
          {open && (
            <motion.ul
              ref={listRef}
              id={listId}
              role="listbox"
              initial={reduce ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute z-10 left-0 right-0 mt-1.5 max-h-[160px] overflow-y-auto bg-white rounded-xl border border-black/[0.08] shadow-md py-1"
            >
              {matches.length === 0 ? (
                <li className="px-3 py-2 text-[12px] text-[#1a1a1a]/40 lowercase">
                  ничего не нашлось
                </li>
              ) : (
                matches.map((s, i) => {
                  const isHi = i === highlighted;
                  return (
                    <li
                      key={s}
                      id={optionId(i)}
                      role="option"
                      aria-selected={isHi}
                      onMouseEnter={() => setHighlighted(i)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        choose(s);
                      }}
                      className={`px-3 py-2 text-[13px] cursor-pointer lowercase transition-colors ${
                        isHi ? "bg-[#1a1a1a]/[0.06] text-[#1a1a1a]" : "text-[#1a1a1a]/75"
                      }`}
                    >
                      <Highlight text={s} query={query} />
                    </li>
                  );
                })
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      <p className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
        стрелки ↑↓ — навигация · enter — выбрать · esc — закрыть
      </p>
    </div>
  );
}
