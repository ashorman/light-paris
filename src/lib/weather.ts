import type { WeatherData } from "./types";

const PARIS_LAT = 48.8566;
const PARIS_LNG = 2.3522;

async function fetchOpenMeteo(): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${PARIS_LAT}&longitude=${PARIS_LNG}&current=temperature_2m,cloud_cover,precipitation,weather_code&timezone=Europe%2FParis`;

  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);

  const data = await res.json();
  const current = data.current;
  const cloudCoverPct: number = current.cloud_cover ?? 50;
  const tempC: number = current.temperature_2m ?? 15;
  const precipitation: number = current.precipitation ?? 0;
  const weatherCode: number = current.weather_code ?? 0;

  const isRainy = precipitation > 0 || (weatherCode >= 51 && weatherCode <= 99);

  return {
    tempC: Math.round(tempC),
    cloudCoverPct,
    conditionText: describeWeatherCode(weatherCode, cloudCoverPct),
    isRainy,
    source: "open-meteo",
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchMeteoFrance(): Promise<WeatherData> {
  const apiKey = process.env.METEOFRANCE_API_KEY;
  if (!apiKey) throw new Error("No Météo-France API key");

  // AROME France model — hourly for Paris
  const url = `https://public-api.meteofrance.fr/public/DPVigiMeteo/v1/vigilance/bulletins?domain=FRANCE`;
  const res = await fetch(url, {
    headers: { apikey: apiKey },
    next: { revalidate: 600 },
  });

  if (!res.ok) throw new Error(`Météo-France error: ${res.status}`);

  // Météo-France returns vigilance/alert data; use as a supplement
  // For actual temperature/cloud data use Open-Meteo as primary
  throw new Error("Météo-France supplement only — use Open-Meteo for now");
}

export async function getWeather(): Promise<WeatherData> {
  // Try Météo-France first (when configured), fall back to Open-Meteo
  try {
    return await fetchMeteoFrance();
  } catch {
    // Expected — Open-Meteo is primary for cloud/temp data
  }

  try {
    return await fetchOpenMeteo();
  } catch {
    // Last resort fallback
    return {
      tempC: 18,
      cloudCoverPct: 30,
      conditionText: "Weather unavailable",
      isRainy: false,
      source: "fallback",
      fetchedAt: new Date().toISOString(),
    };
  }
}

function describeWeatherCode(code: number, cloudCoverPct: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 95) return "Thunderstorm";
  if (cloudCoverPct < 25) return "Sunny";
  if (cloudCoverPct < 60) return "Partly cloudy";
  return "Cloudy";
}
