import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }

    return NextResponse.json({
      status: "ok",
      db: "connected",
      version: "1.0.0",
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        error: err.message,
      },
      { status: 503 }
    );
  }
}
