import { request, requestEmpty } from "./client";
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from "./types";

export function register(body: RegisterRequest) {
  return request<RegisterResponse>("/api/auth/register", {
    method: "POST",
    body,
    auth: false,
  });
}

export function login(body: LoginRequest) {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body,
    auth: false,
  });
}

/** Revokes the token that authorises the call, so it carries no body of its own. */
export function logout() {
  return requestEmpty("/api/auth/logout", { method: "POST", auth: true });
}
