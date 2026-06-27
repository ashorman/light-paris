import { NextResponse } from "next/server";
import { getWeather } from "@/lib/weather";
import { cacheGet, cacheSet } from "@/lib/redis";
import type { WeatherData } from "@/lib/types";

export async function GET() {
  const cacheKey = "weather:paris";
  const cached = await cacheGet<WeatherData>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT" },
    });
  }

  const weather = await getWeather();
  await cacheSet(cacheKey, weather, 600); // 10 min TTL

  return NextResponse.json(weather, { headers: { "X-Cache": "MISS" } });
}
