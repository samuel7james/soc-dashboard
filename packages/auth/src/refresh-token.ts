import { createHash, randomBytes } from "node:crypto";

// Refresh tokens are opaque (not JWTs) — the server is the only party that
// needs to interpret them, so there's no benefit to a self-describing token,
// and an opaque one can't leak claims if it ends up somewhere it shouldn't.
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

// Only the hash is ever persisted; a database read alone can't be replayed as a session.
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
