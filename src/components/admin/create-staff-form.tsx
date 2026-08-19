"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  createStaffAction,
  type CreateStaffState,
} from "@/app/admin/actions";
import { MINIMUM_STAFF_PASSWORD_LENGTH } from "@/lib/auth/password-recovery";

const initialCreateStaffState: CreateStaffState = {
  status: "idle",
  message: "",
  revision: 0,
};

export function CreateStaffForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    createStaffAction,
    initialCreateStaffState,
  );

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status, state.revision]);

  return (
    <section className="admin-panel team-create-panel" aria-labelledby="add-team-member-title">
      <div className="admin-panel__heading">
        <div>
          <p>New team member</p>
          <h2 id="add-team-member-title">Add member</h2>
          <span>
            Creates a confirmed sign-in account and its company access profile.
          </span>
        </div>
      </div>
      <form ref={formRef} action={action} className="team-create-form">
        <div className="team-create-form__fields">
          <label htmlFor="new-staff-name">
            Display name
            <input
              id="new-staff-name"
              name="displayName"
              maxLength={120}
              autoComplete="name"
              required
            />
          </label>
          <label htmlFor="new-staff-email">
            Email address
            <input
              id="new-staff-email"
              name="email"
              type="email"
              maxLength={254}
              autoComplete="email"
              required
            />
          </label>
          <label htmlFor="new-staff-password">
            Initial password
            <input
              id="new-staff-password"
              name="password"
              type="password"
              minLength={MINIMUM_STAFF_PASSWORD_LENGTH}
              maxLength={256}
              autoComplete="new-password"
              aria-describedby="new-staff-password-help"
              required
            />
          </label>
          <label htmlFor="new-staff-role">
            Role
            <select id="new-staff-role" name="role" defaultValue="reviewer">
              <option value="reviewer">Reviewer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        <p id="new-staff-password-help" className="team-create-form__help">
          Use at least {MINIMUM_STAFF_PASSWORD_LENGTH} characters. Share it securely and ask
          the member to replace it using Forgot password after their first sign-in.
        </p>
        <label className="team-card__active">
          <input name="active" type="checkbox" defaultChecked />
          Allow this member to sign in now
        </label>
        {state.message ? (
          <div
            className={state.status === "success" ? "team-form-message is-success" : "team-form-message is-error"}
            role={state.status === "success" ? "status" : "alert"}
          >
            {state.message}
          </div>
        ) : null}
        <button className="button button--primary" type="submit" disabled={pending} aria-busy={pending}>
          {pending ? <span className="admin-action-spinner" aria-hidden="true" /> : null}
          <span>{pending ? "Creating member…" : "Add team member"}</span>
        </button>
      </form>
    </section>
  );
}
