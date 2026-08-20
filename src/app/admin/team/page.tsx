import { notFound } from "next/navigation";

import { CreateStaffForm } from "@/components/admin/create-staff-form";
import { TeamMemberCard } from "@/components/admin/team-member-card";
import { requireStaff } from "@/lib/auth/dal";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { isStaffE2EAdapterEnabled } from "@/lib/testing/staff-adapter";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ removed?: string; remove?: string; cleanup?: string; saved?: string }>;
}) {
  const session = await requireStaff();
  if (session.role !== "admin") notFound();
  const query = await searchParams;

  const adapterEnabled = isStaffE2EAdapterEnabled();
  const profiles = adapterEnabled
    ? query.removed === "1"
      ? []
      : [{ id: "e2000000-0000-4000-8000-000000000001", display_name: "Test Reviewer", role: "reviewer" as const, active: true, updated_at: "2026-08-06T10:00:00.000Z" }]
    : (await (await createServerSupabaseClient()).from("staff_profiles").select("id,display_name,role,active,updated_at").is("removed_at", null).order("display_name")).data ?? [];

  const emailById = new Map<string, string>();
  const profileIds = new Set(profiles.map((profile) => profile.id));
  if (adapterEnabled && profiles[0]) {
    emailById.set(profiles[0].id, "reviewer@example.test");
  } else {
    let page = 1;
    const perPage = 1000;
    while (emailById.size < profiles.length) {
      const { data, error } = await getServiceSupabaseClient().auth.admin.listUsers({ page, perPage });
      if (error) break;
      for (const user of data.users) {
        if (user.email && profileIds.has(user.id)) emailById.set(user.id, user.email);
      }
      if (data.users.length < perPage) break;
      page += 1;
    }
  }

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p>Admin tools</p>
          <h1>Team</h1>
          <span>Create staff sign-ins and manage each member&apos;s role and access state.</span>
        </div>
      </header>
      <p className="admin-intro">
        Only active company profiles can sign in. Passwords are accepted only during account
        creation and are never shown here afterward.
      </p>
      {query.removed === "1" ? (
        <p className="admin-success" role="status">Team member removed.</p>
      ) : null}
      {query.saved === "1" ? (
        <p className="admin-success" role="status">Team member changes saved.</p>
      ) : null}
      {query.cleanup === "pending" || query.remove === "cleanup-required" ? (
        <p className="admin-notice" role="alert">
          The member is gone from Team. Auth account cleanup is safely queued for retry.
        </p>
      ) : null}
      <CreateStaffForm />
      <div className="team-grid">
        {profiles.map((profile) => (
          <TeamMemberCard
            key={profile.id}
            profile={profile}
            email={emailById.get(profile.id) ?? null}
            isCurrentUser={profile.id === session.userId}
          />
        ))}
      </div>
    </>
  );
}
