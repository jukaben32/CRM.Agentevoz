import { DateTime, Interval } from "luxon";
import { TenantDb } from "@/lib/db/tenant";
import {
  businesses,
  voiceAgents,
  businessHours,
  closures,
  appointments,
  services,
} from "@/lib/db/schema";
import { eq, and, gte, lte, ne, asc } from "drizzle-orm";

export interface AvailableSlot {
  startIso: string;
  endIso: string;
  textoHablado: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Convierte una fecha y hora en texto en español natural para que el agente de voz lo verbalice
 * Ejemplo: "el jueves 14 de agosto a las diez y media de la mañana"
 */
export function formatSlotForSpeech(dt: DateTime): string {
  const diaSemana = dt.setLocale("es").toFormat("cccc"); // lunes, martes...
  const diaNumero = dt.day;
  const mes = dt.setLocale("es").toFormat("LLLL"); // enero, febrero...
  
  const hora = dt.hour;
  const minutos = dt.minute;
  
  let textoHora = "";
  if (minutos === 0) {
    textoHora = `a las ${hora === 1 ? "la una" : hora}`;
  } else if (minutos === 30) {
    textoHora = `a las ${hora === 1 ? "la una" : hora} y media`;
  } else if (minutos === 15) {
    textoHora = `a las ${hora === 1 ? "la una" : hora} y cuarto`;
  } else if (minutos === 45) {
    const siguienteHora = (hora % 24) + 1;
    textoHora = `a las ${siguienteHora === 1 ? "la una" : siguienteHora} menos cuarto`;
  } else {
    textoHora = `a las ${hora}:${minutos < 10 ? "0" + minutos : minutos}`;
  }

  const periodo = hora < 14 ? "de la mañana" : hora < 20 ? "de la tarde" : "de la noche";

  return `el ${diaSemana} ${diaNumero} de ${mes} ${textoHora} ${periodo}`;
}

export interface QuerySlotsParams {
  serviceId?: string | null;
  serviceName?: string | null;
  preferredDateIso?: string | null;
  shift?: "manana" | "tarde" | "cualquiera" | null;
  daysAhead?: number;
  maxOptions?: number;
}

/**
 * Calcula los huecos reales disponibles respetando horario semanal, cierres,
 * capacidad simultánea (elevadores/puestos) y citas existentes.
 */
export async function getAvailableSlots(
  tx: TenantDb,
  businessId: string,
  params: QuerySlotsParams = {}
): Promise<AvailableSlot[]> {
  // 1. Obtener datos del negocio y del agente de voz
  const [business] = await tx
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  const [agent] = await tx
    .select()
    .from(voiceAgents)
    .where(eq(voiceAgents.businessId, businessId))
    .limit(1);

  const timezone = business?.timezone || "Europe/Madrid";
  const slotCapacity = agent?.slotCapacity || 1;
  const minNoticeMinutes = agent?.minNoticeMinutes || 60;
  const bookingHorizonDays = Math.min(params.daysAhead || agent?.bookingHorizonDays || 14, 30);
  const maxOptions = params.maxOptions || 3;

  // 2. Determinar duración del servicio solicitado
  let durationMinutes = 60;
  if (params.serviceId) {
    const [srv] = await tx
      .select()
      .from(services)
      .where(and(eq(services.businessId, businessId), eq(services.id, params.serviceId)))
      .limit(1);
    if (srv) durationMinutes = srv.durationMinutes;
  } else if (params.serviceName) {
    const allServices = await tx
      .select()
      .from(services)
      .where(and(eq(services.businessId, businessId), eq(services.isActive, true)));
    const match = allServices.find((s) =>
      s.name.toLowerCase().includes(params.serviceName!.toLowerCase())
    );
    if (match) durationMinutes = match.durationMinutes;
  }

  // 3. Determinar ventana de tiempo a evaluar
  const now = DateTime.now().setZone(timezone);
  const earliestAllowed = now.plus({ minutes: minNoticeMinutes });

  let searchStart = earliestAllowed;
  if (params.preferredDateIso) {
    const parsedPreferred = DateTime.fromISO(params.preferredDateIso, { zone: timezone });
    if (parsedPreferred.isValid && parsedPreferred > earliestAllowed) {
      searchStart = parsedPreferred.startOf("day");
    }
  }

  const searchEnd = searchStart.plus({ days: bookingHorizonDays }).endOf("day");

  // 4. Cargar horarios semanales, cierres y citas existentes
  const weeklyHours = await tx
    .select()
    .from(businessHours)
    .where(and(eq(businessHours.businessId, businessId), eq(businessHours.isClosed, false)));

  const activeClosures = await tx
    .select()
    .from(closures)
    .where(
      and(
        eq(closures.businessId, businessId),
        lte(closures.startsAt, searchEnd.toJSDate()),
        gte(closures.endsAt, searchStart.toJSDate())
      )
    );

  const existingAppointments = await tx
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.businessId, businessId),
        ne(appointments.status, "anulada"),
        lte(appointments.startsAt, searchEnd.toJSDate()),
        gte(appointments.endsAt, searchStart.toJSDate())
      )
    )
    .orderBy(asc(appointments.startsAt));

  // 5. Generar y evaluar franjas de 30 minutos
  const availableSlots: AvailableSlot[] = [];
  let currentDay = searchStart.startOf("day");

  while (currentDay <= searchEnd && availableSlots.length < maxOptions) {
    const weekdayJs = currentDay.weekday % 7; // Luxon weekday 1=Mon..7=Sun -> 0=Sun..6=Sat
    const daySchedules = weeklyHours.filter((h) => h.weekday === weekdayJs);

    for (const schedule of daySchedules) {
      const [openH, openM] = schedule.opensAt.split(":").map(Number);
      const [closeH, closeM] = schedule.closesAt.split(":").map(Number);

      const shiftStart = currentDay.set({ hour: openH, minute: openM, second: 0, millisecond: 0 });
      const shiftEnd = currentDay.set({ hour: closeH, minute: closeM, second: 0, millisecond: 0 });

      let slotStart = shiftStart;

      while (slotStart.plus({ minutes: durationMinutes }) <= shiftEnd) {
        const slotEnd = slotStart.plus({ minutes: durationMinutes });

        // Verificar antelación mínima
        if (slotStart < earliestAllowed) {
          slotStart = slotStart.plus({ minutes: 30 });
          continue;
        }

        // Filtro por franja horaria (mañana/tarde)
        if (params.shift === "manana" && slotStart.hour >= 14) {
          slotStart = slotStart.plus({ minutes: 30 });
          continue;
        }
        if (params.shift === "tarde" && slotStart.hour < 14) {
          slotStart = slotStart.plus({ minutes: 30 });
          continue;
        }

        const slotInterval = Interval.fromDateTimes(slotStart, slotEnd);

        // Verificar si choca con algún cierre
        const collidesWithClosure = activeClosures.some((c) => {
          const closureInterval = Interval.fromDateTimes(
            DateTime.fromJSDate(c.startsAt, { zone: timezone }),
            DateTime.fromJSDate(c.endsAt, { zone: timezone })
          );
          return slotInterval.overlaps(closureInterval);
        });

        if (collidesWithClosure) {
          slotStart = slotStart.plus({ minutes: 30 });
          continue;
        }

        // Contar citas solapadas para verificar capacidad
        const overlappingAppointmentsCount = existingAppointments.filter((app) => {
          const appInterval = Interval.fromDateTimes(
            DateTime.fromJSDate(app.startsAt, { zone: timezone }),
            DateTime.fromJSDate(app.endsAt, { zone: timezone })
          );
          return slotInterval.overlaps(appInterval);
        }).length;

        if (overlappingAppointmentsCount < slotCapacity) {
          availableSlots.push({
            startIso: slotStart.toISO()!,
            endIso: slotEnd.toISO()!,
            textoHablado: formatSlotForSpeech(slotStart),
            startDate: slotStart.toJSDate(),
            endDate: slotEnd.toJSDate(),
          });

          if (availableSlots.length >= maxOptions) {
            break;
          }
        }

        slotStart = slotStart.plus({ minutes: 30 });
      }

      if (availableSlots.length >= maxOptions) break;
    }

    currentDay = currentDay.plus({ days: 1 });
  }

  return availableSlots;
}
