import type { ButtonHTMLAttributes, Ref } from "react";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
  ref?: Ref<HTMLButtonElement>;
}

// 두 variant 모두 1px 테두리를 두고 패딩을 1px 줄여 바깥 크기를 11px 22px 패딩과 맞춘다.
const BASE =
  "cc-type-body inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-solid px-[21px] py-[10px]";

const ENABLED: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "cc-press cursor-pointer border-primary bg-primary text-[#fff]",
  secondary: "cc-press cursor-pointer border-primary bg-transparent text-primary",
};

const DISABLED: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "cursor-default border-hairline bg-parchment text-text-tertiary",
  secondary: "cursor-default border-hairline bg-transparent text-text-tertiary",
};

export function Button({ variant = "primary", type = "button", disabled, className, ...rest }: ButtonProps) {
  const tone = disabled ? DISABLED[variant] : ENABLED[variant];
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      data-variant={variant}
      className={[BASE, tone, className].filter(Boolean).join(" ")}
    />
  );
}
