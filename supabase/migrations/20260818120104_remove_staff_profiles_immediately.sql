create table private.staff_auth_cleanup_queue (
  staff_id uuid primary key,
  requested_by uuid,
  display_name text not null,
  requested_role public.staff_role not null,
  requested_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  attempt_count integer not null default 0,
  last_error_code text,
  constraint staff_auth_cleanup_queue_display_name_check
    check (length(btrim(display_name)) between 1 and 120),
  constraint staff_auth_cleanup_queue_attempt_count_check
    check (attempt_count >= 0),
  constraint staff_auth_cleanup_queue_error_code_check
    check (last_error_code is null or length(last_error_code) between 1 and 80)
);

alter table private.staff_auth_cleanup_queue enable row level security;
revoke all on table private.staff_auth_cleanup_queue from public, anon, authenticated;

alter table public.staff_profiles
  add column removed_at timestamptz,
  add column removed_by uuid,
  add constraint staff_profiles_removed_inactive_check
    check (removed_at is null or not active);

create or replace function public.prepare_staff_removal(p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_target public.staff_profiles%rowtype;
  v_admins integer;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception using errcode = 'P0001', message = 'unauthorized_role';
  end if;

  if p_staff_id = v_actor then
    raise exception using errcode = 'P0001', message = 'self_removal_forbidden';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.staff_admin_invariant', 0)
  );

  select * into v_target
  from public.staff_profiles
  where id = p_staff_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'staff_not_found';
  end if;

  if v_target.role = 'admin' and v_target.active then
    select count(*) into v_admins
    from public.staff_profiles
    where role = 'admin' and active;

    if v_admins <= 1 then
      raise exception using errcode = 'P0001', message = 'final_admin_required';
    end if;
  end if;

  insert into private.staff_auth_cleanup_queue (
    staff_id,
    requested_by,
    display_name,
    requested_role
  )
  values (
    p_staff_id,
    v_actor,
    v_target.display_name,
    v_target.role
  )
  on conflict (staff_id) do update
  set requested_by = excluded.requested_by,
      display_name = excluded.display_name,
      requested_role = excluded.requested_role,
      requested_at = now();

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data
  )
  values (
    v_actor,
    'staff.removal_requested',
    'staff_profile',
    p_staff_id,
    jsonb_build_object(
      'display_name', v_target.display_name,
      'role', v_target.role,
      'active', v_target.active
    ),
    jsonb_build_object('removed_from_team', true)
  );

  update public.staff_profiles
  set active = false,
      removed_at = now(),
      removed_by = v_actor
  where id = p_staff_id;
end;
$$;

create or replace function public.record_staff_removal(p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_auth_exists boolean;
  v_auth_soft_deleted boolean;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception using errcode = 'P0001', message = 'unauthorized_role';
  end if;

  select
    exists(select 1 from auth.users where id = p_staff_id),
    exists(select 1 from auth.users where id = p_staff_id and deleted_at is not null)
  into v_auth_exists, v_auth_soft_deleted;

  if not exists (
      select 1
      from public.staff_profiles
      where id = p_staff_id and removed_at is not null and not active
    ) or (v_auth_exists and not v_auth_soft_deleted) then
    raise exception using errcode = 'P0001', message = 'staff_removal_incomplete';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data)
  values(
    v_actor,
    'staff.removed',
    'staff_profile',
    p_staff_id,
    jsonb_build_object(
      'removed_from_team', true,
      'auth_state', case when v_auth_exists then 'soft_deleted' else 'deleted' end
    )
  );

  delete from private.staff_auth_cleanup_queue where staff_id = p_staff_id;
end;
$$;

create function public.mark_staff_auth_cleanup_pending(
  p_staff_id uuid,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_error_code text := left(coalesce(nullif(btrim(p_error_code), ''), 'auth_delete_failed'), 80);
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception using errcode = 'P0001', message = 'unauthorized_role';
  end if;

  update private.staff_auth_cleanup_queue
  set last_attempt_at = now(),
      attempt_count = attempt_count + 1,
      last_error_code = v_error_code
  where staff_id = p_staff_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'staff_cleanup_not_queued';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data)
  values(
    v_actor,
    'staff.auth_cleanup_pending',
    'staff_profile',
    p_staff_id,
    jsonb_build_object('removed_from_team', true, 'error_code', v_error_code)
  );
end;
$$;

insert into private.staff_auth_cleanup_queue (
  staff_id,
  requested_by,
  display_name,
  requested_role,
  requested_at
)
select
  profile.id,
  removal.actor_id,
  profile.display_name,
  profile.role,
  removal.created_at
from public.staff_profiles profile
cross join lateral (
  select audit.actor_id, audit.created_at
  from public.audit_logs audit
  where audit.entity_id = profile.id
    and audit.action = 'staff.removal_requested'
  order by audit.created_at desc
  limit 1
) removal
where not profile.active
on conflict (staff_id) do nothing;

update public.staff_profiles profile
set active = false,
    removed_at = cleanup.requested_at,
    removed_by = cleanup.requested_by
from private.staff_auth_cleanup_queue cleanup
where profile.id = cleanup.staff_id;

revoke all on function public.prepare_staff_removal(uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_staff_removal(uuid)
  to authenticated;

revoke all on function public.record_staff_removal(uuid)
  from public, anon, authenticated;
grant execute on function public.record_staff_removal(uuid)
  to authenticated;

revoke all on function public.mark_staff_auth_cleanup_pending(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_staff_auth_cleanup_pending(uuid, text)
  to authenticated;
