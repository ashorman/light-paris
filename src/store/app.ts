import { create } from "zustand";
import type { POI, SunPoisResponse, TimeWindow, WeatherData, RedditSignal } from "@/lib/types";
import { TIME_WINDOW_OFFSETS } from "@/lib/types";

export type SunFilter = "sunny" | "shaded" | null;

interface AppState {
  // Location
  userLat: number;
  userLng: number;
  locationGranted: boolean;
  locationError: string | null;

  // Time
  selectedWindow: TimeWindow;

  // Filters
  showTerrace: boolean;
  showBench: boolean;
  sunFilter: SunFilter;
  openNow: boolean;

  // Data
  sunData: SunPoisResponse | null;
  lastFetchedAt: number | null; // epoch ms
  isLoading: boolean;
  error: string | null;

  // Selected POI for bottom sheet
  selectedPOI: POI | null;

  // Actions
  setLocation: (lat: number, lng: number) => void;
  setMapCenter: (lat: number, lng: number) => void;
  setLocationError: (err: string) => void;
  setTimeWindow: (window: TimeWindow) => void;
  toggleTerrace: () => void;
  toggleBench: () => void;
  setSunFilter: (v: SunFilter) => void;
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
  showTerrace: true,
  showBench: true,
  sunFilter: null,
  openNow: false,
  sunData: null,
  lastFetchedAt: null,
  isLoading: false,
  error: null,
  selectedPOI: null,

  setLocation: (lat, lng) => {
    set({ userLat: lat, userLng: lng, locationGranted: true, locationError: null });
    get().fetchSunData();
  },

  // Called by map moveend — updates query centre without triggering easeTo or locationGranted
  setMapCenter: (lat, lng) => {
    set({ userLat: lat, userLng: lng });
    get().fetchSunData();
  },

  setLocationError: (err) => set({ locationError: err }),

  setTimeWindow: (window) => {
    set({ selectedWindow: window });
    get().fetchSunData();
  },

  toggleTerrace: () => set((s) => ({ showTerrace: !s.showTerrace })),
  toggleBench: () => set((s) => ({ showBench: !s.showBench })),
  setSunFilter: (v) => set({ sunFilter: v }),
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
      set({ sunData: data, lastFetchedAt: Date.now(), isLoading: false });
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
  const { sunData, showTerrace, showBench, sunFilter, openNow } = useAppStore();

  if (!sunData) return [];

  return sunData.pois.filter((poi) => {
    if (poi.type === "terrace" && !showTerrace) return false;
    if (poi.type === "bench" && !showBench) return false;
    if (sunFilter === "sunny" && poi.sunStatus !== "sunny" && poi.sunStatus !== "margin") return false;
    if (sunFilter === "shaded" && poi.sunStatus !== "shaded") return false;
    if (openNow && poi.type === "terrace" && poi.openingHours?.toLowerCase().includes("closed")) return false;
    return true;
  });
}

export function useWeather(): WeatherData | null {
  return useAppStore((s) => s.sunData?.weather ?? null);
}

export function useRedditSignal(): RedditSignal | null {
  return useAppStore((s) => s.sunData?.redditSignal ?? null);
}
