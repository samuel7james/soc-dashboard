import { jwtVerify, SignJWT } from "jose";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  secret: string,
  expiresIn = "15m",
): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

export class InvalidAccessTokenError extends Error {
  constructor() {
    super("Invalid or expired access token");
    this.name = "InvalidAccessTokenError";
  }
}

export async function verifyAccessToken(token: string, secret: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      throw new InvalidAccessTokenError();
    }

    return { sub: payload.sub, email: payload.email, role: payload.role };
  } catch {
    throw new InvalidAccessTokenError();
  }
}
