"use client";

import { useAppStore } from "@/store/app";
import type { SunFilter } from "@/store/app";

export default function FilterChips() {
  const showTerrace = useAppStore((s) => s.showTerrace);
  const showBench = useAppStore((s) => s.showBench);
  const sunFilter = useAppStore((s) => s.sunFilter);
  const openNow = useAppStore((s) => s.openNow);
  const toggleTerrace = useAppStore((s) => s.toggleTerrace);
  const toggleBench = useAppStore((s) => s.toggleBench);
  const setSunFilter = useAppStore((s) => s.setSunFilter);
  const setOpenNow = useAppStore((s) => s.setOpenNow);

  const handleSunFilter = (v: SunFilter) =>
    setSunFilter(sunFilter === v ? null : v);

  return (
    <div className="flex gap-2 px-4 py-2.5 bg-white overflow-x-auto shrink-0 border-b border-zinc-100 scrollbar-none">
      {/* Type toggles — independent, can both be on */}
      <button
        onClick={toggleTerrace}
        className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-all duration-150
          ${showTerrace ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"}`}
      >
        ☕ Terraces
      </button>
      <button
        onClick={toggleBench}
        className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-all duration-150
          ${showBench ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"}`}
      >
        🪑 Benches
      </button>

      <div className="w-px bg-zinc-200 mx-1 self-stretch shrink-0" />

      {/* Sun filter — mutually exclusive */}
      <button
        onClick={() => handleSunFilter("sunny")}
        className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-all duration-150
          ${sunFilter === "sunny" ? "bg-amber-400 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
      >
        ☀️ Sunny
      </button>
      <button
        onClick={() => handleSunFilter("shaded")}
        className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-all duration-150
          ${sunFilter === "shaded" ? "bg-slate-500 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
      >
        🌥️ Shaded
      </button>

      <div className="w-px bg-zinc-200 mx-1 self-stretch shrink-0" />

      <button
        onClick={() => setOpenNow(!openNow)}
        className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-all duration-150
          ${openNow ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
      >
        Open now
      </button>
    </div>
  );
}
