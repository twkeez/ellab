// The built-in tools of the-lab. The hub reads the count from here and the
// experiments index lists them, so the number is always honest.

export type Tool = { name: string; desc: string; href: string };

export const TOOLS: Tool[] = [
  { name: "Brain dump", desc: "Capture anything — prefixes file it where it belongs", href: "/" },
  { name: "Groceries", desc: "A shopping list that syncs to your phone", href: "/" },
  { name: "To-do", desc: "One-off tasks, checked off and cleared", href: "/" },
  { name: "On my radar", desc: "Books, films, music & games to explore", href: "/" },
  { name: "Chores", desc: "A rotating focus and a forgiving streak", href: "/chores" },
  { name: "On the bike", desc: "Ride tracker — 30 min a day, 5 days a week", href: "/exercise" },
  { name: "Habits", desc: "Daily habits, each building its own streak", href: "/" },
  { name: "Goals", desc: "The bigger things you're chasing", href: "/goals" },
  { name: "This week", desc: "Your momentum — habits, milestones & wins", href: "/recap" },
  { name: "Recipes", desc: "Dishes worth cooking, saved", href: "/recipes" },
  { name: "Writing studio", desc: "Draft fiction with Claude at your side", href: "/write" },
  { name: "Calendar", desc: "Your own events and schedule", href: "/calendar" },
  { name: "Weather", desc: "Conditions, air quality, sun & moon", href: "/" },
  { name: "The feed", desc: "Books, film & Pittsburgh news that learns", href: "/" },
  { name: "On this day", desc: "A little history, every day", href: "/" },
  { name: "Timer", desc: "Quick kitchen timers", href: "/" },
  { name: "Random spark", desc: "A whim to build when inspiration strikes", href: "/" },
];
