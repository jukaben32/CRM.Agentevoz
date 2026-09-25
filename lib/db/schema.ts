import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  time,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// 1. Negocios (Inquilinos)
export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default("America/Santo_Domingo"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 2. Usuarios del sistema
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 3. Membresías
export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "staff"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.businessId] })
  ]
);

// 4. Sesiones opacas
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  userAgent: text("user_agent"),
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 5. Agentes de Voz
export const voiceAgents = pgTable("voice_agents", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  systemPrompt: text("system_prompt").notNull(),
  systemPromptOverride: text("system_prompt_override"),
  firstMessage: text("first_message").notNull(),
  tone: text("tone").notNull().default("cercano y resolutivo"),
  voiceProvider: text("voice_provider").notNull().default("11labs"),
  voiceId: text("voice_id").notNull().default("UOIqAnmS11Reiei1Ytkc"),
  voiceModel: text("voice_model").default("eleven_turbo_v2_5"),
  voiceLanguage: text("voice_language").default("es"),
  language: text("language").notNull().default("es"),
  model: jsonb("model").notNull().default({ provider: "openai", model: "gpt-4.1-mini" }),
  transcriber: jsonb("transcriber").notNull().default({ provider: "deepgram", model: "nova-3-general", language: "es" }),
  handoffNumber: text("handoff_number"),
  handoffMessage: text("handoff_message").notNull().default("Te transfiero con un compañero del taller para que te ayude."),
  slotCapacity: integer("slot_capacity").notNull().default(1),
  minNoticeMinutes: integer("min_notice_minutes").notNull().default(60),
  bookingHorizonDays: integer("booking_horizon_days").notNull().default(14),
  vapiAssistantId: text("vapi_assistant_id"),
  vapiPhoneNumberId: text("vapi_phone_number_id"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 6. Preguntas frecuentes (business_facts)
export const businessFacts = pgTable("business_facts", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 7. Catálogo de Servicios
export const services = pgTable("services", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  priceCents: integer("price_cents"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 8. Horarios semanales
export const businessHours = pgTable("business_hours", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  weekday: integer("weekday").notNull(),
  opensAt: time("opens_at").notNull(),
  closesAt: time("closes_at").notNull(),
  isClosed: boolean("is_closed").notNull().default(false),
});

// 9. Cierres y festivos
export const closures = pgTable("closures", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 10. Contactos (CRM)
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  company: text("company"),
  notes: text("notes"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  status: text("status", { enum: ["lead", "cliente", "inactivo"] }).notNull().default("lead"),
  source: text("source", { enum: ["agente_voz", "manual", "importado"] }).notNull().default("manual"),
  customFields: jsonb("custom_fields").notNull().default({}),
  outboundConsent: boolean("outbound_consent").notNull().default(false),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 11. Notas de contacto
export const contactNotes = pgTable("contact_notes", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 12. Llamadas
export const calls = pgTable("calls", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  vapiCallId: text("vapi_call_id").notNull().unique(),
  direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
  fromNumber: text("from_number"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  status: text("status", {
    enum: ["scheduled", "queued", "ringing", "in-progress", "forwarding", "ended"],
  })
    .notNull()
    .default("queued"),
  endedReason: text("ended_reason"),
  summary: text("summary"),
  costCents: integer("cost_cents").notNull().default(0),
  recordingUrl: text("recording_url"),
  needsReview: boolean("needs_review").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 13. Mensajes de llamada (transcripción turno a turno)
export const callMessages = pgTable("call_messages", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  callId: uuid("call_id")
    .notNull()
    .references(() => calls.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["assistant", "user", "system", "tool"] }).notNull(),
  content: text("content").notNull(),
  secondsFromStart: integer("seconds_from_start"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 14. Citas (Appointments)
export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  callId: uuid("call_id").references(() => calls.id, { onDelete: "set null" }),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
  serviceName: text("service_name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: text("status", {
    enum: ["agendada", "confirmada", "completada", "anulada", "no_show"],
  })
    .notNull()
    .default("agendada"),
  notes: text("notes"),
  createdVia: text("created_via", { enum: ["agente_voz", "panel"] }).notNull().default("panel"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 15. Registro de Eventos Webhook
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  businessId: uuid("business_id").references(() => businesses.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("vapi"),
  eventType: text("event_type").notNull(),
  externalId: text("external_id").notNull().unique(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  error: text("error"),
});

// 16. Tools Compartidas de VAPI
export const vapiTools = pgTable("vapi_tools", {
  name: text("name").primaryKey(),
  vapiToolId: text("vapi_tool_id").notNull(),
  checksum: text("checksum").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

// Tipos inferidos
export type Business = typeof businesses.$inferSelect;
export type User = typeof users.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type VoiceAgent = typeof voiceAgents.$inferSelect;
export type BusinessFact = typeof businessFacts.$inferSelect;
export type Service = typeof services.$inferSelect;
export type BusinessHour = typeof businessHours.$inferSelect;
export type Closure = typeof closures.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type ContactNote = typeof contactNotes.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type CallMessage = typeof callMessages.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type VapiTool = typeof vapiTools.$inferSelect;
