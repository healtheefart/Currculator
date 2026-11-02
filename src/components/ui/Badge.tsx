import type { ReactNode } from "react";

export interface BadgeProps {
  tone: "gray" | "dark" | "primary";
  children: ReactNode;
  size?: "sm" | "md"; // md = 경고용 큰 패딩
}

const TONE: Record<BadgeProps["tone"], string> = {
  gray: "bg-chip-gray text-ink",
  dark: "bg-tile text-[#fff]",
  primary: "bg-primary text-[#fff]",
};

const SIZE: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "px-[10px] py-[4px]",
  md: "px-[12px] py-[6px]",
};

export function Badge({ tone, children, size = "sm" }: BadgeProps) {
  return (
    <span
      data-tone={tone}
      data-size={size}
      className={`cc-type-fine-print inline-flex flex-none items-center whitespace-nowrap rounded-full ${TONE[tone]} ${SIZE[size]}`}
    >
      {children}
    </span>
  );
}
