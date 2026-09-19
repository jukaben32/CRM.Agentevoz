import pg from "pg";
import fs from "fs";
import path from "path";
import { getAdminDatabaseUrl, toPgConnectionOptions } from "../lib/env";

const { Client } = pg;

async function runMigrations() {
  console.log("🚀 Iniciando migrador de base de datos PostgreSQL 18...");
  const client = new Client(toPgConnectionOptions(getAdminDatabaseUrl()));

  await client.connect();

  try {
    // 1. Tomar bloqueo consultivo exclusivo para migraciones
    console.log("🔒 Adquiriendo pg_advisory_lock para migraciones seguras...");
    await client.query("SELECT pg_advisory_lock(7429183)");

    // 2. Asegurar tabla de control de versiones
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id serial PRIMARY KEY,
        name text NOT NULL UNIQUE,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // 3. Obtener migraciones ya aplicadas
    const { rows: appliedRows } = await client.query<{ name: string }>(
      "SELECT name FROM schema_migrations ORDER BY id ASC"
    );
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    // 4. Leer archivos en db/migrations
    const migrationsDir = path.join(process.cwd(), "db", "migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.log("📁 Directorio db/migrations no encontrado.");
      return;
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        console.log(`⏩ Migración ya aplicada: ${file}`);
        continue;
      }

      console.log(`▶️ Aplicando migración: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sqlContent);
        await client.query(
          "INSERT INTO schema_migrations (name) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(`✅ Migración completada con éxito: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`❌ Error al aplicar migración ${file}:`, err);
        throw err;
      }
    }

    console.log("🎉 Todas las migraciones se han ejecutado correctamente.");
  } finally {
    // Liberar bloqueo consultivo
    await client.query("SELECT pg_advisory_unlock(7429183)");
    await client.end();
  }
}

runMigrations().catch((err) => {
  console.error("Fatal: Falló la ejecución de migraciones:", err);
  process.exit(1);
});
