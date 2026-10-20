-- A brand holds at most one account per platform (one Facebook Page, one
-- Instagram, one LinkedIn, one WhatsApp ...). Ungrouped accounts (no brand)
-- are exempt so accounts connected before brands existed keep working.
-- If a brand already has duplicates, the oldest is kept and the extras are
-- moved back to Ungrouped instead of failing the migration.
UPDATE public.sv_connected_accounts a
SET brand_id = NULL
WHERE brand_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.sv_connected_accounts b
    WHERE b.brand_id = a.brand_id AND b.platform = a.platform
      AND (b.connected_at, b.id) < (a.connected_at, a.id)
  );

CREATE UNIQUE INDEX sv_uniq_brand_platform
  ON public.sv_connected_accounts (brand_id, platform)
  WHERE brand_id IS NOT NULL;
