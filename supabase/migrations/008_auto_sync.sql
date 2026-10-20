-- Lets each connected account have its own auto-sync cadence instead of
-- requiring a manual "Sync now" click every time.
ALTER TABLE public.sv_connected_accounts ADD COLUMN sync_interval_minutes integer NOT NULL DEFAULT 30;
