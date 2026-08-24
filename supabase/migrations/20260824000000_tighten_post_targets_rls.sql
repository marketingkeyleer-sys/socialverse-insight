-- The original pt_update_own policy allowed an authenticated user to update
-- ANY column on their own post_targets rows, including status/locked_at —
-- which meant a user's own session could unlock a row the scheduler had
-- claimed (status='publishing') back to 'pending', defeating the scheduler's
-- exclusive-claim invariant and risking a duplicate publish.
--
-- The only legitimate self-service mutation a user needs is canceling a
-- still-pending target (see cancelScheduledPost in
-- src/lib/scheduled-posts.functions.ts), so restrict the policy to exactly
-- that transition. The scheduler itself uses the service-role client, which
-- bypasses RLS entirely and is unaffected by this change.

DROP POLICY "pt_update_own" ON public.post_targets;

CREATE POLICY "pt_update_own" ON public.post_targets
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'canceled');
