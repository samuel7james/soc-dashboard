import { apiFetch } from "./client";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string;
}

export async function fetchCsrfToken(): Promise<void> {
  await apiFetch("/api/v1/csrf");
}

export async function login(email: string, password: string): Promise<{ user: AuthUser }> {
  return apiFetch("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch("/api/v1/auth/logout", { method: "POST" });
}

export async function fetchMe(): Promise<{ user: AuthUser }> {
  return apiFetch("/api/v1/auth/me");
}
