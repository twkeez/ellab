// Static details for the Europe '27 trip. The checklist + bookings live in
// Supabase (so they persist as you tick them) but are seeded from the defaults
// below the first time the page loads.

export const TRIP = {
  name: "Europe '27",
  tagline: "Pittsburgh → Copenhagen → Bratislava → Slovenia → home",
  departISO: "2027-04-14T11:49:00",
  returnISO: "2027-06-18T16:38:00",
  days: 65,
  route: [
    { code: "PIT", label: "Pittsburgh", note: "Apr 14" },
    { code: "JFK", label: "New York", note: "connect" },
    { code: "CPH", label: "Copenhagen", note: "Apr 15 · 06:45" },
    { code: "VIE", label: "Vienna → bus", note: "same day" },
    { code: "BTS", label: "Bratislava", note: "base · Apr–May" },
    { code: "IZO", label: "Izola / Koper", note: "base · June" },
    { code: "CPH", label: "Copenhagen", note: "Jun 17 night" },
    { code: "PIT", label: "Pittsburgh", note: "Jun 18" },
  ],
  flights: {
    fare: "Economy · Main Basic",
    bags: "Carry-on + personal item included · no checked bag (+$75/way)",
    out: [
      { fno: "DL 5086", from: "PIT", to: "JFK", dep: "Apr 14 · 11:49", arr: "Apr 14 · 13:26", dur: "1h 37m", eq: "CRJ-900" },
      { fno: "DL 302", from: "JFK", to: "CPH", dep: "Apr 14 · 16:50", arr: "Apr 15 · 06:45", dur: "7h 55m", eq: "Boeing 767-300" },
    ],
    ret: [
      { fno: "DL 303", from: "CPH", to: "JFK", dep: "Jun 18 · 09:00", arr: "Jun 18 · 11:40", dur: "8h 40m", eq: "Boeing 767-300" },
      { fno: "Delta", from: "JFK", to: "PIT", dep: "Jun 18", arr: "Jun 18 · 16:38", dur: "", eq: "" },
    ],
  },
  windows: [
    { label: "Bernina Express seats open", when: "~mid-Oct 2026", dateISO: "2026-10-15" },
    { label: "Vienna Shorts film festival", when: "May 25–30 '27 · 1h from Bratislava", dateISO: "2027-05-25" },
  ],
};

export const PHASES = ["Soon · Sep–Oct '26", "Fall '26", "Early '27", "Final month", "See & do"];

export const DEFAULT_TASKS: { phase: string; title: string; urgent: boolean }[] = [
  { phase: "Soon · Sep–Oct '26", title: "Confirm Delta shows carry-on included on Main Basic", urgent: true },
  { phase: "Soon · Sep–Oct '26", title: "Check remaining FlightGift balance", urgent: false },
  { phase: "Soon · Sep–Oct '26", title: "Check passport: valid 3+ mo past return, issued < 10 yrs ago", urgent: false },
  { phase: "Soon · Sep–Oct '26", title: "Buy packable personal-item bag (40×20×25cm)", urgent: false },
  { phase: "Soon · Sep–Oct '26", title: "Book Bernina Express seats the moment they open (~mid-Oct)", urgent: true },
  { phase: "Fall '26", title: "Book Bratislava Airbnb (mid-Apr–late May, washing machine)", urgent: false },
  { phase: "Fall '26", title: "Book Izola/Koper Airbnb (June, washing machine)", urgent: false },
  { phase: "Fall '26", title: "Book CPH→Vienna flight (or confirm CPH→BTS Thu direct)", urgent: false },
  { phase: "Fall '26", title: "Book Copenhagen room for the night of Jun 17", urgent: false },
  { phase: "Early '27", title: "Verify ETIAS status / apply if required", urgent: false },
  { phase: "Early '27", title: "Buy travel insurance (65 days · medical + interruption)", urgent: false },
  { phase: "Early '27", title: "Sort EU eSIM / phone plan", urgent: false },
  { phase: "Early '27", title: "Book Vienna→Bratislava bus (once flight locked)", urgent: false },
  { phase: "Early '27", title: "Vienna Shorts film fest (May 25–30) — tickets + a Vienna night", urgent: false },
  { phase: "Final month", title: "Notify bank/cards; confirm a no-FX-fee card", urgent: false },
  { phase: "Final month", title: "Pack prescriptions/supplies for 65 days", urgent: false },
  { phase: "Final month", title: "Check in at the 24-hr mark (both directions)", urgent: false },
  { phase: "Final month", title: "Offline maps, save Airbnb addresses, photo passport", urgent: false },
  { phase: "See & do", title: "CopenHill — ski-slope power plant: hike the roof, rooftop bar (CPH)", urgent: false },
];

export const DEFAULT_BOOKINGS: { label: string; detail: string; done: boolean }[] = [
  { label: "Flights — Delta PIT ⇄ CPH", detail: "Booked", done: true },
  { label: "Bernina Express", detail: "Opens ~mid-Oct '26", done: false },
  { label: "Bratislava Airbnb", detail: "Apr–May · book Fall '26", done: false },
  { label: "Izola / Koper Airbnb", detail: "June · book Fall '26", done: false },
  { label: "CPH → Vienna flight", detail: "Book Fall '26", done: false },
  { label: "Copenhagen night (Jun 17)", detail: "Book Fall '26", done: false },
  { label: "Vienna → Bratislava bus", detail: "Early '27", done: false },
  { label: "Travel insurance", detail: "Early '27", done: false },
];

export function daysUntil(iso: string, now: number): number {
  return Math.ceil((new Date(iso).getTime() - now) / 86400000);
}
