import { useState } from "react";
import { endOfDay, startOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDate } from "@/lib/utils";
import { reportRange, type ReportPreset, type ReportRange } from "@/lib/analyticsReport";
const PRESETS: { label: string; value: Exclude<ReportPreset, "custom"> }[] = [
  { label: "Today", value: "today" }, { label: "Yesterday", value: "yesterday" },
  { label: "This week", value: "week" }, { label: "This month", value: "month" },
  { label: "Last 7 days", value: "7" }, { label: "Last 30 days", value: "30" }, { label: "Last 90 days", value: "90" },
];
export function DateRangePicker({range, preset, onChange}: {range: ReportRange; preset: ReportPreset; onChange: (range: ReportRange, preset: ReportPreset) => void}) {
  const [draft, setDraft] = useState<{from?: Date; to?: Date}>({from: range.from, to: range.to});
  const [open, setOpen] = useState(false);
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-1.5" aria-label="Reporting period">
      {PRESETS.map(p => <button key={p.value} aria-pressed={preset === p.value} onClick={() => onChange(reportRange(p.value), p.value)} className={cn("rounded-lg px-3 py-2 text-xs font-semibold transition-colors", preset === p.value ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-accent")}>{p.label}</button>)}
      <Popover open={open} onOpenChange={value => {setOpen(value); if(value) setDraft({from: range.from, to: range.to});}}><PopoverTrigger asChild><Button variant={preset === "custom" ? "default" : "outline"} size="sm"><CalendarIcon className="mr-2 h-3.5 w-3.5"/>Custom range</Button></PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="end"><Calendar mode="range" selected={draft.from ? {from: draft.from, to: draft.to} : undefined} onSelect={value => setDraft(value ?? {})} disabled={{after: new Date()}}/><Button className="mt-2 w-full" disabled={!draft.from || !draft.to} onClick={() => {if(draft.from && draft.to) {onChange({from:startOfDay(draft.from), to:endOfDay(draft.to)}, "custom"); setOpen(false);}}}>Apply date range</Button></PopoverContent>
      </Popover>
    </div>
    <p className="text-xs text-muted-foreground">{formatDate(range.from)} – {formatDate(range.to)} · Calendar days in your local timezone · Week starts Monday</p>
  </div>;
}
