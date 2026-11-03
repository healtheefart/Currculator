import { describe, expect, it } from "vitest";
import type { Curriculum } from "@/types/curriculum";
import type { SavedPlan } from "@/types/plan";
import { SAMPLE_COURSE_URL } from "@/lib/url-input";
import { appReducer, createInitialState, SITES, type AppAction, type AppState } from "./app-reducer";
import { createDefaultSettings } from "./presets";

const TODAY = "2026-11-03";

function makeCurriculum(courseId: string): Curriculum {
  return {
    title: `강의 ${courseId}`,
    sourceUrl: `https://www.inflearn.com/course/c${courseId}?cid=${courseId}`,
    platform: "inflearn",
    courseId,
    instructor: null,
    droppedCount: 0,
    items: [
      { id: "s1", title: "섹션", level: 0, order: 0, sectionId: null, durationSec: null, source: "origin", excluded: false },
      { id: "u1", title: "수업 1", level: 1, order: 1, sectionId: "s1", durationSec: 600, source: "origin", excluded: false },
      { id: "u2", title: "수업 2", level: 1, order: 2, sectionId: "s1", durationSec: 900, source: "origin", excluded: false },
    ],
  };
}

function makePlan(id: string, courseId: string): SavedPlan {
  return {
    id,
    curriculum: makeCurriculum(courseId),
    settings: createDefaultSettings("2026-11-01"),
    overrides: { u2: "2026-11-05" },
    savedAt: "2026-11-01T00:00:00.000Z",
  };
}

function reduce(state: AppState, ...actions: AppAction[]): AppState {
  return actions.reduce(appReducer, state);
}

const initial = createInitialState();
const withPlans = reduce(initial, { type: "INIT", plans: [makePlan("p1", "100"), makePlan("p2", "200")] });

/** url 단계에서 추출까지 마친 새 계획 상태 */
function extracted(state: AppState = initial, courseId = "300"): AppState {
  return reduce(
    state,
    { type: "PICK_SOURCE", source: "course" },
    { type: "SET_URL", url: "https://www.inflearn.com/course/x" },
    { type: "EXTRACT_START" },
    { type: "EXTRACT_SUCCESS", curriculum: makeCurriculum(courseId), today: TODAY },
  );
}

describe("createInitialState", () => {
  it("초기값", () => {
    expect(initial).toEqual({
      menu: "build",
      plans: [],
      plansRevision: 0,
      build: {
        stage: "type",
        site: "inflearn",
        url: "",
        extracting: false,
        errorCode: null,
        dupPlanId: null,
        bookNotice: false,
        editingId: null,
        draft: null,
      },
      view: { selected: "all", tab: "list" },
      confirm: null,
    });
  });

  it("SITES 순서", () => {
    expect(SITES.map((s) => s.label)).toEqual(["인프런", "YouTube", "패스트캠퍼스", "메가스터디"]);
    expect(SITES.map((s) => s.id)).toEqual(["inflearn", "youtube", "fastcampus", "megastudy"]);
  });
});

