import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const compactFormatter = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })

/** 1200 -> "1.2K" */
export function formatNumber(value: number): string {
  return compactFormatter.format(value)
}

export function formatDate(value: string | Date, opts: Intl.DateTimeFormatOptions = {}): string {
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...opts })
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
]
const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

/** "2 hours ago" / "in 3 days" */
export function getRelativeTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  const diffSeconds = (date.getTime() - Date.now()) / 1000

  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (Math.abs(diffSeconds) >= secondsInUnit) {
      return relativeFormatter.format(Math.round(diffSeconds / secondsInUnit), unit)
    }
  }
  return relativeFormatter.format(Math.round(diffSeconds), "second")
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}
