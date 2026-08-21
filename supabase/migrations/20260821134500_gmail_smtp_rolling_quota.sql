create table private.email_smtp_quota_reservations (
  id bigint generated always as identity primary key,
  delivery_id uuid not null references public.email_deliveries(id) on delete cascade,
  claim_token uuid not null unique,
  reserved_at timestamptz not null default now()
);

create index email_smtp_quota_reservations_reserved_at_idx
  on private.email_smtp_quota_reservations (reserved_at);

alter table private.email_smtp_quota_reservations enable row level security;
revoke all on table private.email_smtp_quota_reservations from public, anon, authenticated;

create function public.claim_email_delivery_rolling(
  p_delivery_id uuid,
  p_allow_exhausted boolean,
  p_rolling_limit integer
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
  v_reserved_count bigint;
  v_oldest_reservation timestamptz;
begin
  if p_rolling_limit is not null and p_rolling_limit not between 1 and 500 then
    raise exception using errcode = 'P0001', message = 'invalid_email_rolling_limit';
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
    when 'submission_received' then false
    when 'approval_certificate' then
      v_submission.status = 'published'::public.submission_status
      and v_certificate.status = 'generated'::public.certificate_status
      and v_certificate.bucket = 'certificates'
      and v_certificate.object_path is not null
    when 'rejection' then v_submission.status = 'rejected'::public.submission_status
  end;

  if not coalesce(v_eligible, false) or v_contact.email is null then return; end if;

  if p_rolling_limit is not null then
    perform pg_catalog.pg_advisory_xact_lock(8675309001);

    delete from private.email_smtp_quota_reservations
     where reserved_at <= now() - interval '48 hours';

    select count(*), min(reserved_at)
      into v_reserved_count, v_oldest_reservation
      from private.email_smtp_quota_reservations
     where reserved_at > now() - interval '24 hours';

    if v_reserved_count >= p_rolling_limit then
      update public.email_deliveries
         set next_attempt_at = greatest(
           now() + interval '1 minute',
           v_oldest_reservation + interval '24 hours' + interval '1 minute'
         )
       where id = v_delivery.id;
      return;
    end if;

    insert into private.email_smtp_quota_reservations (delivery_id, claim_token)
    values (v_delivery.id, v_claim);
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

comment on function public.claim_email_delivery_rolling(uuid, boolean, integer) is
  'Service-role-only atomic email claim with recipient suppression and an exact rolling 24-hour SMTP capacity reservation.';
revoke all on function public.claim_email_delivery_rolling(uuid, boolean, integer) from public, anon, authenticated;
grant execute on function public.claim_email_delivery_rolling(uuid, boolean, integer) to service_role;
