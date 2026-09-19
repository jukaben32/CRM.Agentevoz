import React from "react";
import { requireSession, getProfileData } from "@/lib/auth/guards";
import { withTenant } from "@/lib/db/tenant";
import { businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ProfileView } from "@/components/profile-view";

export default async function PerfilPage() {
  const session = await requireSession();
  const profileData = await getProfileData(session.userId);

  if (!profileData) {
    redirect("/login");
  }

  const business = await withTenant(session.businessId, async (tx) => {
    const [b] = await tx
      .select({
        id: businesses.id,
        name: businesses.name,
        timezone: businesses.timezone,
      })
      .from(businesses)
      .where(eq(businesses.id, session.businessId))
      .limit(1);
    return b;
  });

  return (
    <ProfileView
      user={profileData.user}
      activeSessions={profileData.activeSessions}
      business={business}
      role={session.role}
    />
  );
}
