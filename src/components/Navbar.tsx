import { useState } from "react";
import { Link, NavLink } from "react-router";
import { motion, AnimatePresence } from "motion/react";

const NAV_LINKS = [
  { to: "/about", label: "о нас" },
  { to: "/templates", label: "шаблоны" },
  { to: "/capabilities", label: "возможности" },
  { to: "/works", label: "другие работы" },
];

export function CloverIcon({ className }: { className?: string }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="#1a1a1a"
      aria-hidden="true"
      className={className}
    >
      <ellipse cx="12" cy="5" rx="4" ry="5" />
      <ellipse cx="12" cy="19" rx="4" ry="5" />
      <ellipse cx="5" cy="12" rx="5" ry="4" />
      <ellipse cx="19" cy="12" rx="5" ry="4" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-xs lg:text-sm lowercase tracking-wide transition-colors whitespace-nowrap ${
    isActive ? "text-[#1a1a1a] font-medium" : "text-[#1a1a1a]/70 hover:text-[#1a1a1a]"
  }`;

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 w-full z-50 py-6 md:py-10 bg-gradient-to-b from-[#f1f1f1]/80 to-transparent backdrop-blur-[2px]">
      <div className="grid grid-cols-12 max-w-7xl mx-auto items-center px-8 md:px-16 lg:px-20 gap-x-4 md:gap-x-8">
        {/* Слева — бренд */}
        <Link to="/" className="col-span-6 md:col-span-3 flex items-center gap-2.5">
          <CloverIcon className="shrink-0" />
          <span className="font-display text-xl md:text-2xl font-medium tracking-tight text-[#1a1a1a]">
            WebIK
          </span>
        </Link>

        {/* Центр — навигация (desktop) */}
        <nav className="hidden md:flex col-span-6 items-center justify-center gap-6 lg:gap-9">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={desktopLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Справа — действия */}
        <div className="col-span-6 md:col-span-3 flex items-center justify-end gap-3 md:gap-5">
          <a
            href="mailto:hello@webik.ru"
            className="hidden lg:inline-block text-xs lg:text-sm lowercase tracking-wide text-[#1a1a1a]/70 hover:text-[#1a1a1a] transition-colors whitespace-nowrap"
          >
            связаться
          </a>
          <a
            href="mailto:hello@webik.ru"
            className="hidden sm:inline-flex items-center gap-2 bg-[#1a1a1a] text-white text-xs md:text-sm lowercase rounded-full px-5 py-2.5 hover:bg-black transition-colors whitespace-nowrap"
          >
            начать проект <span aria-hidden="true">→</span>
          </a>

          {/* Анимированный гамбургер — mobile */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Открыть меню"
            aria-expanded={open}
            className="md:hidden relative w-9 h-9 flex flex-col items-center justify-center gap-[5px]"
          >
            <motion.span
              animate={open ? { rotate: 45, y: 3.5 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="block w-5 h-[2px] bg-[#1a1a1a] rounded-full"
            />
            <motion.span
              animate={open ? { rotate: -45, y: -3.5 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="block w-5 h-[2px] bg-[#1a1a1a] rounded-full"
            />
          </button>
        </div>
      </div>

      {/* Мобильное меню */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="md:hidden absolute top-full left-0 w-full px-6 pb-6"
          >
            <div className="rounded-2xl bg-white/85 backdrop-blur-xl border border-black/[0.05] shadow-lg p-6 flex flex-col gap-4">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="text-sm lowercase tracking-wide text-[#1a1a1a]/80 hover:text-[#1a1a1a] transition-colors"
                >
                  {link.label}
                </NavLink>
              ))}
              <div className="h-px bg-black/[0.06]" />
              <a
                href="mailto:hello@webik.ru"
                onClick={() => setOpen(false)}
                className="text-sm lowercase tracking-wide text-[#1a1a1a]/80 hover:text-[#1a1a1a] transition-colors"
              >
                связаться
              </a>
              <a
                href="mailto:hello@webik.ru"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-2 bg-[#1a1a1a] text-white text-sm lowercase rounded-full px-5 py-3"
              >
                начать проект <span aria-hidden="true">→</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
