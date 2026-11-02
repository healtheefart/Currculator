import { isValidIsoDate } from "@/lib/date/kst";
import type { Curriculum, CurriculumItem } from "@/types/curriculum";
import type { IsoDate, PlanOverrides, PlanSettings, WeekdayMinutes } from "@/types/plan";
import { MAX_MINUTES, MAX_MULTIPLIER, MIN_MULTIPLIER } from "./inputs";
import { PRESETS, type PresetId } from "./presets";

export interface PlanDraft {
  curriculum: Curriculum;
  settings: PlanSettings;
  overrides: PlanOverrides;
}

export type DraftAction =
  | { type: "EDIT_TITLE"; itemId: string; title: string }
  | { type: "EDIT_MINUTES"; itemId: string; minutes: number }
  | { type: "TOGGLE_EXCLUDE"; itemId: string }
  | { type: "SET_WEEKDAY"; weekday: number; minutes: number }
  | { type: "APPLY_PRESET"; preset: PresetId }
  | { type: "SET_TOLERANCE"; minutes: number }
  | { type: "SET_MULTIPLIER"; value: number }
  | { type: "SET_START"; date: IsoDate }
  | { type: "TOGGLE_REST"; date: IsoDate }
  | { type: "REMOVE_REST"; date: IsoDate }
  | { type: "MOVE_ITEM"; itemId: string; date: IsoDate; baseDate: IsoDate | null }
  | { type: "REMOVE_ITEM"; itemId: string }
  | { type: "RESTORE_ITEM"; itemId: string }
  | { type: "RESET_OVERRIDES" };

function isMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_MINUTES;
}

function findLesson(draft: PlanDraft, itemId: string): CurriculumItem | null {
  const item = draft.curriculum.items.find((i) => i.id === itemId);
  return item && item.level === 1 ? item : null;
}

function updateItem(draft: PlanDraft, itemId: string, patch: Partial<CurriculumItem>): PlanDraft {
  return {
    ...draft,
    curriculum: {
      ...draft.curriculum,
      items: draft.curriculum.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    },
  };
}

function updateSettings(draft: PlanDraft, patch: Partial<PlanSettings>): PlanDraft {
  return { ...draft, settings: { ...draft.settings, ...patch } };
}

function setOverride(draft: PlanDraft, itemId: string, value: IsoDate | null): PlanDraft {
  const overrides: PlanOverrides = { ...draft.overrides };
  // 계산된 키 대입이 아니라 defineProperty로 "__proto__" 같은 id도 자기 속성으로 둔다
  Object.defineProperty(overrides, itemId, { value, enumerable: true, writable: true, configurable: true });
  return { ...draft, overrides };
}

function deleteOverride(draft: PlanDraft, itemId: string): PlanDraft {
  if (!Object.hasOwn(draft.overrides, itemId)) return draft;
  const overrides: PlanOverrides = {};
  for (const [key, value] of Object.entries(draft.overrides)) {
    if (key !== itemId) Object.defineProperty(overrides, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return { ...draft, overrides };
}

export function draftReducer(draft: PlanDraft, action: DraftAction): PlanDraft {
  switch (action.type) {
    case "EDIT_TITLE": {
      const title = action.title.trim();
      if (title === "" || !draft.curriculum.items.some((i) => i.id === action.itemId)) return draft;
      return updateItem(draft, action.itemId, { title });
    }
    case "EDIT_MINUTES": {
      if (!isMinutes(action.minutes) || !findLesson(draft, action.itemId)) return draft;
      return updateItem(draft, action.itemId, { durationSec: action.minutes * 60, source: "manual" });
    }
    case "TOGGLE_EXCLUDE": {
      const item = findLesson(draft, action.itemId);
      if (!item) return draft;
      return updateItem(draft, action.itemId, { excluded: !item.excluded });
    }
    case "SET_WEEKDAY": {
      const { weekday, minutes } = action;
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !isMinutes(minutes)) return draft;
      const weekdayMinutes = [...draft.settings.weekdayMinutes] as WeekdayMinutes;
      weekdayMinutes[weekday] = minutes;
      return updateSettings(draft, { weekdayMinutes });
    }
    case "APPLY_PRESET": {
      if (!Object.hasOwn(PRESETS, action.preset)) return draft;
      return updateSettings(draft, { weekdayMinutes: [...PRESETS[action.preset].weekdayMinutes] });
    }
    case "SET_TOLERANCE": {
      if (!isMinutes(action.minutes)) return draft;
      return updateSettings(draft, { toleranceMinutes: action.minutes });
    }
    case "SET_MULTIPLIER": {
      const { value } = action;
      if (!Number.isFinite(value) || value < MIN_MULTIPLIER || value > MAX_MULTIPLIER) return draft;
      return updateSettings(draft, { lectureMultiplier: value });
    }
    case "SET_START": {
      if (!isValidIsoDate(action.date)) return draft;
      return updateSettings(draft, { startDate: action.date });
    }
    case "TOGGLE_REST": {
      if (!isValidIsoDate(action.date)) return draft;
      const current = draft.settings.restDates;
      const restDates = current.includes(action.date)
        ? current.filter((d) => d !== action.date)
        : [...new Set([...current, action.date])].sort();
      return updateSettings(draft, { restDates });
    }
    case "REMOVE_REST": {
      if (!draft.settings.restDates.includes(action.date)) return draft;
      return updateSettings(draft, { restDates: draft.settings.restDates.filter((d) => d !== action.date) });
    }
    case "MOVE_ITEM": {
      if (!isValidIsoDate(action.date) || !findLesson(draft, action.itemId)) return draft;
      if (action.date === action.baseDate) return deleteOverride(draft, action.itemId);
      return setOverride(draft, action.itemId, action.date);
    }
    case "REMOVE_ITEM": {
      if (!findLesson(draft, action.itemId)) return draft;
      return setOverride(draft, action.itemId, null);
    }
    case "RESTORE_ITEM":
      return deleteOverride(draft, action.itemId);
    case "RESET_OVERRIDES":
      return Object.keys(draft.overrides).length === 0 ? draft : { ...draft, overrides: {} };
    default:
      return draft;
  }
}
