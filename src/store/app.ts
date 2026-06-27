import { create } from "zustand";
import type { POI, SunPoisResponse, TimeWindow, WeatherData, RedditSignal } from "@/lib/types";
import { TIME_WINDOW_OFFSETS } from "@/lib/types";

export type FilterType = "all" | "terrace" | "bench";

interface AppState {
  // Location
  userLat: number;
  userLng: number;
  locationGranted: boolean;
  locationError: string | null;

  // Time
  selectedWindow: TimeWindow;

  // Filters
  filterType: FilterType;
  sunnyOnly: boolean;
  openNow: boolean;

  // Data
  sunData: SunPoisResponse | null;
  isLoading: boolean;
  error: string | null;

  // Selected POI for bottom sheet
  selectedPOI: POI | null;

  // Actions
  setLocation: (lat: number, lng: number) => void;
  setLocationError: (err: string) => void;
  setTimeWindow: (window: TimeWindow) => void;
  setFilterType: (type: FilterType) => void;
  setSunnyOnly: (v: boolean) => void;
  setOpenNow: (v: boolean) => void;
  setSelectedPOI: (poi: POI | null) => void;
  fetchSunData: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  userLat: 48.8566,
  userLng: 2.3522,
  locationGranted: false,
  locationError: null,
  selectedWindow: "now",
  filterType: "all",
  sunnyOnly: false,
  openNow: false,
  sunData: null,
  isLoading: false,
  error: null,
  selectedPOI: null,

  setLocation: (lat, lng) => {
    set({ userLat: lat, userLng: lng, locationGranted: true, locationError: null });
    get().fetchSunData();
  },

  setLocationError: (err) => set({ locationError: err }),

  setTimeWindow: (window) => {
    set({ selectedWindow: window });
    get().fetchSunData();
  },

  setFilterType: (type) => set({ filterType: type }),
  setSunnyOnly: (v) => set({ sunnyOnly: v }),
  setOpenNow: (v) => set({ openNow: v }),
  setSelectedPOI: (poi) => set({ selectedPOI: poi }),

  fetchSunData: async () => {
    const { userLat, userLng, selectedWindow } = get();
    set({ isLoading: true, error: null });

    try {
      const offsetMs = TIME_WINDOW_OFFSETS[selectedWindow];
      const targetDate = new Date(Date.now() + offsetMs);
      const params = new URLSearchParams({
        lat: String(userLat),
        lng: String(userLng),
        t: targetDate.toISOString(),
        radius: "500",
      });

      const res = await fetch(`/api/sun-pois?${params}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: SunPoisResponse = await res.json();
      set({ sunData: data, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load data",
        isLoading: false,
      });
    }
  },
}));

/** Derived: filtered + sorted POI list */
export function useFilteredPOIs(): POI[] {
  const { sunData, filterType, sunnyOnly, openNow } = useAppStore();

  if (!sunData) return [];

  return sunData.pois.filter((poi) => {
    if (filterType !== "all" && poi.type !== filterType) return false;
    if (sunnyOnly && poi.sunStatus !== "sunny" && poi.sunStatus !== "margin") return false;
    if (openNow && poi.type === "terrace" && poi.openingHours) {
      // Basic open check — if we can't parse, include it
      if (poi.openingHours.toLowerCase().includes("closed")) return false;
    }
    return true;
  });
}

export function useWeather(): WeatherData | null {
  return useAppStore((s) => s.sunData?.weather ?? null);
}

export function useRedditSignal(): RedditSignal | null {
  return useAppStore((s) => s.sunData?.redditSignal ?? null);
}
