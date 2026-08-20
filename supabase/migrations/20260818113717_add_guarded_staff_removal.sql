create or replace function public.manage_staff_profile(
  p_staff_id uuid,
  p_display_name text,
  p_role public.staff_role,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_name text := regexp_replace(btrim(p_display_name), '[[:space:]]+', ' ', 'g');
  v_before public.staff_profiles%rowtype;
  v_admins integer;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception using errcode = 'P0001', message = 'unauthorized_role';
  end if;

  if v_name is null or length(v_name) not between 1 and 120 then
    raise exception using errcode = 'P0001', message = 'invalid_staff_profile';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.staff_admin_invariant', 0)
  );

  select * into v_before
  from public.staff_profiles
  where id = p_staff_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'staff_not_found';
  end if;

  if p_staff_id = v_actor and p_active = false then
    raise exception using errcode = 'P0001', message = 'self_deactivation_forbidden';
  end if;

  if v_before.role = 'admin' and v_before.active and (p_role <> 'admin' or not p_active) then
    select count(*) into v_admins
    from public.staff_profiles
    where role = 'admin' and active;

    if v_admins <= 1 then
      raise exception using errcode = 'P0001', message = 'final_admin_required';
    end if;
  end if;

  update public.staff_profiles
  set display_name = v_name, role = p_role, active = p_active
  where id = p_staff_id;

  if v_before.display_name is distinct from v_name then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
    values(v_actor, 'staff.display_name_changed', 'staff_profile', p_staff_id,
      jsonb_build_object('display_name', v_before.display_name),
      jsonb_build_object('display_name', v_name));
  end if;

  if v_before.role is distinct from p_role then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
    values(v_actor, 'staff.role_changed', 'staff_profile', p_staff_id,
      jsonb_build_object('role', v_before.role),
      jsonb_build_object('role', p_role));
  end if;

  if v_before.active is distinct from p_active then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
    values(v_actor, 'staff.active_changed', 'staff_profile', p_staff_id,
      jsonb_build_object('active', v_before.active),
      jsonb_build_object('active', p_active));
  end if;
end;
$$;

create function public.prepare_staff_removal(p_staff_id uuid)
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

  update public.staff_profiles
  set active = false
  where id = p_staff_id;

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
    jsonb_build_object('active', false)
  );
end;
$$;

create function public.record_staff_removal(p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception using errcode = 'P0001', message = 'unauthorized_role';
  end if;

  if exists (select 1 from public.staff_profiles where id = p_staff_id)
    or exists (select 1 from auth.users where id = p_staff_id) then
    raise exception using errcode = 'P0001', message = 'staff_removal_incomplete';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data)
  values(
    v_actor,
    'staff.removed',
    'staff_profile',
    p_staff_id,
    jsonb_build_object('deleted', true)
  );
end;
$$;

revoke all on function public.manage_staff_profile(uuid, text, public.staff_role, boolean)
  from public, anon, authenticated;
grant execute on function public.manage_staff_profile(uuid, text, public.staff_role, boolean)
  to authenticated;

revoke all on function public.prepare_staff_removal(uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_staff_removal(uuid)
  to authenticated;

revoke all on function public.record_staff_removal(uuid)
  from public, anon, authenticated;
grant execute on function public.record_staff_removal(uuid)
  to authenticated;
