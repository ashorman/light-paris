"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app";

export default function LocationButton() {
  const setLocation = useAppStore((s) => s.setLocation);
  const setLocationError = useAppStore((s) => s.setLocationError);
  const fetchSunData = useAppStore((s) => s.fetchSunData);
  const locationGranted = useAppStore((s) => s.locationGranted);
  const isLoading = useAppStore((s) => s.isLoading);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      fetchSunData(); // Use Paris centre as fallback
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation(pos.coords.latitude, pos.coords.longitude),
      () => {
        setLocationError("Location denied — showing Paris centre");
        fetchSunData();
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  };

  // On first load, auto-request location
  useEffect(() => {
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      onClick={requestLocation}
      disabled={isLoading}
      title="Find my location"
      className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-base hover:bg-zinc-50 active:scale-95 transition-all disabled:opacity-50"
    >
      {locationGranted ? "📍" : "🔍"}
    </button>
  );
}
