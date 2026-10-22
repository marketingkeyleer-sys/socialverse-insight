import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickScheduleDialog } from "@/components/calendar/QuickScheduleDialog";
import { useCalendarPosts, effectiveDate } from "@/hooks/useCalendarPosts";
import { getPlatformIcon } from "@/lib/platforms";
import { cn, truncateText } from "@/lib/utils";
import type { Platform, Post } from "@/types/database";
import { localDayKey } from "@/lib/scheduling";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function statusDotColor(status: Post["status"]) {
  switch (status) {
    case "published":
      return "bg-emerald-500";
    case "failed":
      return "bg-destructive";
    case "partially_failed":
      return "bg-amber-500";
    case "publishing":
      return "bg-blue-500";
    default:
      return "bg-muted-foreground";
  }
}

export default function CalendarPage() {
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [dialogDate, setDialogDate] = useState<Date | null>(null);
  const { data: posts = [], isLoading, error, refetch } = useCalendarPosts(monthCursor);
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      if (platformFilter !== "all" && !post.platforms.includes(platformFilter)) continue;
      const date = effectiveDate(post);
      if (!date) continue;
      const key = localDayKey(date);
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [posts, platformFilter]);

  const days = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - firstOfMonth.getDay());

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [monthCursor]);

  const monthLabel = monthCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today = new Date();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Every scheduled and published post, by day. <Link className="text-primary underline" to="/content-planner">Plan a month or year</Link></p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-36 text-center text-sm font-medium">{monthLabel}</span>
          <Button variant="outline" size="icon" onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonthCursor(new Date())}>
            Today
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2"><Button size="sm" variant={platformFilter === "all" ? "default" : "outline"} onClick={() => setPlatformFilter("all")}>All platforms</Button>{[...new Set(posts.flatMap(post => post.platforms))].map(platform => <Button key={platform} size="sm" variant={platformFilter === platform ? "default" : "outline"} onClick={() => setPlatformFilter(platform as Platform)}>{platform.replace("_", " ")}</Button>)}<Button asChild size="sm" className="ml-auto"><Link to="/compose">Create post</Link></Button></div>
      <p className="text-xs text-muted-foreground">Times use your device timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Scheduling supports one or several connected accounts. Automatic publishing is checked every five minutes.</p>
      {error && <p role="alert">Calendar could not load. <button className="underline" onClick={() => void refetch()}>Retry</button></p>}
      {!isLoading && !error && !posts.length && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No dated posts in this workspace yet. Save a scheduled post to see it here; undated drafts remain in Posts.</p>}
      {isLoading ? (
        <Skeleton className="h-[600px] rounded-xl" />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const inMonth = day.getMonth() === monthCursor.getMonth();
              const dayPosts = postsByDay.get(localDayKey(day)) ?? [];
              const overflow = dayPosts.length - 3;

              return (
                <div
                  key={i}
                  className={cn(
                    "group flex min-h-28 flex-col gap-1 border-b border-r p-1.5 last:border-r-0",
                    !inMonth && "bg-muted/20",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-full text-xs",
                        isSameDay(day, today) ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                        !inMonth && "opacity-40",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <button
                      onClick={() => setDialogDate(day)}
                      className="hidden rounded-md p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground group-hover:block"
                      aria-label="Schedule a post on this day"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {dayPosts.slice(0, 3).map((post) => {
                      const platform = post.platforms[0] as Platform | undefined;
                      const Icon = platform ? getPlatformIcon(platform) : null;
                      return (
                        <Link
                          key={post.id}
                          to={`/posts/${post.id}`}
                          className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] hover:bg-accent"
                        >
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDotColor(post.status))} />
                          {Icon && <Icon className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{truncateText(post.title || post.content, 24)}</span>
                        </Link>
                      );
                    })}
                    {overflow > 0 && <p className="px-1 text-[11px] text-muted-foreground">+{overflow} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <QuickScheduleDialog date={dialogDate} open={dialogDate !== null} onOpenChange={(open) => !open && setDialogDate(null)} />
    </div>
  );
}
