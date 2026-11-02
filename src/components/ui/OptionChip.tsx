export interface OptionChipProps {
  label: string;
  detail?: string;
  selected?: boolean;
  onClick?: () => void;
}

export function OptionChip({ label, detail, selected = false, onClick }: OptionChipProps) {
  // 선택 시 테두리가 2px로 두꺼워지는 만큼 패딩을 1px 줄여 크기를 유지한다.
  const border = selected
    ? "border-2 border-primary-focus px-[17px] py-[11px]"
    : "border border-hairline px-[18px] py-[12px]";
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`cc-press inline-flex w-auto min-h-[44px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border-solid bg-canvas text-ink ${border}`}
    >
      <span className="cc-type-caption-strong">{label}</span>
      {detail ? <span className="cc-type-caption text-text-secondary">{detail}</span> : null}
    </button>
  );
}
