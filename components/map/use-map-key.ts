"use client";
import { useLayoutEffect, useState } from "react";

/**
 * Key for <MapContainer>. With Cache Components, Next.js hides visited pages with React <Activity> instead of
 * unmounting them. react-leaflet removes its Leaflet map when hidden but keeps the dead instance in state, so on
 * return every layer is added to a removed map ("Cannot read properties of undefined (reading 'appendChild')").
 * Bumping the key in the hide cleanup gives a fresh map each time the page is shown again.
 * (Pattern from node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md.)
 */
export function useMapKey(): number {
  const [key, setKey] = useState(0);
  useLayoutEffect(() => () => setKey((k) => k + 1), []);
  return key;
}
