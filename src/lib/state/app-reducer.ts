import { SAMPLE_COURSE_URL } from "@/lib/url-input";
import type { ClientErrorCode, Curriculum } from "@/types/curriculum";
import type { IsoDate, PlanOverrides, SavedPlan } from "@/types/plan";
import { draftReducer, type DraftAction, type PlanDraft } from "./draft-reducer";
import { createDefaultSettings } from "./presets";

export type Menu = "build" | "view";
export type BuildStage = "type" | "url" | "book" | "edit" | "schedule" | "adjust";
export type SiteId = "inflearn" | "youtube" | "fastcampus" | "megastudy";

export const SITES: readonly { id: SiteId; label: string }[] = [
  { id: "inflearn", label: "인프런" },
  { id: "youtube", label: "YouTube" },
  { id: "fastcampus", label: "패스트캠퍼스" },
  { id: "megastudy", label: "메가스터디" },
];

export interface BuildState {
  stage: BuildStage;
  site: SiteId;
  url: string;
  extracting: boolean;
  errorCode: ClientErrorCode | null;
  dupPlanId: string | null; // ALREADY_PLANNED일 때 기존 계획 id
  bookNotice: boolean; // 책 목차를 눌렀을 때
  editingId: string | null; // 수정 중인 SavedPlan id (새 계획이면 null)
  draft: PlanDraft | null;
}

export interface AppState {
  menu: Menu;
  plans: SavedPlan[];
  plansRevision: number; // 사용자 동작으로 plans가 바뀔 때만 1 증가 → page가 저장
  build: BuildState;
  view: { selected: "all" | string; tab: "list" | "calendar" };
  confirm: null | { kind: "reset" } | { kind: "delete"; planId: string };
}

export type AppAction =
  | { type: "INIT"; plans: SavedPlan[] }
  | { type: "NAVIGATE"; menu: Menu }
  | { type: "PICK_SOURCE"; source: "course" | "book" }
  | { type: "BACK_TO_TYPE" }
  | { type: "BOOK_SEARCH_START" }
  | { type: "BOOK_SEARCH_END" }
  | { type: "BOOK_SELECTED"; curriculum: Curriculum; today: IsoDate }
  | { type: "PICK_SITE"; site: SiteId }
  | { type: "SET_URL"; url: string }
  | { type: "FILL_SAMPLE" }
  | { type: "SUBMIT_REJECTED"; code: ClientErrorCode; dupPlanId?: string }
  | { type: "EXTRACT_START" }
  | { type: "EXTRACT_FAILURE"; code: ClientErrorCode }
  | { type: "EXTRACT_SUCCESS"; curriculum: Curriculum; today: IsoDate }
  | { type: "GO_STAGE"; stage: BuildStage }
  | { type: "DRAFT"; action: DraftAction }
  | { type: "CREATE_PLAN"; id: string; savedAt: string }
  | { type: "START_EDIT"; planId: string }
  | { type: "SAVE_EDIT"; savedAt: string }
  | { type: "CANCEL_EDIT" }
  | { type: "ASK_RESET" }
  | { type: "ASK_DELETE"; planId: string }
  | { type: "CANCEL_CONFIRM" }
  | { type: "CONFIRM" }
  | { type: "SELECT_PLAN"; selected: "all" | string }
  | { type: "SET_TAB"; tab: "list" | "calendar" }
  | { type: "OPEN_DUP" };

function createInitialBuild(): BuildState {
  return {
    stage: "type",
    site: "inflearn",
    url: "",
    extracting: false,
    errorCode: null,
    dupPlanId: null,
    bookNotice: false,
    editingId: null,
    draft: null,
  };
}

export function createInitialState(): AppState {
  return {
    menu: "build",
    plans: [],
    plansRevision: 0,
    build: createInitialBuild(),
    view: { selected: "all", tab: "list" },
    confirm: null,
  };
}

