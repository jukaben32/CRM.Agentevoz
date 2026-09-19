import { redirect } from "next/navigation";
import { getSession, SessionData } from "./session";
import { pool } from "@/lib/db";

/**
 * Exige una sesión activa. Si no existe, redirige a /login.
 * Se utiliza en layouts y Server Components protegidos.
 */
export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Devuelve los datos del perfil del usuario actual junto a sus sesiones activas (Vista 7: Mi perfil).
 */
export async function getProfileData(userId: string) {
  const client = await pool.connect();
  try {
    const { rows: userRows } = await client.query<{
      id: string;
      email: string;
      full_name: string;
      created_at: Date;
    }>(
      "SELECT id, email, full_name, created_at FROM users WHERE id = $1",
      [userId]
    );

    if (userRows.length === 0) return null;

    const { rows: sessionRows } = await client.query<{
      id: string;
      user_agent: string | null;
      ip: string | null;
      created_at: Date;
      expires_at: Date;
    }>(
      `SELECT id, user_agent, ip, created_at, expires_at
       FROM sessions
       WHERE user_id = $1 AND expires_at > now()
       ORDER BY created_at DESC`,
      [userId]
    );

    return {
      user: userRows[0],
      activeSessions: sessionRows,
    };
  } finally {
    client.release();
  }
}
