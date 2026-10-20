-- Demo data: 3 users, each with 2-3 connected accounts, 90 days of
-- analytics history, and 15-20 posts across every status. Safe to re-run —
-- it deletes any prior demo rows for these three emails first.

DO $$
DECLARE
  demo_emails text[] := ARRAY['demo1@socialhub.test', 'demo2@socialhub.test', 'demo3@socialhub.test'];
  demo_names text[] := ARRAY['Ava Martinez', 'Noah Chen', 'Priya Sharma'];
  demo_tiers text[] := ARRAY['free', 'pro', 'business'];
  uid uuid;
  email text;
  full_name text;
  tier text;
  platform_set text[];
  plat text;
  account_id uuid;
  followers_base int;
  d date;
  day_offset int;
  post_titles text[] := ARRAY[
    'Big announcement coming soon', 'Behind the scenes today', 'Our team is growing',
    'New product drop', 'Customer spotlight', 'Weekly tips roundup', 'Q&A recap',
    'Milestone unlocked', 'Thank you to our community', 'Sneak peek',
    'Live event highlights', 'Case study: real results', 'Monday motivation',
    'Feature walkthrough', 'Holiday hours update', 'We hit a new record',
    'Partner spotlight', 'Ask us anything', 'This week in review', 'Coming next month'
  ];
  post_statuses text[] := ARRAY['draft','scheduled','published','published','published','published','failed'];
  chosen_status text;
  post_id uuid;
  i int;
BEGIN
  -- Clean any prior demo data.
  DELETE FROM auth.users WHERE email = ANY(demo_emails);

  FOR i IN 1..3 LOOP
    email := demo_emails[i];
    full_name := demo_names[i];
    tier := demo_tiers[i];

    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      email, crypt('DemoPass123!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', full_name),
      now() - interval '90 days', now()
    );

    UPDATE public.sv_profiles
    SET plan_tier = tier,
        max_connected_accounts = CASE tier WHEN 'free' THEN 4 WHEN 'pro' THEN 10 ELSE 25 END,
        max_scheduled_posts = CASE tier WHEN 'free' THEN 10 ELSE 999999 END,
        onboarding_completed = true
    WHERE id = uid;

    -- 2-3 connected accounts per user, rotating through platforms.
    platform_set := CASE i
      WHEN 1 THEN ARRAY['facebook','instagram']
      WHEN 2 THEN ARRAY['instagram','youtube','linkedin']
      ELSE ARRAY['facebook','linkedin','youtube']
    END;

    FOREACH plat IN ARRAY platform_set LOOP
      account_id := gen_random_uuid();
      followers_base := 1000 + floor(random() * 45000)::int;

      INSERT INTO public.sv_connected_accounts (
        id, user_id, platform, platform_user_id, platform_username,
        platform_display_name, is_active, profile_picture_url,
        followers_count, following_count, posts_count,
        connected_at, last_synced_at
      ) VALUES (
        account_id, uid, plat, 'demo_' || plat || '_' || i,
        lower(replace(full_name, ' ', '')) || '_' || plat,
        full_name, true,
        'https://api.dicebear.com/9.x/avataaars/svg?seed=' || plat || i,
        followers_base + 90 * (5 + floor(random() * 40)::int), 200 + floor(random() * 800)::int,
        15 + floor(random() * 40)::int,
        now() - interval '90 days', now() - interval '2 hours'
      );

      -- 90 days of analytics, followers trending up, weekday-heavier engagement.
      FOR day_offset IN 0..89 LOOP
        d := (CURRENT_DATE - (89 - day_offset));
        INSERT INTO public.sv_analytics_snapshots (
          user_id, connected_account_id, platform, metric_date,
          followers, following, impressions, reach, engagement_rate,
          likes, comments, shares, saves, clicks, profile_views, video_views
        ) VALUES (
          uid, account_id, plat, d,
          followers_base + day_offset * (5 + floor(random() * 40)::int),
          200 + floor(random() * 800)::int,
          (CASE WHEN extract(isodow FROM d) IN (6,7) THEN 800 ELSE 1500 END + floor(random() * 2500))::int,
          (CASE WHEN extract(isodow FROM d) IN (6,7) THEN 500 ELSE 1000 END + floor(random() * 1800))::int,
          round((1 + random() * 7)::numeric, 2),
          floor(random() * 300)::int, floor(random() * 60)::int, floor(random() * 40)::int,
          floor(random() * 50)::int, floor(random() * 120)::int, floor(random() * 200)::int,
          CASE WHEN plat = 'youtube' THEN floor(random() * 5000)::int ELSE 0 END
        )
        ON CONFLICT (connected_account_id, metric_date) DO NOTHING;
      END LOOP;
    END LOOP;

    -- 15-20 posts per user across every status.
    FOR i IN 1..(15 + floor(random() * 6)::int) LOOP
      chosen_status := post_statuses[1 + floor(random() * array_length(post_statuses, 1))::int];
      post_id := gen_random_uuid();

      INSERT INTO public.sv_posts (
        id, user_id, title, content, platforms, status,
        scheduled_at, published_at, created_at
      ) VALUES (
        post_id, uid,
        post_titles[1 + floor(random() * array_length(post_titles, 1))::int],
        'This is demo content for a ' || chosen_status || ' post. ' ||
          'Crafted to show how SocialVerse keeps every channel in sync.',
        platform_set,
        chosen_status,
        CASE WHEN chosen_status = 'scheduled' THEN now() + (floor(random() * 14) || ' days')::interval ELSE NULL END,
        CASE WHEN chosen_status = 'published' THEN now() - (floor(random() * 60) || ' days')::interval ELSE NULL END,
        now() - (floor(random() * 90) || ' days')::interval
      );

      IF chosen_status IN ('published', 'failed') THEN
        FOREACH plat IN ARRAY platform_set LOOP
          INSERT INTO public.sv_post_platform_results (
            post_id, user_id, connected_account_id, platform, status,
            platform_post_id, published_url, error_message, engagement_data, published_at
          )
          SELECT
            post_id, uid, ca.id, plat,
            CASE WHEN chosen_status = 'failed' THEN 'failed' ELSE 'published' END,
            CASE WHEN chosen_status = 'published' THEN 'demo_post_' || substr(post_id::text, 1, 8) ELSE NULL END,
            CASE WHEN chosen_status = 'published' THEN 'https://example.com/' || plat || '/' || substr(post_id::text, 1, 8) ELSE NULL END,
            CASE WHEN chosen_status = 'failed' THEN 'Rate limited by platform API — try again later.' ELSE NULL END,
            CASE WHEN chosen_status = 'published'
              THEN jsonb_build_object('likes', floor(random()*500)::int, 'comments', floor(random()*80)::int, 'shares', floor(random()*40)::int)
              ELSE '{}'::jsonb
            END,
            CASE WHEN chosen_status = 'published' THEN now() - (floor(random() * 60) || ' days')::interval ELSE NULL END
          FROM public.sv_connected_accounts ca
          WHERE ca.user_id = uid AND ca.platform = plat
          LIMIT 1;
        END LOOP;
      END IF;
    END LOOP;

    INSERT INTO public.sv_activity_log (user_id, action, entity_type, metadata)
    VALUES (uid, 'account_created', 'profile', jsonb_build_object('plan', tier));
  END LOOP;
END $$;