function copyOverrides(overrides: PlanOverrides): PlanOverrides {
  const copy: PlanOverrides = {};
  for (const [key, value] of Object.entries(overrides)) {
    Object.defineProperty(copy, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return copy;
}

/** 저장본과 객체를 공유하지 않는 draft (수정 취소 시 저장본 불변) */
function draftFromPlan(plan: SavedPlan): PlanDraft {
  return {
    curriculum: { ...plan.curriculum, items: plan.curriculum.items.map((item) => ({ ...item })) },
    settings: {
      ...plan.settings,
      weekdayMinutes: [...plan.settings.weekdayMinutes],
      restDates: [...plan.settings.restDates],
    },
    overrides: copyOverrides(plan.overrides),
  };
}

function withBuild(state: AppState, patch: Partial<BuildState>): AppState {
  return { ...state, build: { ...state.build, ...patch } };
}

function allowedStages(build: BuildState): readonly BuildStage[] {
  if (build.draft === null) {
    if (build.extracting) return [];
    return build.stage === "url" ? ["type", "url"] : build.stage === "book" ? ["type", "book"] : ["type"];
  }
  return build.editingId === null ? ["edit", "schedule"] : ["edit", "schedule", "adjust"];
}

export function appReducer(state: AppState, action: AppAction): AppState {
  const { build } = state;
  switch (action.type) {
    case "INIT":
      return { ...state, plans: action.plans, menu: action.plans.length > 0 ? "view" : "build" };

    case "NAVIGATE":
      return state.menu === action.menu ? state : { ...state, menu: action.menu };

    case "PICK_SOURCE":
      if (build.stage !== "type") return state;
      return action.source === "course"
        ? withBuild(state, { stage: "url", bookNotice: false })
        : withBuild(state, { stage: "book", bookNotice: false });

    case "BACK_TO_TYPE":
      if (build.extracting || build.draft !== null) return state;
      return withBuild(state, { stage: "type", errorCode: null, dupPlanId: null });

    case "BOOK_SEARCH_START":
      return build.stage === "book" && !build.extracting ? withBuild(state, { extracting: true, errorCode: null, dupPlanId: null }) : state;
    case "BOOK_SEARCH_END":
      return withBuild(state, { extracting: false });
    case "BOOK_SELECTED": {
      if (build.stage !== "book") return state;
      const dup = state.plans.find((p) => p.curriculum.courseId === action.curriculum.courseId);
      if (dup) return withBuild(state, { extracting: false, errorCode: "ALREADY_PLANNED", dupPlanId: dup.id });
      return withBuild(state, { extracting: false, errorCode: null, dupPlanId: null, stage: "edit", draft: { curriculum: action.curriculum, settings: createDefaultSettings(action.today), overrides: {} } });
    }

    case "PICK_SITE":
      return withBuild(state, { site: action.site });

    case "SET_URL":
      if (build.extracting) return state;
      return withBuild(state, { url: action.url, errorCode: null, dupPlanId: null });

    case "FILL_SAMPLE":
      if (build.extracting) return state;
      return withBuild(state, { url: SAMPLE_COURSE_URL, errorCode: null, dupPlanId: null });

    case "SUBMIT_REJECTED":
      return withBuild(state, { errorCode: action.code, dupPlanId: action.dupPlanId ?? null });

    case "EXTRACT_START":
      if (build.extracting) return state;
      return withBuild(state, { extracting: true, errorCode: null, dupPlanId: null });

    case "EXTRACT_FAILURE":
      return withBuild(state, { extracting: false, errorCode: action.code, dupPlanId: null });

    case "EXTRACT_SUCCESS": {
      const dup = state.plans.find((p) => p.curriculum.courseId === action.curriculum.courseId);
      if (dup) {
        return withBuild(state, { extracting: false, errorCode: "ALREADY_PLANNED", dupPlanId: dup.id });
      }
      return withBuild(state, {
        extracting: false,
        errorCode: null,
        dupPlanId: null,
        stage: "edit",
        draft: { curriculum: action.curriculum, settings: createDefaultSettings(action.today), overrides: {} },
      });
    }

    case "GO_STAGE":
      if (action.stage === build.stage || !allowedStages(build).includes(action.stage)) return state;
      return withBuild(state, { stage: action.stage });

    case "DRAFT": {
      if (build.draft === null) return state;
      const draft = draftReducer(build.draft, action.action);
      return draft === build.draft ? state : withBuild(state, { draft });
    }

    case "CREATE_PLAN": {
      const { draft } = build;
      if (draft === null || build.editingId !== null) return state;
      const plan: SavedPlan = {
        id: action.id,
        curriculum: draft.curriculum,
        settings: draft.settings,
        overrides: draft.overrides,
        savedAt: action.savedAt,
      };
      return {
        ...state,
        plans: [...state.plans, plan],
        plansRevision: state.plansRevision + 1,
        menu: "view",
        view: { ...state.view, selected: action.id },
        build: createInitialBuild(),
      };
    }

    case "START_EDIT": {
      const plan = state.plans.find((p) => p.id === action.planId);
      if (!plan) return state;
      return {
        ...state,
        menu: "build",
        build: { ...createInitialBuild(), stage: "adjust", editingId: plan.id, draft: draftFromPlan(plan) },
      };
    }

    case "SAVE_EDIT": {
      const { draft, editingId } = build;
      if (draft === null || editingId === null || !state.plans.some((p) => p.id === editingId)) return state;
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id === editingId
            ? { id: p.id, curriculum: draft.curriculum, settings: draft.settings, overrides: draft.overrides, savedAt: action.savedAt }
            : p,
        ),
        plansRevision: state.plansRevision + 1,
        menu: "view",
        view: { ...state.view, selected: editingId },
        build: createInitialBuild(),
      };
    }

    case "CANCEL_EDIT":
      if (build.editingId === null) return state;
      return { ...state, menu: "view", build: createInitialBuild() };

    case "ASK_RESET":
      return { ...state, confirm: { kind: "reset" } };

    case "ASK_DELETE":
      if (!state.plans.some((p) => p.id === action.planId)) return state;
      return { ...state, confirm: { kind: "delete", planId: action.planId } };

    case "CANCEL_CONFIRM":
      return state.confirm === null ? state : { ...state, confirm: null };

    case "CONFIRM": {
      const { confirm } = state;
      if (confirm === null) return state;
      if (confirm.kind === "reset") return { ...state, confirm: null, build: createInitialBuild() };
      return {
        ...state,
        confirm: null,
        plans: state.plans.filter((p) => p.id !== confirm.planId),
        plansRevision: state.plansRevision + 1,
        view: { ...state.view, selected: "all" },
      };
    }

    case "SELECT_PLAN": {
      const selected = state.plans.some((p) => p.id === action.selected) ? action.selected : "all";
      return { ...state, view: { ...state.view, selected } };
    }

    case "SET_TAB":
      return { ...state, view: { ...state.view, tab: action.tab } };

    case "OPEN_DUP":
      if (build.dupPlanId === null) return state;
      return {
        ...state,
        menu: "view",
        view: {
          ...state.view,
          selected: state.plans.some((p) => p.id === build.dupPlanId) ? build.dupPlanId : "all",
        },
        build: { ...build, errorCode: null, dupPlanId: null },
      };

    default:
      return state;
  }
}
