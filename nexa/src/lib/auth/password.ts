import bcrypt from "bcryptjs";

/**
 * Password hashing. bcryptjs is pure-JS (no native build) so it runs anywhere
 * the app deploys, including edge-adjacent Node runtimes. Cost 12 is a sane
 * 2025 default (~250ms/hash).
 */
const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
