// A goal's progress ring blends its one-time milestones with the daily
// habits linked to it: each done milestone and each still-alive habit fills
// one unit of the total. A lapsed linked habit stays in the denominator, so
// letting the routine slip drags the ring down and nudges you back.
export function goalProgress(
  milestonesDone: number,
  milestonesTotal: number,
  habitsAlive: number,
  habitsTotal: number
): number {
  const total = milestonesTotal + habitsTotal;
  if (!total) return 0;
  return (milestonesDone + habitsAlive) / total;
}

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
