const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

// Providers.tsx also fires a background GET /api/v1/csrf on mount to warm
// this cookie before the user finishes typing — but that's fire-and-forget,
// so nothing here can assume it has landed. A mutating call fired quickly
// enough after page load (fast form-fill/autofill, or a scripted client)
// would otherwise race it and 403. This makes every mutating request
// self-sufficient regardless of whether the background prime won the race.
async function ensureCsrfToken(): Promise<string | undefined> {
  const existing = readCookie("csrf_token");
  if (existing) return existing;
  await fetch(`${API_BASE_URL}/api/v1/csrf`, { credentials: "include" });
  return readCookie("csrf_token");
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {};

  // Only set Content-Type when there's an actual body — some fetch
  // implementations reject "application/json" paired with no body at all.
  if (init?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (!SAFE_METHODS.has(method)) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...headers, ...init?.headers },
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : `Request to ${path} failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// Separate from apiFetch because FormData needs the browser to set its own
// multipart boundary in Content-Type — apiFetch always forces application/json.
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const csrfToken = await ensureCsrfToken();
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : `Upload to ${path} failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}
