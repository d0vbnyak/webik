import { Routes, Route, Navigate } from "react-router";
import { AuthProvider } from "./context/AuthContext";
import { PeriodProvider } from "./context/PeriodContext";
import RequireAuth from "./RequireAuth";
import AdminLayout from "./AdminLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Incomes from "./pages/Incomes";
import Expenses from "./pages/Expenses";
import Recurring from "./pages/Recurring";
import Clients from "./pages/Clients";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";
import Crm from "./pages/Crm";
import LeadCard from "./pages/LeadCard";
import CrmReport from "./pages/CrmReport";

/**
 * Закрытая админ-панель. Монтируется в App на /admin/* в обход публичного
 * SiteLayout. /admin/login — публичный; остальное — за RequireAuth.
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
            <Route index element={<Dashboard />} />
            <Route path="incomes" element={<Incomes />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="recurring" element={<Recurring />} />
            <Route path="crm" element={<Crm />} />
            <Route path="crm/report" element={<CrmReport />} />
            <Route path="crm/:id" element={<LeadCard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="stats" element={<Stats />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </PeriodProvider>
    </AuthProvider>
  );
}
