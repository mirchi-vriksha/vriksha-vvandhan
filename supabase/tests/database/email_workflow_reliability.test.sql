begin;
select no_plan();

select has_table('private','email_suppressions','private recipient suppression registry exists');
select has_table('public','email_worker_runs','worker telemetry table exists');
select has_column('public','email_deliveries','first_attempt_at','first attempt time is retained');
select has_column('public','email_deliveries','suppressed_at','suppression time is retained');
select has_column('public','email_deliveries','suppression_reason','suppression reason is retained');
select has_column('public','email_deliveries','idempotency_version','explicit retry version is retained');
select has_column('public','email_webhook_events','event_detail_code','safe transport detail is retained');
select ok(not has_table_privilege('authenticated','private.email_suppressions','select'),'staff cannot inspect the suppression registry');
select ok(not has_function_privilege('authenticated','public.record_resend_webhook_event(text,text,text,timestamp with time zone,text)','execute'),'staff cannot forge transport events');
select ok(has_function_privilege('service_role','public.record_resend_webhook_event(text,text,text,timestamp with time zone,text)','execute'),'service can record transport events');

insert into public.submissions(id) values
('62000000-0000-4000-8000-000000000001'),
('62000000-0000-4000-8000-000000000002');
insert into public.submission_contacts(submission_id,email) values
('62000000-0000-4000-8000-000000000001','suppression-test@example.test'),
('62000000-0000-4000-8000-000000000002','suppression-test@example.test');
insert into public.email_deliveries(id,submission_id,kind,status,idempotency_key,provider_message_id,sent_at) values
('62000000-0000-4000-8000-000000000011','62000000-0000-4000-8000-000000000001','submission_received','sent','reliability-one','provider-reliability',now());
insert into public.email_deliveries(id,submission_id,kind,status,idempotency_key) values
('62000000-0000-4000-8000-000000000012','62000000-0000-4000-8000-000000000002','submission_received','not_started','reliability-two');

set local role service_role;
select ok(public.record_resend_webhook_event(
  'event-permanent-bounce','provider-reliability','email.bounced',now(),'permanent'
),'permanent bounce is recorded');
reset role;
select is((select status::text from public.email_deliveries where id='62000000-0000-4000-8000-000000000011'),'suppressed','permanent bounce suppresses the delivery');
select is((select reason from private.email_suppressions where normalized_email='suppression-test@example.test'),'permanent_bounce','recipient suppression propagates privately');

set local role service_role;
select is((select count(*) from public.claim_email_delivery('62000000-0000-4000-8000-000000000012',false)),0::bigint,'a suppressed recipient is never sent to the provider');
reset role;
select is((select status::text from public.email_deliveries where id='62000000-0000-4000-8000-000000000012'),'suppressed','future work records the suppression outcome');

insert into public.submissions(id) values ('62000000-0000-4000-8000-000000000003');
insert into public.email_deliveries(id,submission_id,kind,status,idempotency_key,claim_token,queued_at,last_attempt_at,attempt_count) values
('62000000-0000-4000-8000-000000000013','62000000-0000-4000-8000-000000000003','submission_received','queued','reliability-race','62000000-0000-4000-8000-000000000014',now(),now(),1);
set local role service_role;
select ok(public.record_resend_webhook_event('event-race','provider-race','email.delivered',now(),null),'webhook may arrive before completion');
select ok(public.complete_email_delivery(
  '62000000-0000-4000-8000-000000000013','62000000-0000-4000-8000-000000000014','submission-received-v3','provider-race'
),'delivery completion succeeds after early webhook');
reset role;
select isnt((select delivered_at from public.email_deliveries where id='62000000-0000-4000-8000-000000000013'),null,'completion reconciles the early webhook');

set local role service_role;
select lives_ok($$select public.begin_email_worker_run()$$,'service can begin worker telemetry');
select lives_ok($$select public.purge_email_webhook_events(90,1000)$$,'service can run the bounded 90-day purge');
reset role;

select * from finish();
rollback;
