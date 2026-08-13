alter table public.submissions
  add column show_on_movement_wall boolean not null default true;

create index submissions_visible_on_movement_wall_idx
  on public.submissions (published_at desc, guardian_number desc)
  where status = 'published'
    and is_test = false
    and counts_toward_goal = true
    and show_on_movement_wall = true
    and trashed_at is null;

create function public.set_movement_wall_visibility(
  p_submission_id uuid,
  p_visible boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_before boolean;
begin
  if not coalesce((select private.is_reviewer_or_admin()), false) then
    raise exception using errcode = 'P0001', message = 'unauthorized_role';
  end if;

  if p_visible is null then
    raise exception using errcode = 'P0001', message = 'invalid_visibility';
  end if;

  select submission.show_on_movement_wall
    into v_before
    from public.submissions as submission
   where submission.id = p_submission_id
     and submission.status = 'published'::public.submission_status
     and submission.trashed_at is null
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'visibility_conflict';
  end if;

  if v_before is distinct from p_visible then
    update public.submissions
       set show_on_movement_wall = p_visible
     where id = p_submission_id;

    insert into public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      before_data,
      after_data
    ) values (
      v_actor,
      'submission.movement_wall_visibility_changed',
      'submission',
      p_submission_id,
      jsonb_build_object('show_on_movement_wall', v_before),
      jsonb_build_object('show_on_movement_wall', p_visible)
    );
  end if;
end;
$$;

create or replace function public.list_public_movement_entries(
  p_limit integer default 24,
  p_before_published_at timestamptz default null,
  p_before_guardian_number bigint default null
)
returns table(
  guardian_number bigint, display_name text, published_at timestamptz,
  card_path text, card_width integer, card_height integer,
  full_path text, full_width integer, full_height integer,
  alt_text text, focal_x numeric, focal_y numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.guardian_number,s.display_name,s.published_at,m.published_card_path,m.published_card_width,
    m.published_card_height,m.published_full_path,m.published_full_width,m.published_full_height,
    m.alt_text,coalesce(m.focal_x,0.5),coalesce(m.focal_y,0.5)
  from public.submissions s join public.submission_media m on m.submission_id=s.id
  where s.status='published' and s.is_test=false and s.counts_toward_goal=true
    and s.show_on_movement_wall=true and s.trashed_at is null
    and m.status='published' and m.published_bucket='published-images'
    and m.published_card_path is not null and m.published_full_path is not null
    and (p_before_published_at is null or (s.published_at,s.guardian_number)<(p_before_published_at,p_before_guardian_number))
  order by s.published_at desc,s.guardian_number desc limit least(greatest(coalesce(p_limit,24),1),48);
$$;

revoke all on function public.set_movement_wall_visibility(uuid,boolean)
  from public, anon;
grant execute on function public.set_movement_wall_visibility(uuid,boolean)
  to authenticated;

comment on column public.submissions.show_on_movement_wall is
  'Staff-controlled display flag. It hides or restores the Movement Wall card without changing the campaign count or deleting publication assets.';
comment on function public.set_movement_wall_visibility(uuid,boolean) is
  'Allows active Reviewers and Admins to hide or restore a published Movement Wall card with an audit event.';
