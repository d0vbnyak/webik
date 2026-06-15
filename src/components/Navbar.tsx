import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import Logo from "./Logo";

const MOBILE_MENU_ID = "mobile-nav-panel";

const NAV_LINKS = [
  { to: "/about", label: "о нас" },
  { to: "/templates", label: "шаблоны" },
  { to: "/capabilities", label: "возможности" },
  { to: "/works", label: "другие работы" },
];

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-xs lg:text-sm lowercase tracking-wide transition-colors whitespace-nowrap ${
    isActive ? "text-[#1a1a1a] font-medium" : "text-[#1a1a1a]/70 hover:text-[#1a1a1a]"
  }`;

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Закрытие по Escape + фокус-менеджмент (фокус-трап) при открытом меню
  useEffect(() => {
    if (!open) return;

    // Переводим фокус на первую интерактивную ссылку панели
    const focusables = () =>
      panelRef.current
        ? Array.from(
            panelRef.current.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled])',
            ),
          )
        : [];

    focusables()[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (e.key === "Tab") {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !panelRef.current?.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // При закрытии возвращаем фокус на кнопку-гамбургер
  const closeMenu = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 py-6 md:py-10 bg-gradient-to-b from-[#f1f1f1]/80 to-transparent backdrop-blur-[2px]">
      <div className="grid grid-cols-12 max-w-7xl mx-auto items-center px-8 md:px-16 lg:px-20 gap-x-4 md:gap-x-8">
        {/* Слева — бренд */}
        <Logo className="col-span-6 md:col-span-3" />

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
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            aria-controls={MOBILE_MENU_ID}
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
          <>
            {/* Полупрозрачный backdrop-оверлей — закрытие кликом по фону */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={closeMenu}
              aria-hidden="true"
              className="md:hidden fixed inset-0 top-full -z-[1] bg-black/20"
            />
            <motion.div
              ref={panelRef}
              id={MOBILE_MENU_ID}
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
                    onClick={closeMenu}
                    className="text-sm lowercase tracking-wide text-[#1a1a1a]/80 hover:text-[#1a1a1a] transition-colors"
                  >
                    {link.label}
                  </NavLink>
                ))}
                <div className="h-px bg-black/[0.06]" />
                <a
                  href="mailto:hello@webik.ru"
                  onClick={closeMenu}
                  className="text-sm lowercase tracking-wide text-[#1a1a1a]/80 hover:text-[#1a1a1a] transition-colors"
                >
                  связаться
                </a>
                <a
                  href="mailto:hello@webik.ru"
                  onClick={closeMenu}
                  className="inline-flex items-center justify-center gap-2 bg-[#1a1a1a] text-white text-sm lowercase rounded-full px-5 py-3"
                >
                  начать проект <span aria-hidden="true">→</span>
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
