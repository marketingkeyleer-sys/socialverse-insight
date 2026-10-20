import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostFilters } from "@/components/posts/PostFilters";
import { PostList } from "@/components/posts/PostList";
import { BulkActions } from "@/components/posts/BulkActions";
import { usePosts, type PostFilters as Filters } from "@/hooks/usePosts";
import type { Platform, PostStatus } from "@/types/database";

const TABS: { value: PostStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "failed", label: "Failed" },
];

const EMPTY_MESSAGES: Record<PostStatus | "all", string> = {
  all: "You haven't created any posts yet.",
  draft: "No drafts saved.",
  scheduled: "Nothing scheduled right now.",
  publishing: "Nothing publishing right now.",
  published: "You haven't published anything yet.",
  partially_failed: "No partially failed posts.",
  failed: "No failed posts — nice.",
};

export default function Posts() {
  const [tab, setTab] = useState<PostStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const filters: Filters = {
    ...(tab !== "all" && { status: tab }),
    ...(platform !== "all" && { platform }),
    ...(search && { search }),
  };

  const { list, deletePost, duplicatePost } = usePosts(filters, page);
  const posts = list.data?.posts ?? [];
  const total = list.data?.total ?? 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    for (const id of selected) await deletePost.mutateAsync(id);
    setSelected(new Set());
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as PostStatus | "all");
          setPage(0);
          setSelected(new Set());
        }}
      >
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <PostFilters search={search} onSearchChange={setSearch} platform={platform} onPlatformChange={setPlatform} />

      <BulkActions count={selected.size} onClear={() => setSelected(new Set())} onDelete={handleBulkDelete} />

      {list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <PostList
          posts={posts}
          selectedIds={selected}
          onToggleSelect={toggleSelect}
          onDelete={(id) => deletePost.mutate(id)}
          onDuplicate={(id) => duplicatePost.mutate(id)}
          emptyMessage={EMPTY_MESSAGES[tab]}
        />
      )}

      {total > (page + 1) * 20 && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
