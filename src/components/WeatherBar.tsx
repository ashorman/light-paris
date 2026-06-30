"use client";

import { useWeather, useRedditSignal, useAppStore } from "@/store/app";

function formatAgo(epochMs: number): string {
  const diffMin = Math.round((Date.now() - epochMs) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return `${hrs}h${mins > 0 ? ` ${mins}m` : ""} ago`;
}

const SENTIMENT_ICONS: Record<string, string> = {
  sunny: "☀️",
  cloudy: "☁️",
  rainy: "🌧️",
  unknown: "💬",
};

export default function WeatherBar() {
  const weather = useWeather();
  const reddit = useRedditSignal();
  const lastFetchedAt = useAppStore((s) => s.lastFetchedAt);

  if (!weather) {
    return (
      <div className="h-10 bg-white/90 backdrop-blur-sm flex items-center px-4 gap-3 border-b border-zinc-200">
        <div className="h-3 w-24 bg-zinc-200 rounded animate-pulse" />
        <div className="h-3 w-16 bg-zinc-200 rounded animate-pulse" />
      </div>
    );
  }

  const cloudIcon =
    weather.isRainy
      ? "🌧️"
      : weather.cloudCoverPct < 20
      ? "☀️"
      : weather.cloudCoverPct < 60
      ? "⛅"
      : "☁️";

  return (
    <div className="h-10 bg-white/90 backdrop-blur-sm flex items-center px-4 gap-3 border-b border-zinc-100 shrink-0">
      <span className="text-sm font-semibold text-zinc-800">
        {cloudIcon} {weather.tempC}°C
      </span>
      <span className="text-xs text-zinc-500">
        {weather.conditionText}
      </span>
      <span className="text-xs text-zinc-400">·</span>
      <span className="text-xs text-zinc-500">
        {weather.cloudCoverPct}% cloud
      </span>
      {reddit && reddit.sentiment !== "unknown" && (
        <>
          <span className="text-xs text-zinc-300 hidden sm:block">·</span>
          <span className="text-xs text-zinc-500 hidden sm:flex items-center gap-1">
            {SENTIMENT_ICONS[reddit.sentiment]}
            <span>{reddit.label}</span>
          </span>
        </>
      )}
      {lastFetchedAt && (
        <>
          <span className="text-xs text-zinc-300 ml-auto">·</span>
          <span className="text-xs text-zinc-400 ml-1">
            Updated {formatAgo(lastFetchedAt)}
          </span>
        </>
      )}
    </div>
  );
}
