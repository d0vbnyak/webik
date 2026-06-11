import { useState } from "react";
import { motion } from "motion/react";

export default function ThemeSwitch() {
  const [dark, setDark] = useState(false);

  return (
    <div
      className={`rounded-xl border p-5 transition-colors duration-500 ${
        dark ? "bg-[#16161a] border-white/10" : "bg-white border-black/[0.05]"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs lowercase tracking-wide transition-colors duration-500 ${
            dark ? "text-white/50" : "text-[#1a1a1a]/50"
          }`}
        >
          {dark ? "тёмная тема" : "светлая тема"}
        </span>
        <button
          type="button"
          onClick={() => setDark((v) => !v)}
          aria-label="Переключить тему"
          className={`w-12 h-7 rounded-full p-1 flex transition-colors duration-500 ${
            dark ? "bg-brand-green justify-end" : "bg-zinc-200 justify-start"
          }`}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="w-5 h-5 rounded-full bg-white shadow"
          />
        </button>
      </div>

      {/* Мини-профиль */}
      <div className="mt-5 flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center font-display font-medium text-sm transition-colors duration-500 ${
            dark ? "bg-brand-green text-[#1a1a1a]" : "bg-bg-base text-[#1a1a1a]"
          }`}
        >
          ВК
        </div>
        <div>
          <div
            className={`text-sm font-medium transition-colors duration-500 ${
              dark ? "text-white" : "text-[#1a1a1a]"
            }`}
          >
            WebIK Studio
          </div>
          <div
            className={`text-[11px] transition-colors duration-500 ${
              dark ? "text-white/40" : "text-[#1a1a1a]/45"
            }`}
          >
            дизайн-система с тёмной темой
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {["сайт", "бот", "seo"].map((t) => (
          <div
            key={t}
            className={`rounded-lg px-2 py-2.5 text-center text-[11px] lowercase transition-colors duration-500 ${
              dark
                ? "bg-white/[0.06] text-white/70"
                : "bg-bg-base text-[#1a1a1a]/70"
            }`}
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}
