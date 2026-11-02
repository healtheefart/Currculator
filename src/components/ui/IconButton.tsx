import type { ReactNode } from "react";

export interface IconButtonProps {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  size?: number;
}

export function IconButton({ label, icon, onClick, size = 44 }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{ width: size, height: size }}
      className="cc-press inline-grid flex-none cursor-pointer place-items-center rounded-full border-0 bg-[var(--surface-chip-translucent)] p-0 text-ink"
    >
      {icon}
    </button>
  );
}
