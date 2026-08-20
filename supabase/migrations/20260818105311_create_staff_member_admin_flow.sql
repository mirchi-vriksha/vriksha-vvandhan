create function public.create_staff_profile(
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
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception using errcode = 'P0001', message = 'unauthorized_role';
  end if;

  if v_name is null
    or length(v_name) not between 1 and 120
    or p_role is null
    or p_active is null then
    raise exception using errcode = 'P0001', message = 'invalid_staff_profile';
  end if;

  if not exists (select 1 from auth.users where id = p_staff_id) then
    raise exception using errcode = 'P0001', message = 'auth_user_not_found';
  end if;

  if exists (select 1 from public.staff_profiles where id = p_staff_id) then
    raise exception using errcode = 'P0001', message = 'staff_already_exists';
  end if;

  insert into public.staff_profiles (id, display_name, role, active)
  values (p_staff_id, v_name, p_role, p_active);

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    after_data
  )
  values (
    v_actor,
    'staff.created',
    'staff_profile',
    p_staff_id,
    jsonb_build_object(
      'display_name', v_name,
      'role', p_role,
      'active', p_active
    )
  );
end;
$$;

revoke all on function public.create_staff_profile(uuid, text, public.staff_role, boolean)
  from public, anon, authenticated;
grant execute on function public.create_staff_profile(uuid, text, public.staff_role, boolean)
  to authenticated;
