import { describe, expect, it } from "vitest";
import { ApiError, NETWORK_ERROR_STATUS } from "@/api/client";
import type { ProblemDetail } from "@/api/types";
import { describeError, fieldErrorOf, hasFieldErrors } from "./errors";

const UNEXPECTED = "Algo deu errado. Tente novamente.";

function problem(over: Partial<ProblemDetail> = {}): ProblemDetail {
  return { status: 400, ...over };
}

function refusal(status: number, over: Partial<ProblemDetail> = {}) {
  return new ApiError(status, "raw", problem({ status, ...over }));
}

describe("describeError", () => {
  /*
   * The order these are tried in is the whole of this function, and each step exists because the one
   * below it says the wrong thing in some case. They are checked one at a time, then against each
   * other where two could answer.
   */
  it("answers the generic sentence for anything that is not an ApiError", () => {
    expect(describeError(new Error("boom"))).toBe(UNEXPECTED);
    expect(describeError("a string")).toBe(UNEXPECTED);
    expect(describeError(null)).toBe(UNEXPECTED);
    expect(describeError(undefined)).toBe(UNEXPECTED);
  });

  it("points at the fields when the refusal is carried by them", () => {
    const error = refusal(400, {
      errors: { customerName: ["must not be blank"] },
    });

    expect(describeError(error)).toBe("Confira os campos destacados.");
  });

  /* Field errors win even where the caller supplied a text for the status, because that text would
   * name one problem while several highlighted fields are naming others. */
  it("prefers the fields over a status text the caller gave", () => {
    const error = refusal(400, { errors: { email: ["already taken"] } });

    expect(describeError(error, { 400: "Pedido inválido." })).toBe(
      "Confira os campos destacados.",
    );
  });

  it("uses the caller's text for a status it named", () => {
    expect(
      describeError(refusal(404), { 404: "Este pedido não existe mais." }),
    ).toBe("Este pedido não existe mais.");
  });

  /* One status covers more than one refusal — a 409 is a duplicate e-mail on the register screen
   * and an illegal transition everywhere else — so the screen's text outranks the API's. */
  it("prefers the caller's text over the detail the API sent", () => {
    const error = refusal(409, { detail: "Order 7 is already ENTREGUE" });

    expect(
      describeError(error, { 409: "Esse e-mail já está cadastrado." }),
    ).toBe("Esse e-mail já está cadastrado.");
  });

  it("falls back to the detail the API sent", () => {
    const error = refusal(409, { detail: "Order 7 is already ENTREGUE" });

    expect(describeError(error)).toBe("Order 7 is already ENTREGUE");
  });

  it("falls back to the generic sentence when the refusal carried no detail", () => {
    expect(describeError(refusal(500))).toBe(UNEXPECTED);
    expect(describeError(new ApiError(503, "raw", null))).toBe(UNEXPECTED);
  });

  /*
   * The only refusal answered by status alone, because it is the only one that arrives with no reply
   * to quote. It says what is missing and what the reader can do, and does not ask them to go and
   * check on a server they were never given the means to reach.
   */
  it("says what to do about a request that never came back", () => {
    const error = new ApiError(NETWORK_ERROR_STATUS, "unreachable", null);

    expect(describeError(error)).toBe(
      "Sem resposta do servidor. Verifique sua conexão e tente novamente.",
    );
  });

  it("still lets a screen override even the no-reply text", () => {
    const error = new ApiError(NETWORK_ERROR_STATUS, "unreachable", null);

    expect(describeError(error, { [NETWORK_ERROR_STATUS]: "Sem rede." })).toBe(
      "Sem rede.",
    );
  });
});

describe("hasFieldErrors", () => {
  it("is true only when a field is actually carrying one", () => {
    expect(hasFieldErrors(refusal(400, { errors: { name: ["blank"] } }))).toBe(
      true,
    );
    expect(hasFieldErrors(refusal(400, { errors: {} }))).toBe(false);
    expect(hasFieldErrors(refusal(400))).toBe(false);
    expect(hasFieldErrors(new Error("boom"))).toBe(false);
  });
});

describe("fieldErrorOf", () => {
  /* A field can break more than one rule, so the API sends a list and the first one is shown. */
  it("shows the first rule the field broke", () => {
    const error = refusal(400, {
      errors: {
        password: ["size must be between 8 and 72", "must not be blank"],
      },
    });

    expect(fieldErrorOf(error, "password")).toBe(
      "size must be between 8 and 72",
    );
  });

  it("is undefined for a field that is not highlighted", () => {
    const error = refusal(400, { errors: { password: ["too short"] } });

    expect(fieldErrorOf(error, "email")).toBeUndefined();
    expect(fieldErrorOf(new Error("boom"), "email")).toBeUndefined();
  });
});
