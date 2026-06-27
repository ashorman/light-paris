"use client";

import { useAppStore } from "@/store/app";
import type { FilterType } from "@/store/app";

const TYPE_FILTERS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "terrace", label: "Terraces" },
  { value: "bench", label: "Benches" },
];

export default function FilterChips() {
  const filterType = useAppStore((s) => s.filterType);
  const sunnyOnly = useAppStore((s) => s.sunnyOnly);
  const openNow = useAppStore((s) => s.openNow);
  const setFilterType = useAppStore((s) => s.setFilterType);
  const setSunnyOnly = useAppStore((s) => s.setSunnyOnly);
  const setOpenNow = useAppStore((s) => s.setOpenNow);

  return (
    <div className="flex gap-2 px-4 py-2.5 bg-white overflow-x-auto shrink-0 border-b border-zinc-100 scrollbar-none">
      {TYPE_FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => setFilterType(f.value)}
          className={`
            whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-all duration-150
            ${
              filterType === f.value
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }
          `}
        >
          {f.label}
        </button>
      ))}

      <div className="w-px bg-zinc-200 mx-1 self-stretch shrink-0" />

      <button
        onClick={() => setSunnyOnly(!sunnyOnly)}
        className={`
          whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-all duration-150
          ${
            sunnyOnly
              ? "bg-amber-400 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }
        `}
      >
        ☀️ Sunny only
      </button>

      <button
        onClick={() => setOpenNow(!openNow)}
        className={`
          whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-all duration-150
          ${
            openNow
              ? "bg-emerald-500 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }
        `}
      >
        Open now
      </button>
    </div>
  );
}
