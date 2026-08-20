alter table public.submissions
  add column rejection_reason_code text,
  add column rejection_participant_note text,
  add column rejection_internal_note text,
  add constraint submissions_rejection_reason_code_check check (
    rejection_reason_code is null or rejection_reason_code in (
      'tree_or_rakhi_not_visible',
      'image_quality',
      'privacy_or_safety',
      'duplicate_submission',
      'campaign_mismatch',
      'other'
    )
  ),
  add constraint submissions_rejection_participant_note_check check (
    rejection_participant_note is null or length(btrim(rejection_participant_note)) between 1 and 600
  ),
  add constraint submissions_rejection_internal_note_check check (
    rejection_internal_note is null or length(btrim(rejection_internal_note)) between 1 and 1200
  );

update public.submissions
   set rejection_reason_code = 'other',
       rejection_participant_note = left(rejection_comment, 600),
       rejection_internal_note = rejection_comment
 where rejection_comment is not null;

alter table public.email_deliveries
  add column first_attempt_at timestamptz,
  add column suppressed_at timestamptz,
  add column suppression_reason text,
  add column idempotency_version integer not null default 1,
  add constraint email_deliveries_suppression_reason_check check (
    suppression_reason is null or suppression_reason ~ '^[a-z0-9_]{1,80}$'
  ),
  add constraint email_deliveries_idempotency_version_check check (idempotency_version between 1 and 1000),
  add constraint email_deliveries_suppressed_check check (
    status <> 'suppressed' or (suppressed_at is not null and suppression_reason is not null)
  );

update public.email_deliveries
   set first_attempt_at = last_attempt_at
 where first_attempt_at is null and last_attempt_at is not null;

create table private.email_suppressions (
  normalized_email text primary key,
  reason text not null,
  provider_message_id text,
  suppressed_at timestamptz not null default now(),
  source_event_id text,
  constraint email_suppressions_email_check check (
    normalized_email = lower(btrim(normalized_email))
    and length(normalized_email) between 3 and 254
  ),
  constraint email_suppressions_reason_check check (reason in (
    'permanent_bounce', 'complaint', 'provider_suppressed', 'invalid_recipient'
  )),
  constraint email_suppressions_message_id_check check (
    provider_message_id is null or length(provider_message_id) between 1 and 240
  ),
  constraint email_suppressions_event_id_check check (
    source_event_id is null or length(source_event_id) between 1 and 240
  )
);

alter table private.email_suppressions enable row level security;
revoke all on table private.email_suppressions from public, anon, authenticated;

alter table public.email_webhook_events
  add column event_detail_code text,
  drop constraint email_webhook_events_type_check,
  add constraint email_webhook_events_type_check check (event_type in (
    'email.delivered',
    'email.bounced',
    'email.complained',
    'email.delivery_delayed',
    'email.failed',
    'email.suppressed'
  )),
  add constraint email_webhook_events_detail_check check (
    event_detail_code is null or event_detail_code ~ '^[a-z0-9_]{1,80}$'
  );

create table public.email_worker_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  outcome text not null default 'running',
  processed_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  error_code text,
  constraint email_worker_runs_outcome_check check (outcome in ('running', 'succeeded', 'failed')),
  constraint email_worker_runs_counts_check check (
    processed_count >= 0 and sent_count >= 0 and failed_count >= 0
  ),
  constraint email_worker_runs_error_check check (
    error_code is null or error_code ~ '^[a-z0-9_]{1,80}$'
  )
);

create index email_worker_runs_started_idx on public.email_worker_runs (started_at desc);
alter table public.email_worker_runs enable row level security;
revoke all on table public.email_worker_runs from public, anon, authenticated;
grant select on table public.email_worker_runs to authenticated;
create policy email_worker_runs_admin_read on public.email_worker_runs
  for select to authenticated using ((select private.is_admin()));

drop function public.claim_email_delivery(uuid, boolean);

