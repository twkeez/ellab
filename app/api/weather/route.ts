// Weather endpoint. Source is Open-Meteo (free, no API key). The response
// shape is deliberately provider-agnostic — { tempF, label, rainLine } — so
// the data source can be swapped later without touching the UI.

export const revalidate = 900; // refresh the upstream data at most every 15 min

// Pittsburgh. Later this becomes a per-user setting.
const LOCATION = { name: "Pittsburgh", lat: 40.4406, lon: -79.9959 };

function labelFor(code: number): string {
  if (code === 0) return "clear";
  if (code === 1) return "mostly clear";
  if (code === 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "foggy";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rainy";
  if (code >= 71 && code <= 77) return "snowy";
  if (code >= 80 && code <= 82) return "rain showers";
  if (code >= 85 && code <= 86) return "snow showers";
  if (code >= 95) return "thunderstorms";
  return "clear";
}

function hourLabel(iso: string): string {
  const h = parseInt(iso.slice(11, 13), 10);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return `${h12} ${suffix}`;
}

function rainLineFrom(currentTime: string, times: string[], probs: number[]): string {
  for (let i = 0; i < times.length; i++) {
    if (times[i] > currentTime && probs[i] >= 50) {
      return `rain likely around ${hourLabel(times[i])}`;
    }
  }
  return "no rain expected today";
}

export async function GET() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.lat}&longitude=${LOCATION.lon}` +
    `&current=temperature_2m,weather_code&hourly=precipitation_probability` +
    `&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`;

  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();

    const tempF = Math.round(data.current.temperature_2m);
    const label = labelFor(data.current.weather_code);
    const rainLine = rainLineFrom(
      data.current.time,
      data.hourly.time,
      data.hourly.precipitation_probability
    );

    return Response.json({ city: LOCATION.name, tempF, label, rainLine });
  } catch {
    return Response.json({ error: "weather unavailable" }, { status: 502 });
  }
}
