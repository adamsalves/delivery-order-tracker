import { Ban, Check } from "lucide-react";
import type { OrderStatus, OrderStatusEntry } from "@/api/types";
import { formatDateTime } from "@/lib/format";
import { FORWARD_STATUSES, STATUS_LABELS } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";

const DOT: Record<OrderStatus, string> = {
  RECEBIDO: "border-status-recebido bg-status-recebido",
  EM_PREPARO: "border-status-em-preparo bg-status-em-preparo",
  SAIU_PARA_ENTREGA:
    "border-status-saiu-para-entrega bg-status-saiu-para-entrega",
  ENTREGUE: "border-status-entregue bg-status-entregue",
  CANCELADO: "border-status-cancelado bg-status-cancelado",
};

/** The segment below a step, which carries the colour of the step it leaves. */
const LINE: Record<OrderStatus, string> = {
  RECEBIDO: "bg-status-recebido",
  EM_PREPARO: "bg-status-em-preparo",
  SAIU_PARA_ENTREGA: "bg-status-saiu-para-entrega",
  ENTREGUE: "bg-status-entregue",
  CANCELADO: "bg-status-cancelado",
};

const RING: Record<OrderStatus, string> = {
  RECEBIDO: "ring-status-recebido/25",
  EM_PREPARO: "ring-status-em-preparo/25",
  SAIU_PARA_ENTREGA: "ring-status-saiu-para-entrega/25",
  ENTREGUE: "ring-status-entregue/25",
  CANCELADO: "ring-status-cancelado/25",
};

interface OrderStatusTimelineProps {
  history: OrderStatusEntry[];
}

/**
 * Drawn from the history rather than from the order's status, so each step can say when it happened
 * and who moved it — which the current status alone does not know.
 *
 * The state machine forbids skipping a step, so what has been reached is always a prefix of the
 * path: there is no gap in the middle to render.
 */
export function OrderStatusTimeline({ history }: OrderStatusTimelineProps) {
  const cancellation = history.find((entry) => entry.toStatus === "CANCELADO");
  const reached = new Map(
    history
      .filter((entry) => entry.toStatus !== "CANCELADO")
      .map((entry) => [entry.toStatus, entry]),
  );
  const current = history.at(-1)?.toStatus;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold">Histórico</h2>

      <div className="border-border bg-card rounded-lg border px-4 py-4">
        <ol>
          {FORWARD_STATUSES.map((step, index) => {
            const entry = reached.get(step);
            const next = FORWARD_STATUSES[index + 1];

            return (
              <Step
                key={step}
                status={step}
                entry={entry}
                current={step === current}
                /*
                 * Once cancelled, the steps left undone were not merely skipped for now — the order
                 * stopped before them, and they will never be reached.
                 */
                interrupted={entry === undefined && cancellation !== undefined}
                /*
                 * The connector is only coloured while both of its ends were reached, so it turns
                 * grey exactly where the order stopped rather than at the end of the list.
                 */
                continues={next !== undefined && reached.has(next)}
                last={
                  index === FORWARD_STATUSES.length - 1 &&
                  cancellation === undefined
                }
              />
            );
          })}
        </ol>

        {/*
         * Outside the list of steps, because it is not one. Counted as its fifth item, a screen
         * reader would announce it as coming after ENTREGUE — the reading the drawing spends its
         * greyed connector and struck-through labels avoiding.
         */}
        {cancellation !== undefined && (
          <Step
            status="CANCELADO"
            entry={cancellation}
            current
            interrupted={false}
            continues={false}
            last
            branch
          />
        )}
      </div>
    </section>
  );
}

interface StepProps {
  status: OrderStatus;
  entry: OrderStatusEntry | undefined;
  current: boolean;
  interrupted: boolean;
  continues: boolean;
  last: boolean;
  branch?: boolean;
}

function Step({
  status,
  entry,
  current,
  interrupted,
  continues,
  last,
  branch = false,
}: StepProps) {
  const done = entry !== undefined;
  const Row = branch ? "div" : "li";

  return (
    <Row
      className="grid grid-cols-[1.5rem_1fr] gap-x-3"
      aria-current={current ? "step" : undefined}
    >
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
            done ? DOT[status] : "border-rail-track bg-card border-dashed",
            current && `ring-4 ${RING[status]}`,
          )}
        >
          {branch ? (
            <Ban className="text-card size-3.5" strokeWidth={3} />
          ) : done ? (
            <Check className="text-card size-3.5" strokeWidth={3} />
          ) : null}
        </span>

        {!last && (
          <span
            className={cn(
              "w-0.5 flex-1",
              continues ? LINE[status] : "bg-rail-track",
            )}
          />
        )}
      </div>

      <div className={cn("pb-6", last && "pb-0")}>
        <p
          className={cn(
            "text-sm font-medium",
            !done && "text-muted-foreground",
            interrupted && "line-through",
          )}
        >
          {STATUS_LABELS[status]}
        </p>

        {entry !== undefined ? (
          <p className="text-muted-foreground mt-0.5 text-xs">
            <span className="font-mono tabular-nums">
              {formatDateTime(entry.changedAt)}
            </span>
            {" · "}
            <span className="font-mono">{entry.changedBy}</span>
          </p>
        ) : (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {interrupted ? "Não alcançado" : "Pendente"}
          </p>
        )}
      </div>
    </Row>
  );
}
