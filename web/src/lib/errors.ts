import { ApiError, NETWORK_ERROR_STATUS } from "@/api/client";

const UNEXPECTED = "Não foi possível concluir a operação. Tente novamente.";

/**
 * The API answers in English, so a refusal the UI can anticipate is restated in Portuguese. What
 * is not on this list falls back to the detail the API sent: a message that arrived is never
 * traded for "erro desconhecido".
 */
const BY_STATUS: Record<number, string> = {
  [NETWORK_ERROR_STATUS]:
    "Não foi possível falar com o servidor. Verifique se a API está no ar.",
  401: "E-mail ou senha incorretos.",
  403: "Você não tem permissão para isso.",
  409: "Este e-mail já está cadastrado.",
};

export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) return UNEXPECTED;

  if (Object.keys(error.fieldErrors).length > 0) {
    return "Confira os campos destacados.";
  }

  return BY_STATUS[error.status] ?? error.problem?.detail ?? UNEXPECTED;
}

/** One field can break more than one rule, so the API sends a list and the first one is shown. */
export function fieldErrorOf(
  error: unknown,
  field: string,
): string | undefined {
  return error instanceof ApiError ? error.fieldErrors[field]?.[0] : undefined;
}