describe("INIT / NAVIGATE", () => {
  it("저장본이 있으면 계획확인, plansRevision은 그대로", () => {
    expect(withPlans.menu).toBe("view");
    expect(withPlans.plans.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(withPlans.plansRevision).toBe(0);
  });

  it("저장본이 없으면 계획짜기", () => {
    const s = reduce(initial, { type: "INIT", plans: [] });
    expect(s.menu).toBe("build");
    expect(s.plansRevision).toBe(0);
  });

  it("NAVIGATE는 계획짜기 상태를 유지한다", () => {
    const s = extracted();
    const back = reduce(s, { type: "NAVIGATE", menu: "view" }, { type: "NAVIGATE", menu: "build" });
    expect(back.build).toBe(s.build);
    expect(back.menu).toBe("build");
  });
});

describe("학습 자료·사이트 선택", () => {
  it("PICK_SOURCE course → url, book → book 단계", () => {
    expect(reduce(initial, { type: "PICK_SOURCE", source: "course" }).build.stage).toBe("url");
    const book = reduce(initial, { type: "PICK_SOURCE", source: "book" });
    expect(book.build.stage).toBe("book");
    expect(book.build.bookNotice).toBe(false);
  });

  it.each(["inflearn", "youtube", "fastcampus", "megastudy"] as const)("PICK_SITE: %s를 선택한다", (site) => {
    const s = reduce(initial, { type: "PICK_SOURCE", source: "course" }, { type: "PICK_SITE", site });
    expect(s.build.site).toBe(site);
  });

  it("BACK_TO_TYPE: 오류를 지우고 type으로, 추출 중이면 무시", () => {
    const s = reduce(
      initial,
      { type: "PICK_SOURCE", source: "course" },
      { type: "SUBMIT_REJECTED", code: "INVALID_URL" },
      { type: "BACK_TO_TYPE" },
    );
    expect(s.build.stage).toBe("type");
    expect(s.build.errorCode).toBeNull();

    const busy = reduce(initial, { type: "PICK_SOURCE", source: "course" }, { type: "EXTRACT_START" });
    expect(appReducer(busy, { type: "BACK_TO_TYPE" })).toBe(busy);
  });
});

describe("URL 입력·추출", () => {
  const atUrl = reduce(initial, { type: "PICK_SOURCE", source: "course" });

  it("SET_URL은 오류와 dupPlanId를 지운다", () => {
    const s = reduce(
      withPlans,
      { type: "PICK_SOURCE", source: "course" },
      { type: "SUBMIT_REJECTED", code: "ALREADY_PLANNED", dupPlanId: "p1" },
    );
    expect(s.build.errorCode).toBe("ALREADY_PLANNED");
    expect(s.build.dupPlanId).toBe("p1");
    const t = appReducer(s, { type: "SET_URL", url: "abc" });
    expect(t.build).toMatchObject({ url: "abc", errorCode: null, dupPlanId: null });
  });

  it("FILL_SAMPLE", () => {
    const s = reduce(atUrl, { type: "SUBMIT_REJECTED", code: "INVALID_URL" }, { type: "FILL_SAMPLE" });
    expect(s.build.url).toBe(SAMPLE_COURSE_URL);
    expect(s.build.errorCode).toBeNull();
  });

  it("SUBMIT_REJECTED는 dupPlanId가 없으면 null", () => {
    const s = reduce(atUrl, { type: "SUBMIT_REJECTED", code: "UNSUPPORTED" });
    expect(s.build).toMatchObject({ errorCode: "UNSUPPORTED", dupPlanId: null, extracting: false });
  });

  it("EXTRACT_START: 오류를 지우고 extracting, 중복 시작은 무시", () => {
    const s = reduce(atUrl, { type: "SUBMIT_REJECTED", code: "INVALID_URL" }, { type: "EXTRACT_START" });
    expect(s.build).toMatchObject({ extracting: true, errorCode: null });
    expect(appReducer(s, { type: "EXTRACT_START" })).toBe(s);
  });

  it("EXTRACT_FAILURE: extracting 해제, url 유지", () => {
    const s = reduce(
      atUrl,
      { type: "SET_URL", url: "https://www.inflearn.com/course/x" },
      { type: "EXTRACT_START" },
      { type: "EXTRACT_FAILURE", code: "FETCH_FAILED" },
    );
    expect(s.build).toMatchObject({ extracting: false, errorCode: "FETCH_FAILED", url: "https://www.inflearn.com/course/x", stage: "url" });
  });

  it("EXTRACT_SUCCESS: 기본 설정으로 draft, edit 단계", () => {
    const s = extracted();
    expect(s.build.stage).toBe("edit");
    expect(s.build.extracting).toBe(false);
    expect(s.build.draft).toEqual({
      curriculum: makeCurriculum("300"),
      settings: createDefaultSettings(TODAY),
      overrides: {},
    });
  });

  it("EXTRACT_SUCCESS: 이미 계획한 강의면 ALREADY_PLANNED로 url 단계에 머문다", () => {
    const s = extracted(withPlans, "200");
    expect(s.build).toMatchObject({
      stage: "url",
      extracting: false,
      errorCode: "ALREADY_PLANNED",
      dupPlanId: "p2",
      draft: null,
    });
  });

  it("OPEN_DUP: 기존 계획을 선택한 계획확인", () => {
    const s = appReducer(extracted(withPlans, "200"), { type: "OPEN_DUP" });
    expect(s.menu).toBe("view");
    expect(s.view.selected).toBe("p2");
    expect(s.build.errorCode).toBeNull();
    expect(s.build.dupPlanId).toBeNull();
  });

  it("OPEN_DUP: dupPlanId가 없으면 무시", () => {
    expect(appReducer(atUrl, { type: "OPEN_DUP" })).toBe(atUrl);
  });
});

describe("GO_STAGE", () => {
  it("draft 없음: type 가능, url은 현재 url일 때만, 추출 중이면 무시", () => {
    const atUrl = reduce(initial, { type: "PICK_SOURCE", source: "course" });
    expect(appReducer(atUrl, { type: "GO_STAGE", stage: "type" }).build.stage).toBe("type");
    expect(appReducer(initial, { type: "GO_STAGE", stage: "url" })).toBe(initial);
    expect(appReducer(atUrl, { type: "GO_STAGE", stage: "edit" })).toBe(atUrl);
    const busy = appReducer(atUrl, { type: "EXTRACT_START" });
    expect(appReducer(busy, { type: "GO_STAGE", stage: "type" })).toBe(busy);
  });

  it("새 계획: edit·schedule만", () => {
    const s = extracted();
    expect(appReducer(s, { type: "GO_STAGE", stage: "schedule" }).build.stage).toBe("schedule");
    for (const stage of ["type", "url", "adjust"] as const) {
      expect(appReducer(s, { type: "GO_STAGE", stage })).toBe(s);
    }
  });

  it("수정 중: edit·schedule·adjust만", () => {
    const s = appReducer(withPlans, { type: "START_EDIT", planId: "p1" });
    expect(appReducer(s, { type: "GO_STAGE", stage: "edit" }).build.stage).toBe("edit");
    expect(reduce(s, { type: "GO_STAGE", stage: "edit" }, { type: "GO_STAGE", stage: "adjust" }).build.stage).toBe("adjust");
    for (const stage of ["type", "url"] as const) {
      expect(appReducer(s, { type: "GO_STAGE", stage })).toBe(s);
    }
  });
});

describe("DRAFT", () => {
  it("draft에 위임한다", () => {
    const s = appReducer(extracted(), { type: "DRAFT", action: { type: "SET_TOLERANCE", minutes: 5 } });
    expect(s.build.draft?.settings.toleranceMinutes).toBe(5);
  });

  it("draft가 없거나 변화가 없으면 같은 state", () => {
    expect(appReducer(initial, { type: "DRAFT", action: { type: "RESET_OVERRIDES" } })).toBe(initial);
    const s = extracted();
    expect(appReducer(s, { type: "DRAFT", action: { type: "SET_TOLERANCE", minutes: -1 } })).toBe(s);
  });
});

describe("CREATE_PLAN", () => {
  it("저장 목록 끝에 추가하고 계획확인에서 선택, 계획짜기 초기화", () => {
    const s = reduce(
      extracted(withPlans),
      { type: "DRAFT", action: { type: "REMOVE_ITEM", itemId: "u1" } },
      { type: "CREATE_PLAN", id: "p3", savedAt: "2026-11-03T01:00:00.000Z" },
    );
    expect(s.plans.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(s.plans[2]).toEqual({
      id: "p3",
      curriculum: makeCurriculum("300"),
      settings: createDefaultSettings(TODAY),
      overrides: { u1: null },
      savedAt: "2026-11-03T01:00:00.000Z",
    });
    expect(s.plansRevision).toBe(1);
    expect(s.menu).toBe("view");
    expect(s.view.selected).toBe("p3");
    expect(s.build).toEqual(initial.build);
  });

  it("draft가 없거나 수정 중이면 무시", () => {
    const action: AppAction = { type: "CREATE_PLAN", id: "p9", savedAt: "x" };
    expect(appReducer(initial, action)).toBe(initial);
    const editing = appReducer(withPlans, { type: "START_EDIT", planId: "p1" });
    expect(appReducer(editing, action)).toBe(editing);
  });
});

describe("수정", () => {
  it("START_EDIT: 깊은 복사로 draft, adjust 단계", () => {
    const s = appReducer(withPlans, { type: "START_EDIT", planId: "p1" });
    expect(s.menu).toBe("build");
    expect(s.build).toMatchObject({ stage: "adjust", editingId: "p1" });
    const p1 = withPlans.plans[0];
    const draft = s.build.draft!;
    expect(draft).toEqual({ curriculum: p1.curriculum, settings: p1.settings, overrides: p1.overrides });
    expect(draft.curriculum).not.toBe(p1.curriculum);
    expect(draft.curriculum.items).not.toBe(p1.curriculum.items);
    expect(draft.curriculum.items[1]).not.toBe(p1.curriculum.items[1]);
    expect(draft.settings).not.toBe(p1.settings);
    expect(draft.settings.weekdayMinutes).not.toBe(p1.settings.weekdayMinutes);
    expect(draft.settings.restDates).not.toBe(p1.settings.restDates);
    expect(draft.overrides).not.toBe(p1.overrides);
  });

  it("START_EDIT 없는 id → 무시", () => {
    expect(appReducer(withPlans, { type: "START_EDIT", planId: "nope" })).toBe(withPlans);
  });

  it("SAVE_EDIT: 그 계획만 바꾸고 순서 유지", () => {
    const s = reduce(
      withPlans,
      { type: "START_EDIT", planId: "p1" },
      { type: "DRAFT", action: { type: "EDIT_TITLE", itemId: "u1", title: "바뀐 수업" } },
      { type: "DRAFT", action: { type: "RESET_OVERRIDES" } },
      { type: "SAVE_EDIT", savedAt: "2026-11-03T02:00:00.000Z" },
    );
    expect(s.plans.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(s.plans[0].curriculum.items[1].title).toBe("바뀐 수업");
    expect(s.plans[0].overrides).toEqual({});
    expect(s.plans[0].savedAt).toBe("2026-11-03T02:00:00.000Z");
    expect(s.plans[1]).toBe(withPlans.plans[1]);
    expect(s.plansRevision).toBe(1);
    expect(s.menu).toBe("view");
    expect(s.view.selected).toBe("p1");
    expect(s.build).toEqual(initial.build);
  });

  it("SAVE_EDIT: 수정 중이 아니면 무시", () => {
    const s = extracted(withPlans);
    expect(appReducer(s, { type: "SAVE_EDIT", savedAt: "x" })).toBe(s);
  });

  it("CANCEL_EDIT: 저장본 불변(깊은 복사), 계획확인", () => {
    const snapshot = structuredClone(withPlans.plans);
    const s = reduce(
      withPlans,
      { type: "START_EDIT", planId: "p1" },
      { type: "DRAFT", action: { type: "EDIT_TITLE", itemId: "u1", title: "바뀐 수업" } },
      { type: "DRAFT", action: { type: "EDIT_MINUTES", itemId: "u1", minutes: 99 } },
      { type: "DRAFT", action: { type: "SET_WEEKDAY", weekday: 0, minutes: 0 } },
      { type: "DRAFT", action: { type: "TOGGLE_REST", date: "2026-11-10" } },
      { type: "DRAFT", action: { type: "REMOVE_ITEM", itemId: "u1" } },
      { type: "CANCEL_EDIT" },
    );
    expect(s.plans).toBe(withPlans.plans);
    expect(s.plans).toEqual(snapshot);
    expect(s.plansRevision).toBe(0);
    expect(s.menu).toBe("view");
    expect(s.build).toEqual(initial.build);
  });
});

describe("확인창", () => {
  it("ASK_RESET → CONFIRM: 계획짜기 초기화, menu 유지", () => {
    const s = reduce(extracted(), { type: "ASK_RESET" });
    expect(s.confirm).toEqual({ kind: "reset" });
    const t = appReducer(s, { type: "CONFIRM" });
    expect(t.confirm).toBeNull();
    expect(t.build).toEqual(initial.build);
    expect(t.menu).toBe("build");
    expect(t.plansRevision).toBe(0);
  });

  it("CANCEL_CONFIRM: 그대로", () => {
    const s = extracted();
    const t = reduce(s, { type: "ASK_RESET" }, { type: "CANCEL_CONFIRM" });
    expect(t.confirm).toBeNull();
    expect(t.build).toBe(s.build);
  });

  it("ASK_DELETE → CONFIRM: 삭제, plansRevision+1, 전체 선택", () => {
    const s = reduce(
      withPlans,
      { type: "SELECT_PLAN", selected: "p1" },
      { type: "ASK_DELETE", planId: "p1" },
    );
    expect(s.confirm).toEqual({ kind: "delete", planId: "p1" });
    const t = appReducer(s, { type: "CONFIRM" });
    expect(t.plans.map((p) => p.id)).toEqual(["p2"]);
    expect(t.plansRevision).toBe(1);
    expect(t.view.selected).toBe("all");
    expect(t.confirm).toBeNull();
  });

  it("ASK_DELETE 없는 id·확인창 없을 때 CONFIRM → 무시", () => {
    expect(appReducer(withPlans, { type: "ASK_DELETE", planId: "nope" })).toBe(withPlans);
    expect(appReducer(withPlans, { type: "CONFIRM" })).toBe(withPlans);
  });
});

describe("계획확인", () => {
  it("SELECT_PLAN: 있는 id는 선택, 없는 id는 all", () => {
    expect(appReducer(withPlans, { type: "SELECT_PLAN", selected: "p2" }).view.selected).toBe("p2");
    const s = appReducer(withPlans, { type: "SELECT_PLAN", selected: "p2" });
    expect(appReducer(s, { type: "SELECT_PLAN", selected: "nope" }).view.selected).toBe("all");
    expect(appReducer(s, { type: "SELECT_PLAN", selected: "all" }).view.selected).toBe("all");
  });

  it("SET_TAB: 메뉴를 오가도 유지", () => {
    const s = reduce(
      withPlans,
      { type: "SET_TAB", tab: "calendar" },
      { type: "NAVIGATE", menu: "build" },
      { type: "NAVIGATE", menu: "view" },
    );
    expect(s.view.tab).toBe("calendar");
  });
});

describe("plansRevision", () => {
  it("사용자 동작(계획하기·저장·삭제)에서만 증가한다", () => {
    const actions: AppAction[] = [
      { type: "INIT", plans: [makePlan("p1", "100")] },
      { type: "NAVIGATE", menu: "build" },
      { type: "PICK_SOURCE", source: "course" },
      { type: "SET_URL", url: "x" },
      { type: "EXTRACT_START" },
      { type: "EXTRACT_SUCCESS", curriculum: makeCurriculum("300"), today: TODAY },
      { type: "DRAFT", action: { type: "SET_TOLERANCE", minutes: 5 } },
      { type: "GO_STAGE", stage: "schedule" },
    ];
    let s = reduce(initial, ...actions);
    expect(s.plansRevision).toBe(0);
    s = reduce(s, { type: "CREATE_PLAN", id: "p2", savedAt: "t1" });
    expect(s.plansRevision).toBe(1);
    s = reduce(s, { type: "START_EDIT", planId: "p2" }, { type: "CANCEL_EDIT" });
    expect(s.plansRevision).toBe(1);
    s = reduce(s, { type: "START_EDIT", planId: "p2" }, { type: "SAVE_EDIT", savedAt: "t2" });
    expect(s.plansRevision).toBe(2);
    s = reduce(s, { type: "ASK_DELETE", planId: "p1" }, { type: "CONFIRM" });
    expect(s.plansRevision).toBe(3);
  });
});
