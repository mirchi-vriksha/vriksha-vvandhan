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
  v_quota_exceeded boolean;
  v_email text;
begin
  if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,80}$' then
    raise exception using errcode = 'P0001', message = 'invalid_delivery_error';
  end if;

  v_quota_exceeded := p_error_code = 'gmail_smtp_quota_exceeded';
  v_retryable := p_error_code in (
    'resend_timeout', 'resend_rate_limited', 'resend_temporary_error',
    'resend_provider_error', 'email_completion_failed',
    'resend_internal_server_error', 'resend_concurrent_idempotency',
    'gmail_smtp_temporary_error', 'gmail_smtp_quota_exceeded'
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
           when v_quota_exceeded then now() + interval '24 hours'
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

comment on function public.fail_email_delivery(uuid, uuid, text) is
  'Records safe provider failures, defers Gmail quota exhaustion for 24 hours, suppresses invalid recipients, and routes ambiguous SMTP outcomes to manual review.';
