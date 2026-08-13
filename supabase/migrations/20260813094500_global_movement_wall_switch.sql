alter table public.campaign_settings
  add column movement_wall_enabled boolean not null default true;

drop function public.update_campaign_settings(integer,text,boolean);

create function public.update_campaign_settings(
  p_target_count integer,
  p_metric_label text,
  p_submissions_open boolean,
  p_movement_wall_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_label text := btrim(p_metric_label);
  v_before jsonb;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception using errcode='P0001', message='unauthorized_role';
  end if;
  if p_target_count <= 0
     or v_label is null
     or length(v_label) not between 1 and 80
     or p_submissions_open is null
     or p_movement_wall_enabled is null then
    raise exception using errcode='P0001', message='invalid_campaign_settings';
  end if;

  select jsonb_build_object(
      'target_count',target_count,
      'metric_label',metric_label,
      'submissions_open',submissions_open,
      'movement_wall_enabled',movement_wall_enabled
    )
    into v_before
    from public.campaign_settings
   where id=1
   for update;

  update public.campaign_settings
     set target_count=p_target_count,
         metric_label=v_label,
         submissions_open=p_submissions_open,
         movement_wall_enabled=p_movement_wall_enabled
   where id=1;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,before_data,after_data)
  values(
    v_actor,
    'campaign.settings_changed',
    'campaign_settings',
    null,
    v_before,
    jsonb_build_object(
      'target_count',p_target_count,
      'metric_label',v_label,
      'submissions_open',p_submissions_open,
      'movement_wall_enabled',p_movement_wall_enabled
    )
  );
end;
$$;

drop function public.get_public_campaign_summary();

create function public.get_public_campaign_summary()
returns table(
  current_count bigint,
  target_count integer,
  metric_label text,
  submissions_open boolean,
  movement_wall_enabled boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_published_count(), settings.target_count, settings.metric_label,
    settings.submissions_open, settings.movement_wall_enabled
  from public.campaign_settings settings where settings.id=1;
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
  where (select settings.movement_wall_enabled from public.campaign_settings settings where settings.id=1)
    and s.status='published' and s.is_test=false and s.counts_toward_goal=true
    and s.show_on_movement_wall=true and s.trashed_at is null
    and m.status='published' and m.published_bucket='published-images'
    and m.published_card_path is not null and m.published_full_path is not null
    and (p_before_published_at is null or (s.published_at,s.guardian_number)<(p_before_published_at,p_before_guardian_number))
  order by s.published_at desc,s.guardian_number desc limit least(greatest(coalesce(p_limit,24),1),48);
$$;

revoke all on function public.update_campaign_settings(integer,text,boolean,boolean)
  from public,anon;
grant execute on function public.update_campaign_settings(integer,text,boolean,boolean)
  to authenticated;
revoke all on function public.get_public_campaign_summary() from public;
grant execute on function public.get_public_campaign_summary() to anon,authenticated;

comment on column public.campaign_settings.movement_wall_enabled is
  'Global public Movement Wall switch. False removes public navigation and disables public wall data without deleting submissions or images.';

update public.campaign_settings
   set movement_wall_enabled = false
 where id = 1;
