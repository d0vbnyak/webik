import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const SYMBOLS = ["🚀", "💡", "🎨", "🤖", "📈", "⚡", "🛠️", "🌐"] as const;

type Card = { id: number; symbol: string };

/** перемешивание в обработчике/эффекте (не на этапе модуля) */
function buildDeck(): Card[] {
  const deck: Card[] = SYMBOLS.flatMap((symbol, i) => [
    { id: i * 2, symbol },
    { id: i * 2 + 1, symbol },
  ]);
  // Фишер–Йейтс
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export default function MemoryGame() {
  const reduce = useReducedMotion();
  const [deck, setDeck] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]); // индексы открытых сейчас
  const [matched, setMatched] = useState<number[]>([]); // id найденных
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const mismatchTimer = useRef<number | null>(null);

  const reset = useCallback(() => {
    if (mismatchTimer.current !== null) {
      window.clearTimeout(mismatchTimer.current);
      mismatchTimer.current = null;
    }
    setDeck(buildDeck());
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setLocked(false);
  }, []);

  useEffect(() => {
    reset();
  }, [reset]);

  // Чистим висящий таймер несовпадения при размонтировании
  useEffect(() => {
    return () => {
      if (mismatchTimer.current !== null) {
        window.clearTimeout(mismatchTimer.current);
        mismatchTimer.current = null;
      }
    };
  }, []);

  const done = deck.length > 0 && matched.length === deck.length;

  const onFlip = (index: number) => {
    if (locked || flipped.includes(index) || matched.includes(deck[index].id))
      return;

    const next = [...flipped, index];
    setFlipped(next);

    if (next.length === 2) {
      setMoves((m) => m + 1);
      setLocked(true);
      const [a, b] = next;
      if (deck[a].symbol === deck[b].symbol) {
        setMatched((prev) => [...prev, deck[a].id, deck[b].id]);
        setFlipped([]);
        setLocked(false);
      } else {
        mismatchTimer.current = window.setTimeout(() => {
          setFlipped([]);
          setLocked(false);
          mismatchTimer.current = null;
        }, 750);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full max-w-[340px] items-center justify-between px-1">
        <span className="text-xs lowercase text-[#1a1a1a]/50">
          ходов: <b className="font-display text-[#1a1a1a]">{moves}</b>
        </span>
        {done ? (
          <motion.span
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-full bg-brand-green px-3 py-1 text-[10px] lowercase font-medium text-[#1a1a1a]"
          >
            готово! 🎉
          </motion.span>
        ) : (
          <span className="text-[10px] lowercase tracking-wide text-[#1a1a1a]/40">
            соберите пары
          </span>
        )}
      </div>

      <div className="grid w-full max-w-[340px] grid-cols-4 gap-2">
        {deck.map((card, i) => {
          const isOpen = flipped.includes(i) || matched.includes(card.id);
          const isMatched = matched.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onFlip(i)}
              aria-label={isOpen ? `карта ${card.symbol}` : "закрытая карта"}
              className="relative aspect-square w-full rounded-lg [transform-style:preserve-3d]"
              style={{ perspective: 600 }}
            >
              <motion.div
                className="relative h-full w-full [transform-style:preserve-3d]"
                animate={{ rotateY: isOpen ? 180 : 0 }}
                transition={{ duration: reduce ? 0 : 0.3 }}
              >
                {/* рубашка */}
                <span
                  className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#1a1a1a] text-white/70 [backface-visibility:hidden]"
                >
                  ?
                </span>
                {/* лицо */}
                <span
                  className={`absolute inset-0 flex items-center justify-center rounded-lg border text-xl [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                    isMatched
                      ? "border-brand-green bg-brand-green/20"
                      : "border-black/[0.05] bg-white"
                  }`}
                >
                  {card.symbol}
                </span>
              </motion.div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={reset}
        className="rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-xs lowercase text-[#1a1a1a]/70 transition-colors hover:border-black/20"
      >
        ↺ заново
      </button>
    </div>
  );
}
