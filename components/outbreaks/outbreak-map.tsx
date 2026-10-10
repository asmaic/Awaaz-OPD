"use client";
// Loaded only via next/dynamic({ ssr: false }) — Leaflet touches window on import.
import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import type { LocalityStat } from "@/lib/surveillance";
import { findLocality } from "@/lib/localities";

const STATUS = {
  alert: { fill: "#DC2626", label: "⚠ ALERT" },
  watch: { fill: "#CA8A04", label: "◐ Watch" },
  none: { fill: "#1e5b52", label: "Usual level" },
};

/** One circle per locality: area ∝ cases this week; colour = status (always repeated as text in the tooltip). */
export default function OutbreakMap({ stats, focus, onPick }: { stats: LocalityStat[]; focus?: string; onPick: (locality: string) => void }) {
  const placed = stats.flatMap((s) => {
    const l = findLocality(s.locality);
    return l ? [{ s, lat: l.lat, lng: l.lng }] : [];
  });
  return (
    <MapContainer center={[33.65, 73.06]} zoom={11} scrollWheelZoom={false} className="size-full">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      {placed.map(({ s, lat, lng }) => {
        const st = STATUS[s.alert ?? "none"];
        const isFocus = focus && findLocality(focus)?.name === findLocality(s.locality)?.name;
        return (
          <CircleMarker
            key={s.locality}
            center={[lat, lng]}
            radius={Math.max(5, 4 + Math.sqrt(s.thisWeek) * 5)}
            pathOptions={{ color: isFocus ? "#15201d" : "#ffffff", weight: isFocus ? 4 : 2, fillColor: st.fill, fillOpacity: s.thisWeek ? 0.7 : 0.25 }}
            eventHandlers={{ click: () => onPick(s.locality) }}
          >
            <Tooltip direction="top" permanent={!!isFocus}>
              <b>{s.locality}</b> · {st.label}<br />{s.thisWeek} this week · usual {s.baselineWeekly}/wk
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
