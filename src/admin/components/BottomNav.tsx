import { NavLink } from "react-router";
import type { ReactNode } from "react";

type Item = { to: string; label: string; end?: boolean; icon: ReactNode };

// Иконки — inline-SVG (без сторонних зависимостей), 22×22, stroke=currentColor.
const ic = (path: ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

const NAV: Item[] = [
  { to: "/admin", end: true, label: "Дашборд", icon: ic(<><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></>) },
  { to: "/admin/incomes", label: "Доходы", icon: ic(<><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></>) },
  { to: "/admin/expenses", label: "Расходы", icon: ic(<><path d="M12 5v14" /><path d="M19 12l-7 7-7-7" /></>) },
  { to: "/admin/recurring", label: "Повтор.", icon: ic(<><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>) },
  { to: "/admin/clients", label: "Клиенты", icon: ic(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 6.5a3 3 0 0 1 0 5.8" /><path d="M16.5 14.5A5.5 5.5 0 0 1 20.5 20" /></>) },
  { to: "/admin/stats", label: "Стат.", icon: ic(<><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-4" /><path d="M12 16V8" /><path d="M16 16v-6" /></>) },
  { to: "/admin/settings", label: "Настр.", icon: ic(<><circle cx="12" cy="12" r="3" /><path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 0 1-4 0v-.2A1.7 1.7 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 0 1 0-4h.2A1.7 1.7 0 0 0 4.7 7L4.6 7a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z" /></>) },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {NAV.map((item) => (
          <li key={item.to} className="min-w-0 flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-0.5 py-2 text-[10px] transition sm:text-xs ${
                  isActive ? "text-brand-green" : "text-zinc-400 hover:text-zinc-200"
                }`
              }
            >
              {item.icon}
              <span className="w-full truncate text-center leading-none">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
