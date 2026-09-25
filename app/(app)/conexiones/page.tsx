import React from "react";
import { requireSession } from "@/lib/auth/guards";
import { withTenant } from "@/lib/db/tenant";
import { voiceAgents, vapiTools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { ConnectionsView } from "@/components/connections-view";

export default async function ConexionesPage() {
  const session = await requireSession();

  const { agent, tools } = await withTenant(session.businessId, async (tx) => {
    const [ag] = await tx
      .select()
      .from(voiceAgents)
      .where(eq(voiceAgents.businessId, session.businessId))
      .limit(1);

    const tls = await tx.select().from(vapiTools);

    return {
      agent: ag || null,
      tools: tls || [],
    };
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
      <ConnectionsView
        agent={agent}
        tools={tools}
        appUrl={env.APP_URL}
      />
    </div>
  );
}
