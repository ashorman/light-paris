import type { OverpassBuilding, OverpassPOI } from "./types";
import { cacheGet, cacheSet } from "./redis";
import seedPOIs from "../data/paris-pois-seed.json";

const PARIS_BBOX = "48.815,2.224,48.902,2.470";

const OVERPASS_MIRRORS = [
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

// In-memory fallback cache — avoids hammering Overpass during dev when Redis is not configured
const memCache = new Map<string, { value: unknown; expiresAt: number }>();

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.value as T;
}

function memSet(key: string, value: unknown, ttlSeconds: number) {
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function cachedGet<T>(key: string): Promise<T | null> {
  return (await cacheGet<T>(key)) ?? memGet<T>(key);
}

async function cachedSet(key: string, value: unknown, ttlSeconds: number) {
  memSet(key, value, ttlSeconds);
  await cacheSet(key, value, ttlSeconds);
}

async function overpassQuery(
  query: string,
  timeoutMs = 8000
): Promise<unknown> {
  let lastError: Error | null = null;

  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "LightParis/1.0 (https://lightparis.app)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 429 || res.status === 503 || res.status === 406) {
        lastError = new Error(`Overpass ${url} returned ${res.status}`);
        continue;
      }

      if (!res.ok) {
        lastError = new Error(`Overpass ${url} returned ${res.status}`);
        continue;
      }

      return res.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  throw lastError ?? new Error("All Overpass mirrors failed");
}

/**
 * Fetch buildings within a radius around a point.
 * Fast 5s timeout — returns empty array on any failure so POI list still loads.
 */
export async function fetchBuildingsNear(
  lat: number,
  lng: number,
  radiusM: number = 300
): Promise<OverpassBuilding[]> {
  const cacheKey = `buildings:${lat.toFixed(3)},${lng.toFixed(3)}:${radiusM}`;
  const cached = await cachedGet<OverpassBuilding[]>(cacheKey);
  if (cached) return cached;

  const query = `
[out:json][timeout:15];
(
  way["building"](around:${radiusM},${lat},${lng});
);
out body geom;
`.trim();

  let buildings: OverpassBuilding[];
  try {
    const data = await overpassQuery(query, 5000) as { elements: OverpassElement[] };
    buildings = parseBuildings(data.elements);
    await cachedSet(cacheKey, buildings, 86400);
  } catch {
    // Rate-limited or unavailable — shadow classification skipped this request
    buildings = [];
  }

  return buildings;
}

/**
 * Fetch all outdoor-seating POIs in Paris intra-muros.
 *
 * Returns seed data immediately (zero network latency).
 * Triggers a background Overpass refresh that updates the cache for the next request.
 */
export async function fetchParisPOIs(): Promise<OverpassPOI[]> {
  const cacheKey = "pois:paris:v1";

  // Return cached data instantly (memory or Redis)
  const cached = await cachedGet<OverpassPOI[]>(cacheKey);
  if (cached) return cached;

  // Seed data is always available — serve it immediately
  const seed = seedPOIs as OverpassPOI[];
  // Cache seed so subsequent calls within this process don't repeat this path
  memSet(cacheKey, seed, 1800);

  // Refresh from Overpass in the background — doesn't block this response
  refreshPOIsBackground(cacheKey).catch(() => {/* silent */});

  return seed;
}

/** Fire-and-forget: fetch fresh POIs from Overpass and update the cache */
async function refreshPOIsBackground(cacheKey: string): Promise<void> {
  const query = `
[out:json][timeout:45];
(
  node["amenity"~"cafe|restaurant"]["outdoor_seating"="yes"](${PARIS_BBOX});
  way["amenity"~"cafe|restaurant"]["outdoor_seating"="yes"](${PARIS_BBOX});
  node["amenity"="bench"](${PARIS_BBOX});
);
out center;
`.trim();

  try {
    const data = await overpassQuery(query, 50000) as { elements: OverpassElement[] };
    const pois = parsePOIs(data.elements);
    if (pois.length > 0) {
      await cachedSet(cacheKey, pois, 86400);
      console.log(`[overpass] Refreshed ${pois.length} POIs from Overpass`);
    }
  } catch (err) {
    console.warn("[overpass] Background POI refresh failed:", (err as Error).message);
  }
}

function parseBuildings(elements: OverpassElement[]): OverpassBuilding[] {
  const buildings: OverpassBuilding[] = [];

  for (const el of elements) {
    if (el.type !== "way" || !el.geometry || el.geometry.length < 3) continue;

    const tags = el.tags ?? {};
    const heightM = estimateHeight(tags);
    if (heightM < 3) continue; // skip very low structures

    const geometry = el.geometry.map(
      (pt: { lat: number; lon: number }) => [pt.lon, pt.lat] as [number, number]
    );

    buildings.push({ id: el.id, geometry, heightM });
  }

  return buildings;
}

function estimateHeight(tags: Record<string, string>): number {
  if (tags["height"]) {
    const h = parseFloat(tags["height"]);
    if (!isNaN(h)) return h;
  }
  if (tags["building:height"]) {
    const h = parseFloat(tags["building:height"]);
    if (!isNaN(h)) return h;
  }
  if (tags["building:levels"]) {
    const lvl = parseFloat(tags["building:levels"]);
    if (!isNaN(lvl)) return lvl * 3.2;
  }
  // Default Haussmann Paris building: 5 levels
  return 16;
}

function parsePOIs(elements: OverpassElement[]): OverpassPOI[] {
  const pois: OverpassPOI[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon) continue;

    const amenity = tags["amenity"] ?? "";
    const type =
      amenity === "bench"
        ? "bench"
        : ("terrace" as "bench" | "terrace");

    const name =
      tags["name"] ??
      (type === "bench" ? "Public bench" : "Outdoor terrace");

    pois.push({
      id: el.id,
      name,
      lat,
      lng: lon,
      type,
      openingHours: tags["opening_hours"],
      website: tags["website"] ?? tags["contact:website"],
    });
  }

  return pois;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}
