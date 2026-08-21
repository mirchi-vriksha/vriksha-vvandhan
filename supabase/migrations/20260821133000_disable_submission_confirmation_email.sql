create function private.suppress_submission_confirmation_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'submission_received'::public.email_delivery_kind
     and new.status not in ('sent'::public.email_delivery_status, 'suppressed'::public.email_delivery_status) then
    new.status := 'suppressed'::public.email_delivery_status;
    new.suppressed_at := coalesce(new.suppressed_at, now());
    new.suppression_reason := 'submission_confirmation_disabled';
    new.next_attempt_at := null;
    new.claim_token := null;
    new.last_error_code := null;
  end if;
  return new;
end;
$$;

revoke all on function private.suppress_submission_confirmation_email() from public, anon, authenticated;

create trigger email_deliveries_suppress_submission_confirmation
before insert or update of kind, status on public.email_deliveries
for each row
execute function private.suppress_submission_confirmation_email();

update public.email_deliveries
   set status = 'suppressed',
       suppressed_at = coalesce(suppressed_at, now()),
       suppression_reason = 'submission_confirmation_disabled',
       next_attempt_at = null,
       claim_token = null,
       last_error_code = null
 where kind = 'submission_received'
   and status not in ('sent', 'suppressed');

comment on function private.suppress_submission_confirmation_email() is
  'Prevents submission-received confirmation emails from entering or re-entering the delivery queue.';
