import { useState } from "react";
import { Link, Outlet } from "react-router";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";

export function AppLayout() {
  const { session, signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);

  /** No redirect of its own: dropping the session is what RequireAuth reacts to. */
  async function handleSignOut() {
    setLeaving(true);
    await signOut();
  }

  return (
    <div className="min-h-svh">
      <header className="border-border bg-card border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link
            to="/orders"
            className="font-display text-sm font-medium tracking-[0.2em] uppercase"
          >
            Delivery Order Tracker
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-muted-foreground hidden font-mono text-xs sm:inline">
              {session?.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={leaving}
            >
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
