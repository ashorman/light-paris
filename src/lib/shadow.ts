import SunCalc from "suncalc";
import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import type { OverpassBuilding, OverpassPOI, POI, SunStatus } from "./types";

/** Metres within a shadow edge where we classify as "margin" (uncertain due to height estimation error) */
const MARGIN_M = 4;

/** Max shadow length to bother computing (handles very low sun angles gracefully) */
const MAX_SHADOW_M = 500;

export interface SunPosition {
  azimuth: number; // radians, north = 0, clockwise
  altitude: number; // radians, negative = below horizon
  altitudeDeg: number;
  azimuthDeg: number;
}

export function getSunPosition(lat: number, lng: number, date: Date): SunPosition {
  const pos = SunCalc.getPosition(date, lat, lng);
  // SunCalc azimuth: south = 0, west = positive. Convert to north-clockwise.
  const azimuthNorthCW = pos.azimuth + Math.PI;
  return {
    azimuth: azimuthNorthCW,
    altitude: pos.altitude,
    altitudeDeg: (pos.altitude * 180) / Math.PI,
    azimuthDeg: (azimuthNorthCW * 180) / Math.PI,
  };
}

/**
 * Compute shadow polygon for a building at a given sun position.
 * Returns null if sun is below horizon or shadow would be trivially small.
 */
function buildingShadowPolygon(
  building: OverpassBuilding,
  sun: SunPosition
): Feature<Polygon> | null {
  if (sun.altitude <= 0.05) return null; // sun below ~3° — skip

  const shadowLen = Math.min(
    building.heightM / Math.tan(sun.altitude),
    MAX_SHADOW_M
  );
  if (shadowLen < 1) return null;

  // Shadow direction: opposite of sun azimuth (where shadow falls)
  const shadowAzimuth = sun.azimuth + Math.PI;

  // Convert shadow vector to lng/lat delta
  // Approximate: 1 degree lat ≈ 111,111m, 1 degree lng ≈ 111,111m × cos(lat)
  const avgLat = building.geometry.reduce((sum, p) => sum + p[1], 0) / building.geometry.length;
  const latM = 111111;
  const lngM = 111111 * Math.cos((avgLat * Math.PI) / 180);

  const dLat = (Math.cos(shadowAzimuth) * shadowLen) / latM;
  const dLng = (Math.sin(shadowAzimuth) * shadowLen) / lngM;

  // Create shadow polygon: original footprint + projected vertices
  const originalCoords = [...building.geometry];
  const projectedCoords = building.geometry.map(([lng, lat]) => [
    lng + dLng,
    lat + dLat,
  ] as [number, number]);

  // Hull of all coords forms the shadow area
  const allCoords = [...originalCoords, ...projectedCoords];
  const points = turf.featureCollection(
    allCoords.map((c) => turf.point(c))
  );

  try {
    const hull = turf.convex(points);
    if (!hull) return null;
    return hull as Feature<Polygon>;
  } catch {
    return null;
  }
}

/**
 * Classify a set of POIs against building shadows at a given time.
 * Returns classified POI array.
 */
export function classifyPOIs(
  pois: OverpassPOI[],
  buildings: OverpassBuilding[],
  date: Date,
  originLat: number,
  originLng: number,
  weatherCloudCoverPct: number
): POI[] {
  // Pre-compute sun position
  const sun = getSunPosition(48.8566, 2.3522, date);

  // Sun below horizon — everything is shaded (night / twilight)
  if (sun.altitude <= 0) {
    return pois.map((poi) => ({
      id: String(poi.id),
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      type: poi.type,
      openingHours: poi.openingHours,
      website: poi.website,
      sunStatus: "shaded" as SunStatus,
      sunnyUntil: null,
      distanceM: haversineM(originLat, originLng, poi.lat, poi.lng),
    }));
  }

  // Heavily overcast — geometric shadows are irrelevant
  if (weatherCloudCoverPct >= 80) {
    return pois.map((poi) => ({
      id: String(poi.id),
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      type: poi.type,
      openingHours: poi.openingHours,
      website: poi.website,
      sunStatus: "clouds" as SunStatus,
      sunnyUntil: null,
      distanceM: haversineM(originLat, originLng, poi.lat, poi.lng),
    }));
  }

  // Pre-compute shadow polygons for all buildings
  const shadowPolygons: Feature<Polygon>[] = [];
  for (const building of buildings) {
    const shadow = buildingShadowPolygon(building, sun);
    if (shadow) shadowPolygons.push(shadow);
  }

  return pois.map((poi) => {
    const point = turf.point([poi.lng, poi.lat]);
    const distanceM = haversineM(originLat, originLng, poi.lat, poi.lng);

    let inShadow = false;
    let minEdgeDistanceM = Infinity;

    for (const shadow of shadowPolygons) {
      if (turf.booleanPointInPolygon(point, shadow)) {
        inShadow = true;
        // Approximate distance to shadow edge
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const edgeDist = turf.pointToLineDistance(point, turf.polygonToLine(shadow) as any, { units: "meters" });
          minEdgeDistanceM = Math.min(minEdgeDistanceM, edgeDist);
        } catch {
          minEdgeDistanceM = 0;
        }
        break;
      } else {
        // Check how close to the shadow edge
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const edgeDist = turf.pointToLineDistance(point, turf.polygonToLine(shadow) as any, { units: "meters" });
          minEdgeDistanceM = Math.min(minEdgeDistanceM, edgeDist);
        } catch {
          // skip
        }
      }
    }

    let sunStatus: SunStatus;
    if (inShadow) {
      sunStatus = minEdgeDistanceM < MARGIN_M ? "margin" : "shaded";
    } else if (minEdgeDistanceM < MARGIN_M) {
      sunStatus = "margin";
    } else {
      sunStatus = weatherCloudCoverPct >= 60 ? "margin" : "sunny";
    }

    const sunnyUntil =
      sunStatus === "sunny" || sunStatus === "margin"
        ? computeSunnyUntil(poi, buildings, sun, date)
        : null;

    return {
      id: String(poi.id),
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      type: poi.type,
      openingHours: poi.openingHours,
      website: poi.website,
      sunStatus,
      sunnyUntil,
      distanceM,
    };
  });
}

/**
 * Find when a currently-sunny POI will next become shaded.
 * Checks in 15-minute increments up to 4 hours ahead.
 */
function computeSunnyUntil(
  poi: OverpassPOI,
  buildings: OverpassBuilding[],
  _currentSun: SunPosition,
  currentDate: Date
): string | null {
  const point = turf.point([poi.lng, poi.lat]);
  const stepMs = 15 * 60 * 1000;
  const maxSteps = 16; // 4 hours

  for (let step = 1; step <= maxSteps; step++) {
    const futureDate = new Date(currentDate.getTime() + step * stepMs);
    const futureSun = getSunPosition(48.8566, 2.3522, futureDate);

    // Sun sets
    if (futureSun.altitude <= 0) {
      // Only return sunset time if it's more than 15 min away (avoid noise)
      const minsAway = (futureDate.getTime() - currentDate.getTime()) / 60000;
      return minsAway >= 15 ? futureDate.toISOString() : null;
    }

    for (const building of buildings) {
      const shadow = buildingShadowPolygon(building, futureSun);
      if (!shadow) continue;
      if (turf.booleanPointInPolygon(point, shadow)) {
        return futureDate.toISOString();
      }
    }
  }

  return null; // Still sunny after 4h
}

export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
