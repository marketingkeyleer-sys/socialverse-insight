export function localDayKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function scheduleTimestamp(date: Date | undefined | null, time: string, now = Date.now()): string {
  if (!date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Choose a valid date and time");
  const [hours, minutes] = time.split(":").map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  if (!Number.isFinite(combined.getTime()) || combined.getTime() <= now) throw new Error("Choose a scheduling time in the future");
  return combined.toISOString();
}

export const POST_CACHE_KEYS = ["posts", "post", "calendar-posts", "upcoming-posts", "dashboard-stats", "monthly-post-count"];
