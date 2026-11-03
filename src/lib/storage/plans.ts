// localStorage 계획 목록 저장·검증·복원 (ADR-010).
// localStorage는 사용자가 조작할 수 있는 비신뢰 입력이다. 읽은 값은 필드마다 검증하고
// 필요한 필드만 골라 새 객체로 다시 만든다. 어떤 경우에도 예외를 밖으로 던지지 않는다.
import { isValidIsoDate } from "@/lib/date/kst";
import type { Curriculum, CurriculumItem } from "@/types/curriculum";
import type { IsoDate, PlanOverrides, PlanSettings, SavedPlan, WeekdayMinutes } from "@/types/plan";

export const PLANS_KEY = "currculator:plans:v1";
const VERSION = 1;

type Obj = Record<string, unknown>;

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function resolve(storage: Storage | null | undefined): Storage | null {
  return storage === undefined ? defaultStorage() : storage;
}

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isDate(value: unknown): value is IsoDate {
  return isString(value) && isValidIsoDate(value);
}

function isIntIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function own(obj: Obj, key: string): unknown {
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}

function readItem(raw: unknown): CurriculumItem | null {
  if (!isObj(raw)) return null;
  const id = own(raw, "id");
  const title = own(raw, "title");
  const level = own(raw, "level");
  const order = own(raw, "order");
  const sectionId = own(raw, "sectionId");
  const durationSec = own(raw, "durationSec");
  const source = own(raw, "source");
  const excluded = own(raw, "excluded");
  if (!isString(id) || !isString(title)) return null;
  if (level !== 0 && level !== 1) return null;
  if (typeof order !== "number" || !Number.isInteger(order) || order < 0) return null;
  if (sectionId !== null && !isString(sectionId)) return null;
  if (durationSec !== null && !(typeof durationSec === "number" && Number.isFinite(durationSec) && durationSec >= 0)) {
    return null;
  }
  if (source !== "origin" && source !== "manual") return null;
  if (typeof excluded !== "boolean") return null;
  const pageStart = own(raw, "pageStart");
  const pageEnd = own(raw, "pageEnd");
  if (pageStart !== undefined && pageStart !== null && !isIntIn(pageStart, 1, Number.MAX_SAFE_INTEGER)) return null;
  if (pageEnd !== undefined && pageEnd !== null && !isIntIn(pageEnd, 1, Number.MAX_SAFE_INTEGER)) return null;
  return { id, title, level, order, sectionId, durationSec, source, excluded, ...(pageStart !== undefined ? { pageStart } : {}), ...(pageEnd !== undefined ? { pageEnd } : {}) };
}

function readCurriculum(raw: unknown): Curriculum | null {
  if (!isObj(raw)) return null;
  const title = own(raw, "title");
  const sourceUrl = own(raw, "sourceUrl");
  const platform = own(raw, "platform");
  const courseId = own(raw, "courseId");
  const instructor = own(raw, "instructor");
  const droppedCount = own(raw, "droppedCount");
  const rawItems = own(raw, "items");
  if (!isString(title) || !isString(sourceUrl) || !isString(courseId)) return null;
  if (platform !== "inflearn" && platform !== "youtube" && platform !== "book") return null;
  if (instructor !== null && !isString(instructor)) return null;
  if (!isIntIn(droppedCount, 0, Number.MAX_SAFE_INTEGER)) return null;
  if (!Array.isArray(rawItems)) return null;
  const items: CurriculumItem[] = [];
  for (const rawItem of rawItems) {
    const item = readItem(rawItem);
    if (item === null) return null;
    items.push(item);
  }
  return { title, sourceUrl, platform, courseId, instructor, droppedCount, items };
}

function readSettings(raw: unknown): PlanSettings | null {
  if (!isObj(raw)) return null;
  const startDate = own(raw, "startDate");
  const weekdayMinutes = own(raw, "weekdayMinutes");
  const toleranceMinutes = own(raw, "toleranceMinutes");
  const restDates = own(raw, "restDates");
  const lectureMultiplier = own(raw, "lectureMultiplier");
  if (!isDate(startDate)) return null;
  if (!Array.isArray(weekdayMinutes) || weekdayMinutes.length !== 7) return null;
  if (!weekdayMinutes.every((m) => isIntIn(m, 0, 1440))) return null;
  if (!isIntIn(toleranceMinutes, 0, 1440)) return null;
  if (typeof lectureMultiplier !== "number" || !(lectureMultiplier >= 0.5 && lectureMultiplier <= 5)) return null;
  if (!Array.isArray(restDates) || !restDates.every(isDate)) return null;
  return {
    startDate,
    weekdayMinutes: [...weekdayMinutes] as WeekdayMinutes,
    toleranceMinutes,
    restDates: [...restDates],
    lectureMultiplier,
  };
}

function readOverrides(raw: unknown): PlanOverrides | null {
  if (!isObj(raw)) return null;
  const overrides: PlanOverrides = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value !== null && !isDate(value)) return null;
    // "__proto__" 키도 프로토타입을 바꾸지 않고 자기 속성으로 둔다
    Object.defineProperty(overrides, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return overrides;
}

function readPlan(raw: unknown): SavedPlan | null {
  if (!isObj(raw)) return null;
  const id = own(raw, "id");
  const savedAt = own(raw, "savedAt");
  if (!isString(id) || id === "" || !isString(savedAt)) return null;
  const curriculum = readCurriculum(own(raw, "curriculum"));
  const settings = readSettings(own(raw, "settings"));
  const overrides = readOverrides(own(raw, "overrides"));
  if (curriculum === null || settings === null || overrides === null) return null;
  return { id, curriculum, settings, overrides, savedAt };
}

export function loadPlans(storage?: Storage | null): SavedPlan[] {
  try {
    const target = resolve(storage);
    if (target === null) return [];
    const text = target.getItem(PLANS_KEY);
    if (text === null) return [];
    const data: unknown = JSON.parse(text);
    if (!isObj(data) || own(data, "version") !== VERSION) return [];
    const rawPlans = own(data, "plans");
    if (!Array.isArray(rawPlans)) return [];
    const plans: SavedPlan[] = [];
    const seen = new Set<string>();
    for (const rawPlan of rawPlans) {
      const plan = readPlan(rawPlan);
      if (plan === null || seen.has(plan.id)) continue;
      seen.add(plan.id);
      plans.push(plan);
    }
    return plans;
  } catch {
    return [];
  }
}

export function savePlans(plans: SavedPlan[], storage?: Storage | null): boolean {
  try {
    const target = resolve(storage);
    if (target === null) return false;
    target.setItem(PLANS_KEY, JSON.stringify({ version: VERSION, plans }));
    return true;
  } catch {
    return false;
  }
}

export function clearPlans(storage?: Storage | null): void {
  try {
    resolve(storage)?.removeItem(PLANS_KEY);
  } catch {
    // 저장소를 쓸 수 없으면 지울 것도 없다
  }
}
