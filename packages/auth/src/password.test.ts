import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
  });

  it("produces a different hash for the same password each time (random salt)", async () => {
    const [hashA, hashB] = await Promise.all([hashPassword("same-password"), hashPassword("same-password")]);
    expect(hashA).not.toEqual(hashB);
  });

  it("never stores the plaintext password in the hash output", async () => {
    const hash = await hashPassword("super-secret-value");
    expect(hash).not.toContain("super-secret-value");
  });
});
