import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "./hooks/useAuth";
import Spinner from "./components/Spinner";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Spinner full />;
  if (!session) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}
