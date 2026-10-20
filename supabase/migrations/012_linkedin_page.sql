-- LinkedIn Company Page access is a genuinely separate product from
-- personal "Sign In with LinkedIn" (Community Management API, its own
-- LinkedIn app, its own OAuth client) — modeled as its own platform value
-- rather than a sub-mode of 'linkedin', so a user can have both a personal
-- LinkedIn identity connection and a Page connection side by side.
ALTER TABLE public.sv_connected_accounts DROP CONSTRAINT sv_connected_accounts_platform_check;
ALTER TABLE public.sv_connected_accounts ADD CONSTRAINT sv_connected_accounts_platform_check
  CHECK (platform IN ('facebook','instagram','youtube','linkedin','linkedin_page'));
