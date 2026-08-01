import { Outlet } from "react-router";
import { ORDER_STATUSES } from "@/api/types";
import { StatusRail } from "@/components/StatusRail";

/**
 * The state machine itself is the artwork: one rail per status, ending on the one that breaks.
 * The track is darkened locally because the panel is ink rather than steel.
 */
export function AuthLayout() {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <aside className="bg-foreground text-background hidden flex-col justify-between p-12 [--rail-track:#2a2f38] lg:flex">
        <p className="font-display text-sm font-medium tracking-[0.2em] uppercase opacity-70">
          Delivery Order Tracker
        </p>

        <div className="space-y-7">
          <h1 className="font-display max-w-md text-4xl leading-tight font-semibold font-stretch-110%">
            Cada pedido percorre um trilho só de ida.
          </h1>

          <ul className="max-w-sm space-y-4">
            {ORDER_STATUSES.map((status) => (
              <li key={status} className="space-y-1.5">
                <span className="font-mono text-[11px] tracking-wider opacity-60">
                  {status}
                </span>
                <StatusRail status={status} aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>

        <p className="max-w-sm text-sm opacity-60">
          Entregue e cancelado são finais. O trilho rompido marca o pedido que
          saiu do fluxo em vez de completá-lo.
        </p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
