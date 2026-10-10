import { AppShell } from "@/components/shell/app-shell";

export default function ScreensLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
