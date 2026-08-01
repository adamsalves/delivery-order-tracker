export interface Session {
  token: string;
  email: string;
  /** Epoch milliseconds, derived from the expiresIn the API reports in seconds. */
  expiresAt: number;
}

const STORAGE_KEY = "order-tracker.session";

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.token === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.expiresAt === "number"
  );
}

function load(): Session | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

let current = load();

/**
 * Held in the module rather than only in React state, so the fetch client can read the token
 * without the provider having mounted. A child's effect runs before its parent's, so a listing
 * that fetches on mount would otherwise go out unauthenticated on the first render.
 *
 * <p>An expired token is dropped on the way out instead of being spent on a request that would
 * come back 401.
 */
export function getSession(): Session | null {
  if (current !== null && current.expiresAt <= Date.now()) {
    setSession(null);
  }

  return current;
}

export function setSession(next: Session | null): void {
  current = next;

  if (next === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
}
