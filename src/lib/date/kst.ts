import type { IsoDate } from "@/types/plan";

/** "YYYY-MM" */
export type YearMonth = string;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 날짜 계산은 1970-01-01 기준 일수(정수)로 한다. 실행 환경 시간대와 무관하다.
// days_from_civil / civil_from_days (proleptic Gregorian)

function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(days: number): [number, number, number] {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return [y, m, d];
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function format(y: number, m: number, d: number): IsoDate {
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

function parse(date: IsoDate): [number, number, number] {
  return [Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10))];
}

function toDays(date: IsoDate): number {
  const [y, m, d] = parse(date);
  return daysFromCivil(y, m, d);
}

function fromDays(days: number): IsoDate {
  const [y, m, d] = civilFromDays(days);
  return format(y, m, d);
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

/** Date → Asia/Seoul 기준 "YYYY-MM-DD". 이 파일에서만 Date를 인자로 받는다. */
export function toKstIsoDate(now: Date): IsoDate {
  return fromDays(Math.floor((now.getTime() + KST_OFFSET_MS) / MS_PER_DAY));
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDays(toDays(date) + days);
}

/** 0 = 일요일 … 6 = 토요일 */
export function weekdayOf(date: IsoDate): number {
  // 1970-01-01은 목요일(4)
  return (((toDays(date) + 4) % 7) + 7) % 7;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = parse(value);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function monthOf(date: IsoDate): YearMonth {
  return date.slice(0, 7);
}

export function addMonths(month: YearMonth, n: number): YearMonth {
  const index = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + n;
  const y = Math.floor(index / 12);
  const m = index - y * 12 + 1;
  return `${pad(y, 4)}-${pad(m, 2)}`;
}

/** 일요일 시작 달력 칸. 1일 앞의 빈칸은 null, 그 뒤 1일~말일. 끝은 채우지 않는다. */
export function monthCells(month: YearMonth): (IsoDate | null)[] {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const first = format(y, m, 1);
  const cells: (IsoDate | null)[] = Array.from({ length: weekdayOf(first) }, () => null);
  for (let d = 1; d <= daysInMonth(y, m); d++) cells.push(format(y, m, d));
  return cells;
}
