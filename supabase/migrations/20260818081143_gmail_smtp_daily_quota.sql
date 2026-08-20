create table private.email_daily_quotas (
  quota_date date primary key,
  reserved_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint email_daily_quotas_reserved_count_check check (reserved_count between 0 and 100000)
);

alter table private.email_daily_quotas enable row level security;
revoke all on table private.email_daily_quotas from public, anon, authenticated;

drop function public.claim_email_delivery(uuid, boolean);

create function public.claim_email_delivery(
  p_delivery_id uuid,
  p_allow_exhausted boolean default false,
  p_quota_date date default null,
  p_daily_limit integer default null,
  p_next_window timestamptz default null
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
  v_reserved_count integer;
begin
  if (p_quota_date is null) <> (p_daily_limit is null)
     or (p_quota_date is null) <> (p_next_window is null)
     or (p_daily_limit is not null and p_daily_limit not between 1 and 500)
     or (p_next_window is not null and p_next_window <= now()) then
    raise exception using errcode = 'P0001', message = 'invalid_email_quota_window';
  end if;

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
       'email_completion_failed', 'resend_concurrent_idempotency',
       'gmail_smtp_ambiguous', 'gmail_smtp_provider_error'
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

  if p_quota_date is not null then
    insert into private.email_daily_quotas (quota_date, reserved_count, updated_at)
    values (p_quota_date, 1, now())
    on conflict (quota_date) do update
      set reserved_count = private.email_daily_quotas.reserved_count + 1,
          updated_at = now()
      where private.email_daily_quotas.reserved_count < p_daily_limit
    returning reserved_count into v_reserved_count;

    if v_reserved_count is null then
      update public.email_deliveries
         set next_attempt_at = p_next_window
       where id = v_delivery.id;
      return;
    end if;
  end if;

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

comment on function public.claim_email_delivery(uuid, boolean, date, integer, timestamptz) is
  'Service-role-only atomic claim with private recipient suppression and a durable calendar-day provider quota reservation.';
revoke all on function public.claim_email_delivery(uuid, boolean, date, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_email_delivery(uuid, boolean, date, integer, timestamptz) to service_role;

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
  v_manual_review boolean;
  v_email text;
begin
  if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,80}$' then
    raise exception using errcode = 'P0001', message = 'invalid_delivery_error';
  end if;

  v_retryable := p_error_code in (
    'resend_timeout', 'resend_rate_limited', 'resend_temporary_error',
    'resend_provider_error', 'email_completion_failed',
    'resend_internal_server_error', 'resend_concurrent_idempotency',
    'gmail_smtp_temporary_error'
  );
  v_permanent_suppression := p_error_code in ('resend_invalid_recipient', 'gmail_smtp_invalid_recipient');
  v_manual_review := p_error_code in ('gmail_smtp_ambiguous', 'gmail_smtp_provider_error');

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
     set status = case
           when v_permanent_suppression then 'suppressed'::public.email_delivery_status
           when v_manual_review then 'manual_review'::public.email_delivery_status
           else 'failed'::public.email_delivery_status
         end,
         claim_token = null,
         last_error_code = p_error_code,
         suppressed_at = case when v_permanent_suppression then now() else suppressed_at end,
         suppression_reason = case when v_permanent_suppression then 'invalid_recipient' else suppression_reason end,
         next_attempt_at = case
           when v_permanent_suppression or v_manual_review or not v_retryable then null
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
