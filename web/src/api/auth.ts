import { request, requestEmpty } from "./client";
import { loginResponse, registerResponse } from "./parse";
import type { LoginRequest, RegisterRequest } from "./types";

export function register(body: RegisterRequest) {
  return request(
    "/api/auth/register",
    { method: "POST", body, auth: false },
    registerResponse,
  );
}

export function login(body: LoginRequest) {
  return request(
    "/api/auth/login",
    { method: "POST", body, auth: false },
    loginResponse,
  );
}

/** Revokes the token that authorises the call, so it carries no body of its own. */
export function logout() {
  return requestEmpty("/api/auth/logout", { method: "POST", auth: true });
}
