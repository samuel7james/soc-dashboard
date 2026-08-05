import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { InvalidAccessTokenError, signAccessToken, verifyAccessToken } from "./access-token";

const SECRET = "test-secret-that-is-long-enough-1234567890";
const OTHER_SECRET = "a-completely-different-secret-abcdefghijkl";

describe("access tokens", () => {
  it("round-trips a signed token", async () => {
    const token = await signAccessToken({ sub: "user-1", email: "a@example.com", role: "analyst" }, SECRET);
    const payload = await verifyAccessToken(token, SECRET);

    expect(payload).toEqual({ sub: "user-1", email: "a@example.com", role: "analyst" });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signAccessToken({ sub: "user-1", email: "a@example.com", role: "analyst" }, SECRET);

    await expect(verifyAccessToken(token, OTHER_SECRET)).rejects.toThrow(InvalidAccessTokenError);
  });

  it("rejects an expired token", async () => {
    const token = await signAccessToken(
      { sub: "user-1", email: "a@example.com", role: "analyst" },
      SECRET,
      "-1s",
    );

    await expect(verifyAccessToken(token, SECRET)).rejects.toThrow(InvalidAccessTokenError);
  });

  it("rejects a malformed token", async () => {
    await expect(verifyAccessToken("not-a-jwt", SECRET)).rejects.toThrow(InvalidAccessTokenError);
  });

  // Every case above is rejected by jwtVerify itself — bad signature, expiry,
  // unparseable — so none of them ever reach the payload-shape guard. This one
  // is signed correctly with the real secret and passes verification, leaving
  // the guard as the only thing standing between a claim-less token and a
  // request being treated as authenticated.
  it("rejects a validly-signed token whose payload is missing claims", async () => {
    const token = await new SignJWT({ sub: "user-1", role: "analyst" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(SECRET));

    await expect(verifyAccessToken(token, SECRET)).rejects.toThrow(InvalidAccessTokenError);
  });
});
