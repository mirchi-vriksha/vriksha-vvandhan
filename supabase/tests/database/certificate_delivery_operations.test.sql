begin;
select no_plan();

select has_column('public','certificates','template_version','certificate template version is tracked');
select has_column('public','certificates','file_bytes','certificate byte size is tracked');
select has_column('public','certificates','checksum_sha256','certificate checksum is tracked');
select has_column('public','certificates','claim_token','certificate claims have an ownership token');
select has_column('public','email_deliveries','claim_token','email claims have an ownership token');
select has_function('public','claim_certificate_generation',array['uuid','text','boolean','boolean'],'certificate claim function exists');
select has_function('public','complete_certificate_generation',array['uuid','uuid','text','text','bigint','text'],'certificate completion function exists');
select has_function('public','fail_certificate_generation',array['uuid','uuid','text'],'certificate failure function exists');
select has_function('public','claim_email_delivery',array['uuid','boolean'],'email claim function exists');
select has_function('public','complete_email_delivery',array['uuid','uuid','text','text'],'email completion function exists');
select has_function('public','fail_email_delivery',array['uuid','uuid','text'],'email failure function exists');
select has_function('public','record_campaign_data_export',array['integer'],'export audit function exists');
select ok(not has_function_privilege('authenticated','public.claim_certificate_generation(uuid,text,boolean,boolean)','execute'),'authenticated staff cannot claim certificate work');
select ok(not has_function_privilege('authenticated','public.claim_email_delivery(uuid,boolean)','execute'),'authenticated staff cannot claim email work');
select ok(has_function_privilege('service_role','public.claim_certificate_generation(uuid,text,boolean,boolean)','execute'),'trusted service can claim certificate work');
select ok(has_function_privilege('service_role','public.claim_email_delivery(uuid,boolean)','execute'),'trusted service can claim email work');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) values
('52000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reviewer-section5@example.test','',now(),now()),
('52000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-section5@example.test','',now(),now());
insert into public.staff_profiles(id,display_name,role,active) values
('52000000-0000-4000-8000-000000000001','Section 5 Reviewer','reviewer',true),
('52000000-0000-4000-8000-000000000002','Section 5 Admin','admin',true);

create function pg_temp.make_submission(p_id uuid,p_status public.submission_status,p_guardian bigint default null) returns void language plpgsql as $$
begin
  insert into public.submissions(
    id,status,display_name,submitted_at,guardian_number,approved_at,approved_by,published_at,
    rejection_comment,rejection_confirmed_at,rejection_confirmed_by,rejected_at,counts_toward_goal
  ) values (
    p_id,p_status,'Section 5 Test',now(),p_guardian,
    case when p_status='published' then now() end,
    case when p_status='published' then '52000000-0000-4000-8000-000000000002'::uuid end,
    case when p_status='published' then now() end,
    case when p_status='rejected' then 'The photograph could not be approved.' end,
    case when p_status='rejected' then now() end,
    case when p_status='rejected' then '52000000-0000-4000-8000-000000000002'::uuid end,
    case when p_status='rejected' then now() end,
    false
  );
  insert into public.submission_consents(submission_id,consent_version,publication_consent,terms_accepted,accepted_at)
  values(p_id,'section5-test',true,true,now());
  insert into public.submission_contacts(submission_id,email) values(p_id,'explicit-section5@example.test');
end $$;

select pg_temp.make_submission('52000000-0000-4000-8000-000000000010','published',427);
select pg_temp.make_submission('52000000-0000-4000-8000-000000000011','rejected',null);
select pg_temp.make_submission('52000000-0000-4000-8000-000000000012','pending_review',null);
insert into public.certificates(submission_id) values
('52000000-0000-4000-8000-000000000010'),
('52000000-0000-4000-8000-000000000011'),
('52000000-0000-4000-8000-000000000012');

