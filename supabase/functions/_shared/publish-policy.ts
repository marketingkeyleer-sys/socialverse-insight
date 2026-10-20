interface Account { id: string; user_id: string; platform: string; is_active: boolean }
interface Post { user_id: string; platforms: string[]; connected_account_ids?: string[] | null }

export function selectPublishTargets<T extends Account>(ownerId: string, post: Post, accounts: T[]): T[] {
  if (post.user_id !== ownerId) throw new Error("Post belongs to another user");
  const owned = accounts.filter((a) => a.user_id === ownerId && a.is_active);
  if (post.connected_account_ids?.length) {
    const ids = [...new Set(post.connected_account_ids)];
    const targets = ids.map((id) => owned.find((a) => a.id === id));
    if (targets.some((a) => !a)) throw new Error("A selected account is disconnected or belongs to another user");
    return targets as T[];
  }
  // Legacy posts have only platform names. Never choose an arbitrary account.
  return [...new Set(post.platforms)].map((platform) => {
    const matches = owned.filter((a) => a.platform === platform);
    if (matches.length !== 1) throw new Error(`Select a destination account for ${platform} in the composer`);
    return matches[0];
  });
}
