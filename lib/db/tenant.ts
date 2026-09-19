import { pool } from "./index";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { sql } from "drizzle-orm";

export type TenantDb = NodePgDatabase<typeof schema>;

/**
 * Ejecuta una operación de base de datos dentro del contexto de inquilino (RLS forzado).
 * 
 * Abre una conexión/transacción del pool, fija de forma parametrizada:
 * `SELECT set_config('app.business_id', $1, true)`
 * y asegura que todas las políticas de Row Level Security apliquen al businessId indicado.
 * 
 * @param businessId UUID del negocio
 * @param callback Función a ejecutar con el cliente transaccional de Drizzle
 */
export async function withTenant<T>(
  businessId: string,
  callback: (tx: TenantDb) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Fija la variable de sesión para esta transacción (is_local = true)
    await client.query("SELECT set_config('app.business_id', $1, true)", [businessId]);
    
    const txDb = drizzle(client, { schema });
    const result = await callback(txDb);
    
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignora error secundario de rollback si la conexión cayó
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ejecuta una operación sin fijar inquilino (para autenticación, registro de webhooks o infraestructura).
 */
export async function withoutTenant<T>(
  callback: (dbClient: TenantDb) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    const dbClient = drizzle(client, { schema });
    return await callback(dbClient);
  } finally {
    client.release();
  }
}
