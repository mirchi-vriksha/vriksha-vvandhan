begin;
select no_plan();

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
) values
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reviewer-rls@example.test', '', now(), now()),
  ('40000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-rls@example.test', '', now(), now()),
  ('40000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inactive-rls@example.test', '', now(), now()),
  ('40000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nonstaff-rls@example.test', '', now(), now());
insert into public.staff_profiles (id, display_name, role, active) values
  ('40000000-0000-4000-8000-000000000001', 'Reviewer', 'reviewer', true),
  ('40000000-0000-4000-8000-000000000002', 'Admin', 'admin', true),
  ('40000000-0000-4000-8000-000000000003', 'Inactive', 'reviewer', false);
insert into public.submissions (id) values ('40000000-0000-4000-8000-000000000010');
insert into public.submission_contacts values ('40000000-0000-4000-8000-000000000010', 'private@example.test', now(), now());
insert into public.submission_consents values ('40000000-0000-4000-8000-000000000010', 'v1', true, true, now(), now(), now());
insert into public.submission_media (submission_id, original_path, original_extension)
values ('40000000-0000-4000-8000-000000000010', '40000000-0000-4000-8000-000000000010/original.jpg', 'jpg');
insert into public.certificates (submission_id) values ('40000000-0000-4000-8000-000000000010');
insert into public.email_deliveries (submission_id, kind, idempotency_key)
values ('40000000-0000-4000-8000-000000000010', 'submission_received', 'rls-received');
insert into public.email_webhook_events(event_id,provider_message_id,event_type,event_created_at)
values ('rls-event','rls-provider','email.delivered',now());
insert into public.audit_logs (actor_id, action, entity_type, entity_id)
values ('40000000-0000-4000-8000-000000000002', 'test', 'submission', '40000000-0000-4000-8000-000000000010');

set local role anon;
select throws_ok($$select * from public.submissions$$, '42501', null, 'Anonymous cannot read submissions');
select throws_ok($$insert into public.submissions default values$$, '42501', null, 'Anonymous cannot insert');
select throws_ok($$update public.submissions set display_name = 'x'$$, '42501', null, 'Anonymous cannot update');
select throws_ok($$delete from public.submissions$$, '42501', null, 'Anonymous cannot delete');
select throws_ok($$select * from public.email_webhook_events$$, '42501', null, 'Anonymous cannot read webhook events');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000004', true);
select is((select count(*) from public.submissions), 0::bigint, 'Authenticated non-staff has no internal access');
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000003', true);
select is((select count(*) from public.submissions), 0::bigint, 'Inactive staff has no internal access');

select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
select is((select count(*) from public.staff_profiles), 1::bigint, 'Reviewer reads only own profile');
select is((select count(*) from public.campaign_settings), 1::bigint, 'Reviewer reads settings');
select is((select count(*) from public.submissions), 1::bigint, 'Reviewer reads submissions');
select is((select count(*) from public.submission_consents), 1::bigint, 'Reviewer reads consents');
select is((select count(*) from public.submission_media), 1::bigint, 'Reviewer reads media');
select is((select count(*) from public.certificates), 1::bigint, 'Reviewer reads certificate status');
select is((select count(*) from public.email_deliveries), 1::bigint, 'Reviewer reads email status');
select throws_ok($$select * from public.email_webhook_events$$, '42501', null, 'Reviewer cannot read webhook event internals');
select is((select count(*) from public.submission_contacts), 0::bigint, 'Reviewer cannot read participant email');
select is((select count(*) from public.audit_logs), 0::bigint, 'Reviewer cannot read audit logs');
select throws_ok($$update public.submissions set display_name = 'x'$$, '42501', null, 'Reviewer cannot mutate');

select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.staff_profiles), 3::bigint, 'Admin reads all staff profiles');
select is((select count(*) from public.submission_contacts), 1::bigint, 'Admin reads participant email');
select is((select count(*) from public.audit_logs), 1::bigint, 'Admin reads audit logs');
select throws_ok($$delete from public.submissions$$, '42501', null, 'Admin has no broad direct delete grant');
reset role;

select * from finish();
rollback;
