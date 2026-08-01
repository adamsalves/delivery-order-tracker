import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as authApi from "@/api/auth";
import { setTokenProvider, setUnauthorizedHandler } from "@/api/client";
import type { LoginRequest, RegisterRequest } from "@/api/types";
import { AuthContext, type AuthContextValue } from "./AuthContext";
import { getSession, setSession, type Session } from "./session";

setTokenProvider(() => getSession()?.token ?? null);

export function AuthProvider({ children }: { children: ReactNode }) {
  /*
   * A lazy initializer rather than an effect: reading storage is synchronous, so there is no render
   * in which a signed-in visitor is still anonymous — which is what used to throw them at /login on
   * every refresh.
   */
  const [session, setSessionState] = useState<Session | null>(getSession);

  const forget = useCallback(() => {
    setSession(null);
    setSessionState(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(forget);
  }, [forget]);

  const remember = useCallback((email: string, token: string, ttl: number) => {
    const next = { token, email, expiresAt: Date.now() + ttl * 1000 };
    setSession(next);
    setSessionState(next);
  }, []);

  const signIn = useCallback(
    async (credentials: LoginRequest) => {
      const { token, expiresIn } = await authApi.login(credentials);
      remember(credentials.email, token, expiresIn);
    },
    [remember],
  );

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
    forget();
  }, [forget]);

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
