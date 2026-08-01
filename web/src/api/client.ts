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

  constructor(status: number, message: string, problem: ProblemDetail | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
    this.fieldErrors = problem?.errors ?? {};
  }
}

type TokenProvider = () => string | null;
type UnauthorizedHandler = () => void;

let readToken: TokenProvider = () => null;
let onUnauthorized: UnauthorizedHandler = () => {};

/**
 * Wired by the auth provider instead of imported from it. Reaching for the context here would
 * close a cycle — the context calls the client to log in, and the client would call the context to
 * read the token.
 */
export function setTokenProvider(provider: TokenProvider) {
  readToken = provider;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /**
   * Whether the call carries the session token. It also decides who owns a 401: an authenticated
   * call that gets one has an expired session, but /api/auth/login answers 401 for a wrong
   * password, and treating that as an expiry would bounce the login screen off itself and swallow
   * the message.
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
    const token = readToken();
    if (token) {
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
    );
  }

  if (!response.ok) {
    const problem = await readProblem(response);

    if (response.status === 401 && auth) {
      onUnauthorized();
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

  return (await response.json()) as T;
}

/**
 * A failure is not obliged to carry a body — 401s refused in the filter chain sometimes do not —
 * so an unreadable one leaves the status to speak for itself rather than becoming a second error.
 */
async function readProblem(response: Response): Promise<ProblemDetail | null> {
  try {
    return (await response.json()) as ProblemDetail;
  } catch {
    return null;
  }
}
