// 화면 입력 문자열 → 숫자. 실패하면 null (화면은 이전 값을 유지한다)

export const MAX_MINUTES = 1440;
export const MIN_MULTIPLIER = 0.5;
export const MAX_MULTIPLIER = 5;

/** 요일 분·재생 분·허용 오차 공통: 0~1440 정수 */
export function parseMinutes(text: string): number | null {
  if (!/^\s*\d+\s*$/.test(text)) return null;
  const value = Number(text.trim());
  return value >= 0 && value <= MAX_MINUTES ? value : null;
}

/** 강의 배수: 0.5~5 */
export function parseMultiplier(text: string): number | null {
  if (!/^\s*\d*\.?\d+\s*$/.test(text)) return null;
  const value = Number(text.trim());
  return value >= MIN_MULTIPLIER && value <= MAX_MULTIPLIER ? value : null;
}