set local role authenticated;
select set_config('request.jwt.claim.sub','52000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.record_campaign_data_export(3)$$,'P0001','unauthorized_role','Reviewer cannot audit or authorize a sensitive export');
select set_config('request.jwt.claim.sub','52000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.record_campaign_data_export(3)$$,'Admin may record a campaign export');
select is((select count(*) from public.audit_logs where action='campaign.data_exported' and actor_id='52000000-0000-4000-8000-000000000002'),1::bigint,'export action is audited without workbook data');
reset role;

set local role service_role;
select is((select count(*) from public.claim_certificate_generation('52000000-0000-4000-8000-000000000011','vriksha-2026-v1',false,false)),0::bigint,'Rejected submission cannot generate a certificate');
select is((select count(*) from public.claim_certificate_generation('52000000-0000-4000-8000-000000000012','vriksha-2026-v1',false,false)),0::bigint,'Pending Review cannot generate a certificate');
select is((select count(*) from public.claim_certificate_generation('52000000-0000-4000-8000-000000000010','vriksha-2026-v1',false,false)),1::bigint,'Published submission is eligible for certificate generation');
reset role;
select is((select status::text from public.certificates where submission_id='52000000-0000-4000-8000-000000000010'),'queued','certificate becomes queued atomically');
select is((select attempt_count from public.certificates where submission_id='52000000-0000-4000-8000-000000000010'),1,'certificate attempt is incremented');
select is((select count(*) from public.claim_certificate_generation('52000000-0000-4000-8000-000000000010','vriksha-2026-v1',false,false)),0::bigint,'a second worker cannot claim queued generation');
select ok(public.fail_certificate_generation(
  (select id from public.certificates where submission_id='52000000-0000-4000-8000-000000000010'),
  (select claim_token from public.certificates where submission_id='52000000-0000-4000-8000-000000000010'),
  'render_failed'
),'claimed certificate may fail with a safe error');
select is((select status::text from public.submissions where id='52000000-0000-4000-8000-000000000010'),'published','certificate failure does not reverse publication');
select is((select guardian_number from public.submissions where id='52000000-0000-4000-8000-000000000010'),427::bigint,'certificate failure does not change Guardian number');
select is((select count(*) from public.claim_certificate_generation('52000000-0000-4000-8000-000000000010','vriksha-2026-v1',false,true)),1::bigint,'an explicit Admin retry may bypass certificate backoff');
select is((select attempt_count from public.certificates where submission_id='52000000-0000-4000-8000-000000000010'),2,'retry increments certificate attempt');
select ok(public.complete_certificate_generation(
  (select id from public.certificates where submission_id='52000000-0000-4000-8000-000000000010'),
  (select claim_token from public.certificates where submission_id='52000000-0000-4000-8000-000000000010'),
  'vriksha-2026-v1',
  '52000000-0000-4000-8000-000000000010/vriksha-guardian-427-v1.pdf',
  200000,
  repeat('a',64)
),'certificate completion records bounded metadata');
select is((select status::text from public.certificates where submission_id='52000000-0000-4000-8000-000000000010'),'generated','certificate reaches generated');
select is((select count(*) from public.claim_certificate_generation('52000000-0000-4000-8000-000000000010','vriksha-2026-v1',false,false)),0::bigint,'generated certificate is idempotent without explicit regeneration');

insert into public.email_deliveries(id,submission_id,kind,status,idempotency_key) values
('52000000-0000-4000-8000-000000000020','52000000-0000-4000-8000-000000000010','approval_certificate','not_started','approval_certificate:52000000-0000-4000-8000-000000000010'),
('52000000-0000-4000-8000-000000000021','52000000-0000-4000-8000-000000000011','rejection','not_started','rejection:52000000-0000-4000-8000-000000000011');
select throws_ok($$insert into public.email_deliveries(submission_id,kind,idempotency_key) values('52000000-0000-4000-8000-000000000010','approval_certificate','different-key')$$,'23505',null,'one delivery exists per submission and kind');
select is((select count(*) from public.claim_email_delivery('52000000-0000-4000-8000-000000000020',false)),1::bigint,'generated approval certificate makes email eligible');
select is((select count(*) from public.claim_email_delivery('52000000-0000-4000-8000-000000000020',false)),0::bigint,'queued email cannot be double claimed');
select ok(public.fail_email_delivery(
  '52000000-0000-4000-8000-000000000020',
  (select claim_token from public.email_deliveries where id='52000000-0000-4000-8000-000000000020'),
  'resend_timeout'
),'email attempt may fail safely');
select is((select status::text from public.submissions where id='52000000-0000-4000-8000-000000000010'),'published','email failure does not alter publication');
select is((select count(*) from public.claim_email_delivery('52000000-0000-4000-8000-000000000020',true)),1::bigint,'an explicit Admin retry may bypass email backoff');
select is((select idempotency_key from public.email_deliveries where id='52000000-0000-4000-8000-000000000020'),'approval_certificate:52000000-0000-4000-8000-000000000010','retry preserves stable idempotency key');
select ok(public.complete_email_delivery(
  '52000000-0000-4000-8000-000000000020',
  (select claim_token from public.email_deliveries where id='52000000-0000-4000-8000-000000000020'),
  'approval-certificate-v1',
  'provider-message-section5'
),'email completion stores provider message ID');
select is((select count(*) from public.claim_email_delivery('52000000-0000-4000-8000-000000000020',false)),0::bigint,'sent email can never be reclaimed');
select is((select attempt_count from public.email_deliveries where id='52000000-0000-4000-8000-000000000020'),2,'email retry attempt count is retained');
select is((select count(*) from public.claim_email_delivery('52000000-0000-4000-8000-000000000021',false)),1::bigint,'final rejection email is eligible without certificate');
select is((select guardian_number from public.submissions where id='52000000-0000-4000-8000-000000000010'),427::bigint,'all delivery operations preserve Guardian allocation');

select * from finish();
rollback;
