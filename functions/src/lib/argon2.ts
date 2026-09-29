import { hash, verify } from "@node-rs/argon2";

/** Parámetros fijados por el plan de seguridad: m=19456, t=2, p=1 (no bcrypt, límite de 72 bytes). */
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string, pepper: string): Promise<string> {
  return hash(password + pepper, ARGON2_OPTIONS);
}

export async function verifyPassword(hashGuardado: string, password: string, pepper: string): Promise<boolean> {
  return verify(hashGuardado, password + pepper);
}
