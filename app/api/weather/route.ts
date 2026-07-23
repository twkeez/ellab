// Weather endpoint. Source is Open-Meteo (free, no API key). The response
// shape is deliberately provider-agnostic so the data source can be swapped
// later without touching the UI. Also returns sunrise/sunset (which drive the
// time-of-day theme) and the current US air-quality index.

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

// "2026-07-23T20:43" -> "8:43p"
function clockLabel(iso: string): string {
  const h = parseInt(iso.slice(11, 13), 10);
  const m = iso.slice(14, 16);
  const suffix = h < 12 ? "a" : "p";
  const h12 = h % 12 || 12;
  return `${h12}:${m}${suffix}`;
}

function minutesOf(iso: string): number {
  return parseInt(iso.slice(11, 13), 10) * 60 + parseInt(iso.slice(14, 16), 10);
}

function rainLineFrom(currentTime: string, times: string[], probs: number[]): string {
  for (let i = 0; i < times.length; i++) {
    if (times[i] > currentTime && probs[i] >= 50) {
      return `rain likely around ${hourLabel(times[i])}`;
    }
  }
  return "no rain expected today";
}

function aqiLabelFor(aqi: number): string {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "unhealthy for sensitive";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "very unhealthy";
  return "hazardous";
}

export async function GET() {
  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.lat}&longitude=${LOCATION.lon}` +
    `&current=temperature_2m,weather_code&hourly=precipitation_probability&daily=sunrise,sunset` +
    `&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`;

  const airUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LOCATION.lat}` +
    `&longitude=${LOCATION.lon}&current=us_aqi&timezone=auto`;

  try {
    const [wxRes, airRes] = await Promise.all([
      fetch(forecastUrl, { next: { revalidate } }),
      fetch(airUrl, { next: { revalidate } }),
    ]);
    if (!wxRes.ok) throw new Error(`upstream ${wxRes.status}`);
    const data = await wxRes.json();

    const tempF = Math.round(data.current.temperature_2m);
    const label = labelFor(data.current.weather_code);
    const rainLine = rainLineFrom(
      data.current.time,
      data.hourly.time,
      data.hourly.precipitation_probability
    );

    const sunriseIso: string = data.daily.sunrise[0];
    const sunsetIso: string = data.daily.sunset[0];

    let aqi: number | null = null;
    let aqiLabel: string | null = null;
    if (airRes.ok) {
      const air = await airRes.json();
      const v = air?.current?.us_aqi;
      if (typeof v === "number") {
        aqi = Math.round(v);
        aqiLabel = aqiLabelFor(aqi);
      }
    }

    return Response.json({
      city: LOCATION.name,
      tempF,
      label,
      rainLine,
      sunrise: clockLabel(sunriseIso),
      sunset: clockLabel(sunsetIso),
      sunriseMin: minutesOf(sunriseIso),
      sunsetMin: minutesOf(sunsetIso),
      aqi,
      aqiLabel,
    });
  } catch {
    return Response.json({ error: "weather unavailable" }, { status: 502 });
  }
}
