create table private.application_rate_limits (
  scope text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  expires_at timestamptz not null,
  request_count integer not null default 1,
  primary key (scope, key_hash, window_started_at),
  constraint application_rate_limits_scope_check
    check (scope ~ '^[a-z0-9:_-]{1,80}$'),
  constraint application_rate_limits_key_hash_check
    check (key_hash ~ '^[0-9a-f]{64}$'),
  constraint application_rate_limits_count_check
    check (request_count between 1 and 100000),
  constraint application_rate_limits_window_check
    check (expires_at > window_started_at)
);

alter table private.application_rate_limits enable row level security;
revoke all on table private.application_rate_limits from public, anon, authenticated;

create function public.consume_application_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_count integer;
begin
  if p_scope is null or p_scope !~ '^[a-z0-9:_-]{1,80}$'
     or p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$'
     or p_limit not between 1 and 10000
     or p_window_seconds not between 1 and 86400 then
    raise exception using errcode = 'P0001', message = 'invalid_rate_limit';
  end if;

  v_window_started_at := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into private.application_rate_limits as bucket (
    scope,
    key_hash,
    window_started_at,
    expires_at,
    request_count
  ) values (
    p_scope,
    p_key_hash,
    v_window_started_at,
    v_window_started_at + make_interval(secs => p_window_seconds),
    1
  )
  on conflict (scope, key_hash, window_started_at) do update
     set request_count = least(bucket.request_count + 1, 100000)
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

comment on function public.consume_application_rate_limit(text, text, integer, integer) is
  'Service-role-only fixed-window limiter. The key is a server-side HMAC; raw client addresses are never stored.';
revoke all on function public.consume_application_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_application_rate_limit(text, text, integer, integer)
  to service_role;

create function public.purge_expired_rate_limits(p_limit integer default 1000)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_limit not between 1 and 5000 then
    raise exception using errcode = 'P0001', message = 'invalid_cleanup_limit';
  end if;

  with expired as (
    select rate_limit.tableoid, rate_limit.ctid
      from private.application_rate_limits as rate_limit
     where rate_limit.expires_at < now() - interval '1 day'
     order by rate_limit.expires_at
     limit p_limit
  )
  delete from private.application_rate_limits as rate_limit
   using expired
   where rate_limit.tableoid = expired.tableoid
     and rate_limit.ctid = expired.ctid;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_rate_limits(integer)
  from public, anon, authenticated;
grant execute on function public.purge_expired_rate_limits(integer) to service_role;

alter table public.certificates
  add column next_attempt_at timestamptz default now();

update public.certificates
   set next_attempt_at = now()
 where status in ('not_started', 'failed');

create index certificates_due_work_idx
  on public.certificates (next_attempt_at, updated_at)
  where status in ('not_started', 'failed') and next_attempt_at is not null;

alter table public.email_deliveries
  add column next_attempt_at timestamptz default now(),
  add column delivered_at timestamptz,
  add column bounced_at timestamptz,
  add column complained_at timestamptz,
  add column delivery_delayed_at timestamptz,
  add column provider_failed_at timestamptz;

update public.email_deliveries
   set next_attempt_at = now()
 where status in ('not_started', 'failed');

create index email_deliveries_due_work_idx
  on public.email_deliveries (next_attempt_at, updated_at)
  where status in ('not_started', 'failed') and next_attempt_at is not null;

create unique index email_deliveries_provider_message_id_unique
  on public.email_deliveries (provider_message_id)
  where provider_message_id is not null;

drop function public.claim_certificate_generation(uuid, text, boolean);

create function public.claim_certificate_generation(
  p_submission_id uuid,
  p_template_version text,
  p_force_regeneration boolean,
  p_allow_exhausted boolean
)
returns table (
  certificate_id uuid,
  claim_token uuid,
  display_name text,
  guardian_number bigint,
  approved_at timestamptz,
  previous_object_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_certificate public.certificates%rowtype;
  v_submission public.submissions%rowtype;
  v_claim uuid := extensions.gen_random_uuid();
begin
  if p_template_version is null
     or length(p_template_version) not between 1 and 80
     or p_template_version !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]*$' then
    raise exception using errcode = 'P0001', message = 'invalid_template_version';
  end if;

  select * into v_submission
    from public.submissions as submission
   where submission.id = p_submission_id
   for update;

  if not found
     or v_submission.status <> 'published'::public.submission_status
     or v_submission.trashed_at is not null
     or v_submission.display_name is null
     or v_submission.guardian_number is null
     or v_submission.approved_at is null then
    return;
  end if;

  select * into v_certificate
    from public.certificates as certificate
   where certificate.submission_id = p_submission_id
   for update;

  if not found
     or v_certificate.status = 'queued'::public.certificate_status
     or (v_certificate.status = 'generated'::public.certificate_status and not p_force_regeneration)
     or (
       v_certificate.status in ('not_started', 'failed')
       and not p_allow_exhausted
       and (
         v_certificate.attempt_count >= 5
         or v_certificate.next_attempt_at is null
         or v_certificate.next_attempt_at > now()
       )
     ) then
    return;
  end if;

  update public.certificates as certificate
     set status = 'queued',
         claim_token = v_claim,
         attempt_count = certificate.attempt_count + 1,
         queued_at = now(),
         next_attempt_at = null,
         last_error_code = null
   where certificate.id = v_certificate.id;

  return query select
    v_certificate.id,
    v_claim,
    v_submission.display_name,
    v_submission.guardian_number,
    v_submission.approved_at,
    v_certificate.object_path;
