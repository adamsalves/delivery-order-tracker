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

export async function request<T>(
  path: string,
  options: RequestOptions,
): Promise<T> {
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
    const problem = await readJson<ProblemDetail>(response);

    if (response.status === 401 && auth) {
      clearSession();
    }

    throw new ApiError(
      response.status,
      problem?.detail ?? `Request to ${path} failed with ${response.status}`,
      problem,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await readJson<T>(response);

  if (payload === null) {
    throw new ApiError(
      response.status,
      `Response to ${path} was not readable as JSON`,
      null,
    );
  }

  return payload;
}

/**
 * A body is not obliged to be readable — a failure refused in the filter chain may carry none, and
 * an interposed proxy can answer 200 with a page. Either way it becomes one ApiError rather than a
 * parser error escaping past the callers that only expect that type.
 */
async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
