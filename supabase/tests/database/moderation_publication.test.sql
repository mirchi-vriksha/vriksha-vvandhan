begin;
select no_plan();

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) values
('51000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reviewer-section4@example.test','',now(),now()),
('51000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-section4@example.test','',now(),now()),
('51000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','second-admin-section4@example.test','',now(),now()),
('51000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inactive-section4@example.test','',now(),now()),
('51000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','nonstaff-section4@example.test','',now(),now());
insert into public.staff_profiles(id,display_name,role,active) values
('51000000-0000-4000-8000-000000000001','Section 4 Reviewer','reviewer',true),
('51000000-0000-4000-8000-000000000002','Section 4 Admin','admin',true),
('51000000-0000-4000-8000-000000000003','Second Admin','admin',true),
('51000000-0000-4000-8000-000000000004','Inactive Reviewer','reviewer',false);

select has_column('public','submission_media','published_version','public media version is recorded');
select has_column('public','submission_media','published_card_bytes','card byte size is recorded');
select has_column('public','submission_media','published_full_bytes','full byte size is recorded');
select has_column('public','submissions','show_on_movement_wall','Movement Wall visibility is stored as a boolean');
select has_function('public','publish_submission',array['uuid','bigint','text','text','integer','integer','bigint','text','integer','integer','bigint','text'],'atomic publication function exists');
select has_function('public','get_public_campaign_summary',array[]::text[],'safe public summary function exists');
select has_function('public','list_public_movement_entries',array['integer','timestamp with time zone','bigint'],'safe public movement function exists');
select ok(has_function_privilege('anon','public.get_public_campaign_summary()','execute'),'anonymous may read only the safe summary');
select ok(not has_function_privilege('anon','public.publish_submission(uuid,bigint,text,text,integer,integer,bigint,text,integer,integer,bigint,text)','execute'),'anonymous cannot publish');
select ok(not has_function_privilege('authenticated','public.reserve_guardian_number_for_publication(uuid,uuid)','execute'),'authenticated staff cannot reserve outside the service orchestrator');
select ok(has_function_privilege('service_role','public.reserve_guardian_number_for_publication(uuid,uuid)','execute'),'service orchestrator can reserve a Guardian number');
select has_function('public','set_movement_wall_visibility',array['uuid','boolean'],'staff Movement Wall visibility function exists');

create function pg_temp.make_pending(p_id uuid,p_name text) returns void language plpgsql as $$
begin
  insert into public.submissions(id,status,display_name,submitted_at) values(p_id,'pending_review',p_name,now());
  insert into public.submission_consents(submission_id,consent_version,publication_consent,terms_accepted,accepted_at) values(p_id,'section4-test',true,true,now());
  insert into public.submission_media(submission_id,status,original_path,original_extension,original_mime_type,original_bytes,original_width,original_height,original_checksum_sha256,uploaded_at)
  values(p_id,'uploaded',p_id::text||'/original.webp','webp','image/webp',1024,1200,1200,repeat('a',64),now());
end $$;

select pg_temp.make_pending('51000000-0000-4000-8000-000000000010','  Asha   Rao  ');
select pg_temp.make_pending('51000000-0000-4000-8000-000000000011','Direct Reject');
select pg_temp.make_pending('51000000-0000-4000-8000-000000000012','Published Guardian');
select pg_temp.make_pending('51000000-0000-4000-8000-000000000013','Admin Instead');

