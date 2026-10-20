import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLATFORM_CONFIGS } from "@/lib/platforms";
import type { Platform } from "@/types/database";

export function PostFilters({
  search,
  onSearchChange,
  platform,
  onPlatformChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  platform: Platform | "all";
  onPlatformChange: (value: Platform | "all") => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search posts…"
          className="pl-9"
        />
      </div>
      <Select value={platform} onValueChange={(v) => onPlatformChange(v as Platform | "all")}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="All platforms" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All platforms</SelectItem>
          {PLATFORM_CONFIGS.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
