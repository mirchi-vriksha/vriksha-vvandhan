begin;
select no_plan();

select has_table('private','application_rate_limits','private abuse limiter table exists');
select ok(not has_table_privilege('anon','private.application_rate_limits','select'),'anonymous cannot inspect abuse hashes');
select ok(not has_function_privilege('anon','public.consume_application_rate_limit(text,text,integer,integer)','execute'),'anonymous cannot call the rate limiter');
select ok(not has_function_privilege('authenticated','public.consume_application_rate_limit(text,text,integer,integer)','execute'),'staff clients cannot call the rate limiter');
select ok(has_function_privilege('service_role','public.consume_application_rate_limit(text,text,integer,integer)','execute'),'trusted service can call the rate limiter');

set local role service_role;
select ok(public.consume_application_rate_limit('test:prepare',repeat('a',64),2,60),'first bounded request is accepted');
select ok(public.consume_application_rate_limit('test:prepare',repeat('a',64),2,60),'second bounded request is accepted');
select ok(not public.consume_application_rate_limit('test:prepare',repeat('a',64),2,60),'burst above the bound is rejected atomically');
reset role;

insert into public.submissions(id) values ('61000000-0000-4000-8000-000000000001');
insert into public.email_deliveries(
  id,submission_id,kind,status,idempotency_key,provider_message_id,sent_at
) values (
  '61000000-0000-4000-8000-000000000002',
  '61000000-0000-4000-8000-000000000001',
  'submission_received',
  'sent',
  'section6-webhook:61000000-0000-4000-8000-000000000001',
  'provider-section6',
  now()
);

set local role service_role;
select ok(public.record_resend_webhook_event(
  'event-section6','provider-section6','email.delivered',now(),null
),'first signed event ID is recorded');
select ok(not public.record_resend_webhook_event(
  'event-section6','provider-section6','email.delivered',now(),null
),'duplicate webhook event ID is ignored');
reset role;
select isnt((select delivered_at from public.email_deliveries where id='61000000-0000-4000-8000-000000000002'),null,'delivery webhook records delivered time');
select is((select count(*) from public.email_webhook_events where event_id='event-section6'),1::bigint,'duplicate webhook does not duplicate state');

insert into public.submissions(id) values ('61000000-0000-4000-8000-000000000003');
insert into public.certificates(submission_id,status,claim_token,queued_at,attempt_count)
values ('61000000-0000-4000-8000-000000000003','queued','61000000-0000-4000-8000-000000000004',now()-interval '20 minutes',1);
insert into public.email_deliveries(submission_id,kind,status,idempotency_key,claim_token,queued_at,last_attempt_at,attempt_count)
values ('61000000-0000-4000-8000-000000000003','submission_received','queued','stale-section6','61000000-0000-4000-8000-000000000005',now()-interval '20 minutes',now()-interval '20 minutes',1);
set local role service_role;
select is(
  (select row(certificates_recovered,emails_recovered)::text from public.recover_stale_delivery_claims(15)),
  '(1,1)',
  'the first duplicate-safe cron invocation recovers both stale claims'
);
select is(
  (select row(certificates_recovered,emails_recovered)::text from public.recover_stale_delivery_claims(15)),
  '(0,0)',
  'a duplicate cron invocation has no additional effect'
);
reset role;
select is((select status::text from public.certificates where submission_id='61000000-0000-4000-8000-000000000003'),'failed','stale certificate work remains recoverable without workflow rollback');
select is((select status::text from public.email_deliveries where submission_id='61000000-0000-4000-8000-000000000003'),'failed','stale email work remains recoverable without workflow rollback');

select * from finish();
rollback;
