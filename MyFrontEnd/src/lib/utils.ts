import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { endOfMonth, endOfWeek, isWithinInterval, startOfMonth, startOfWeek } from "date-fns";
import { toast } from "sonner";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function facetedFilter(row: any, columnId: string, filterValue: any[]) {
  if (!filterValue || filterValue.length === 0) return true;
    const rowValue = row.getValue(columnId);
  return filterValue.includes(String(rowValue));
}

export function recordsInThisWeek(records: any[]) {
  let week: number = 0;
  const now = new Date();
  const weekRange = {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  };

  for (const r of records) {
    if (!r) continue;
    const day = new Date(r);

    if (isWithinInterval(day, weekRange)) {
      week++;
    }
  }
  return week;
}

export function recordsInThisMonth(records: any[]) {
  let month: number = 0;
  const now = new Date();
  const monthRange = {
    start: startOfMonth(now),
    end: endOfMonth(now),
  };

  for (const r of records) {
    if (!r) continue;
    const day = new Date(r);
    if (isWithinInterval(day, monthRange)) {
      month++;
    }
  }
  return month;
}

export async function toClipboard(text: string, successMessage: string = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage, { position: "top-center" });
  } catch (error) {
    console.error("Failed to copy to clipboard", error);
  }
}
export function sortSeverity(a: string, b: string) {
  const severityOrder: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
    none: 0,
  };

  const orderA = severityOrder[a.toLowerCase()] ?? 0;
  const orderB = severityOrder[b.toLowerCase()] ?? 0;

  return orderA - orderB;
}

export function combineDateAndTime(date: Date, time: string) {
  const [hours, minutes, seconds] = time.split(":").map(Number);
  date.setHours(hours, minutes, seconds || 0);
  return date;
}
