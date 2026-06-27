"use client";

import { useAppStore } from "@/store/app";
import type { TimeWindow } from "@/lib/types";

const WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: "now", label: "Now" },
  { value: "30m", label: "+30 min" },
  { value: "1h", label: "+1 hr" },
  { value: "2h", label: "+2 hr" },
];

export default function TimeSelector() {
  const selected = useAppStore((s) => s.selectedWindow);
  const setTimeWindow = useAppStore((s) => s.setTimeWindow);
  const isLoading = useAppStore((s) => s.isLoading);

  return (
    <div className="flex gap-1.5 px-4 py-2 bg-white/95 backdrop-blur-sm border-b border-zinc-100 shrink-0">
      {WINDOWS.map((w) => (
        <button
          key={w.value}
          onClick={() => setTimeWindow(w.value)}
          disabled={isLoading}
          className={`
            flex-1 py-1.5 rounded-full text-xs font-semibold transition-all duration-150
            ${
              selected === w.value
                ? "bg-amber-400 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 active:scale-95"
            }
            disabled:opacity-50
          `}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}
