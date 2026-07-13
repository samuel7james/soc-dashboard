import type { FastifyInstance, LightMyRequestResponse } from "fastify";

// Exercises the full HTTP surface (cookies, CSRF, RBAC) against a real Fastify
// instance via `inject` — used by every route test so cookie/CSRF handling
// doesn't get re-implemented (and re-drifted) per test file.
export class TestClient {
  private cookies = new Map<string, string>();

  constructor(private readonly app: FastifyInstance) {}

  private cookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  private capture(res: LightMyRequestResponse): void {
    for (const cookie of res.cookies) {
      this.cookies.set(cookie.name, cookie.value);
    }
  }

  clearCookie(name: string): void {
    this.cookies.delete(name);
  }

  cookieValue(name: string): string | undefined {
    return this.cookies.get(name);
  }

  async get(url: string): Promise<LightMyRequestResponse> {
    const res = await this.app.inject({ method: "GET", url, headers: { cookie: this.cookieHeader() } });
    this.capture(res);
    return res;
  }

  private async mutate(
    method: "POST" | "PATCH" | "DELETE",
    url: string,
    payload?: Record<string, unknown>,
  ): Promise<LightMyRequestResponse> {
    const headers: Record<string, string> = { cookie: this.cookieHeader() };
    const csrfToken = this.cookies.get("csrf_token");
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    const res = await this.app.inject({
      method,
      url,
      headers,
      ...(payload !== undefined ? { payload } : {}),
    });
    this.capture(res);
    return res;
  }

  async post(url: string, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> {
    return this.mutate("POST", url, payload);
  }

  async patch(url: string, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> {
    return this.mutate("PATCH", url, payload);
  }

  async delete(url: string): Promise<LightMyRequestResponse> {
    return this.mutate("DELETE", url);
  }

  async primeCsrf(): Promise<void> {
    await this.get("/api/v1/csrf");
  }

  async loginAs(email: string, password: string): Promise<LightMyRequestResponse> {
    await this.primeCsrf();
    return this.post("/api/v1/auth/login", { email, password });
  }
}
