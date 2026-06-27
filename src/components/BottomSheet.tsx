"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/app";
import type { POI, SunStatus } from "@/lib/types";

const STATUS_LABELS: Record<SunStatus, { text: string; bg: string; text_color: string }> = {
  sunny: { text: "Sunny now", bg: "bg-amber-100", text_color: "text-amber-700" },
  margin: { text: "Possibly sunny", bg: "bg-yellow-100", text_color: "text-yellow-700" },
  clouds: { text: "Depends on clouds", bg: "bg-slate-100", text_color: "text-slate-600" },
  shaded: { text: "Currently shaded", bg: "bg-slate-100", text_color: "text-slate-500" },
};

function formatSunnyUntil(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.round((d.getTime() - now.getTime()) / 60000);
  if (diffMin <= 0) return null;
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  if (diffMin < 60) return `${diffMin} min (until ${hh}:${mm})`;
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return `${hrs}h${mins > 0 ? ` ${mins}m` : ""} (until ${hh}:${mm})`;
}

function mapsDeepLink(poi: POI): string {
  const label = encodeURIComponent(poi.name);
  return `https://maps.apple.com/?q=${label}&ll=${poi.lat},${poi.lng}`;
}

function googleMapsLink(poi: POI): string {
  return `https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}`;
}

function shareLink(poi: POI): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.searchParams.set("lat", String(poi.lat));
  url.searchParams.set("lng", String(poi.lng));
  return url.toString();
}

export default function BottomSheet() {
  const selectedPOI = useAppStore((s) => s.selectedPOI);
  const setSelectedPOI = useAppStore((s) => s.setSelectedPOI);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedPOI(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSelectedPOI]);

  if (!selectedPOI) return null;

  const poi = selectedPOI;
  const statusCfg = STATUS_LABELS[poi.sunStatus];
  const sunnyUntil = formatSunnyUntil(poi.sunnyUntil);
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  const handleShare = async () => {
    const url = shareLink(poi);
    if (canShare) {
      try {
        await navigator.share({ title: poi.name, url });
      } catch {
        // cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={() => setSelectedPOI(null)}
        className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]"
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-zinc-300" />
        </div>

        <div className="px-5 pb-8">
          {/* Header */}
          <div className="flex items-start justify-between mt-2 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">
                {poi.type === "bench" ? "🪑" : "☕"}
              </span>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 leading-tight">
                  {poi.name}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5 capitalize">{poi.type}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedPOI(null)}
              className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 transition-colors shrink-0"
            >
              ✕
            </button>
          </div>

          {/* Sun status pill */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${statusCfg.bg} mb-4`}>
            <span className="text-sm">
              {poi.sunStatus === "sunny" ? "☀️" : poi.sunStatus === "margin" ? "🌤️" : "🌥️"}
            </span>
            <span className={`text-sm font-medium ${statusCfg.text_color}`}>
              {statusCfg.text}
            </span>
          </div>

          {/* Details */}
          <div className="space-y-2.5 mb-5">
            {sunnyUntil && (
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <span className="text-base">⏱</span>
                <span>Sun stays for <strong>{sunnyUntil}</strong></span>
              </div>
            )}
            {poi.openingHours && (
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <span className="text-base">🕐</span>
                <span>{poi.openingHours}</span>
              </div>
            )}
            {poi.website && (
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <span className="text-base">🔗</span>
                <a
                  href={poi.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline truncate"
                >
                  {poi.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
            {poi.sunStatus === "margin" && (
              <div className="text-xs text-zinc-400 bg-zinc-50 rounded-lg px-3 py-2">
                This spot is near a shadow edge — confidence is ~60%.
                Building height estimates may shift the shadow boundary by a few metres.
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <a
              href={mapsDeepLink(poi)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 active:scale-[0.98] transition-all"
            >
              <span>📍</span> Directions
            </a>
            <a
              href={googleMapsLink(poi)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-zinc-100 text-zinc-700 text-sm font-medium hover:bg-zinc-200 active:scale-[0.98] transition-all"
            >
              <span>🗺</span> Google Maps
            </a>
            <button
              onClick={handleShare}
              className="w-12 flex items-center justify-center py-3 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 active:scale-[0.98] transition-all"
            >
              📤
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
