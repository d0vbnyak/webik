import { Link } from "react-router";
import Logo from "./Logo";

const PAGES = [
  { to: "/about", label: "о нас" },
  { to: "/templates", label: "шаблоны" },
  { to: "/capabilities", label: "возможности" },
  { to: "/works", label: "другие работы" },
];

const SERVICES = [
  "создание сайтов",
  "веб-дизайн",
  "telegram и MAX боты",
  "seo-оптимизация",
  "ai-агенты",
  "ai-колл-центр",
];

export default function Footer() {
  return (
    <footer className="relative z-10 bg-bg-base border-t border-black/[0.06]">
      <div className="max-w-7xl mx-auto px-8 md:px-16 lg:px-20 py-12 md:py-16 grid grid-cols-12 gap-y-10 gap-x-4 md:gap-x-8">
        <div className="col-span-12 md:col-span-5">
          <Logo variant="white" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#1a1a1a]/60">
            Веб-студия полного цикла: сайты, дизайн, боты и AI-решения для
            вашего бизнеса.
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
              <li key={s} className="text-sm lowercase text-[#1a1a1a]/70">
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-8 border-t border-black/[0.06]">
          <span className="text-[11px] tracking-wide text-[#1a1a1a]/50">
            © 2026 WebIK — веб-студия и AI-решения
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
