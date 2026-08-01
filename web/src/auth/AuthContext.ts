import { createContext } from "react";
import type { LoginRequest, RegisterRequest } from "@/api/types";
import type { Session } from "./session";

export interface AuthContextValue {
  session: Session | null;
  isAuthenticated: boolean;
  signIn: (credentials: LoginRequest) => Promise<void>;
  signUp: (data: RegisterRequest) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
