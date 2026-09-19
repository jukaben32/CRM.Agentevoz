import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { getAdminDatabaseUrl } from "../lib/env";
import { pool } from "../lib/db";
import { withTenant } from "../lib/db/tenant";
import { contacts } from "../lib/db/schema";
import { eq } from "drizzle-orm";

const { Client } = pg;

describe("Seguridad RLS (Row Level Security) y Aislamiento Multi-Tenant", () => {
  let businessAId: string | undefined;
  let businessBId: string | undefined;
  let contactAId: string | undefined;
  let dbAvailable = false;

  before(async () => {
    try {
      const adminClient = new Client({ connectionString: getAdminDatabaseUrl() });
      await adminClient.connect();
      try {
        const { rows: bA } = await adminClient.query<{ id: string }>(
          "INSERT INTO businesses (name, slug, phone) VALUES ('Taller Test A', 'taller-test-a', '+34910000001') RETURNING id"
        );
        businessAId = bA[0].id;

        const { rows: bB } = await adminClient.query<{ id: string }>(
          "INSERT INTO businesses (name, slug, phone) VALUES ('Taller Test B', 'taller-test-b', '+34910000002') RETURNING id"
        );
        businessBId = bB[0].id;

        const { rows: cA } = await adminClient.query<{ id: string }>(
          "INSERT INTO contacts (business_id, full_name, phone) VALUES ($1, 'Cliente Test A', '+34600111222') RETURNING id",
          [businessAId]
        );
        contactAId = cA[0].id;
        dbAvailable = true;
      } finally {
        await adminClient.end();
      }
    } catch (err: any) {
      dbAvailable = false;
    }
  });

  after(async () => {
    if (!dbAvailable) {
      await pool.end().catch(() => {});
      return;
    }
    try {
      const adminClient = new Client({ connectionString: getAdminDatabaseUrl() });
      await adminClient.connect();
      try {
        if (businessAId) await adminClient.query("DELETE FROM businesses WHERE id = $1", [businessAId]);
        if (businessBId) await adminClient.query("DELETE FROM businesses WHERE id = $1", [businessBId]);
      } finally {
        await adminClient.end();
      }
    } catch {
      // Ignorar en limpieza
    } finally {
      await pool.end().catch(() => {});
    }
  });

  it("el tenant A debe poder ver sus propios contactos", async (t) => {
    if (!dbAvailable || !businessAId || !contactAId) {
      t.skip("Prueba RLS omitida: base de datos local no disponible");
      return;
    }

    const result = await withTenant(businessAId, async (tx) => {
      return await tx.select().from(contacts).where(eq(contacts.id, contactAId!));
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].fullName, "Cliente Test A");
  });

  it("el tenant B NO debe poder ver los contactos del tenant A bajo RLS", async (t) => {
    if (!dbAvailable || !businessBId || !contactAId) {
      t.skip("Prueba RLS omitida: base de datos local no disponible");
      return;
    }

    const result = await withTenant(businessBId, async (tx) => {
      return await tx.select().from(contacts).where(eq(contacts.id, contactAId!));
    });

    assert.equal(result.length, 0);
  });
});
