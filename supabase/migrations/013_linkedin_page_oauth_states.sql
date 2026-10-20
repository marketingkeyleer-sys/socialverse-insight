-- sv_oauth_states and sv_platform_posts each have their own copy of the
-- platform CHECK constraint (separate tables, separate constraints) —
-- missed in 012. sv_oauth_states needs it since oauth-start inserts a state
-- row before the account itself ever exists; sv_platform_posts needs it for
-- when Page sync/analytics gets built.
ALTER TABLE public.sv_oauth_states DROP CONSTRAINT sv_oauth_states_platform_check;
ALTER TABLE public.sv_oauth_states ADD CONSTRAINT sv_oauth_states_platform_check
  CHECK (platform IN ('facebook','instagram','youtube','linkedin','linkedin_page'));

ALTER TABLE public.sv_platform_posts DROP CONSTRAINT sv_platform_posts_platform_check;
ALTER TABLE public.sv_platform_posts ADD CONSTRAINT sv_platform_posts_platform_check
  CHECK (platform IN ('facebook','instagram','youtube','linkedin','linkedin_page'));
