import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Big_Shoulders, IBM_Plex_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// next/font self-hosts these at build time, so the demo works offline.
// Atkinson Hyperlegible: built by the Braille Institute for low-vision reading (kiosk + projector).
const body = Atkinson_Hyperlegible_Next({ variable: "--font-sans", subsets: ["latin"] });
// Big Shoulders: condensed public-signage face, used for token numbers and wayfinding headings only.
const signage = Big_Shoulders({ variable: "--font-signage", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });
const nastaliq = Noto_Nastaliq_Urdu({ variable: "--font-urdu", subsets: ["arabic"] });

export const metadata: Metadata = {
  title: "Awaaz OPD",
  description: "Har awaaz suni jaye — voice triage and queue for overcrowded OPDs",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${signage.variable} ${mono.variable} ${nastaliq.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
