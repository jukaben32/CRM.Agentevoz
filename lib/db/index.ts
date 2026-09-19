import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getAppDatabaseUrl } from "@/lib/env";
import * as schema from "./schema";

const { Pool } = pg;

// Declaración global para reutilizar el Pool entre recargas en caliente (Next.js hot reload)
declare global {
  var __dbPool: pg.Pool | undefined;
}

function createPool() {
  const connectionString = getAppDatabaseUrl();
  const isCloud = connectionString.includes("supabase.co") ||
    connectionString.includes("pooler.supabase.com") ||
    connectionString.includes("neon.tech") ||
    connectionString.includes("sslmode=require");

  return new Pool({
    connectionString,
    max: process.env.NODE_ENV === "production" ? 10 : 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: isCloud ? { rejectUnauthorized: false } : undefined,
  });
}

export const pool = globalThis.__dbPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__dbPool = pool;
}

export const db = drizzle(pool, { schema });
