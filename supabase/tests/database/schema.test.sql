begin;
select no_plan();

select has_enum('public', 'staff_role', 'staff_role enum exists');
select has_enum('public', 'submission_status', 'submission_status enum exists');
select has_enum('public', 'submission_source', 'submission_source enum exists');
select has_enum('public', 'media_status', 'media_status enum exists');
select has_enum('public', 'certificate_status', 'certificate_status enum exists');
select has_enum('public', 'email_delivery_status', 'email_delivery_status enum exists');
select has_enum('public', 'email_delivery_kind', 'email_delivery_kind enum exists');

select has_table('public', 'staff_profiles', 'staff_profiles table exists');
select has_table('public', 'campaign_settings', 'campaign_settings table exists');
select has_table('public', 'submissions', 'submissions table exists');
select has_table('public', 'submission_contacts', 'submission_contacts table exists');
select has_table('public', 'submission_consents', 'submission_consents table exists');
select has_table('public', 'submission_media', 'submission_media table exists');
select has_table('public', 'certificates', 'certificates table exists');
select has_table('public', 'email_deliveries', 'email_deliveries table exists');
select has_table('public', 'email_webhook_events', 'email_webhook_events table exists');
select has_table('public', 'audit_logs', 'audit_logs table exists');

select has_pk('public', 'staff_profiles', 'staff_profiles has a primary key');
select has_pk('public', 'campaign_settings', 'campaign_settings has a primary key');
select has_pk('public', 'submissions', 'submissions has a primary key');
select has_fk('public', 'submission_contacts', 'submission_contacts has a foreign key');
select has_fk('public', 'submission_consents', 'submission_consents has a foreign key');
select has_fk('public', 'submission_media', 'submission_media has a foreign key');
select has_sequence('public', 'guardian_number_seq', 'guardian_number_seq exists');

select has_column('public', 'submissions', 'guardian_number', 'guardian_number column exists');
select has_column('public', 'submissions', 'rejection_recommended_by', 'rejection_recommended_by column exists');
select has_column('public', 'submissions', 'rejection_confirmed_by', 'rejection_confirmed_by column exists');
select has_column('public', 'submissions', 'trashed_at', 'trashed_at column exists');
select hasnt_column('public', 'campaign_settings', 'current_count', 'settings does not store current_count');
select has_column('public', 'campaign_settings', 'movement_wall_enabled', 'global Movement Wall switch exists');
select is((select target_count from public.campaign_settings where id = 1), 983, 'singleton target is 983');

select has_index('public', 'submissions', 'submissions_guardian_number_unique'::name, 'Guardian number unique index exists');
select has_index('public', 'submissions', 'submissions_active_pending_review_idx'::name, 'pending review partial index exists');
select has_index('public', 'submissions', 'submissions_rejection_pending_admin_idx'::name, 'rejection pending partial index exists');
select has_index('public', 'submissions', 'submissions_active_published_idx'::name, 'published partial index exists');

select has_function('private', 'is_active_staff', array[]::text[], 'is_active_staff exists');
select has_function('private', 'current_staff_role', array[]::text[], 'current_staff_role exists');
select has_function('private', 'is_admin', array[]::text[], 'is_admin exists');
select has_function('private', 'is_reviewer_or_admin', array[]::text[], 'is_reviewer_or_admin exists');
select has_function('private', 'current_published_count', array[]::text[], 'current_published_count exists');
select function_returns('private', 'current_published_count', array[]::text[], 'bigint', 'current_published_count returns bigint');

select ok(c.relrowsecurity, c.relname || ' has RLS enabled')
from pg_catalog.pg_class as c
join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'staff_profiles', 'campaign_settings', 'submissions', 'submission_contacts',
    'submission_consents', 'submission_media', 'certificates', 'email_deliveries',
    'email_webhook_events', 'audit_logs'
  );

select is((select public from storage.buckets where id = 'submission-originals'), false, 'original bucket is private');
select is((select public from storage.buckets where id = 'published-images'), true, 'published images bucket is public');
select is((select public from storage.buckets where id = 'certificates'), false, 'certificate bucket is private');

select * from finish();
rollback;
