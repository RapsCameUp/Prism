import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, useAuthHydrated } from "@/store/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNavbar } from "@/components/layout/TopNavbar";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const isAuthed = useAuth((s) => s.isAuthenticated);
  const hydrated = useAuthHydrated();

  useEffect(() => {
    if (hydrated && !isAuthed) navigate({ to: "/login" });
  }, [hydrated, isAuthed, navigate]);

  if (!hydrated || !isAuthed) return null;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNavbar />
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
