import type { ReactNode } from "react";

export interface TextLinkProps {
  children: ReactNode;
  onClick: () => void;
}

// 링크처럼 보이는 버튼. href="#" 대신 <button>으로 동작을 만든다.
export function TextLink({ children, onClick }: TextLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline cursor-pointer border-0 bg-transparent p-0 text-[var(--text-link)] no-underline hover:underline"
    >
      {children}
    </button>
  );
}
