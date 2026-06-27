import { NextRequest, NextResponse } from "next/server";
import { fetchBuildingsNear, fetchParisPOIs } from "@/lib/overpass";
import { classifyPOIs, getSunPosition, haversineM } from "@/lib/shadow";
import { getWeather } from "@/lib/weather";
import { cacheGet, cacheSet } from "@/lib/redis";
import type { SunPoisResponse, RedditSignal } from "@/lib/types";

// Snap timestamps to hour slots for cache efficiency
function toHourSlot(date: Date): string {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

// Round lat/lng to ~1km grid for cache key
function gridKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const t = searchParams.get("t");
  const lat = parseFloat(searchParams.get("lat") ?? "48.8566");
  const lng = parseFloat(searchParams.get("lng") ?? "2.3522");
  const radius = Math.min(parseInt(searchParams.get("radius") ?? "500"), 1000);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "Invalid lat/lng" }, { status: 400 });
  }

  const date = t ? new Date(t) : new Date();
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
  }

  const hourSlot = toHourSlot(date);
  const cacheKey = `sun_pois:${gridKey(lat, lng)}:${hourSlot}`;

  // Check cache first
  const cached = await cacheGet<SunPoisResponse>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT", "Cache-Control": "public, max-age=300" },
    });
  }

  try {
    // POIs and weather always resolve (seed / fallback guaranteed).
    // Buildings resolve in ≤5s — empty array on failure (shadow skipped, spots still shown).
    const [buildings, allPOIs, weather] = await Promise.all([
      fetchBuildingsNear(lat, lng, radius),
      fetchParisPOIs(),
      getWeather(),
    ]);

    // Filter POIs to within radius
    const nearbyPOIs = allPOIs.filter(
      (poi) => haversineM(lat, lng, poi.lat, poi.lng) <= radius
    );

    // Get reddit signal from cache (updated by cron)
    const redditSignal =
      (await cacheGet<RedditSignal>("reddit_signal")) ??
      defaultRedditSignal();

    // Compute sun position
    const sun = getSunPosition(lat, lng, date);

    // Classify POIs
    const classifiedPOIs = classifyPOIs(
      nearbyPOIs,
      buildings,
      date,
      lat,
      lng,
      weather.cloudCoverPct
    );

    // Sort by: sunny first, then by distance
    classifiedPOIs.sort((a, b) => {
      const statusOrder = { sunny: 0, margin: 1, clouds: 2, shaded: 3 };
      const statusDiff =
        (statusOrder[a.sunStatus] ?? 3) - (statusOrder[b.sunStatus] ?? 3);
      if (statusDiff !== 0) return statusDiff;
      return (a.distanceM ?? 0) - (b.distanceM ?? 0);
    });

    const response: SunPoisResponse = {
      pois: classifiedPOIs.slice(0, 40),
      weather,
      redditSignal,
      sunAzimuth: sun.azimuthDeg,
      sunAltitudeDeg: sun.altitudeDeg,
      computedAt: new Date().toISOString(),
    };

    // Cache for 1 hour (data is snapped to hour slot)
    await cacheSet(cacheKey, response, 3600);

    return NextResponse.json(response, {
      headers: { "X-Cache": "MISS", "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    console.error("[sun-pois]", err);
    return NextResponse.json(
      { error: "Failed to compute sun status" },
      { status: 500 }
    );
  }
}

function defaultRedditSignal(): RedditSignal {
  return {
    sentiment: "unknown",
    postCount: 0,
    label: "No local signal yet",
    fetchedAt: new Date().toISOString(),
  };
}
