import React from "react";
import { requireSession } from "@/lib/auth/guards";
import { withTenant } from "@/lib/db/tenant";
import {
  businesses,
  voiceAgents,
  services,
  businessHours,
  businessFacts,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getEffectivePrompt } from "@/lib/vapi/prompt";
import { AgentSettingsView } from "@/components/agent-settings-view";

export default async function EstudioPage() {
  const session = await requireSession();

  const data = await withTenant(session.businessId, async (tx) => {
    const [business] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.id, session.businessId))
      .limit(1);

    const [agent] = await tx
      .select()
      .from(voiceAgents)
      .where(eq(voiceAgents.businessId, session.businessId))
      .limit(1);

    const srvs = await tx
      .select()
      .from(services)
      .where(eq(services.businessId, session.businessId))
      .orderBy(asc(services.sortOrder));

    const hours = await tx
      .select()
      .from(businessHours)
      .where(eq(businessHours.businessId, session.businessId))
      .orderBy(asc(businessHours.weekday));

    const facts = await tx
      .select()
      .from(businessFacts)
      .where(eq(businessFacts.businessId, session.businessId))
      .orderBy(asc(businessFacts.sortOrder));

    const { prompt: effectivePrompt, isOverride } = getEffectivePrompt({
      business,
      agent,
      hours,
      services: srvs,
      facts,
    });

    return {
      business,
      agent,
      services: srvs,
      hours,
      facts,
      effectivePrompt,
      isPromptOverride: isOverride,
    };
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          Ajustes del Agente de Voz
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          Configuración completa de personalidad, modelos de IA, catálogo de servicios y publicación en VAPI
        </p>
      </div>

      <AgentSettingsView
        business={data.business}
        agent={data.agent}
        services={data.services}
        hours={data.hours}
        facts={data.facts}
        effectivePrompt={data.effectivePrompt}
        isPromptOverride={data.isPromptOverride}
      />
    </div>
  );
}
