drop function public.set_movement_wall_visibility(uuid,boolean);

drop index if exists public.submissions_visible_on_movement_wall_idx;

alter table public.submissions
  drop column show_on_movement_wall;

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
    and s.trashed_at is null
    and m.status='published' and m.published_bucket='published-images'
    and m.published_card_path is not null and m.published_full_path is not null
    and (p_before_published_at is null or (s.published_at,s.guardian_number)<(p_before_published_at,p_before_guardian_number))
  order by s.published_at desc,s.guardian_number desc limit least(greatest(coalesce(p_limit,24),1),48);
$$;

comment on function public.list_public_movement_entries(integer,timestamptz,bigint) is
  'Anonymous safe Movement Wall page, globally disabled by campaign_settings.movement_wall_enabled. Per-submission visibility is intentionally unsupported.';
