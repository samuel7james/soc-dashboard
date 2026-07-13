import { hash, verify } from "@node-rs/argon2";

// @node-rs/argon2 defaults to the Argon2id variant, which is the OWASP-recommended
// choice (resistant to both GPU cracking and side-channel attacks).
export async function hashPassword(plainTextPassword: string): Promise<string> {
  return hash(plainTextPassword);
}

export async function verifyPassword(passwordHash: string, plainTextPassword: string): Promise<boolean> {
  return verify(passwordHash, plainTextPassword);
}
