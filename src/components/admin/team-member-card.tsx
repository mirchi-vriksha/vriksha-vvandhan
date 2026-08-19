import { manageStaffAction, removeStaffAction } from "@/app/admin/actions";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { RemoveStaffButton } from "@/components/admin/remove-staff-button";

type TeamMemberProfile = {
  id: string;
  display_name: string;
  role: "admin" | "reviewer";
  active: boolean;
  updated_at: string;
};

export function TeamMemberCard({
  profile,
  email,
  isCurrentUser,
}: {
  profile: TeamMemberProfile;
  email: string | null;
  isCurrentUser: boolean;
}) {
  return (
    <article className="admin-panel team-card">
      <div className="team-card__heading">
        <div>
          <strong>{profile.display_name}</strong>
          <span>{profile.role}</span>
          <small className="team-card__email">{email ?? "Email unavailable"}</small>
        </div>
        <span className={`team-card__status ${profile.active ? "is-active" : ""}`}>
          {profile.active ? "Active" : "Inactive"}
        </span>
      </div>

      <details className="team-card__details">
        <summary>
          <span>Edit member</span>
          <span aria-hidden="true">+</span>
        </summary>
        <form className="team-card__edit" action={manageStaffAction}>
          <input type="hidden" name="staffId" value={profile.id} />
          <label>
            Display name
            <input name="displayName" defaultValue={profile.display_name} maxLength={120} required />
          </label>
          <label>
            Role
            <select name="role" defaultValue={profile.role}>
              <option value="reviewer">Reviewer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="team-card__active">
            <input type="checkbox" name="active" defaultChecked={profile.active} />
            Active staff profile
          </label>
          <small>Last updated {new Date(profile.updated_at).toLocaleString("en-IN")}</small>
          <AdminActionButton className="button button--light" label="Save changes" pendingLabel="Saving changes…" />
        </form>

        <form className="team-card__danger" action={removeStaffAction}>
          <input type="hidden" name="staffId" value={profile.id} />
          <p>
            This permanently removes the member&apos;s profile and sign-in account.
          </p>
          <RemoveStaffButton displayName={profile.display_name} disabled={isCurrentUser} />
          {isCurrentUser ? <small>You cannot remove your own account.</small> : null}
        </form>
      </details>
    </article>
  );
}
