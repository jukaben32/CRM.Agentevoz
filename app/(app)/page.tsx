import React from "react";
import Link from "next/link";
import { requireSession } from "@/lib/auth/guards";
import { withTenant } from "@/lib/db/tenant";
import { calls, appointments, contacts, voiceAgents } from "@/lib/db/schema";
import { eq, desc, gte, and, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import {
  PhoneCall,
  CalendarCheck,
  CurrencyDollar,
  TrendUp,
  Clock,
  UserPlus,
  CheckCircle,
  WarningCircle,
  ArrowRight,
  Waveform,
} from "@phosphor-icons/react/dist/ssr";
import { DashboardCharts } from "@/components/dashboard-charts";
import { formatPhoneForDisplay } from "@/lib/phone";
import { CALL_STATUS_LABELS, getStatusBadgeStyle } from "@/lib/labels";

interface PageProps {
  searchParams: Promise<{ periodo?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const { periodo = "30d" } = await searchParams;

  const now = DateTime.now().setZone(session.businessTimezone || "Europe/Madrid");
  let startDate: DateTime;

  if (periodo === "7d") {
    startDate = now.minus({ days: 7 }).startOf("day");
  } else if (periodo === "12m") {
    startDate = now.minus({ months: 12 }).startOf("month");
  } else if (periodo === "anos") {
    startDate = now.minus({ years: 3 }).startOf("year");
  } else {
    // 30d por defecto
    startDate = now.minus({ days: 30 }).startOf("day");
  }

  const {
    metrics,
    chartData,
    recentCalls,
    systemStatus,
  } = await withTenant(session.businessId, async (tx) => {
    // 1. Métricas del periodo
    const [periodStats] = await tx
      .select({
        totalCalls: sql<number>`count(*)::int`,
        totalCostCents: sql<number>`coalesce(sum(${calls.costCents}), 0)::int`,
        avgDurationSec: sql<number>`coalesce(avg(${calls.durationSeconds}), 0)::int`,
      })
      .from(calls)
      .where(and(eq(calls.businessId, session.businessId), gte(calls.startedAt, startDate.toJSDate())));

    // Llamadas hoy
    const todayStart = now.startOf("day").toJSDate();
    const [todayCalls] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(calls)
      .where(and(eq(calls.businessId, session.businessId), gte(calls.startedAt, todayStart)));

    // Citas por voz
    const [voiceAppointments] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          eq(appointments.businessId, session.businessId),
          eq(appointments.createdVia, "agente_voz"),
          gte(appointments.createdAt, startDate.toJSDate())
        )
      );

    // Citas pendientes
    const [pendingAppointments] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          eq(appointments.businessId, session.businessId),
          gte(appointments.startsAt, new Date()),
          eq(appointments.status, "agendada")
        )
      );

    // Contactos captados por voz
    const [voiceContacts] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(
        and(
          eq(contacts.businessId, session.businessId),
          eq(contacts.source, "agente_voz"),
          gte(contacts.createdAt, startDate.toJSDate())
        )
      );

    // 2. Últimas llamadas
    const recent = await tx
      .select({
        id: calls.id,
        direction: calls.direction,
        fromNumber: calls.fromNumber,
        startedAt: calls.startedAt,
        durationSeconds: calls.durationSeconds,
        status: calls.status,
        summary: calls.summary,
        costCents: calls.costCents,
        contactName: contacts.fullName,
      })
      .from(calls)
      .leftJoin(contacts, eq(contacts.id, calls.contactId))
      .where(eq(calls.businessId, session.businessId))
      .orderBy(desc(calls.startedAt))
      .limit(6);

    // 3. Estado del sistema
    const [agent] = await tx
      .select()
      .from(voiceAgents)
      .where(eq(voiceAgents.businessId, session.businessId))
      .limit(1);

    // 4. Datos para gráficas diarias
    const allCallsInPeriod = await tx
      .select({
        date: calls.startedAt,
        costCents: calls.costCents,
      })
      .from(calls)
      .where(and(eq(calls.businessId, session.businessId), gte(calls.startedAt, startDate.toJSDate())));

    const allAppsInPeriod = await tx
      .select({
        date: appointments.createdAt,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.businessId, session.businessId),
          gte(appointments.createdAt, startDate.toJSDate())
        )
      );

    // Generar buckets según el periodo
    const chartBuckets: Array<{ label: string; llamadas: number; citas: number; coste: number }> = [];
    let cur = startDate;

    if (periodo === "12m" || periodo === "anos") {
      const endMonth = now.startOf("month");
      while (cur <= endMonth) {
        const monthLabel = cur.setLocale("es").toFormat("LLL yyyy");
        const nextCur = cur.plus({ months: 1 });

        const callsCount = allCallsInPeriod.filter((c) => {
          if (!c.date) return false;
          const d = DateTime.fromJSDate(c.date, { zone: session.businessTimezone });
          return d >= cur && d < nextCur;
        }).length;

        const appsCount = allAppsInPeriod.filter((a) => {
          if (!a.date) return false;
          const d = DateTime.fromJSDate(a.date, { zone: session.businessTimezone });
          return d >= cur && d < nextCur;
        }).length;

        const costTotal = allCallsInPeriod
          .filter((c) => {
            if (!c.date) return false;
            const d = DateTime.fromJSDate(c.date, { zone: session.businessTimezone });
            return d >= cur && d < nextCur;
          })
          .reduce((acc, c) => acc + (c.costCents || 0) / 100, 0);

        chartBuckets.push({
          label: monthLabel,
          llamadas: callsCount,
          citas: appsCount,
          coste: Number(costTotal.toFixed(2)),
        });

        cur = nextCur;
      }
    } else {
      const endDay = now.startOf("day");
      while (cur <= endDay) {
        const dayLabel = cur.setLocale("es").toFormat("dd LLL");
        const nextCur = cur.plus({ days: 1 });

        const callsCount = allCallsInPeriod.filter((c) => {
          if (!c.date) return false;
          const d = DateTime.fromJSDate(c.date, { zone: session.businessTimezone });
          return d >= cur && d < nextCur;
        }).length;

        const appsCount = allAppsInPeriod.filter((a) => {
          if (!a.date) return false;
          const d = DateTime.fromJSDate(a.date, { zone: session.businessTimezone });
          return d >= cur && d < nextCur;
        }).length;

        const costTotal = allCallsInPeriod
          .filter((c) => {
            if (!c.date) return false;
            const d = DateTime.fromJSDate(c.date, { zone: session.businessTimezone });
            return d >= cur && d < nextCur;
          })
          .reduce((acc, c) => acc + (c.costCents || 0) / 100, 0);

        chartBuckets.push({
          label: dayLabel,
          llamadas: callsCount,
          citas: appsCount,
          coste: Number(costTotal.toFixed(2)),
        });

        cur = nextCur;
      }
    }

    const totalCalls = periodStats.totalCalls || 0;
    const voiceAppCount = voiceAppointments.count || 0;
    const conversionRate = totalCalls > 0 ? Math.round((voiceAppCount / totalCalls) * 100) : 0;
    const totalCostUsd = ((periodStats.totalCostCents || 0) / 100).toFixed(2);
    const avgCostUsd =
      totalCalls > 0 ? ((periodStats.totalCostCents || 0) / 100 / totalCalls).toFixed(2) : "0.00";

    return {
      metrics: {
        totalCalls,
        callsToday: todayCalls.count || 0,
        totalCostUsd,
        avgCostUsd,
        voiceAppointments: voiceAppCount,
        pendingAppointments: pendingAppointments.count || 0,
        conversionRate,
        avgDurationSec: periodStats.avgDurationSec || 0,
        newContacts: voiceContacts.count || 0,
      },
      chartData: chartBuckets,
      recentCalls: recent,
      systemStatus: {
        agentConfigured: Boolean(agent?.vapiAssistantId),
        phoneAttached: Boolean(agent?.vapiPhoneNumberId),
        lastPublished: agent?.publishedAt,
      },
    };
  });

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Cabecera & Selector de Periodo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Panel de control
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Rendimiento del recepcionista telefónico y actividad del taller
          </p>
        </div>

        {/* Selector segmentado en píldora */}
        <div className="seg-container">
          <Link
            href="/?periodo=7d"
            className={`seg-item ${periodo === "7d" ? "active" : ""}`}
          >
            7 días
          </Link>
          <Link
            href="/?periodo=30d"
            className={`seg-item ${periodo === "30d" ? "active" : ""}`}
          >
            30 días
          </Link>
          <Link
            href="/?periodo=12m"
            className={`seg-item ${periodo === "12m" ? "active" : ""}`}
          >
            12 meses
          </Link>
          <Link
            href="/?periodo=anos"
            className={`seg-item ${periodo === "anos" ? "active" : ""}`}
          >
            Años
          </Link>
        </div>
      </div>

      {/* 6 Tarjetas de Métrica del Periodo (§12 - Vista 1) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Llamadas */}
        <div className="card-saas p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium">Llamadas totales</span>
            <PhoneCall size={18} className="text-orange-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {metrics.totalCalls}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              <strong>{metrics.callsToday}</strong> hoy
            </div>
          </div>
        </div>

        {/* 2. Coste en USD */}
        <div className="card-saas p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium">Coste llamadas</span>
            <CurrencyDollar size={18} className="text-teal-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              ${metrics.totalCostUsd}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              ~${metrics.avgCostUsd} / llamada
            </div>
          </div>
        </div>

        {/* 3. Citas por Teléfono */}
        <div className="card-saas p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium">Citas por teléfono</span>
            <CalendarCheck size={18} className="text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {metrics.voiceAppointments}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              <strong>{metrics.pendingAppointments}</strong> pendientes en agenda
            </div>
          </div>
        </div>

        {/* 4. Tasa de Conversión */}
        <div className="card-saas p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium">Tasa de conversión</span>
            <TrendUp size={18} className="text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {metrics.conversionRate}%
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              Llamadas que cierran cita
            </div>
          </div>
        </div>

        {/* 5. Duración Media */}
        <div className="card-saas p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium">Duración media</span>
            <Clock size={18} className="text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {Math.floor(metrics.avgDurationSec / 60)}m {metrics.avgDurationSec % 60}s
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              Por conversación de voz
            </div>
          </div>
        </div>

        {/* 6. Contactos Nuevos */}
        <div className="card-saas p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium">Contactos nuevos</span>
            <UserPlus size={18} className="text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {metrics.newContacts}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              Captados automáticamente
            </div>
          </div>
        </div>
      </div>

      {/* 2 Gráficas Lado a Lado (Recharts) */}
      <DashboardCharts data={chartData} />

      {/* Bloque Inferior: Últimas llamadas & Estado del Sistema */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Últimas Llamadas (2 columnas) */}
        <div className="card-saas p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Últimas llamadas atendidas
              </h2>
              <p className="text-xs text-stone-500">Historial reciente de conversaciones telefónicas</p>
            </div>
            <Link
              href="/conversaciones"
              className="text-xs text-orange-600 dark:text-orange-400 font-medium hover:underline flex items-center gap-1"
            >
              <span>Ver todas</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {recentCalls.length === 0 ? (
            <div className="texture-stripes rounded-xl p-8 text-center text-stone-400 text-xs">
              No hay llamadas registradas en este taller todavía.
            </div>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {recentCalls.map((c) => {
                const dateStr = c.startedAt
                  ? DateTime.fromJSDate(c.startedAt, { zone: session.businessTimezone }).toFormat(
                      "dd LLL, HH:mm"
                    )
                  : "—";
                const badgeStyle = getStatusBadgeStyle(c.status);

                return (
                  <div key={c.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-600 shrink-0">
                        <Waveform size={16} />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {c.contactName || formatPhoneForDisplay(c.fromNumber)}
                        </div>
                        <div className="text-[11px] text-stone-500 truncate">
                          {c.summary || (c.contactName ? formatPhoneForDisplay(c.fromNumber) : "Llamada sin resumen")}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] font-mono text-stone-600 dark:text-stone-400">
                        ${((c.costCents || 0) / 100).toFixed(2)}
                      </span>
                      <span className="text-[11px] text-stone-400">{dateStr}</span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                      >
                        {CALL_STATUS_LABELS[c.status as keyof typeof CALL_STATUS_LABELS] || c.status}
                      </span>
                      <Link
                        href={`/conversaciones?id=${c.id}`}
                        className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium"
                      >
                        Ver
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel de Estado del Sistema (1 columna) */}
        <div className="card-saas p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">
              Estado del sistema
            </h2>
            <p className="text-xs text-stone-500 mb-5">Conexión con infraestructura y VAPI</p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-stone-900 dark:text-stone-200">
                    PostgreSQL 18 & RLS
                  </div>
                  <div className="text-[11px] text-stone-500">Conectado y aislado por inquilino</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                {systemStatus.agentConfigured ? (
                  <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <WarningCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-medium text-stone-900 dark:text-stone-200">
                    Asistente de Voz en VAPI
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {systemStatus.agentConfigured
                      ? "Asistente provisionado correctamente"
                      : "Pendiente de publicación en VAPI"}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                {systemStatus.phoneAttached ? (
                  <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <WarningCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-medium text-stone-900 dark:text-stone-200">
                    Número telefónico
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {systemStatus.phoneAttached ? "Número vinculado al asistente" : "Sin número asignado"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-stone-100 dark:border-stone-800 mt-6">
            <Link
              href="/conexiones"
              className="btn btn-secondary w-full text-xs flex items-center justify-center gap-2"
            >
              <span>Gestionar conexiones VAPI</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
