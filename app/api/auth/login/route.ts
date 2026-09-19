import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

// Rate limiting simple en memoria por IP y email
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Por favor, introduce tu correo y contraseña." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rateKey = `${ip}_${normalizedEmail}`;
    const now = Date.now();

    // Comprobar rate limit (máx 6 intentos por cada 5 minutos)
    const attempt = loginAttempts.get(rateKey);
    if (attempt && attempt.resetAt > now) {
      if (attempt.count >= 6) {
        return NextResponse.json(
          { error: "Demasiados intentos fallidos. Por favor, espera 5 minutos." },
          { status: 429 }
        );
      }
    }

    const client = await pool.connect();
    let user: any = null;
    try {
      const { rows } = await client.query(
        "SELECT id, email, password_hash, full_name FROM users WHERE email = $1 LIMIT 1",
        [normalizedEmail]
      );
      if (rows.length > 0) user = rows[0];
    } finally {
      client.release();
    }

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      const current = loginAttempts.get(rateKey);
      loginAttempts.set(rateKey, {
        count: (current?.count || 0) + 1,
        resetAt: current && current.resetAt > now ? current.resetAt : now + 5 * 60 * 1000,
      });

      return NextResponse.json(
        { error: "Credenciales incorrectas. Verifica tu correo o contraseña." },
        { status: 401 }
      );
    }

    // Limpiar intentos tras éxito
    loginAttempts.delete(rateKey);

    // Crear sesión
    const userAgent = req.headers.get("user-agent");
    await createSession(user.id, userAgent, ip);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error en login:", err);
    return NextResponse.json(
      { error: "Ha ocurrido un error al iniciar sesión. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