set local role authenticated;
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000005',true);
select throws_ok($$select public.update_submission_review_fields('51000000-0000-4000-8000-000000000010','Asha Rao',.5,.5)$$,'P0001','unauthorized_role','non-staff cannot update review fields');
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000004',true);
select throws_ok($$select public.recommend_submission_rejection('51000000-0000-4000-8000-000000000010','A clear participant comment.')$$,'P0001','unauthorized_role','inactive staff cannot moderate');
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.update_submission_review_fields('51000000-0000-4000-8000-000000000010','Asha Rao',.25,.75)$$,'Reviewer updates safe review fields');
select is((select display_name from public.submissions where id='51000000-0000-4000-8000-000000000010'),'Asha Rao','display name is normalized and saved');
select is((select focal_x from public.submission_media where submission_id='51000000-0000-4000-8000-000000000010'),.25::numeric,'focal point is saved');
select throws_ok($$select public.recommend_submission_rejection('51000000-0000-4000-8000-000000000010','short')$$,'P0001','comment_required','recommendation requires a participant-facing comment');
select lives_ok($$select public.recommend_submission_rejection('51000000-0000-4000-8000-000000000010','Please submit a clearer tree photograph.')$$,'Reviewer recommends rejection');
select is((select status::text from public.submissions where id='51000000-0000-4000-8000-000000000010'),'rejection_pending_admin','recommendation awaits Admin');
select is((select count(*) from public.email_deliveries where submission_id='51000000-0000-4000-8000-000000000010' and kind='rejection'),0::bigint,'recommendation creates no rejection delivery');
select throws_ok($$select public.confirm_submission_rejection('51000000-0000-4000-8000-000000000010','Reviewer must not confirm this.')$$,'P0001','unauthorized_role','Reviewer cannot confirm rejection');
select throws_ok($$select * from public.trash_submission('51000000-0000-4000-8000-000000000010')$$,'P0001','unauthorized_role','Reviewer cannot trash');
select throws_ok($$select public.delete_trashed_submission('51000000-0000-4000-8000-000000000010','Reviewer cannot delete this record.')$$,'P0001','unauthorized_role','Reviewer cannot permanently delete');
select throws_ok($$select public.manage_staff_profile('51000000-0000-4000-8000-000000000001','Reviewer','reviewer',true)$$,'P0001','unauthorized_role','Reviewer cannot manage staff');
select throws_ok($$select public.update_campaign_settings(983,'Vriksha promises',true)$$,'P0001','unauthorized_role','Reviewer cannot change campaign settings');
select throws_ok($$select * from public.publish_submission('51000000-0000-4000-8000-000000000010',9001,'v1','card/9001-v1.webp',640,800,1000,'full/9001-v1.webp',1200,1200,2000,'Tree')$$,'P0001','approval_conflict','Reviewer cannot publish a rejection recommendation');

select lives_ok($$select * from public.publish_submission('51000000-0000-4000-8000-000000000012',9002,'v1','card/9002-v1.webp',640,800,1000,'full/9002-v1.webp',1200,1200,2000,'A tree protected by a Vriksha Guardian')$$,'Reviewer publishes Pending Review');
select is((select status::text from public.submissions where id='51000000-0000-4000-8000-000000000012'),'published','publication is atomic');
select is((select status::text from public.submission_media where submission_id='51000000-0000-4000-8000-000000000012'),'published','media becomes public atomically');
select is((select count(*) from public.certificates where submission_id='51000000-0000-4000-8000-000000000012' and status='not_started'),1::bigint,'certificate placeholder is created once');
select is((select count(*) from public.email_deliveries where submission_id='51000000-0000-4000-8000-000000000012' and kind='approval_certificate' and status='not_started'),1::bigint,'approval email placeholder is created once');
select is((select count(*) from public.email_deliveries where submission_id='51000000-0000-4000-8000-000000000012' and status='sent'),0::bigint,'no email is marked sent');
select is((select count(*) from public.certificates where submission_id='51000000-0000-4000-8000-000000000012' and status='generated'),0::bigint,'no certificate is generated');
select is(
  (select already_published from public.publish_submission('51000000-0000-4000-8000-000000000012',9002,'v1','card/9002-v1.webp',640,800,1000,'full/9002-v1.webp',1200,1200,2000,'A tree protected by a Vriksha Guardian')),
  true,
  'a second reviewer publication attempt converges to the existing publication'
);
reset role;
select is((select count(*) from public.audit_logs where entity_id='51000000-0000-4000-8000-000000000012' and action='submission.approved'),1::bigint,'competing publication attempts create one approval audit event');

set local role authenticated;
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.set_movement_wall_visibility('51000000-0000-4000-8000-000000000012',false)$$,'Reviewer hides a published card');
select is((select current_count from public.get_public_campaign_summary()),1::bigint,'hiding a card does not change the campaign count');
select is((select count(*) from public.list_public_movement_entries(24,null,null)),0::bigint,'hidden card is absent from Movement Wall');
select lives_ok($$select public.set_movement_wall_visibility('51000000-0000-4000-8000-000000000012',true)$$,'Reviewer restores a published card');
select is((select count(*) from public.list_public_movement_entries(24,null,null)),1::bigint,'restored card returns to Movement Wall');
reset role;
select is((select count(*) from public.audit_logs where entity_id='51000000-0000-4000-8000-000000000012' and action='submission.movement_wall_visibility_changed'),2::bigint,'visibility changes are audited');

