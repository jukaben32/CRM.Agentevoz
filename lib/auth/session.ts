import crypto from "crypto";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { withoutTenant } from "@/lib/db/tenant";
import { sessions, users, memberships, businesses } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

export const SESSION_COOKIE_NAME = "voiceops_session";
const SESSION_DURATION_DAYS = 30;

export interface SessionData {
  sessionId: string;
  userId: string;
  userEmail: string;
  userName: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessTimezone: string;
  role: "owner" | "staff";
}

/**
 * Calcula el hash SHA-256 de un token opaco
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Genera un token aleatorio seguro de 32 bytes en formato base64url
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Crea una nueva sesión en base de datos y establece la cookie httpOnly
 */
export async function createSession(
  userId: string,
  userAgent?: string | null,
  ip?: string | null
): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await withoutTenant(async (db) => {
    await db.insert(sessions).values({
      userId,
      tokenHash,
      expiresAt,
      userAgent: userAgent ?? null,
      ip: ip ?? null,
    });
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

/**
 * Valida la sesión actual desde las cookies, extiende su expiración deslizante y devuelve los datos
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const now = new Date();

  const client = await pool.connect();
  try {
    const { rows } = await client.query<{
      session_id: string;
      user_id: string;
      email: string;
      full_name: string;
      business_id: string;
      business_name: string;
      business_slug: string;
      timezone: string;
      role: "owner" | "staff";
      expires_at: Date;
    }>(
      `SELECT
         s.id AS session_id,
         u.id AS user_id,
         u.email,
         u.full_name,
         b.id AS business_id,
         b.name AS business_name,
         b.slug AS business_slug,
         b.timezone,
         m.role,
         s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN memberships m ON m.user_id = u.id
       JOIN businesses b ON b.id = m.business_id
       WHERE s.token_hash = $1 AND s.expires_at > $2
       LIMIT 1`,
      [tokenHash, now]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];

    // Renovación deslizante si le queda menos de la mitad de su vida
    const timeLeft = new Date(row.expires_at).getTime() - now.getTime();
    if (timeLeft < (SESSION_DURATION_DAYS / 2) * 24 * 60 * 60 * 1000) {
      const newExpiresAt = new Date(now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
      await client.query("UPDATE sessions SET expires_at = $1 WHERE id = $2", [
        newExpiresAt,
        row.session_id,
      ]);
    }

    return {
      sessionId: row.session_id,
      userId: row.user_id,
      userEmail: row.email,
      userName: row.full_name,
      businessId: row.business_id,
      businessName: row.business_name,
      businessSlug: row.business_slug,
      businessTimezone: row.timezone,
      role: row.role,
    };
  } finally {
    client.release();
  }
}

/**
 * Revoca y elimina la sesión actual
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const tokenHash = hashToken(token);
    await withoutTenant(async (db) => {
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
