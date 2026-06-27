"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/app";
import type { POI } from "@/lib/types";

const PARIS_CENTER: [number, number] = [2.3522, 48.8566];
const PARIS_BOUNDS: [[number, number], [number, number]] = [
  [2.224, 48.815],
  [2.47, 48.902],
];

const STATUS_FILL: Record<string, string> = {
  sunny: "#F59E0B",
  margin: "#FCD34D",
  clouds: "#94A3B8",
  shaded: "#64748B",
};

const STATUS_RING: Record<string, string> = {
  sunny: "#D97706",
  margin: "#CA8A04",
  clouds: "#64748B",
  shaded: "#475569",
};

// Build a GeoJSON FeatureCollection of circle buffers around sunny/margin POIs
// so the map shows a soft amber zone rather than trying to render shadows
function buildSunZones(pois: POI[]) {
  const sunnyPOIs = pois.filter(
    (p) => p.sunStatus === "sunny" || p.sunStatus === "margin"
  );

  const features = sunnyPOIs.map((poi) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [poi.lng, poi.lat],
    },
    properties: {
      status: poi.sunStatus,
      name: poi.name,
    },
  }));

  return { type: "FeatureCollection" as const, features };
}

function buildShadedZones(pois: POI[]) {
  const shadedPOIs = pois.filter((p) => p.sunStatus === "shaded");
  return {
    type: "FeatureCollection" as const,
    features: shadedPOIs.map((poi) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [poi.lng, poi.lat],
      },
      properties: { name: poi.name },
    })),
  };
}

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ remove: () => void }[]>([]);

  const sunData = useAppStore((s) => s.sunData);
  const userLat = useAppStore((s) => s.userLat);
  const userLng = useAppStore((s) => s.userLng);
  const setSelectedPOI = useAppStore((s) => s.setSelectedPOI);

  const updateMap = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map: any, pois: POI[], maplibregl: any) => {
      // -- Remove old markers --
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];

      // -- Update zone layers --
      const sunZones = buildSunZones(pois);
      const shadedZones = buildShadedZones(pois);

      if (map.getSource("sun-zones")) {
        map.getSource("sun-zones").setData(sunZones);
      } else {
        map.addSource("sun-zones", { type: "geojson", data: sunZones });
        // Soft amber halo around sunny spots
        map.addLayer({
          id: "sun-zones-halo",
          type: "circle",
          source: "sun-zones",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 28, 17, 55],
            "circle-color": "#FCD34D",
            "circle-opacity": 0.25,
            "circle-blur": 0.6,
          },
        });
      }

      if (map.getSource("shaded-zones")) {
        map.getSource("shaded-zones").setData(shadedZones);
      } else {
        map.addSource("shaded-zones", { type: "geojson", data: shadedZones });
        map.addLayer({
          id: "shaded-zones-halo",
          type: "circle",
          source: "shaded-zones",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 22, 17, 44],
            "circle-color": "#94A3B8",
            "circle-opacity": 0.2,
            "circle-blur": 0.6,
          },
        });
      }

      // -- Add POI markers --
      for (const poi of pois) {
        const el = document.createElement("div");
        const fill = STATUS_FILL[poi.sunStatus] ?? "#64748B";
        const ring = STATUS_RING[poi.sunStatus] ?? "#475569";
        const icon = poi.type === "bench" ? "🪑" : "☕";

        el.style.cssText = `
          width:32px; height:32px; border-radius:50%;
          background:${fill}; border:2.5px solid ${ring};
          box-shadow:0 2px 8px rgba(0,0,0,0.25);
          display:flex; align-items:center; justify-content:center;
          font-size:15px; cursor:pointer;
          transition:transform 0.12s ease, box-shadow 0.12s ease;
          user-select:none;
        `;
        el.textContent = icon;
        el.title = poi.name;

        el.addEventListener("mouseenter", () => {
          el.style.transform = "scale(1.25)";
          el.style.boxShadow = "0 4px 14px rgba(0,0,0,0.35)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.transform = "scale(1)";
          el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)";
        });
        el.addEventListener("click", () => setSelectedPOI(poi));

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([poi.lng, poi.lat])
          .addTo(map);

        markersRef.current.push(marker);
      }
    },
    [setSelectedPOI]
  );

  // -- Initialise map --
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("maplibre-gl").then((mod) => {
      const maplibregl = mod.default ?? mod;

      const map = new maplibregl.Map({
        container: mapRef.current!,
        // Clean flat style — no 3D, easier to read sunny zones
        style: "https://tiles.openfreemap.org/styles/positron",
        center: PARIS_CENTER,
        zoom: 14.5,
        maxBounds: PARIS_BOUNDS,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      map.on("load", () => {
        // Add user location dot
        map.addSource("user-loc", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [{
              type: "Feature",
              geometry: { type: "Point", coordinates: [PARIS_CENTER[0], PARIS_CENTER[1]] },
              properties: {},
            }],
          },
        });
        map.addLayer({
          id: "user-loc-dot",
          type: "circle",
          source: "user-loc",
          paint: {
            "circle-radius": 7,
            "circle-color": "#3B82F6",
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
          },
        });
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // -- Update map when POI data changes --
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !sunData) return;

    import("maplibre-gl").then((mod) => {
      const maplibregl = mod.default ?? mod;

      const onReady = () => updateMap(map, sunData.pois, maplibregl);

      if (map.isStyleLoaded()) {
        onReady();
      } else {
        map.once("load", onReady);
      }
    });
  }, [sunData, updateMap]);

  // -- Pan to user location --
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    import("maplibre-gl").then((mod) => {
      const maplibregl = mod.default ?? mod;

      // Update user location dot
      if (map.getSource("user-loc")) {
        map.getSource("user-loc").setData({
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            geometry: { type: "Point", coordinates: [userLng, userLat] },
            properties: {},
          }],
        });
      }

      map.easeTo({ center: [userLng, userLat], zoom: 15, duration: 800 });

      // Add accuracy ring
      if (!map.getSource("user-acc")) {
        map.addSource("user-acc", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "user-acc-ring",
          type: "circle",
          source: "user-acc",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 24, 17, 80],
            "circle-color": "#3B82F6",
            "circle-opacity": 0.08,
            "circle-stroke-color": "#3B82F6",
            "circle-stroke-width": 1.5,
            "circle-stroke-opacity": 0.3,
          },
        });
        map.getSource("user-acc").setData({
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            geometry: { type: "Point", coordinates: [userLng, userLat] },
            properties: {},
          }],
        });
      }

      void maplibregl; // used indirectly
    });
  }, [userLat, userLng]);

  return <div ref={mapRef} className="w-full h-full" />;
}
