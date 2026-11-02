"use client";

import type { ReactNode } from "react";
import { OptionChip } from "@/components/ui/OptionChip";

export function PlanViewTabs({ heading, tab, onTab, children }: { heading: string; tab: "list" | "calendar"; onTab: (tab: "list" | "calendar") => void; children: ReactNode }) {
  return <section className="mt-8 min-w-0">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 className="cc-type-tagline">{heading}</h2>
      <div className="flex gap-2"><OptionChip label="목록" selected={tab === "list"} onClick={() => onTab("list")} /><OptionChip label="달력" selected={tab === "calendar"} onClick={() => onTab("calendar")} /></div>
    </div>
    {children}
  </section>;
}
