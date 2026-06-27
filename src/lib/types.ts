export type SunStatus = "sunny" | "shaded" | "margin" | "clouds";

export type POIType = "terrace" | "bench";

export interface POI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: POIType;
  openingHours?: string;
  website?: string;
  sunStatus: SunStatus;
  /** ISO timestamp when this spot transitions from sunny to shaded (null if already shaded) */
  sunnyUntil: string | null;
  /** Straight-line distance in metres from query origin */
  distanceM?: number;
}

export interface WeatherData {
  tempC: number;
  cloudCoverPct: number;
  conditionText: string;
  isRainy: boolean;
  source: "meteofrance" | "open-meteo" | "fallback";
  fetchedAt: string;
}

export interface RedditSignal {
  sentiment: "sunny" | "cloudy" | "rainy" | "unknown";
  postCount: number;
  label: string;
  fetchedAt: string;
}

export interface SunPoisResponse {
  pois: POI[];
  weather: WeatherData;
  redditSignal: RedditSignal;
  sunAzimuth: number;
  sunAltitudeDeg: number;
  computedAt: string;
}

export interface OverpassBuilding {
  id: number;
  /** GeoJSON polygon coordinates [lng, lat] */
  geometry: [number, number][];
  heightM: number;
}

export interface OverpassPOI {
  id: number;
  name: string;
  lat: number;
  lng: number;
  type: POIType;
  openingHours?: string;
  website?: string;
}

export type TimeWindow = "now" | "30m" | "1h" | "2h";

export const TIME_WINDOW_OFFSETS: Record<TimeWindow, number> = {
  now: 0,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 120 * 60 * 1000,
};
