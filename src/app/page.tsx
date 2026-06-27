import WeatherBar from "@/components/WeatherBar";
import TimeSelector from "@/components/TimeSelector";
import FilterChips from "@/components/FilterChips";
import POIList from "@/components/POIList";
import BottomSheet from "@/components/BottomSheet";
import LocationButton from "@/components/LocationButton";
import MapWrapper from "@/components/MapWrapper";

export default function Home() {
  return (
    <main className="flex flex-col h-dvh max-w-md mx-auto bg-white relative overflow-hidden">
      {/* Weather bar — top strip */}
      <WeatherBar />

      {/* Map — takes ~45% of height */}
      <div className="relative" style={{ height: "45dvh", flexShrink: 0 }}>
        <MapWrapper />
        <LocationButton />
      </div>

      {/* Bottom panel — scrollable list */}
      <div className="flex flex-col flex-1 overflow-hidden border-t border-zinc-200">
        <TimeSelector />
        <FilterChips />
        <POIList />
      </div>

      {/* Bottom sheet overlay */}
      <BottomSheet />
    </main>
  );
}
