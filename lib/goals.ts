// Days-to-target for a goal. Returns null when no date is set; a tone of
// "hot" as the deadline lands and "over" once it's passed.
export function countdown(target: string | null): { text: string; tone: string } | null {
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target + "T00:00:00");
  const days = Math.round((t.getTime() - today.getTime()) / 86400000);
  if (days > 1) return { text: `${days} days to go`, tone: "" };
  if (days === 1) return { text: "due tomorrow", tone: "hot" };
  if (days === 0) return { text: "due today", tone: "hot" };
  if (days === -1) return { text: "1 day over", tone: "over" };
  return { text: `${-days} days over`, tone: "over" };
}
