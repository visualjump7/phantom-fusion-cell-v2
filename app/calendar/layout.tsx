"use client";

import { TravelProvider } from "@/lib/travel-store";

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return <TravelProvider>{children}</TravelProvider>;
}
