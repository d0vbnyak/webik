import { NavLink, Outlet } from "react-router";
import type { ReactNode } from "react";
import { useAuth } from "./hooks/useAuth";
import BottomNav from "./components/BottomNav";
import RecurringBootstrap from "./components/RecurringBootstrap";
import { IconArchive, IconClients, IconMoney, IconProjects, IconSettings, IconToday } from "./components/icons";

type Item = { to: string; label: string; end?: boolean; icon: ReactNode };

/** Боковая панель десктопа: рабочие разделы сверху, справочные — ниже. */
const MAIN: Item[] = [
  { to: "/admin", end: true, label: "Сегодня", icon: <IconToday /> },
  { to: "/admin/projects", label: "Проекты", icon: <IconProjects /> },
  { to: "/admin/money", label: "Деньги", icon: <IconMoney /> },
];
const SECONDARY: Item[] = [
  { to: "/admin/clients", label: "Клиенты", icon: <IconClients /> },
  { to: "/admin/archive", label: "Архив лидов", icon: <IconArchive /> },
  { to: "/admin/settings", label: "Настройки", icon: <IconSettings /> },
];

function SideLink({ item }: { item: Item }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive ? "bg-zinc-900 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={isActive ? "text-brand-green" : ""}>{item.icon}</span>
          {item.label}
        </>
      )}
    </NavLink>
  );
}

export function Brand() {
  return (
    <span className="font-display text-[15px] font-semibold tracking-tight text-zinc-100">
      WebIK <span className="font-normal text-zinc-500">· студия</span>
    </span>
  );
}

export default function AdminLayout() {
  const { signOut, user } = useAuth();

  return (
    <div className="admin-root min-h-screen">
      {/* Фоновое авто-добавление повторяющихся расходов (один раз за загрузку) */}
      <RecurringBootstrap />

      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-zinc-800/80 px-3 py-5 lg:flex">
        <div className="px-3 pb-6">
          <Brand />
        </div>
        <nav className="space-y-0.5" aria-label="Разделы">
          {MAIN.map((i) => (
            <SideLink key={i.to} item={i} />
          ))}
        </nav>
        <div className="mx-3 my-4 h-px bg-zinc-800/80" />
        <nav className="space-y-0.5" aria-label="Справочники">
          {SECONDARY.map((i) => (
            <SideLink key={i.to} item={i} />
          ))}
        </nav>
        <div className="mt-auto px-3">
          {user?.email && <div className="mb-2 truncate text-xs text-zinc-500">{user.email}</div>}
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            Выйти
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur lg:hidden">
        <div className="flex h-12 items-center px-4">
          <Brand />
        </div>
      </header>

      <main className="px-4 pb-28 pt-5 lg:ml-60 lg:px-10 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
