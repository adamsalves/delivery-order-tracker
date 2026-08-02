import { clearSession, getSession } from "@/auth/session";
import type { ProblemDetail } from "./types";

const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8080"
).replace(/\/$/, "");

/** The status given to a request that never came back, to keep callers on one type. */
export const NETWORK_ERROR_STATUS = 0;

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetail | null;
  readonly fieldErrors: Record<string, string[]>;

  constructor(
    status: number,
    message: string,
    problem: ProblemDetail | null,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
    this.fieldErrors = problem?.errors ?? {};
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /**
   * Whether the call carries the session token. It also decides who owns a 401: an authenticated
   * call that gets one has a session that is no longer good, but /api/auth/login answers 401 for a
   * wrong password, and forgetting the session there would bounce the login screen off itself and
   * swallow the message.
   */
  auth: boolean;
  signal?: AbortSignal;
}

/**
 * For the calls that answer with a representation. A body that is missing or unreadable is a
 * failure here, not an empty result: every caller of this asked for something back.
 */
export async function request<T>(
  path: string,
  options: RequestOptions,
): Promise<T> {
  const response = await send(path, options);
  const payload = await readJson(response);

  if (payload === null) {
    throw new ApiError(
      response.status,
      `Response to ${path} was not readable as JSON`,
      null,
    );
  }

  return fromWire<T>(payload);
}

/**
 * For the calls the API answers 204 to. Kept apart from request so that no body has to be invented
 * to satisfy a type: a caller that asks for nothing is told it got nothing.
 */
export async function requestEmpty(
  path: string,
  options: RequestOptions,
): Promise<void> {
  await send(path, options);
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = "GET", body, auth, signal } = options;
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getSession()?.token;
    if (token !== undefined) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }
    throw new ApiError(
      NETWORK_ERROR_STATUS,
      `Could not reach the API at ${API_URL}`,
      null,
      { cause },
    );
  }

  if (!response.ok) {
    const failure = await readJson(response);

    if (response.status === 401 && auth) {
      clearSession();
    }

    /*
     * A refusal is the answer most likely to arrive from something other than the API — a proxy
     * page, a gateway notice — so what came back is checked before being called a problem detail
     * rather than assumed to be one.
     */
    const problem = isProblemDetail(failure) ? failure : null;

    throw new ApiError(
      response.status,
      problem?.detail ?? `Request to ${path} failed with ${response.status}`,
      problem,
    );
  }

  return response;
}

/**
 * The one place the wire is taken at its word. Nothing here proves the payload matches T — that
 * would need a schema per endpoint — so the step is named and kept to a single line, rather than
 * left as an assertion for each caller to repeat.
 */
function fromWire<T>(payload: unknown): T {
  return payload as T;
}

/**
 * A body is not obliged to be readable — a failure refused in the filter chain may carry none, and
 * an interposed proxy can answer 200 with a page. Either way it becomes one ApiError rather than a
 * parser error escaping past the callers that only expect that type.
 */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** status is the only member RFC 9457 requires, and the only one read without a guard. */
function isProblemDetail(value: unknown): value is ProblemDetail {
  if (typeof value !== "object" || value === null) return false;
  if (!("status" in value) || typeof value.status !== "number") return false;

  return !("errors" in value) || isFieldErrors(value.errors);
}

/** One field can break more than one rule, so each entry is a list and every item is a message. */
function isFieldErrors(value: unknown): value is Record<string, string[]> {
  if (typeof value !== "object" || value === null) return false;

  return Object.values(value).every(
    (messages) =>
      Array.isArray(messages) &&
      messages.every((message) => typeof message === "string"),
  );
}
