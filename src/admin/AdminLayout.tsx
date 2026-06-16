import { Outlet } from "react-router";
import { useAuth } from "./hooks/useAuth";
import BottomNav from "./components/BottomNav";

export default function AdminLayout() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="font-display text-sm font-semibold tracking-tight">
            WebIK <span className="text-brand-green">· Статистика</span>
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
          >
            Выйти
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-5">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
