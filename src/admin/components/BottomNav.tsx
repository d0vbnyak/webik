import { NavLink, useLocation } from "react-router";
import type { ReactNode } from "react";
import { IconMoney, IconMore, IconProjects, IconToday } from "./icons";

type Item = { to: string; label: string; end?: boolean; icon: ReactNode; also?: string[] };

// Мобильная навигация: три рабочих раздела и «Ещё» со справочниками.
// Десктоп — боковая панель в AdminLayout.
const NAV: Item[] = [
  { to: "/admin", end: true, label: "Сегодня", icon: <IconToday /> },
  { to: "/admin/projects", label: "Проекты", icon: <IconProjects /> },
  { to: "/admin/money", label: "Деньги", icon: <IconMoney /> },
  { to: "/admin/more", label: "Ещё", icon: <IconMore />, also: ["/admin/clients", "/admin/archive", "/admin/settings"] },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Разделы"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800/80 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {NAV.map((item) => (
          <li key={item.to} className="min-w-0 flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) => {
                const active = isActive || item.also?.some((p) => pathname.startsWith(p));
                return `flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] transition-colors ${
                  active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`;
              }}
            >
              {({ isActive }) => {
                const active = isActive || item.also?.some((p) => pathname.startsWith(p));
                return (
                  <>
                    <span className={active ? "text-brand-green" : ""}>{item.icon}</span>
                    <span className="leading-none">{item.label}</span>
                  </>
                );
              }}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
