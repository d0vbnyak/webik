import { Link } from "react-router";
import Logo from "./Logo";
import { isVisible, type Section } from "../../shared/visibility";

// Скрытые разделы и услуги отфильтровываются — см. shared/visibility.ts
const PAGES = (
  [
    { to: "/about", label: "о нас", section: "about" },
    { to: "/templates", label: "шаблоны", section: "templates" },
    { to: "/capabilities", label: "возможности" },
    { to: "/prices", label: "цены" },
    { to: "/works", label: "другие работы", section: "works" },
  ] satisfies { to: string; label: string; section?: Section }[]
).filter(isVisible);

const SERVICES = (
  [
    { label: "создание сайтов", hidden: true },
    { label: "лендинги" },
    { label: "веб-дизайн", hidden: true },
    { label: "telegram и MAX боты" },
    { label: "seo-оптимизация", hidden: true },
    { label: "ai-агенты" },
    { label: "ai-колл-центр" },
    { label: "ai-контент и документы" },
  ] satisfies { label: string; hidden?: boolean }[]
).filter(isVisible);

export default function Footer() {
  return (
    <footer className="relative z-10 bg-bg-base border-t border-black/[0.06]">
      <div className="max-w-7xl mx-auto px-8 md:px-16 lg:px-20 py-12 md:py-16 grid grid-cols-12 gap-y-10 gap-x-4 md:gap-x-8">
        <div className="col-span-12 md:col-span-5">
          <Logo variant="white" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#1a1a1a]/60">
            AI-решения для бизнеса: боты, агенты, голосовые роботы и
            лендинги, которые приводят заявки.
          </p>
        </div>

        <div className="col-span-6 md:col-span-3">
          <div className="text-[11px] uppercase tracking-widest text-[#1a1a1a]/40 mb-4">
            страницы
          </div>
          <ul className="flex flex-col gap-2.5">
            {PAGES.map((p) => (
              <li key={p.to}>
                <Link
                  to={p.to}
                  className="text-sm lowercase text-[#1a1a1a]/70 hover:text-[#1a1a1a] transition-colors"
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-6 md:col-span-4">
          <div className="text-[11px] uppercase tracking-widest text-[#1a1a1a]/40 mb-4">
            услуги
          </div>
          <ul className="flex flex-col gap-2.5">
            {SERVICES.map((s) => (
              <li key={s.label} className="text-sm lowercase text-[#1a1a1a]/70">
                {s.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-8 border-t border-black/[0.06]">
          <span className="text-[11px] tracking-wide text-[#1a1a1a]/50">
            © 2026 WebIK — AI-решения для бизнеса
          </span>
          <a
            href="mailto:hello@webik.ru"
            className="text-[11px] tracking-wide text-[#1a1a1a]/50 hover:text-[#1a1a1a] transition-colors"
          >
            hello@webik.ru
          </a>
        </div>
      </div>
    </footer>
  );
}
