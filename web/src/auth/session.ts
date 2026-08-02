export interface Session {
  token: string;
  email: string;
  /** Epoch milliseconds, derived from the expiresIn the API reports in seconds. */
  expiresAt: number;
}

/**
 * The token is kept in localStorage, which trades exposure to XSS for surviving a refresh. The
 * alternative is an httpOnly cookie, and that is a decision for the API: it would mean reinstating
 * CSRF protection and giving up the bearer header the resource server reads.
 */
const STORAGE_KEY = "order-tracker.session";

type Listener = (session: Session | null) => void;

const listeners = new Set<Listener>();

/**
 * Every access is guarded. Reading storage throws outright when the browser is set to block all
 * cookies or the document is sandboxed, and writing throws when the quota is exhausted — and this
 * module is evaluated at import time, so an escaping error would leave a blank page.
 */
function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, value);
    }
  } catch {
    // The session degrades to this tab only rather than taking the application down.
  }
}

/**
 * Built member by member rather than recognised in place: what comes back is whatever JSON.parse
 * made of a storage key the visitor can edit, so the returned type is the result of the three
 * checks and not a promise that they happened.
 */
function toSession(value: unknown): Session | null {
  if (typeof value !== "object" || value === null) return null;

  const found = new Map<string, unknown>(Object.entries(value));
  const token = found.get("token");
  const email = found.get("email");
  const expiresAt = found.get("expiresAt");

  if (
    typeof token !== "string" ||
    typeof email !== "string" ||
    typeof expiresAt !== "number"
  ) {
    return null;
  }

  return { token, email, expiresAt };
}

function load(): Session | null {
  const stored = readStored();
  if (stored === null) return null;

  try {
    const session = toSession(JSON.parse(stored));

    return session === null || session.expiresAt <= Date.now() ? null : session;
  } catch {
    return null;
  }
}

let current = load();

/**
 * Held in the module rather than only in React state, so the fetch client can read the token
 * without the provider having mounted. A child's effect runs before its parent's, so a listing that
 * fetches on mount would otherwise go out unauthenticated on the first render.
 *
 * <p>Reading is pure: an expired session reads as absent but is not cleared here, because this runs
 * inside a render and notifying subscribers from one would update React mid-render. Clearing it is
 * the timer's job, and the 401 path is the backstop.
 */
export function getSession(): Session | null {
  if (current !== null && current.expiresAt <= Date.now()) return null;

  return current;
}

export function setSession(next: Session | null): void {
  current = next;
  writeStored(next === null ? null : JSON.stringify(next));

  for (const listener of listeners) listener(next);
}

export function clearSession(): void {
  setSession(null);
}

export function subscribeToSession(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
