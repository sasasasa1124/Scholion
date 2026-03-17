"use client";

import { SettingsProvider } from "@/lib/settings-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}
