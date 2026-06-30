"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/app";
import type { POI } from "@/lib/types";
import type { SunFilter } from "@/store/app";

// Paris lat/lng → approximate metres conversion
const LNG_TO_M = 73_000;
const LAT_TO_M = 111_000;
const STREET_RADIUS_M = 130; // colour roads within this distance of a classified POI

function distM(aLng: number, aLat: number, bLng: number, bLat: number) {
  const dx = (aLng - bLng) * LNG_TO_M;
  const dy = (aLat - bLat) * LAT_TO_M;
  return Math.sqrt(dx * dx + dy * dy);
}

// Debounce helper
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

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

/**
 * Query all rendered road features (source-layer: transportation) and classify
 * each segment by proximity to a classified POI.
 * Returns a GeoJSON FeatureCollection with {sunStatus} property per feature.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function classifyVisibleRoads(map: any, allPois: POI[], filter: NonNullable<SunFilter>) {
  const style = map.getStyle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roadLayerIds: string[] = (style.layers as any[])
    .filter(
      (l) =>
        l.type === "line" &&
        (l["source-layer"] === "transportation" ||
          l["source-layer"] === "road") &&
        // Exclude casing layers — they duplicate the exact same road geometry
        // and cause stacked opacity darkening
        !(l.id as string).includes("casing") &&
        !(l.id as string).includes("outline") &&
        !(l.id as string).includes("bridge") &&
        !(l.id as string).includes("tunnel")
    )
    .map((l) => l.id as string);

  if (roadLayerIds.length === 0) return null;

  // Only consider POIs that match the active filter
  const targetPois = allPois.filter((p) =>
    filter === "sunny"
      ? p.sunStatus === "sunny" || p.sunStatus === "margin"
      : p.sunStatus === "shaded"
  );
  if (targetPois.length === 0) return { type: "FeatureCollection" as const, features: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendered: any[] = map.queryRenderedFeatures({ layers: roadLayerIds });

  // Deduplicate by id if present
  const seen = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const features: any[] = [];

  for (const f of rendered) {
    const key = JSON.stringify(f.geometry.coordinates);
    if (seen.has(key)) continue;
    seen.add(key);

    // Midpoint of the line segment for proximity check
    const coords: [number, number][] =
      f.geometry.type === "LineString"
        ? f.geometry.coordinates
        : f.geometry.coordinates.flat(1);
    if (!coords.length) continue;
    const mid = coords[Math.floor(coords.length / 2)] as [number, number];

    // Find distance to closest target POI
    let minDist = Infinity;
    for (const poi of targetPois) {
      const d = distM(mid[0], mid[1], poi.lng, poi.lat);
      if (d < minDist) minDist = d;
    }

    if (minDist > STREET_RADIUS_M) continue;

    features.push({
      type: "Feature",
      geometry: f.geometry,
      properties: { sunStatus: filter },
    });
  }

  return { type: "FeatureCollection" as const, features };
}

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ remove: () => void }[]>([]);
  // cleanup ref for idle listener
  const highlightCleanupRef = useRef<(() => void) | null>(null);

  const sunData     = useAppStore((s) => s.sunData);
  const userLat     = useAppStore((s) => s.userLat);
  const userLng     = useAppStore((s) => s.userLng);
  const showTerrace = useAppStore((s) => s.showTerrace);
  const showBench   = useAppStore((s) => s.showBench);
  const sunFilter   = useAppStore((s) => s.sunFilter);
  const setSelectedPOI = useAppStore((s) => s.setSelectedPOI);

  // -- Render markers for visible types only --
  const updateMarkers = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map: any, pois: POI[], maplibregl: any) => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];

      const visible = pois.filter(
        (p) =>
          (p.type === "terrace" && showTerrace) ||
          (p.type === "bench" && showBench)
      );

      for (const poi of visible) {
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
          transition:filter 0.12s ease, box-shadow 0.12s ease;
          user-select:none;
        `;
        el.textContent = icon;
        el.title = poi.name;

        el.addEventListener("mouseenter", () => {
          el.style.filter = "brightness(1.15)";
          el.style.boxShadow = "0 4px 14px rgba(0,0,0,0.35)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.filter = "brightness(1)";
          el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)";
        });
        el.addEventListener("click", () => setSelectedPOI(poi));

        markersRef.current.push(
          new maplibregl.Marker({ element: el }).setLngLat([poi.lng, poi.lat]).addTo(map)
        );
      }
    },
    [showTerrace, showBench, setSelectedPOI]
  );

  // -- Initialise map --
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("maplibre-gl").then((mod) => {
      const maplibregl = mod.default ?? mod;

      const map = new maplibregl.Map({
        container: mapRef.current!,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: PARIS_CENTER,
        zoom: 14.5,
        maxBounds: PARIS_BOUNDS,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      map.on("load", () => {
        // Re-fetch POIs on pan
        const onMoveEnd = debounce(() => {
          const center = map.getCenter();
          useAppStore.getState().setMapCenter(center.lat, center.lng);
        }, 600);
        map.on("moveend", onMoveEnd);

        // Street highlight GeoJSON source + line layer (hidden until filter active)
        map.addSource("street-highlight", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "street-highlight",
          type: "line",
          source: "street-highlight",
          layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": [
              "match",
              ["get", "sunStatus"],
              "sunny",  "#F59E0B",
              "shaded", "#475569",
              "#ccc",
            ],
            "line-width": ["interpolate", ["linear"], ["zoom"], 13, 5, 16, 10],
            "line-opacity": 0.75,
            "line-blur": 0,
          },
        });

        // User location dot
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
      if (highlightCleanupRef.current) highlightCleanupRef.current();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // -- Re-render markers when data or type filters change --
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !sunData) return;

    import("maplibre-gl").then((mod) => {
      const maplibregl = mod.default ?? mod;
      const run = () => updateMarkers(map, sunData.pois, maplibregl);
      if (map.isStyleLoaded()) run();
      else map.once("load", run);
    });
  }, [sunData, showTerrace, showBench, updateMarkers]);

  // -- Street highlight: show/update when sunFilter changes --
  useEffect(() => {
    const map = mapInstanceRef.current;

    // Tear down previous idle listener
    if (highlightCleanupRef.current) {
      highlightCleanupRef.current();
      highlightCleanupRef.current = null;
    }

    if (!map) return;

    const applyHighlight = () => {
      if (!map.getLayer("street-highlight")) return;

      if (!sunFilter || !sunData) {
        map.setLayoutProperty("street-highlight", "visibility", "none");
        return;
      }

      map.setLayoutProperty("street-highlight", "visibility", "visible");

      const classified = classifyVisibleRoads(map, sunData.pois, sunFilter);
      if (classified) {
        map.getSource("street-highlight").setData(classified);
      }
    };

    // Run once after the next idle so tiles are rendered before we query features
    const runOnce = () => {
      map.once("idle", applyHighlight);
      highlightCleanupRef.current = () => map.off("idle", applyHighlight);
    };

    if (map.isStyleLoaded()) {
      runOnce();
    } else {
      map.once("load", runOnce);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sunFilter, sunData]);

  // -- Pan to user location --
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    import("maplibre-gl").then(() => {
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
    });
  }, [userLat, userLng]);

  return <div ref={mapRef} className="w-full h-full" />;
}
