"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-zinc-100 animate-pulse flex items-center justify-center">
      <span className="text-zinc-400 text-sm">Loading map…</span>
    </div>
  ),
});

export default function MapWrapper() {
  return <MapView />;
}
