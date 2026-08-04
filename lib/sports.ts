// Shared shapes for the sports section. Scores/schedules come from ESPN's
// public scoreboard JSON (free, no key) via /api/sports.

export type Team = {
  name: string;
  short: string;
  abbr: string;
  score: string | null;
  record: string | null;
  winner: boolean;
};

export type Game = {
  league: string; // MLB, NFL, EPL, NHL
  id: string;
  startISO: string;
  startMs: number;
  state: "pre" | "in" | "post";
  detail: string; // "Final", "Top 5th", "7:05 PM"
  home: Team;
  away: Team;
  broadcasts: string[];
  national: boolean;
  score: number; // objective watchability
  reasons: string[];
  drama: boolean; // dramatic finish worth a replay
};

export type GolfLeader = { pos: string; name: string; score: string };
export type Golf = {
  name: string;
  detail: string;
  state: string;
  leaders: GolfLeader[];
} | null;

export type SportsData = {
  generatedAt: number;
  today: Game[];
  yesterday: Game[];
  golf: Golf;
};

// The Cubs are always a favorite; the rest come from the user's list.
export const DEFAULT_FAVORITES = ["Cubs"];

export function isFavorite(game: Game, favorites: string[]): boolean {
  const hay = `${game.home.name} ${game.home.short} ${game.away.name} ${game.away.short}`.toLowerCase();
  return favorites.some((f) => f.trim() && hay.includes(f.trim().toLowerCase()));
}

// A short human countdown / live label for a game.
export function whenLabel(game: Game, nowMs: number): string {
  if (game.state === "in") return game.detail || "Live";
  if (game.state === "post") return game.detail || "Final";
  const mins = Math.round((game.startMs - nowMs) / 60000);
  if (mins <= 0) return "Starting";
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 12) return m ? `in ${h}h ${m}m` : `in ${h}h`;
  return game.detail || "";
}
