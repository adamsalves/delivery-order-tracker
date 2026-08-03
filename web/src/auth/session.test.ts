import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSession,
  getSession,
  setSession,
  STORAGE_KEY,
  subscribeToSession,
  type Session,
} from "./session";

function session(over: Partial<Session> = {}): Session {
  return {
    token: "token-one",
    email: "quem@example.com",
    expiresAt: Date.now() + 60_000,
    ...over,
  };
}

/**
 * What the browser raises in the tabs that did not make the change. It is constructed by hand
 * because a same-window write does not produce one — which is the whole reason this listener has to
 * exist rather than being implied by localStorage.
 */
function otherTabWrote(key: string | null) {
  window.dispatchEvent(
    new StorageEvent("storage", { key, storageArea: localStorage }),
  );
}

beforeEach(() => {
  localStorage.clear();
  setSession(null);
});

describe("holding a session", () => {
  it("hands back what it was given", () => {
    setSession(session());

    expect(getSession()).toMatchObject({ email: "quem@example.com" });
  });

  it("reads an expired session as absent without clearing it", () => {
    setSession(session({ expiresAt: Date.now() - 1 }));

    expect(getSession()).toBeNull();
    /* Reading happens inside a render; clearing there would update React mid-render. */
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("tells its subscribers when the session changes", () => {
    const told = vi.fn();
    subscribeToSession(told);

    setSession(session());
    clearSession();

    expect(told).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ token: "token-one" }),
    );
    expect(told).toHaveBeenNthCalledWith(2, null);
  });

  it("stops telling a subscriber that unsubscribed", () => {
    const told = vi.fn();
    subscribeToSession(told)();

    setSession(session());

    expect(told).not.toHaveBeenCalled();
  });
});

describe("another tab changing the session", () => {
  /*
   * The gap this closes: signing out in one tab left the others rendering as signed in, holding a
   * token the API had already revoked, until whenever that tab next spoke to the API.
   */
  it("signs this tab out when another one signed out", () => {
    setSession(session());
    const told = vi.fn();
    subscribeToSession(told);

    localStorage.removeItem(STORAGE_KEY);
    otherTabWrote(STORAGE_KEY);

    expect(told).toHaveBeenCalledWith(null);
    expect(getSession()).toBeNull();
  });

  it("picks up a session another tab signed in with", () => {
    const told = vi.fn();
    subscribeToSession(told);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(session({ token: "token-two" })),
    );
    otherTabWrote(STORAGE_KEY);

    expect(getSession()).toMatchObject({ token: "token-two" });
    expect(told).toHaveBeenCalledWith(
      expect.objectContaining({ token: "token-two" }),
    );
  });

  /* clear() names no key at all, and it takes ours with everything else. */
  it("notices a clear that named no key", () => {
    setSession(session());
    const told = vi.fn();
    subscribeToSession(told);

    localStorage.clear();
    otherTabWrote(null);

    expect(told).toHaveBeenCalledWith(null);
  });

  it("ignores a change to somebody else's key", () => {
    setSession(session());
    const told = vi.fn();
    subscribeToSession(told);

    localStorage.setItem("unrelated", "value");
    otherTabWrote("unrelated");

    expect(told).not.toHaveBeenCalled();
    expect(getSession()).toMatchObject({ token: "token-one" });
  });

  /* Two tabs holding the same session is the ordinary case, and not news worth a re-render. */
  it("says nothing when the stored session is the one already held", () => {
    setSession(session());
    const told = vi.fn();
    subscribeToSession(told);

    otherTabWrote(STORAGE_KEY);

    expect(told).not.toHaveBeenCalled();
  });

  it("stops listening once the last subscriber has gone", () => {
    setSession(session());
    const told = vi.fn();
    subscribeToSession(told)();

    localStorage.removeItem(STORAGE_KEY);
    otherTabWrote(STORAGE_KEY);

    expect(told).not.toHaveBeenCalled();
  });

  /* A key the visitor can edit by hand holds whatever they put there. */
  it("treats an unreadable stored value as no session", () => {
    setSession(session());
    const told = vi.fn();
    subscribeToSession(told);

    localStorage.setItem(STORAGE_KEY, "{ not json");
    otherTabWrote(STORAGE_KEY);

    expect(told).toHaveBeenCalledWith(null);
    expect(getSession()).toBeNull();
  });
});