create function public.claim_email_delivery(
  p_delivery_id uuid,
  p_allow_exhausted boolean
)
returns table (
  delivery_id uuid,
  claim_token uuid,
  submission_id uuid,
  kind public.email_delivery_kind,
  idempotency_key text,
  recipient_email text,
  display_name text,
  guardian_number bigint,
  rejection_comment text,
  rejection_reason_code text,
  rejection_participant_note text,
  certificate_bucket text,
  certificate_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.email_deliveries%rowtype;
  v_submission public.submissions%rowtype;
  v_contact public.submission_contacts%rowtype;
  v_certificate public.certificates%rowtype;
  v_claim uuid := extensions.gen_random_uuid();
  v_eligible boolean := false;
  v_suppression_reason text;
begin
  select * into v_delivery
    from public.email_deliveries as delivery
   where delivery.id = p_delivery_id
   for update;

  if not found
     or v_delivery.status not in ('not_started', 'failed')
     or (
       not p_allow_exhausted
       and (
         v_delivery.attempt_count >= 5
         or v_delivery.next_attempt_at is null
         or v_delivery.next_attempt_at > now()
       )
     ) then
    return;
  end if;

  if v_delivery.first_attempt_at is not null
     and v_delivery.first_attempt_at < now() - interval '23 hours'
     and v_delivery.last_error_code in (
       'resend_timeout', 'resend_temporary_error', 'resend_provider_error',
       'email_completion_failed', 'resend_concurrent_idempotency'
     )
     and not p_allow_exhausted then
    update public.email_deliveries
       set status = 'manual_review', next_attempt_at = null
     where id = v_delivery.id;
    return;
  end if;

  select * into v_submission from public.submissions as submission
   where submission.id = v_delivery.submission_id and submission.trashed_at is null;
  select * into v_contact from public.submission_contacts as contact
   where contact.submission_id = v_delivery.submission_id;
  select * into v_certificate from public.certificates as certificate
   where certificate.submission_id = v_delivery.submission_id;

  select suppression.reason into v_suppression_reason
    from private.email_suppressions as suppression
   where suppression.normalized_email = lower(btrim(v_contact.email));

  if v_suppression_reason is not null then
    update public.email_deliveries
       set status = 'suppressed',
           suppressed_at = now(),
           suppression_reason = v_suppression_reason,
           next_attempt_at = null,
           claim_token = null
     where id = v_delivery.id;
    return;
  end if;

  v_eligible := case v_delivery.kind
    when 'submission_received' then v_submission.status in ('pending_review', 'rejection_pending_admin', 'published', 'rejected')
    when 'approval_certificate' then
      v_submission.status = 'published'::public.submission_status
      and v_certificate.status = 'generated'::public.certificate_status
      and v_certificate.bucket = 'certificates'
      and v_certificate.object_path is not null
    when 'rejection' then v_submission.status = 'rejected'::public.submission_status
  end;

  if not coalesce(v_eligible, false) or v_contact.email is null then return; end if;

  update public.email_deliveries as delivery
     set status = 'queued',
         claim_token = v_claim,
         attempt_count = delivery.attempt_count + 1,
         first_attempt_at = coalesce(delivery.first_attempt_at, now()),
         queued_at = now(),
         last_attempt_at = now(),
         next_attempt_at = null,
         last_error_code = null,
         idempotency_key = split_part(delivery.idempotency_key, ':retry-', 1)
           || case when delivery.idempotency_version > 1 then ':retry-' || delivery.idempotency_version::text else '' end
   where delivery.id = v_delivery.id;

  return query select
    v_delivery.id,
    v_claim,
    v_delivery.submission_id,
    v_delivery.kind,
    split_part(v_delivery.idempotency_key, ':retry-', 1)
      || case when v_delivery.idempotency_version > 1 then ':retry-' || v_delivery.idempotency_version::text else '' end,
    v_contact.email,
    v_submission.display_name,
    v_submission.guardian_number,
    v_submission.rejection_comment,
    v_submission.rejection_reason_code,
    v_submission.rejection_participant_note,
    v_certificate.bucket,
    v_certificate.object_path;
end;
$$;

comment on function public.claim_email_delivery(uuid, boolean) is
  'Service-role-only atomic claim. Enforces private recipient suppression and sends ambiguous work to manual review before the provider idempotency window expires.';
revoke all on function public.claim_email_delivery(uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_email_delivery(uuid, boolean) to service_role;

create or replace function public.complete_email_delivery(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_template_version text,
  p_provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completed boolean;
  v_suppression_reason text;
  v_email text;
begin
  if p_template_version is null or length(p_template_version) not between 1 and 80
     or p_provider_message_id is null or length(p_provider_message_id) not between 1 and 240 then
    raise exception using errcode = 'P0001', message = 'invalid_delivery_metadata';
  end if;

  update public.email_deliveries
     set status = 'sent',
         template_version = p_template_version,
         provider_message_id = p_provider_message_id,
         sent_at = now(),
         claim_token = null,
         last_error_code = null,
         delivered_at = coalesce((
           select max(event.event_created_at) from public.email_webhook_events event
            where event.provider_message_id = p_provider_message_id and event.event_type = 'email.delivered'
         ), delivered_at),
         bounced_at = coalesce((
           select max(event.event_created_at) from public.email_webhook_events event
            where event.provider_message_id = p_provider_message_id and event.event_type = 'email.bounced'
         ), bounced_at),
         complained_at = coalesce((
           select max(event.event_created_at) from public.email_webhook_events event
            where event.provider_message_id = p_provider_message_id and event.event_type = 'email.complained'
         ), complained_at),
         delivery_delayed_at = coalesce((
           select max(event.event_created_at) from public.email_webhook_events event
            where event.provider_message_id = p_provider_message_id and event.event_type = 'email.delivery_delayed'
         ), delivery_delayed_at),
         provider_failed_at = coalesce((
           select max(event.event_created_at) from public.email_webhook_events event
            where event.provider_message_id = p_provider_message_id and event.event_type in ('email.failed', 'email.suppressed')
         ), provider_failed_at)
   where id = p_delivery_id
     and status = 'queued'::public.email_delivery_status
     and claim_token = p_claim_token;
  v_completed := found;
  if not v_completed then return false; end if;

  select case
    when exists(select 1 from public.email_webhook_events event where event.provider_message_id = p_provider_message_id and event.event_type = 'email.complained') then 'complaint'
    when exists(select 1 from public.email_webhook_events event where event.provider_message_id = p_provider_message_id and event.event_type = 'email.suppressed') then 'provider_suppressed'
    when exists(select 1 from public.email_webhook_events event where event.provider_message_id = p_provider_message_id and event.event_type = 'email.bounced' and event.event_detail_code = 'permanent') then 'permanent_bounce'
    else null
  end into v_suppression_reason;

  if v_suppression_reason is not null then
    update public.email_deliveries set
      status = 'suppressed', suppressed_at = now(),
      suppression_reason = v_suppression_reason, next_attempt_at = null
    where id = p_delivery_id;
    select lower(btrim(contact.email)) into v_email
      from public.email_deliveries delivery
      join public.submission_contacts contact on contact.submission_id = delivery.submission_id
     where delivery.id = p_delivery_id;
    if v_email is not null then
      insert into private.email_suppressions(normalized_email, reason, provider_message_id, suppressed_at)
      values(v_email, v_suppression_reason, p_provider_message_id, now())
      on conflict (normalized_email) do update set
        reason = excluded.reason,
        provider_message_id = excluded.provider_message_id,
        suppressed_at = greatest(private.email_suppressions.suppressed_at, excluded.suppressed_at);
    end if;
  end if;
  return v_completed;
end;
$$;

create or replace function public.fail_email_delivery(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retryable boolean;
  v_permanent_suppression boolean;
  v_email text;
begin
  if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,80}$' then
    raise exception using errcode = 'P0001', message = 'invalid_delivery_error';
  end if;

  v_retryable := p_error_code in (
    'resend_timeout', 'resend_rate_limited', 'resend_temporary_error',
    'resend_provider_error', 'email_completion_failed',
    'resend_internal_server_error', 'resend_concurrent_idempotency'
  );
  v_permanent_suppression := p_error_code = 'resend_invalid_recipient';

  if v_permanent_suppression then
    select lower(btrim(contact.email)) into v_email
      from public.email_deliveries delivery
      join public.submission_contacts contact on contact.submission_id = delivery.submission_id
     where delivery.id = p_delivery_id;
    if v_email is not null then
      insert into private.email_suppressions(normalized_email, reason)
      values (v_email, 'invalid_recipient')
      on conflict (normalized_email) do update
        set reason = excluded.reason, suppressed_at = now();
    end if;
  end if;

  update public.email_deliveries
     set status = case when v_permanent_suppression then 'suppressed'::public.email_delivery_status
                       else 'failed'::public.email_delivery_status end,
         claim_token = null,
         last_error_code = p_error_code,
         suppressed_at = case when v_permanent_suppression then now() else suppressed_at end,
         suppression_reason = case when v_permanent_suppression then 'invalid_recipient' else suppression_reason end,
         next_attempt_at = case
           when v_permanent_suppression or not v_retryable then null
           when attempt_count = 1 then now() + interval '1 minute'
           when attempt_count = 2 then now() + interval '5 minutes'
           when attempt_count = 3 then now() + interval '30 minutes'
           when attempt_count = 4 then now() + interval '2 hours'
           else null
         end
   where id = p_delivery_id
     and status = 'queued'::public.email_delivery_status
     and claim_token = p_claim_token;
  return found;
end;
$$;

drop function public.record_resend_webhook_event(text, text, text, timestamptz);

create function public.record_resend_webhook_event(
  p_event_id text,
  p_provider_message_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_event_detail_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted boolean;
  v_email text;
  v_suppression_reason text;
begin
  if p_event_id is null or length(p_event_id) not between 1 and 240
     or p_provider_message_id is null or length(p_provider_message_id) not between 1 and 240
     or p_event_type not in (
       'email.delivered', 'email.bounced', 'email.complained',
       'email.delivery_delayed', 'email.failed', 'email.suppressed'
     )
     or p_event_created_at is null
     or p_event_created_at > now() + interval '10 minutes'
     or (p_event_detail_code is not null and p_event_detail_code !~ '^[a-z0-9_]{1,80}$') then
    raise exception using errcode = 'P0001', message = 'invalid_webhook_event';
  end if;

  insert into public.email_webhook_events (
    event_id, provider_message_id, event_type, event_created_at, event_detail_code
  ) values (
    p_event_id, p_provider_message_id, p_event_type, p_event_created_at, p_event_detail_code
  ) on conflict (event_id) do nothing;
  v_inserted := found;
  if not v_inserted then return false; end if;

  v_suppression_reason := case
    when p_event_type = 'email.complained' then 'complaint'
    when p_event_type = 'email.suppressed' then 'provider_suppressed'
    when p_event_type = 'email.bounced' and p_event_detail_code = 'permanent' then 'permanent_bounce'
    else null
  end;

  update public.email_deliveries
     set delivered_at = case when p_event_type = 'email.delivered'
           then greatest(coalesce(delivered_at, p_event_created_at), p_event_created_at) else delivered_at end,
         bounced_at = case when p_event_type = 'email.bounced'
           then greatest(coalesce(bounced_at, p_event_created_at), p_event_created_at) else bounced_at end,
         complained_at = case when p_event_type = 'email.complained'
           then greatest(coalesce(complained_at, p_event_created_at), p_event_created_at) else complained_at end,
         delivery_delayed_at = case when p_event_type = 'email.delivery_delayed'
           then greatest(coalesce(delivery_delayed_at, p_event_created_at), p_event_created_at) else delivery_delayed_at end,
         provider_failed_at = case when p_event_type in ('email.failed', 'email.suppressed')
           then greatest(coalesce(provider_failed_at, p_event_created_at), p_event_created_at) else provider_failed_at end,
         status = case when v_suppression_reason is not null then 'suppressed'::public.email_delivery_status else status end,
         suppressed_at = case when v_suppression_reason is not null
           then greatest(coalesce(suppressed_at, p_event_created_at), p_event_created_at) else suppressed_at end,
         suppression_reason = coalesce(v_suppression_reason, suppression_reason),
         next_attempt_at = case when v_suppression_reason is not null then null else next_attempt_at end
   where provider_message_id = p_provider_message_id;

  if v_suppression_reason is not null then
    select lower(btrim(contact.email)) into v_email
      from public.email_deliveries delivery
      join public.submission_contacts contact on contact.submission_id = delivery.submission_id
     where delivery.provider_message_id = p_provider_message_id;
    if v_email is not null then
      insert into private.email_suppressions(
        normalized_email, reason, provider_message_id, suppressed_at, source_event_id
      ) values (
        v_email, v_suppression_reason, p_provider_message_id, p_event_created_at, p_event_id
      ) on conflict (normalized_email) do update set
        reason = excluded.reason,
        provider_message_id = excluded.provider_message_id,
        suppressed_at = greatest(private.email_suppressions.suppressed_at, excluded.suppressed_at),
        source_event_id = excluded.source_event_id;
    end if;
  end if;
  return true;
end;
$$;

comment on function public.record_resend_webhook_event(text, text, text, timestamptz, text) is
  'Service-role-only idempotent transport event recorder. Stores no payload and propagates permanent recipient suppression.';
revoke all on function public.record_resend_webhook_event(text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.record_resend_webhook_event(text, text, text, timestamptz, text) to service_role;

create function public.begin_email_worker_run()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.email_worker_runs default values returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.begin_email_worker_run() from public, anon, authenticated;
grant execute on function public.begin_email_worker_run() to service_role;

create function public.complete_email_worker_run(
  p_run_id uuid,
  p_outcome text,
  p_processed_count integer,
  p_sent_count integer,
  p_failed_count integer,
  p_error_code text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_outcome not in ('succeeded', 'failed')
     or least(p_processed_count, p_sent_count, p_failed_count) < 0
     or (p_error_code is not null and p_error_code !~ '^[a-z0-9_]{1,80}$') then
    raise exception using errcode = 'P0001', message = 'invalid_worker_result';
  end if;
  update public.email_worker_runs set
    completed_at = now(), outcome = p_outcome,
    processed_count = p_processed_count, sent_count = p_sent_count,
    failed_count = p_failed_count, error_code = p_error_code
  where id = p_run_id and outcome = 'running';
  return found;
end;
$$;
revoke all on function public.complete_email_worker_run(uuid, text, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.complete_email_worker_run(uuid, text, integer, integer, integer, text) to service_role;

create function public.purge_email_webhook_events(p_retention_days integer default 90, p_limit integer default 1000)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_deleted integer;
begin
  if p_retention_days not between 30 and 365 or p_limit not between 1 and 5000 then
    raise exception using errcode = 'P0001', message = 'invalid_cleanup_limit';
  end if;
  with expired as (
    select event.tableoid, event.ctid from public.email_webhook_events event
    where event.received_at < now() - make_interval(days => p_retention_days)
    order by event.received_at limit p_limit
  )
  delete from public.email_webhook_events event using expired
   where event.tableoid = expired.tableoid and event.ctid = expired.ctid;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
revoke all on function public.purge_email_webhook_events(integer, integer) from public, anon, authenticated;
grant execute on function public.purge_email_webhook_events(integer, integer) to service_role;

create function public.record_delivery_admin_action(p_delivery_id uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception using errcode = 'P0001', message = 'unauthorized_role';
  end if;
  if p_action not in ('email.retry', 'certificate.retry', 'certificate.regenerate') then
    raise exception using errcode = 'P0001', message = 'invalid_delivery_action';
  end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id)
  values(v_actor, p_action, 'delivery', p_delivery_id);
end;
$$;
revoke all on function public.record_delivery_admin_action(uuid, text) from public, anon;
grant execute on function public.record_delivery_admin_action(uuid, text) to authenticated;

create function public.prepare_email_admin_retry(p_delivery_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_before public.email_deliveries%rowtype;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception using errcode = 'P0001', message = 'unauthorized_role';
  end if;
  select * into v_before from public.email_deliveries
   where id = p_delivery_id and status in ('not_started','failed','manual_review') for update;
  if not found then return false; end if;
  update public.email_deliveries set
    status = 'failed', next_attempt_at = now(), claim_token = null,
    idempotency_version = idempotency_version + 1
  where id = p_delivery_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
  values(v_actor, 'email.retry', 'delivery', p_delivery_id,
    jsonb_build_object('status',v_before.status,'attempt_count',v_before.attempt_count,'idempotency_version',v_before.idempotency_version),
    jsonb_build_object('status','failed','idempotency_version',v_before.idempotency_version + 1));
  return true;
end;
$$;
revoke all on function public.prepare_email_admin_retry(uuid) from public, anon;
grant execute on function public.prepare_email_admin_retry(uuid) to authenticated;

drop function public.recommend_submission_rejection(uuid, text);
drop function public.confirm_submission_rejection(uuid, text);

create function public.recommend_submission_rejection(
  p_submission_id uuid,
  p_reason_code text,
  p_participant_note text,
  p_internal_note text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := btrim(p_reason_code);
  v_participant text := nullif(btrim(p_participant_note), '');
  v_internal text := nullif(btrim(p_internal_note), '');
begin
  if (select private.current_staff_role()) is distinct from 'reviewer'::public.staff_role then
    raise exception using errcode = 'P0001', message = 'unauthorized_role';
  end if;
  if v_reason not in ('tree_or_rakhi_not_visible','image_quality','privacy_or_safety','duplicate_submission','campaign_mismatch','other')
     or (v_participant is not null and length(v_participant) > 600)
     or v_internal is null or length(v_internal) not between 10 and 1200 then
    raise exception using errcode = 'P0001', message = 'invalid_rejection_details';
  end if;
  update public.submissions set
    status = 'rejection_pending_admin',
    rejection_comment = coalesce(v_participant, v_internal),
    rejection_reason_code = v_reason,
    rejection_participant_note = v_participant,
    rejection_internal_note = v_internal,
    rejection_recommended_at = now(), rejection_recommended_by = v_actor
  where id = p_submission_id and status = 'pending_review' and trashed_at is null;
  if not found then raise exception using errcode = 'P0001', message = 'already_reviewed'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data)
  values (v_actor, 'submission.rejection_recommended', 'submission', p_submission_id,
    jsonb_build_object('status','rejection_pending_admin','reason_code',v_reason,'has_participant_note',v_participant is not null));
end;
$$;

create function public.confirm_submission_rejection(
  p_submission_id uuid,
  p_reason_code text,
  p_participant_note text,
  p_internal_note text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := btrim(p_reason_code);
  v_participant text := nullif(btrim(p_participant_note), '');
  v_internal text := nullif(btrim(p_internal_note), '');
  v_status public.submission_status;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception using errcode = 'P0001', message = 'unauthorized_role';
  end if;
  if v_reason not in ('tree_or_rakhi_not_visible','image_quality','privacy_or_safety','duplicate_submission','campaign_mismatch','other')
     or (v_participant is not null and length(v_participant) > 600)
     or v_internal is null or length(v_internal) not between 10 and 1200 then
    raise exception using errcode = 'P0001', message = 'invalid_rejection_details';
  end if;
  select status into v_status from public.submissions where id = p_submission_id and trashed_at is null for update;
  if v_status = 'rejected' then return; end if;
  if v_status not in ('pending_review', 'rejection_pending_admin') then
    raise exception using errcode = 'P0001', message = 'already_reviewed';
  end if;
  update public.submissions set
    status = 'rejected',
    rejection_comment = coalesce(v_participant, v_internal),
    rejection_reason_code = v_reason,
    rejection_participant_note = v_participant,
    rejection_internal_note = v_internal,
    rejection_confirmed_at = now(), rejection_confirmed_by = v_actor, rejected_at = now()
  where id = p_submission_id;
  insert into public.email_deliveries(submission_id, kind, status, idempotency_key)
  values (p_submission_id, 'rejection', 'not_started', 'rejection:' || p_submission_id::text)
  on conflict on constraint email_deliveries_submission_kind_unique do nothing;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data)
  values (v_actor, 'submission.rejected', 'submission', p_submission_id,
    jsonb_build_object('status','rejected','reason_code',v_reason,'has_participant_note',v_participant is not null));
end;
$$;

revoke all on function public.recommend_submission_rejection(uuid,text,text,text) from public, anon;
grant execute on function public.recommend_submission_rejection(uuid,text,text,text) to authenticated;
revoke all on function public.confirm_submission_rejection(uuid,text,text,text) from public, anon;
grant execute on function public.confirm_submission_rejection(uuid,text,text,text) to authenticated;
