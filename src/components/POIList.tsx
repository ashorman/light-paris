"use client";

import { useAppStore, useFilteredPOIs } from "@/store/app";
import type { POI, SunStatus } from "@/lib/types";

const STATUS_CONFIG: Record<SunStatus, { label: string; color: string; dot: string }> = {
  sunny: {
    label: "Sunny",
    color: "text-amber-600",
    dot: "bg-amber-400",
  },
  margin: {
    label: "Possibly sunny",
    color: "text-yellow-600",
    dot: "bg-yellow-300",
  },
  clouds: {
    label: "Depends on clouds",
    color: "text-slate-500",
    dot: "bg-slate-300",
  },
  shaded: {
    label: "Shaded",
    color: "text-slate-400",
    dot: "bg-slate-300",
  },
};

function formatDistance(m?: number): string {
  if (!m) return "";
  if (m < 100) return `${Math.round(m)}m`;
  if (m < 1000) return `${Math.round(m / 10) * 10}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function formatSunnyUntil(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.round((d.getTime() - now.getTime()) / 60000);
  if (diffMin <= 0) return null;
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `until ${hh}:${mm}`;
}

function POIItem({ poi }: { poi: POI }) {
  const setSelectedPOI = useAppStore((s) => s.setSelectedPOI);
  const config = STATUS_CONFIG[poi.sunStatus];
  const sunnyUntil = formatSunnyUntil(poi.sunnyUntil);

  return (
    <button
      onClick={() => setSelectedPOI(poi)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 active:bg-zinc-100 transition-colors text-left"
    >
      <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-base">
        {poi.type === "bench" ? "🪑" : "☕"}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-zinc-900 truncate">
            {poi.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
          <span className={`text-xs ${config.color}`}>{config.label}</span>
          {sunnyUntil && (
            <span className="text-xs text-zinc-400">{sunnyUntil}</span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {poi.distanceM !== undefined && (
          <span className="text-xs text-zinc-400">
            {formatDistance(poi.distanceM)}
          </span>
        )}
        <span className="block text-zinc-300 text-xs mt-0.5">›</span>
      </div>
    </button>
  );
}

export default function POIList() {
  const isLoading = useAppStore((s) => s.isLoading);
  const error = useAppStore((s) => s.error);
  const sunData = useAppStore((s) => s.sunData);
  const pois = useFilteredPOIs();

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-zinc-100 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-zinc-100 rounded animate-pulse w-3/4" />
              <div className="h-2.5 bg-zinc-100 rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <span className="text-2xl mb-2">⚠️</span>
        <p className="text-sm text-zinc-600">Could not load spots</p>
        <p className="text-xs text-zinc-400 mt-1">{error}</p>
      </div>
    );
  }

  if (!sunData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <span className="text-2xl mb-2">📍</span>
        <p className="text-sm text-zinc-600">Tap the location button to find sunny spots near you</p>
      </div>
    );
  }

  if (pois.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <span className="text-2xl mb-2">🌥️</span>
        <p className="text-sm text-zinc-600">No spots match your filters</p>
        <p className="text-xs text-zinc-400 mt-1">Try removing some filters or a different time</p>
      </div>
    );
  }

  const sunnyCnt = pois.filter((p) => p.sunStatus === "sunny").length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-100">
        <p className="text-xs text-zinc-500">
          {sunnyCnt > 0
            ? `${sunnyCnt} sunny spot${sunnyCnt !== 1 ? "s" : ""} nearby`
            : `${pois.length} spot${pois.length !== 1 ? "s" : ""} nearby`}
        </p>
      </div>
      <div className="divide-y divide-zinc-50">
        {pois.map((poi) => (
          <POIItem key={poi.id} poi={poi} />
        ))}
      </div>
    </div>
  );
}
