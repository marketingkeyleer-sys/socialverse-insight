import { cn } from "@/lib/utils";

export function CharacterCounter({ current, max }: { current: number; max: number }) {
  const over = current > max;

  return (
    <span className={cn("text-xs tabular-nums", over ? "font-medium text-destructive" : "text-muted-foreground")}>
      {current.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}
