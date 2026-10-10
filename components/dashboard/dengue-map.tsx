"use client";
// Loaded only via next/dynamic({ ssr: false }) — Leaflet touches window on import.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import { LEVEL_META } from "@/components/triage";
import { effectiveLevel } from "@/store/queue";
import type { Patient } from "@/types/contracts";
import { DengueMapFallback } from "./dengue-map-fallback";

const pinIcon = (hex: string) =>
  L.divIcon({
    className: "",
    iconSize: [22, 30],
    iconAnchor: [11, 30],
    html: `<div class="awaaz-pin"><svg viewBox="0 0 24 32" width="22" height="30"><path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.5 12 32 12 32s12-11.5 12-20.3C24 5.2 18.6 0 12 0z" fill="${hex}" stroke="white" stroke-width="2"/><circle cx="12" cy="11.5" r="4" fill="white"/></svg></div>`,
  });

export default function DengueMap({ patients }: { patients: Patient[] }) {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  if (offline) return <DengueMapFallback patients={patients} />;

  return (
    <>
      <style>{`
        @keyframes awaaz-pin-drop { 0% { transform: translateY(-40px); opacity: 0 } 60% { transform: translateY(3px); opacity: 1 } 100% { transform: translateY(0) } }
        .awaaz-pin { animation: awaaz-pin-drop 0.5s cubic-bezier(.2,.8,.3,1.2) both; filter: drop-shadow(0 2px 3px rgba(0,0,0,.3)); }
      `}</style>
      <MapContainer center={[33.63, 73.06]} zoom={11} scrollWheelZoom={false}  className="size-full">
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
          eventHandlers={{ tileerror: () => setOffline(true) }}
        />
        {patients.map((p) => p.geo && (
          <Marker key={p.id} position={[p.geo.lat, p.geo.lng]} icon={pinIcon(LEVEL_META[effectiveLevel(p)].hex)}>
            <Tooltip direction="top" offset={[0, -28]}>Token {p.token} · {p.geo.label}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </>
  );
}