end;
$$;

comment on function public.claim_certificate_generation(uuid, text, boolean, boolean) is
  'Service-role-only atomic claim with bounded automatic retries. Exhausted work requires an explicit Admin retry.';
revoke all on function public.claim_certificate_generation(uuid, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_certificate_generation(uuid, text, boolean, boolean)
  to service_role;

create or replace function public.fail_certificate_generation(
  p_certificate_id uuid,
  p_claim_token uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,80}$' then
    raise exception using errcode = 'P0001', message = 'invalid_delivery_error';
  end if;
  update public.certificates
     set status = 'failed',
         claim_token = null,
         last_error_code = p_error_code,
         next_attempt_at = case
           when attempt_count = 1 then now() + interval '1 minute'
           when attempt_count = 2 then now() + interval '5 minutes'
           when attempt_count = 3 then now() + interval '30 minutes'
           when attempt_count = 4 then now() + interval '2 hours'
           else null
         end
   where id = p_certificate_id
     and status = 'queued'::public.certificate_status
     and claim_token = p_claim_token;
  return found;
end;
$$;

drop function public.claim_email_delivery(uuid);

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

  select * into v_submission from public.submissions as submission
   where submission.id = v_delivery.submission_id and submission.trashed_at is null;
  select * into v_contact from public.submission_contacts as contact
   where contact.submission_id = v_delivery.submission_id;
  select * into v_certificate from public.certificates as certificate
   where certificate.submission_id = v_delivery.submission_id;

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
         queued_at = now(),
         last_attempt_at = now(),
         next_attempt_at = null,
         last_error_code = null
   where delivery.id = v_delivery.id;

  return query select
    v_delivery.id,
    v_claim,
    v_delivery.submission_id,
    v_delivery.kind,
    v_delivery.idempotency_key,
    v_contact.email,
    v_submission.display_name,
    v_submission.guardian_number,
    v_submission.rejection_comment,
    v_certificate.bucket,
    v_certificate.object_path;
end;
$$;

comment on function public.claim_email_delivery(uuid, boolean) is
  'Service-role-only atomic claim with bounded automatic retries and stable provider idempotency keys.';
revoke all on function public.claim_email_delivery(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_email_delivery(uuid, boolean) to service_role;

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
begin
  if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,80}$' then
    raise exception using errcode = 'P0001', message = 'invalid_delivery_error';
  end if;

  v_retryable := p_error_code in (
    'resend_timeout',
    'resend_rate_limited',
    'resend_temporary_error',
    'resend_provider_error',
    'email_completion_failed'
  );

  update public.email_deliveries
     set status = 'failed',
         claim_token = null,
         last_error_code = p_error_code,
         next_attempt_at = case
           when not v_retryable then null
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

create function public.list_due_certificate_work(p_limit integer)
returns table (submission_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select certificate.submission_id
    from public.certificates as certificate
    join public.submissions as submission on submission.id = certificate.submission_id
   where certificate.status in ('not_started', 'failed')
     and certificate.attempt_count < 5
     and certificate.next_attempt_at is not null
     and certificate.next_attempt_at <= now()
     and submission.status = 'published'
     and submission.trashed_at is null
   order by certificate.next_attempt_at, certificate.updated_at
   limit least(greatest(p_limit, 1), 25);
$$;

revoke all on function public.list_due_certificate_work(integer)
  from public, anon, authenticated;
grant execute on function public.list_due_certificate_work(integer) to service_role;

create function public.list_due_email_work(p_limit integer)
returns table (delivery_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select delivery.id
    from public.email_deliveries as delivery
   where delivery.status in ('not_started', 'failed')
     and delivery.attempt_count < 5
     and delivery.next_attempt_at is not null
     and delivery.next_attempt_at <= now()
   order by delivery.next_attempt_at, delivery.updated_at
   limit least(greatest(p_limit, 1), 25);
$$;

revoke all on function public.list_due_email_work(integer)
  from public, anon, authenticated;
grant execute on function public.list_due_email_work(integer) to service_role;

create function public.recover_stale_delivery_claims(p_stale_minutes integer default 15)
returns table (certificates_recovered integer, emails_recovered integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_certificates integer;
  v_emails integer;
begin
  if p_stale_minutes not between 5 and 1440 then
    raise exception using errcode = 'P0001', message = 'invalid_stale_window';
  end if;

  update public.certificates
     set status = 'failed',
         claim_token = null,
         next_attempt_at = case when attempt_count < 5 then now() else null end,
         last_error_code = 'worker_timeout'
   where status = 'queued'
     and queued_at < now() - make_interval(mins => p_stale_minutes);
  get diagnostics v_certificates = row_count;

  update public.email_deliveries
     set status = 'failed',
         claim_token = null,
         next_attempt_at = case when attempt_count < 5 then now() else null end,
         last_error_code = 'email_completion_failed'
   where status = 'queued'
     and queued_at < now() - make_interval(mins => p_stale_minutes);
  get diagnostics v_emails = row_count;

  return query select v_certificates, v_emails;
end;
$$;

revoke all on function public.recover_stale_delivery_claims(integer)
  from public, anon, authenticated;
grant execute on function public.recover_stale_delivery_claims(integer) to service_role;

create table public.email_webhook_events (
  event_id text primary key,
  provider_message_id text not null,
  event_type text not null,
  event_created_at timestamptz not null,
  received_at timestamptz not null default now(),
  constraint email_webhook_events_id_check
    check (length(event_id) between 1 and 240),
  constraint email_webhook_events_message_id_check
    check (length(provider_message_id) between 1 and 240),
  constraint email_webhook_events_type_check
    check (event_type in (
      'email.delivered',
      'email.bounced',
      'email.complained',
      'email.delivery_delayed',
      'email.failed'
    ))
);

create index email_webhook_events_message_idx
  on public.email_webhook_events (provider_message_id, event_created_at desc);

alter table public.email_webhook_events enable row level security;
revoke all on table public.email_webhook_events from public, anon, authenticated;

create function public.record_resend_webhook_event(
  p_event_id text,
  p_provider_message_id text,
  p_event_type text,
  p_event_created_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted boolean;
begin
  if p_event_id is null or length(p_event_id) not between 1 and 240
     or p_provider_message_id is null or length(p_provider_message_id) not between 1 and 240
     or p_event_type not in (
       'email.delivered',
       'email.bounced',
       'email.complained',
       'email.delivery_delayed',
       'email.failed'
     )
     or p_event_created_at is null
     or p_event_created_at > now() + interval '10 minutes' then
    raise exception using errcode = 'P0001', message = 'invalid_webhook_event';
  end if;

  insert into public.email_webhook_events (
    event_id,
    provider_message_id,
    event_type,
    event_created_at
  ) values (
    p_event_id,
    p_provider_message_id,
    p_event_type,
    p_event_created_at
  )
  on conflict (event_id) do nothing;

  v_inserted := found;
  if not v_inserted then return false; end if;

  update public.email_deliveries
     set delivered_at = case when p_event_type = 'email.delivered'
           then greatest(coalesce(delivered_at, p_event_created_at), p_event_created_at)
           else delivered_at end,
         bounced_at = case when p_event_type = 'email.bounced'
           then greatest(coalesce(bounced_at, p_event_created_at), p_event_created_at)
           else bounced_at end,
         complained_at = case when p_event_type = 'email.complained'
           then greatest(coalesce(complained_at, p_event_created_at), p_event_created_at)
           else complained_at end,
         delivery_delayed_at = case when p_event_type = 'email.delivery_delayed'
           then greatest(coalesce(delivery_delayed_at, p_event_created_at), p_event_created_at)
           else delivery_delayed_at end,
         provider_failed_at = case when p_event_type = 'email.failed'
           then greatest(coalesce(provider_failed_at, p_event_created_at), p_event_created_at)
           else provider_failed_at end
   where provider_message_id = p_provider_message_id;

  return true;
end;
$$;

comment on function public.record_resend_webhook_event(text, text, text, timestamptz) is
  'Service-role-only idempotent Resend event recorder. Stores no webhook payload or participant address.';
revoke all on function public.record_resend_webhook_event(text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_resend_webhook_event(text, text, text, timestamptz)
  to service_role;
