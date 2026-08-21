begin;
select no_plan();

select has_function(
  'private',
  'suppress_submission_confirmation_email',
  array[]::text[],
  'submission confirmation suppression trigger function exists'
);

insert into public.submissions(id) values
  ('63000000-0000-4000-8000-000000000001'),
  ('63000000-0000-4000-8000-000000000002'),
  ('63000000-0000-4000-8000-000000000003');

insert into public.submission_contacts(submission_id,email) values
  ('63000000-0000-4000-8000-000000000001','confirmation-disabled@example.test'),
  ('63000000-0000-4000-8000-000000000002','approval-still-enabled@example.test'),
  ('63000000-0000-4000-8000-000000000003','sent-history@example.test');

insert into public.email_deliveries(
  id, submission_id, kind, status, idempotency_key
) values (
  '63000000-0000-4000-8000-000000000011',
  '63000000-0000-4000-8000-000000000001',
  'submission_received',
  'not_started',
  'submission-confirmation-disabled'
);

select is(
  (select status::text from public.email_deliveries where id='63000000-0000-4000-8000-000000000011'),
  'suppressed',
  'new submission confirmations are suppressed before they enter the queue'
);
select is(
  (select suppression_reason from public.email_deliveries where id='63000000-0000-4000-8000-000000000011'),
  'submission_confirmation_disabled',
  'the product decision is recorded with a safe reason'
);
select isnt(
  (select suppressed_at from public.email_deliveries where id='63000000-0000-4000-8000-000000000011'),
  null,
  'the suppression time is recorded'
);

insert into public.email_deliveries(
  id, submission_id, kind, status, idempotency_key
) values (
  '63000000-0000-4000-8000-000000000012',
  '63000000-0000-4000-8000-000000000002',
  'approval_certificate',
  'not_started',
  'approval-remains-enabled'
);

select is(
  (select status::text from public.email_deliveries where id='63000000-0000-4000-8000-000000000012'),
  'not_started',
  'approval certificate deliveries remain enabled'
);

insert into public.email_deliveries(
  id, submission_id, kind, status, idempotency_key, provider_message_id, sent_at
) values (
  '63000000-0000-4000-8000-000000000013',
  '63000000-0000-4000-8000-000000000003',
  'submission_received',
  'sent',
  'historical-submission-confirmation',
  'historical-provider-message',
  now()
);

select is(
  (select status::text from public.email_deliveries where id='63000000-0000-4000-8000-000000000013'),
  'sent',
  'historical sent confirmation records are preserved'
);

select * from finish();
rollback;
