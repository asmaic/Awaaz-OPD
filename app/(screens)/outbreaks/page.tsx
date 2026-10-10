import { Suspense } from "react";
import { OutbreakExplorer } from "@/components/outbreaks/outbreak-explorer";

// Reads ?syndrome= & ?focus= on the client; Suspense is required for useSearchParams with Cache Components.
export default function OutbreaksPage() {
  return (
    <Suspense>
      <OutbreakExplorer />
    </Suspense>
  );
}
