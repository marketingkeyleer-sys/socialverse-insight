-- sv_post_platform_results.connected_account_id was missing an ON DELETE
-- action in the original schema (every other table referencing
-- sv_connected_accounts already has ON DELETE CASCADE) — disconnecting any
-- account that had ever published a post failed with a foreign key
-- violation instead of disconnecting. SET NULL (not CASCADE) here, since
-- publish history — what succeeded, what failed, the error message — has
-- real value even after the account itself is disconnected.
ALTER TABLE public.sv_post_platform_results
  DROP CONSTRAINT sv_post_platform_results_connected_account_id_fkey;
ALTER TABLE public.sv_post_platform_results
  ADD CONSTRAINT sv_post_platform_results_connected_account_id_fkey
  FOREIGN KEY (connected_account_id) REFERENCES public.sv_connected_accounts(id) ON DELETE SET NULL;
