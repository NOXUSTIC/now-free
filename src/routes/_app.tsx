import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  const tabs = [
    { to: "/home", label: "হোম", en: "Home" },
    { to: "/free", label: "এখন কে ফ্রি??", en: "Free now" },
    { to: "/calendar", label: "ক্যালেন্ডার", en: "Calendar" },
    { to: "/exams", label: "পরীক্ষা", en: "Exams" },
    { to: "/routine", label: "রুটিন", en: "Routine" },
  ];

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/" });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center gap-4">
          <Link to="/home" className="font-display text-lg font-semibold text-primary whitespace-nowrap">এখন কে ফ্রি??</Link>
          <nav className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
            {tabs.map((t) => {
              const active = pathname === t.to;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
                    active ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-secondary"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <button onClick={signOut} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">
            লগ আউট
          </button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
