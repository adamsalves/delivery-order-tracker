import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as authApi from "@/api/auth";
import type { LoginRequest, RegisterRequest } from "@/api/types";
import { AuthContext, type AuthContextValue } from "./AuthContext";
import {
  clearSession,
  getSession,
  setSession,
  subscribeToSession,
  type Session,
} from "./session";

/** setTimeout truncates anything past this, which would fire the expiry immediately. */
const MAX_TIMEOUT = 2_147_483_647;

export function AuthProvider({ children }: { children: ReactNode }) {
  /*
   * A lazy initializer rather than an effect: reading storage is synchronous, so there is no render
   * in which a signed-in visitor is still anonymous — which is what used to throw them at /login on
   * every refresh.
   */
  const [session, setSessionState] = useState<Session | null>(getSession);

  /*
   * The module store is the source of truth, because the fetch client forgets the session there
   * when a token stops being accepted. Re-reading on subscribe catches a refusal that landed
   * between the first render and this effect.
   */
  useEffect(() => {
    setSessionState(getSession());
    return subscribeToSession(setSessionState);
  }, []);

  /*
   * Expiry is reached on a timer rather than on the next refused request, so the header stops
   * showing a signed-in visitor at the moment the token stops being usable.
   */
  useEffect(() => {
    if (session === null) return;

    const delay = Math.min(
      Math.max(session.expiresAt - Date.now(), 0),
      MAX_TIMEOUT,
    );
    const timer = setTimeout(clearSession, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [session]);

  const signIn = useCallback(async (credentials: LoginRequest) => {
    const { token, expiresIn } = await authApi.login(credentials);

    setSession({
      token,
      email: credentials.email,
      expiresAt: Date.now() + expiresIn * 1000,
    });
  }, []);

  /** The API issues no token on register, so the account is opened and then signed into. */
  const signUp = useCallback(
    async (data: RegisterRequest) => {
      await authApi.register(data);
      await signIn({ email: data.email, password: data.password });
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The token is being dropped locally either way; a refusal here changes nothing.
    }
    clearSession();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: session !== null,
      signIn,
      signUp,
      signOut,
    }),
    [session, signIn, signUp, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
