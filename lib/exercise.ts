// Stationary-bike tracker: 30 minutes a day, 5 days a week.
import { ymd, habitStreak, weekDates } from "./streak";

export const DAILY_GOAL_MIN = 30;
export const WEEKLY_GOAL_DAYS = 5;

export type Workout = { id: number; date: string; minutes: number };

// Total minutes ridden per day (several sessions in a day add up).
export function minutesByDay(workouts: Workout[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const w of workouts) m[w.date] = (m[w.date] ?? 0) + w.minutes;
  return m;
}

export type ExerciseStats = {
  todayMin: number;
  streak: number; // consecutive days that met the daily goal
  weekDaysHit: number; // days this week that met the goal
  weekMinutes: number; // total minutes ridden this week
  week: { date: string; minutes: number; hit: boolean }[]; // Mon→Sun
};

export function exerciseStats(workouts: Workout[], today: Date): ExerciseStats {
  const byDay = minutesByDay(workouts);
  const todayStr = ymd(today);
  const hitDays = Object.keys(byDay).filter((d) => byDay[d] >= DAILY_GOAL_MIN);
  const week = weekDates(today).map((d) => {
    const minutes = byDay[d] ?? 0;
    return { date: d, minutes, hit: minutes >= DAILY_GOAL_MIN };
  });
  return {
    todayMin: byDay[todayStr] ?? 0,
    streak: habitStreak(hitDays, todayStr),
    weekDaysHit: week.filter((x) => x.hit).length,
    weekMinutes: week.reduce((s, x) => s + x.minutes, 0),
    week,
  };
}
