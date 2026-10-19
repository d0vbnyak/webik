import { Link } from "react-router";
import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { IconArchive, IconCandidates, IconClients, IconSettings } from "../components/icons";

const ITEMS: { to: string; label: string; hint: string; icon: ReactNode }[] = [
  { to: "/admin/candidates", label: "Кандидаты", hint: "фирмы со старыми сайтами — кому написать", icon: <IconCandidates /> },
  { to: "/admin/clients", label: "Клиенты", hint: "контакты для доходов и проектов", icon: <IconClients /> },
  { to: "/admin/archive", label: "Архив лидов", hint: "старая воронка и разобранные заявки", icon: <IconArchive /> },
  { to: "/admin/settings", label: "Настройки", hint: "налог, цели, категории, плагин webik", icon: <IconSettings /> },
];

/** «Ещё» — справочные разделы на мобильном. На десктопе они в боковой панели. */
export default function More() {
  const { signOut, user } = useAuth();
  return (
    <div>
      <h1 className="mb-6 font-display text-[28px] font-semibold leading-tight tracking-[-0.015em]">Ещё</h1>
      <ul className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800/80">
        {ITEMS.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-zinc-900">
              <span className="text-zinc-500">{i.icon}</span>
              <span className="min-w-0">
                <span className="block text-[15px] text-zinc-100">{i.label}</span>
                <span className="block truncate text-xs text-zinc-500">{i.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex items-center justify-between text-sm">
        <span className="truncate text-zinc-500">{user?.email}</span>
        <button type="button" onClick={() => void signOut()} className="text-zinc-400 hover:text-zinc-100">
          Выйти
        </button>
      </div>
    </div>
  );
}
