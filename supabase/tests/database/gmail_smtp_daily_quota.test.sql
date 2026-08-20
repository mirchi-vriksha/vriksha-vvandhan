begin;
select plan(10);

select has_table('private', 'email_daily_quotas', 'private daily quota ledger exists');
select ok(not has_table_privilege('authenticated', 'private.email_daily_quotas', 'select'), 'staff cannot inspect provider quota state');
select ok(not has_function_privilege('authenticated', 'public.claim_email_delivery(uuid,boolean,date,integer,timestamp with time zone)', 'execute'), 'staff cannot claim quota-controlled email work');
select ok(has_function_privilege('service_role', 'public.claim_email_delivery(uuid,boolean,date,integer,timestamp with time zone)', 'execute'), 'service role can claim quota-controlled email work');

insert into public.submissions(id,status,display_name,submitted_at) values
('68000000-0000-4000-8000-000000000001','pending_review','Quota One',now()),
('68000000-0000-4000-8000-000000000002','pending_review','Quota Two',now());
insert into public.submission_contacts(submission_id,email) values
('68000000-0000-4000-8000-000000000001','quota-one@example.test'),
('68000000-0000-4000-8000-000000000002','quota-two@example.test');
insert into public.email_deliveries(id,submission_id,kind,status,idempotency_key) values
('68000000-0000-4000-8000-000000000011','68000000-0000-4000-8000-000000000001','submission_received','not_started','quota-one'),
('68000000-0000-4000-8000-000000000012','68000000-0000-4000-8000-000000000002','submission_received','not_started','quota-two');

set local role service_role;
select is(
  (select count(*) from public.claim_email_delivery(
    '68000000-0000-4000-8000-000000000011', false, current_date, 1, now() + interval '1 day'
  )),
  1::bigint,
  'the first eligible delivery reserves the daily capacity'
);
select is(
  (select count(*) from public.claim_email_delivery(
    '68000000-0000-4000-8000-000000000012', false, current_date, 1, now() + interval '1 day'
  )),
  0::bigint,
  'the next delivery is deferred after the daily limit is reserved'
);
reset role;

select is((select reserved_count from private.email_daily_quotas where quota_date = current_date), 1, 'quota reservation is durable');
select is((select status::text from public.email_deliveries where id = '68000000-0000-4000-8000-000000000012'), 'not_started', 'deferred delivery is not consumed');
select ok((select next_attempt_at > now() from public.email_deliveries where id = '68000000-0000-4000-8000-000000000012'), 'deferred delivery is scheduled for the next window');

set local role service_role;
select throws_ok(
  $$select public.claim_email_delivery('68000000-0000-4000-8000-000000000012', false, current_date, 501, now() + interval '1 day')$$,
  'P0001',
  'invalid_email_quota_window',
  'the database rejects an unsafe daily limit'
);
reset role;

select * from finish();
rollback;
