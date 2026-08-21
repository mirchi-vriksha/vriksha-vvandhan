begin;
select no_plan();

select has_table('private', 'email_smtp_quota_reservations', 'private rolling SMTP quota ledger exists');
select ok(
  not has_table_privilege('authenticated', 'private.email_smtp_quota_reservations', 'select'),
  'staff cannot inspect provider quota state'
);
select ok(
  not has_function_privilege('authenticated', 'public.claim_email_delivery_rolling(uuid,boolean,integer)', 'execute'),
  'staff cannot claim rolling-quota email work'
);
select ok(
  has_function_privilege('service_role', 'public.claim_email_delivery_rolling(uuid,boolean,integer)', 'execute'),
  'service role can claim rolling-quota email work'
);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) values (
  '68000000-0000-4000-8000-000000000020',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'quota-admin@example.test',
  '',
  now(),
  now()
);
insert into public.staff_profiles(id,display_name,role,active) values (
  '68000000-0000-4000-8000-000000000020',
  'Quota Admin',
  'admin',
  true
);

insert into public.submissions(
  id,status,display_name,submitted_at,rejection_comment,rejection_reason_code,
  rejection_participant_note,rejection_internal_note,rejection_confirmed_at,
  rejection_confirmed_by,rejected_at,counts_toward_goal
) values
(
  '68000000-0000-4000-8000-000000000001','rejected','Quota One',now(),
  'Please try again.','image_quality','Please try again.','Quota test.',now(),
  '68000000-0000-4000-8000-000000000020',now(),false
),
(
  '68000000-0000-4000-8000-000000000002','rejected','Quota Two',now(),
  'Please try again.','image_quality','Please try again.','Quota test.',now(),
  '68000000-0000-4000-8000-000000000020',now(),false
);
insert into public.submission_contacts(submission_id,email) values
  ('68000000-0000-4000-8000-000000000001','quota-one@example.test'),
  ('68000000-0000-4000-8000-000000000002','quota-two@example.test');
insert into public.email_deliveries(id,submission_id,kind,status,idempotency_key) values
  ('68000000-0000-4000-8000-000000000011','68000000-0000-4000-8000-000000000001','rejection','not_started','quota-one'),
  ('68000000-0000-4000-8000-000000000012','68000000-0000-4000-8000-000000000002','rejection','not_started','quota-two');

set local role service_role;
select is(
  (select count(*) from public.claim_email_delivery_rolling(
    '68000000-0000-4000-8000-000000000011', false, 1
  )),
  1::bigint,
  'the first eligible delivery reserves rolling capacity'
);
reset role;
select ok(
  public.fail_email_delivery(
    '68000000-0000-4000-8000-000000000011',
    (select claim_token from public.email_deliveries where id='68000000-0000-4000-8000-000000000011'),
    'gmail_smtp_quota_exceeded'
  ),
  'a provider quota response safely releases the delivery claim'
);
set local role service_role;
select is(
  (select count(*) from public.claim_email_delivery_rolling(
    '68000000-0000-4000-8000-000000000012', false, 1
  )),
  0::bigint,
  'the next delivery is deferred while the rolling limit is reserved'
);
reset role;

select is(
  (select status::text from public.email_deliveries where id='68000000-0000-4000-8000-000000000011'),
  'failed',
  'provider quota exhaustion keeps the delivery retryable'
);
select ok(
  (select next_attempt_at >= now() + interval '23 hours 59 minutes' from public.email_deliveries where id='68000000-0000-4000-8000-000000000011'),
  'provider quota exhaustion defers retry for approximately 24 hours'
);

select is(
  (select count(*) from private.email_smtp_quota_reservations where reserved_at > now() - interval '24 hours'),
  1::bigint,
  'rolling reservation is durable'
);
select is(
  (select status::text from public.email_deliveries where id = '68000000-0000-4000-8000-000000000012'),
  'not_started',
  'deferred delivery is not consumed'
);
select ok(
  (select next_attempt_at > now() from public.email_deliveries where id = '68000000-0000-4000-8000-000000000012'),
  'deferred delivery is scheduled after capacity expires'
);

update private.email_smtp_quota_reservations
   set reserved_at = now() - interval '25 hours';
set local role service_role;
select is(
  (select count(*) from public.claim_email_delivery_rolling(
    '68000000-0000-4000-8000-000000000012', false, 1
  )),
  1::bigint,
  'capacity becomes available exactly outside the rolling 24-hour window'
);
select throws_ok(
  $$select public.claim_email_delivery_rolling('68000000-0000-4000-8000-000000000012', false, 501)$$,
  'P0001',
  'invalid_email_rolling_limit',
  'the database rejects an unsafe rolling limit'
);
reset role;

select * from finish();
rollback;
