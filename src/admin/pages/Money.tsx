import { NavLink, Outlet } from "react-router";

const TABS = [
  { to: "/admin/money", end: true, label: "Обзор" },
  { to: "/admin/money/incomes", label: "Доходы" },
  { to: "/admin/money/expenses", label: "Расходы" },
  { to: "/admin/money/recurring", label: "Подписки" },
  { to: "/admin/money/stats", label: "Статистика" },
];

/** «Деньги»: финансовые страницы под одной вкладочной навигацией. */
export default function Money() {
  return (
    <div>
      <nav aria-label="Деньги" className="scroll-x -mx-4 mb-6 overflow-x-auto border-b border-zinc-800/80 px-4 lg:mx-0 lg:px-0">
        <ul className="flex w-max gap-5">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `-mb-px block border-b-2 pb-2.5 text-sm transition-colors ${
                    isActive ? "border-brand-green text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
