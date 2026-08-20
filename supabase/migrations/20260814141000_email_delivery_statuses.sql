alter type public.email_delivery_status add value if not exists 'suppressed';
alter type public.email_delivery_status add value if not exists 'manual_review';