set local role authenticated;
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.confirm_submission_rejection('51000000-0000-4000-8000-000000000011','This photograph does not clearly show a tree.')$$,'Admin rejects Pending Review directly');
select lives_ok($$select public.confirm_submission_rejection('51000000-0000-4000-8000-000000000011','This photograph does not clearly show a tree.')$$,'Final rejection is idempotent');
select is((select count(*) from public.email_deliveries where submission_id='51000000-0000-4000-8000-000000000011' and kind='rejection'),1::bigint,'final rejection prepares exactly one delivery');
select throws_ok($$select * from public.publish_submission('51000000-0000-4000-8000-000000000011',9011,'v1','card/9011-v1.webp',640,800,1000,'full/9011-v1.webp',1200,1200,2000,'Rejected tree')$$,'P0001','approval_conflict','approval racing after final rejection cannot change the final state');
select lives_ok($$select * from public.publish_submission('51000000-0000-4000-8000-000000000010',9003,'v2','card/9003-v2.webp',640,800,1100,'full/9003-v2.webp',1200,1200,2100,'Asha Rao tree promise')$$,'Admin approves instead of confirming recommendation');

select is((select current_count from public.get_public_campaign_summary()),2::bigint,'public count uses published media rule');
select is((select count(*) from public.list_public_movement_entries(24,null,null)),2::bigint,'movement exposes two active publications');
select ok(not ((select to_jsonb(entry) from public.list_public_movement_entries(1,null,null) entry) ? 'submission_id'),'movement rows omit submission IDs');
select ok(not ((select to_jsonb(entry) from public.list_public_movement_entries(1,null,null) entry) ? 'email'),'movement rows omit email');
select ok(not ((select to_jsonb(entry) from public.list_public_movement_entries(1,null,null) entry) ? 'original_path'),'movement rows omit original paths');
select is((select count(*) from public.list_public_movement_entries(100,null,null)),2::bigint,'movement limit is safely capped without duplication');

select lives_ok($$select * from public.trash_submission('51000000-0000-4000-8000-000000000012')$$,'Admin trashes Published record');
select throws_ok($$select * from public.trash_submission('51000000-0000-4000-8000-000000000012')$$,'P0001','already_trashed','a second Trash request is conflict safe');
select is((select current_count from public.get_public_campaign_summary()),1::bigint,'trash immediately decreases public count');
select is((select count(*) from public.list_public_movement_entries(24,null,null) where guardian_number=9002),0::bigint,'trash hides Movement entry');
select lives_ok($$select public.restore_published_submission('51000000-0000-4000-8000-000000000012','v3','card/9002-v3.webp',640,800,1200,'full/9002-v3.webp',1200,1200,2200)$$,'Published restore requires new immutable metadata');
select throws_ok($$select public.restore_published_submission('51000000-0000-4000-8000-000000000012','v4','card/9002-v4.webp',640,800,1200,'full/9002-v4.webp',1200,1200,2200)$$,'P0001','restore_conflict','a second restore request is conflict safe');
select is((select current_count from public.get_public_campaign_summary()),2::bigint,'restored Published record counts again');
select throws_ok($$select public.delete_trashed_submission('51000000-0000-4000-8000-000000000012','Cannot delete active publication.')$$,'P0001','delete_requires_trash','permanent deletion requires Trash');

select lives_ok($$select public.manage_staff_profile('51000000-0000-4000-8000-000000000001','Campaign Reviewer','reviewer',true)$$,'Admin edits existing staff profile');
select lives_ok($$select public.update_campaign_settings(1000,'Tree promises',true)$$,'Admin may change campaign settings');
select is((select target_count from public.campaign_settings where id=1),1000,'Admin setting change is stored');
select throws_ok($$select public.manage_staff_profile('51000000-0000-4000-8000-000000000002','Section 4 Admin','admin',false)$$,'P0001','self_deactivation_forbidden','Admin cannot deactivate their own profile');
select lives_ok($$select public.manage_staff_profile('51000000-0000-4000-8000-000000000003','Second Admin','reviewer',true)$$,'Admin may demote another Admin while one remains');
select throws_ok($$select public.manage_staff_profile('51000000-0000-4000-8000-000000000002','Section 4 Admin','reviewer',true)$$,'P0001','final_admin_required','final active Admin cannot be demoted');
reset role;

set local role anon;
select is((select current_count from public.get_public_campaign_summary()),2::bigint,'anonymous public summary works without table access');
select is((select count(*) from public.list_public_movement_entries(24,null,null)),2::bigint,'anonymous Movement list works');
select throws_ok($$select * from public.submissions$$,'42501',null,'anonymous still cannot read internal submissions');
reset role;

select * from finish();
rollback;
