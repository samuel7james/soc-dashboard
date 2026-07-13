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
});
