import { useEffect, useState } from "react";
import { motion } from "motion/react";

const PHRASES = [
  "лендинги под ключ",
  "telegram-боты",
  "ai-агенты для бизнеса",
  "обработка документов",
  "ai-колл-центр",
];

export default function Typewriter() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [length, setLength] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const phrase = PHRASES[phraseIndex];
    const delay = deleting ? 40 : length === phrase.length ? 1400 : 80;

    const timer = setTimeout(() => {
      if (!deleting) {
        if (length < phrase.length) setLength(length + 1);
        else setDeleting(true);
      } else {
        if (length > 0) setLength(length - 1);
        else {
          setDeleting(false);
          setPhraseIndex((i) => (i + 1) % PHRASES.length);
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [length, deleting, phraseIndex]);

  return (
    <div className="py-8 text-center">
      <div className="text-xs lowercase tracking-widest text-[#1a1a1a]/40 mb-3">
        мы делаем
      </div>
      <div className="font-display font-medium text-2xl md:text-3xl text-[#1a1a1a] min-h-[44px]">
        {PHRASES[phraseIndex].slice(0, length)}
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.9, repeat: Infinity }}
          className="inline-block w-[3px] h-[1em] bg-[#1a1a1a] align-middle ml-1 rounded-[1px]"
        />
      </div>
    </div>
  );
}
