-- Supabase Cron owns durable email-queue processing. Secrets and job URLs are
-- configured per environment after this idempotent extension prerequisite.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
