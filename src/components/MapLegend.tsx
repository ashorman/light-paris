"use client";

import { useAppStore } from "@/store/app";
import type { SunFilter } from "@/store/app";

export default function MapLegend() {
  const showTerrace = useAppStore((s) => s.showTerrace);
  const showBench   = useAppStore((s) => s.showBench);
  const sunFilter   = useAppStore((s) => s.sunFilter);
  const toggleTerrace = useAppStore((s) => s.toggleTerrace);
  const toggleBench   = useAppStore((s) => s.toggleBench);
  const setSunFilter  = useAppStore((s) => s.setSunFilter);

  const handleSunFilter = (v: SunFilter) =>
    setSunFilter(sunFilter === v ? null : v);

  const chipBase =
    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer select-none transition-all duration-150 active:scale-95";

  return (
    <div className="absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-xl px-2 py-1.5 shadow-sm flex gap-1.5 flex-wrap max-w-[calc(100%-56px)]">
      {/* Type filters */}
      <button
        onClick={toggleTerrace}
        className={`${chipBase} ${
          showTerrace
            ? "bg-zinc-900 text-white"
            : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
        }`}
      >
        ☕ Terrace
      </button>

      <button
        onClick={toggleBench}
        className={`${chipBase} ${
          showBench
            ? "bg-zinc-900 text-white"
            : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
        }`}
      >
        🪑 Bench
      </button>

      <div className="w-px bg-zinc-200 self-stretch" />

      {/* Sun filter — mutually exclusive */}
      <button
        onClick={() => handleSunFilter("sunny")}
        className={`${chipBase} ${
          sunFilter === "sunny"
            ? "bg-amber-400 text-white"
            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block ring-1 ring-amber-500" />
        Sunny
      </button>

      <button
        onClick={() => handleSunFilter("shaded")}
        className={`${chipBase} ${
          sunFilter === "shaded"
            ? "bg-slate-500 text-white"
            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-slate-400 inline-block ring-1 ring-slate-500" />
        Shaded
      </button>
    </div>
  );
}
