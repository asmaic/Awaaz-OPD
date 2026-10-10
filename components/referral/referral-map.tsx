"use client";
// Loaded only via next/dynamic({ ssr: false }) — Leaflet touches window on import.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from "react-leaflet";
import type { ReferralPlan } from "@/types/features";

// Cached per colour/size: a new icon each render makes react-leaflet rebuild the marker (the dashboard re-renders every second).
const dots = new Map<string, L.DivIcon>();
const dot = (bg: string, size = 14) => {
  const k = `${bg}|${size}`;
  if (!dots.has(k)) dots.set(k, L.divIcon({ className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${bg};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>` }));
  return dots.get(k)!;
};

/** Origin → best facility as a straight line (approximate: no road routing offline). Other options shown as grey dots. */
export default function ReferralMap({ plan }: { plan: ReferralPlan }) {
  const { origin, best, options } = plan;
  const pts: [number, number][] = [[origin.lat, origin.lng], ...(best ? [[best.facility.lat, best.facility.lng] as [number, number]] : [])];
  const bounds = L.latLngBounds(options.map((o) => [o.facility.lat, o.facility.lng] as [number, number]).concat([[origin.lat, origin.lng]]));
  return (
    <MapContainer bounds={bounds.pad(0.15)} scrollWheelZoom={false} className="size-full">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      {options.map((o) => o !== best && (
        <Marker key={o.facility.id} position={[o.facility.lat, o.facility.lng]} icon={dot(Number.isFinite(o.score) ? "#64748b" : "#cbd5e1", 12)}>
          <Tooltip direction="top">{o.facility.short}{Number.isFinite(o.score) ? "" : " (can't treat)"}</Tooltip>
        </Marker>
      ))}
      <Marker position={[origin.lat, origin.lng]} icon={dot("#0d9488")}>
        <Tooltip direction="top" permanent>{origin.label}</Tooltip>
      </Marker>
      {best && (
        <>
          <Polyline positions={pts} pathOptions={{ color: "#DC2626", weight: 5, dashArray: "10 8" }} />
          <Marker position={[best.facility.lat, best.facility.lng]} icon={dot("#DC2626", 18)}>
            <Tooltip direction="top" permanent>{best.facility.short} · {best.travelMin} min</Tooltip>
          </Marker>
        </>
      )}
    </MapContainer>
  );
}
