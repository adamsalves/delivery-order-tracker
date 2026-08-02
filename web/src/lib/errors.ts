import { ApiError, NETWORK_ERROR_STATUS } from "@/api/client";

const UNEXPECTED = "Algo deu errado. Tente novamente.";

/**
 * The only refusal answered by status alone, because it is the only one that arrives without a
 * reply to quote.
 *
 * <p>It says what is missing and what the reader can do about it, and stops there. Whether the
 * request died on this side or the other is not something the failure itself distinguishes, and
 * asking whoever is reading to go and check on a server is asking for something they were never
 * given the means to do.
 */
const NO_REPLY: Record<number, string> = {
  [NETWORK_ERROR_STATUS]:
    "Sem resposta do servidor. Verifique sua conexão e tente novamente.",
};

export type StatusMessages = Record<number, string>;

/**
 * Restating a refusal in Portuguese is the screen's call, not this module's: one status covers more
 * than one refusal. A 409 is a duplicate e-mail on the register screen and an illegal status
 * transition everywhere else, and fixing a text to the status would show the wrong one while
 * discarding the message that names the transitions actually open.
 */
export function describeError(
  error: unknown,
  onStatus: StatusMessages = {},
): string {
  if (!(error instanceof ApiError)) return UNEXPECTED;

  if (hasFieldErrors(error)) {
    return "Confira os campos destacados.";
  }

  return (
    onStatus[error.status] ??
    NO_REPLY[error.status] ??
    error.problem?.detail ??
    UNEXPECTED
  );
}

/**
 * Whether the refusal is one the fields themselves are carrying. A screen that clears its
 * highlights as they are corrected needs this to know when its own banner has run out of things to
 * point at: "confira os campos destacados" outlives the last destaque otherwise.
 */
export function hasFieldErrors(error: unknown): boolean {
  return error instanceof ApiError && Object.keys(error.fieldErrors).length > 0;
}

/** One field can break more than one rule, so the API sends a list and the first one is shown. */
export function fieldErrorOf(
  error: unknown,
  field: string,
): string | undefined {
  return error instanceof ApiError ? error.fieldErrors[field]?.[0] : undefined;
}
