import { describe, expect, it } from "vitest";

import { generateRefreshToken, hashRefreshToken } from "./refresh-token";

describe("refresh tokens", () => {
  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateRefreshToken()));
    expect(tokens.size).toBe(50);
  });

  it("hashes deterministically so a stored hash can be matched on refresh", () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toEqual(hashRefreshToken(token));
  });

  it("produces different hashes for different tokens", () => {
    const tokenA = generateRefreshToken();
    const tokenB = generateRefreshToken();
    expect(hashRefreshToken(tokenA)).not.toEqual(hashRefreshToken(tokenB));
  });

  it("never stores the raw token as its own hash", () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).not.toEqual(token);
  });
});
