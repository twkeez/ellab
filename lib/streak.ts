// Date + streak helpers shared by the hub and the goals page.

export function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayBefore(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return ymd(d);
}

// Monday→Sunday of the week containing `today`, as ymd strings.
export function weekDates(today: Date): string[] {
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, i) =>
    ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))
  );
}

// Consecutive days completed, counting back from today (or yesterday, so a
// not-yet-ticked-today habit still shows the streak it's about to keep).
// Returns 0 when the chain is broken — i.e. nothing done today or yesterday,
// which also means the streak is no longer "alive".
export function habitStreak(dates: string[], today: string): number {
  const set = new Set(dates);
  let cursor = set.has(today) ? today : dayBefore(today);
  if (!set.has(cursor)) return 0;
  let n = 0;
  while (set.has(cursor)) { n++; cursor = dayBefore(cursor); }
  return n;
}
