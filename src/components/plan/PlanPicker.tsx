"use client";

import { CheckIcon } from "@/components/ui/icons";

export function PlanPicker({ rows, selected, onSelect }: { rows: { id: "all" | string; title: string; sub: string }[]; selected: "all" | string; onSelect: (id: "all" | string) => void }) {
  return <div role="listbox" aria-label="저장한 계획" className="overflow-hidden rounded-lg border border-hairline bg-canvas">
    {rows.map((row) => <button key={row.id} type="button" role="option" aria-selected={selected === row.id} onClick={() => onSelect(row.id)} className={`flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 border-b border-divider px-5 py-3 text-left last:border-b-0 ${selected === row.id ? "bg-pearl shadow-[inset_3px_0_0_var(--color-primary-focus)]" : ""}`}>
      <span className="min-w-0"><strong className="cc-type-body-strong block truncate">{row.title}</strong><span className="cc-type-caption block truncate text-text-secondary">{row.sub}</span></span>
      {selected === row.id && <CheckIcon size={18} className="text-primary" />}
    </button>)}
  </div>;
}
