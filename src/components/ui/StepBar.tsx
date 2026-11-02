import { Badge } from "./Badge";

export interface StepBarProps {
  steps: { key: string; label: string }[];
  currentKey: string;
  reachableKeys: string[];
  onSelect: (key: string) => void;
  editing?: boolean;
}

type StepState = "past" | "current" | "upcoming";

const LABEL: Record<StepState, string> = {
  past: "text-ink",
  current: "text-ink font-semibold",
  upcoming: "text-text-tertiary",
};

const DOT: Record<StepState, string> = {
  past: "bg-chip-gray text-ink",
  current: "bg-ink text-[#fff]",
  upcoming: "bg-transparent text-text-tertiary",
};

// backdrop blur는 이 sticky 단계 바에서만 쓴다(UI_GUIDE).
const FROSTED = { backdropFilter: "var(--blur-frosted)", WebkitBackdropFilter: "var(--blur-frosted)" };

export function StepBar({ steps, currentKey, reachableKeys, onSelect, editing = false }: StepBarProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentKey);
  return (
    <div
      style={FROSTED}
      className="sticky top-0 z-[5] border-b border-solid border-[var(--color-hairline-alpha)] bg-[var(--surface-frosted)]"
    >
      <nav
        aria-label="단계"
        className="mx-auto flex min-h-[var(--subnav-height)] max-w-[980px] items-center gap-5 overflow-x-auto px-5"
      >
        {editing ? <Badge tone="gray">계획 수정 중</Badge> : null}
        {steps.map((step, index) => {
          const state: StepState =
            index === currentIndex ? "current" : currentIndex >= 0 && index < currentIndex ? "past" : "upcoming";
          const reachable = reachableKeys.includes(step.key);
          return (
            <button
              key={step.key}
              type="button"
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
              disabled={!reachable}
              onClick={() => onSelect(step.key)}
              className={`cc-type-caption flex min-h-[var(--touch-min)] flex-none items-center gap-2 border-0 bg-transparent p-0 ${
                reachable ? "cursor-pointer" : "cursor-default"
              } ${LABEL[state]}`}
            >
              <span
                className={`cc-type-fine-print grid h-5 w-5 place-items-center rounded-full tabular-nums ${DOT[state]}`}
              >
                {index + 1}
              </span>
              {step.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
