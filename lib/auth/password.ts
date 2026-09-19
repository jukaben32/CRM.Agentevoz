import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hashea una contraseña en texto plano usando bcrypt con coste 12
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compara una contraseña en texto plano contra su hash bcrypt
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
