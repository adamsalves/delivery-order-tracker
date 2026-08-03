import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import { getOrder, updateOrderStatus } from "@/api/orders";
import type { OrderDetail, OrderStatus } from "@/api/types";
import { OrderTransitions } from "./OrderTransitions";

vi.mock("@/api/orders", () => ({
  getOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
}));

const moved = vi.mocked(updateOrderStatus);
const read = vi.mocked(getOrder);

function detail(status: OrderStatus = "RECEBIDO"): OrderDetail {
  return {
    id: 7,
    customerName: "Ana Souza",
    deliveryAddress: "Rua das Flores, 100",
    status,
    createdAt: "2026-08-03T00:59:29.535Z",
    updatedAt: "2026-08-03T00:59:29.535Z",
    items: [],
    history: [],
  };
}

/** Leaves the request hanging, so the buttons can be looked at while it is in flight. */
function held() {
  let settle: (value: OrderDetail) => void = () => {};
  moved.mockReturnValue(
    new Promise<OrderDetail>((resolve) => {
      settle = resolve;
    }),
  );

  return () => {
    settle(detail("EM_PREPARO"));
  };
}

function show(status: OrderStatus = "RECEBIDO", onMoved = vi.fn()) {
  render(<OrderTransitions order={detail(status)} onMoved={onMoved} />);

  return onMoved;
}

beforeEach(() => {
  moved.mockResolvedValue(detail("EM_PREPARO"));
});

describe("what is offered", () => {
  it("offers only the transitions open from where the order is", () => {
    show("RECEBIDO");

    expect(
      screen.getByRole("button", { name: "Iniciar preparo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar pedido" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirmar entrega" }),
    ).toBeNull();
  });

  it.each(["ENTREGUE", "CANCELADO"] as const)(
    "shows nothing at all for %s",
    (status) => {
      const { container } = render(
        <OrderTransitions order={detail(status)} onMoved={vi.fn()} />,
      );

      expect(container).toBeEmptyDOMElement();
    },
  );
});

describe("while a transition is in flight", () => {
  /*
   * The decision this pins is written next to "Carregar mais" on the listing: aria-disabled rather
   * than disabled, so the control announces the wait without leaving the focus order. Note that
   * jsdom keeps focus on an element that becomes disabled where a browser drops it, so what is
   * checked here is the choice of attribute and the guard that makes it safe — the dropped focus
   * itself is the browser behaviour the choice exists for and is not reproducible in this runner.
   */
  it("marks the buttons busy without taking them out of the document's focus order", async () => {
    const release = held();
    show("RECEBIDO");

    await userEvent.click(
      screen.getByRole("button", { name: "Iniciar preparo" }),
    );

    const button = screen.getByRole("button", { name: "Iniciar preparo" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();

    release();
  });

  /* aria-disabled is advisory, so the press still arrives — and is refused in move() instead. */
  it("refuses a repeat press rather than a second request", async () => {
    const release = held();
    show("RECEBIDO");

    const button = screen.getByRole("button", { name: "Iniciar preparo" });
    await userEvent.click(button);
    await userEvent.click(button);
    await userEvent.click(
      screen.getByRole("button", { name: "Cancelar pedido" }),
    );

    expect(moved).toHaveBeenCalledTimes(1);
    expect(moved).toHaveBeenCalledWith(7, "EM_PREPARO");

    release();
  });
});

describe("when the transition is accepted", () => {
  it("hands the whole order back rather than reading it again", async () => {
    const onMoved = show("RECEBIDO");

    await userEvent.click(
      screen.getByRole("button", { name: "Iniciar preparo" }),
    );

    await waitFor(() => {
      expect(onMoved).toHaveBeenCalledWith(
        expect.objectContaining({ status: "EM_PREPARO" }),
      );
    });
    expect(read).not.toHaveBeenCalled();
  });
});

describe("when the transition is refused", () => {
  /*
   * A 409 means the order moved while this screen held an older copy, so it is read back before
   * anything is said — the screen catches up, and the refusal names the status in the language the
   * rest of the page speaks rather than quoting the API's English.
   */
  it("reads the order back and explains where it actually is", async () => {
    moved.mockRejectedValue(new ApiError(409, "conflict", null));
    read.mockResolvedValue(detail("ENTREGUE"));

    const onMoved = show("RECEBIDO");
    await userEvent.click(
      screen.getByRole("button", { name: "Iniciar preparo" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O pedido está em «Entregue», que encerra o pedido e não admite outra mudança.",
    );
    expect(onMoved).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ENTREGUE" }),
    );
  });

  it("leaves the buttons pressable again after a failure that was not a conflict", async () => {
    moved.mockRejectedValue(new ApiError(500, "boom", null));
    show("RECEBIDO");

    await userEvent.click(
      screen.getByRole("button", { name: "Iniciar preparo" }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "Iniciar preparo" });
    expect(button).toHaveAttribute("aria-disabled", "false");
    expect(button).not.toBeDisabled();

    /* And a second attempt really does go out, which is what "pressable again" has to mean. */
    moved.mockResolvedValue(detail("EM_PREPARO"));
    await userEvent.click(button);

    await waitFor(() => {
      expect(moved).toHaveBeenCalledTimes(2);
    });
  });

  it("keeps the section up on a refusal that ended the order", async () => {
    moved.mockRejectedValue(new ApiError(409, "conflict", null));
    read.mockResolvedValue(detail("CANCELADO"));

    show("SAIU_PARA_ENTREGA");
    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar entrega" }),
    );

    /* Reaching a terminal status is often the refusal itself, and leaving would take the
     * explanation with it. */
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
