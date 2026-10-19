import { Routes, Route, Navigate } from "react-router";
import { AuthProvider } from "./context/AuthContext";
import { PeriodProvider } from "./context/PeriodContext";
import RequireAuth from "./RequireAuth";
import AdminLayout from "./AdminLayout";
import Login from "./pages/Login";
import Today from "./pages/Today";
import Projects from "./pages/Projects";
import ProjectCard from "./pages/ProjectCard";
import Money from "./pages/Money";
import MoneyOverview from "./pages/MoneyOverview";
import Incomes from "./pages/Incomes";
import Expenses from "./pages/Expenses";
import Recurring from "./pages/Recurring";
import Clients from "./pages/Clients";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";
import More from "./pages/More";
import Crm from "./pages/Crm";
import LeadCard from "./pages/LeadCard";
import CrmReport from "./pages/CrmReport";

/**
 * Закрытая админ-панель студии редизайна. Монтируется в App на /admin/* в обход
 * публичного SiteLayout. /admin/login — публичный; остальное — за RequireAuth.
 *
 * Разделы: «Сегодня» (дела и заявки), «Проекты» (этапы плагина webik),
 * «Деньги» (бывшие доходы, расходы, подписки, статистика), справочники.
 * Старая воронка ИИ-автоматизации — «Архив лидов».
 */
export default function AdminApp() {
  return (
    <AuthProvider>
      <PeriodProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Today />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectCard />} />
            <Route path="money" element={<Money />}>
              <Route index element={<MoneyOverview />} />
              <Route path="incomes" element={<Incomes />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="recurring" element={<Recurring />} />
              <Route path="stats" element={<Stats />} />
            </Route>
            <Route path="clients" element={<Clients />} />
            <Route path="archive" element={<Crm />} />
            <Route path="archive/report" element={<CrmReport />} />
            <Route path="archive/:id" element={<LeadCard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="more" element={<More />} />
            {/* Старые адреса — закладки не ломаются */}
            <Route path="incomes" element={<Navigate to="/admin/money/incomes" replace />} />
            <Route path="expenses" element={<Navigate to="/admin/money/expenses" replace />} />
            <Route path="recurring" element={<Navigate to="/admin/money/recurring" replace />} />
            <Route path="stats" element={<Navigate to="/admin/money/stats" replace />} />
            <Route path="crm/*" element={<Navigate to="/admin/archive" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </PeriodProvider>
    </AuthProvider>
  );
}
