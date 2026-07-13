import {
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  signAccessToken,
  verifyPassword,
} from "@soc/auth";
import { prisma, type Prisma, type User } from "@soc/database";

import { env } from "../config/env.js";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Computed once (real argon2id hash of an unguessable, unused value) so the
// "user not found" path still pays the same argon2 cost as a real verification
// instead of hand-rolling a PHC string that might fail to parse.
let dummyPasswordHash: Promise<string> | undefined;
function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= hashPassword(generateRefreshToken());
  return dummyPasswordHash;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export class AccountInactiveError extends Error {
  constructor() {
    super("Account is inactive");
    this.name = "AccountInactiveError";
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super("Invalid or expired refresh token");
    this.name = "InvalidRefreshTokenError";
  }
}

export interface RequestContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface AuthResult {
  user: Pick<User, "id" | "email" | "name" | "role">;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

async function issueSession(user: User, ctx: RequestContext): Promise<AuthResult> {
  const accessToken = await signAccessToken(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_ACCESS_SECRET,
    ACCESS_TOKEN_TTL,
  );

  const refreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  const sessionData: Prisma.SessionUncheckedCreateInput = {
    userId: user.id,
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshTokenExpiresAt,
  };
  if (ctx.ipAddress !== undefined) sessionData.ipAddress = ctx.ipAddress;
  if (ctx.userAgent !== undefined) sessionData.userAgent = ctx.userAgent;

  await prisma.session.create({ data: sessionData });

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    accessToken,
    refreshToken,
    refreshTokenExpiresAt,
  };
}

export async function login(email: string, password: string, ctx: RequestContext): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always run the verify step, even with no user, so a nonexistent-account
  // response takes the same time as a wrong-password one (mitigates
  // user-enumeration via timing).
  const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash());
  const passwordMatches = await verifyPassword(passwordHash, password);

  if (!user || !passwordMatches) {
    throw new InvalidCredentialsError();
  }

  if (!user.isActive) {
    throw new AccountInactiveError();
  }

  return issueSession(user, ctx);
}

export async function refresh(refreshToken: string, ctx: RequestContext): Promise<AuthResult> {
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash },
    include: { user: true },
  });

  if (!session) {
    throw new InvalidRefreshTokenError();
  }

  if (session.revokedAt) {
    // This token was already rotated away — presenting it again means either a
    // replay of an old request or an attacker holding a stolen copy. Either
    // way, the safest response is to kill every active session for this user.
    await prisma.session.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new InvalidRefreshTokenError();
  }

  if (session.expiresAt < new Date()) {
    throw new InvalidRefreshTokenError();
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  if (!session.user.isActive) {
    throw new AccountInactiveError();
  }

  return issueSession(session.user, ctx);
}

export async function logout(refreshToken: string): Promise<void> {
  const refreshTokenHash = hashRefreshToken(refreshToken);
  await prisma.session.updateMany({
    where: { refreshTokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
