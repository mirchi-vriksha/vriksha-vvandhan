# Rollback runbook

For a serious launch issue:

1. Set `submissions_open=false` using the Admin setting or a verified Admin RPC session.
2. Keep the campaign story/homepage public where safe; stop new participant writes.
3. Preserve every already submitted record and private object.
4. Disable the delivery cron/email sending if delivery behaviour is implicated.
5. Capture request IDs, deployment ID, safe error codes and timing; never copy PII into incident chat.
6. Roll back the Vercel deployment when the fault is code/configuration.
7. Revert a database migration only with a reviewed forward-fix/restore plan; never casually reset production.
8. Restore from backup only for actual corruption or loss, into isolation first.
9. Re-run RLS, bucket visibility, count, submission, moderation, delivery and mobile smoke checks.
10. Obtain company operations and engineering sign-off before reopening submissions.

Keep Gate B/email disabled during recovery unless email has been separately proven safe. Guardian sequence gaps are acceptable; duplicate or reused Guardian numbers are not. A failed certificate/email must never undo approval or publication.
