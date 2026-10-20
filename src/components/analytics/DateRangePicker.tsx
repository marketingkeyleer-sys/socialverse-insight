import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDate } from "@/lib/utils";
import { last, type DateRange } from "@/hooks/useAnalytics";

const PRESETS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

export function DateRangePicker({
  range,
  activeDays,
  onChange,
}: {
  range: DateRange;
  activeDays: number | null;
  onChange: (range: DateRange, days: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border p-0.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.days}
            onClick={() => onChange(last(preset.days), preset.days)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeDays === preset.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn(activeDays === null && "border-primary")}>
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {formatDate(range.from)} – {formatDate(range.to)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{ from: range.from, to: range.to }}
            onSelect={(value) => {
              if (value?.from && value?.to) onChange({ from: value.from, to: value.to }, null);
            }}
            disabled={{ after: new Date() }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
