import { describe, expect, it } from "vitest";
import type { Curriculum } from "@/types/curriculum";
import { draftReducer, type DraftAction, type PlanDraft } from "./draft-reducer";
import { createDefaultSettings } from "./presets";

function makeCurriculum(): Curriculum {
  return {
    title: "강의",
    sourceUrl: "https://www.inflearn.com/course/x?cid=1",
    platform: "inflearn",
    courseId: "1",
    instructor: "강사",
    droppedCount: 0,
    items: [
      { id: "s1", title: "섹션 1", level: 0, order: 0, sectionId: null, durationSec: null, source: "origin", excluded: false },
      { id: "u1", title: "수업 1", level: 1, order: 1, sectionId: "s1", durationSec: 600, source: "origin", excluded: false },
      { id: "u2", title: "수업 2", level: 1, order: 2, sectionId: "s1", durationSec: null, source: "origin", excluded: false },
    ],
  };
}

function makeDraft(): PlanDraft {
  return { curriculum: makeCurriculum(), settings: createDefaultSettings("2026-11-03"), overrides: {} };
}

function freeze(draft: PlanDraft): PlanDraft {
  // 입력을 변경하면 예외가 나도록 깊게 얼린다
  const deep = (v: unknown): void => {
    if (v && typeof v === "object") {
      Object.freeze(v);
      Object.values(v).forEach(deep);
    }
  };
  deep(draft);
  return draft;
}

function run(action: DraftAction, draft: PlanDraft = makeDraft()): { before: PlanDraft; after: PlanDraft } {
  const before = freeze(draft);
  return { before, after: draftReducer(before, action) };
}

const item = (d: PlanDraft, id: string) => d.curriculum.items.find((i) => i.id === id)!;

describe("EDIT_TITLE", () => {
  it("trim해서 저장한다(불변)", () => {
    const { before, after } = run({ type: "EDIT_TITLE", itemId: "u1", title: "  새 제목 " });
    expect(item(after, "u1").title).toBe("새 제목");
    expect(item(before, "u1").title).toBe("수업 1");
    expect(after).not.toBe(before);
  });

  it("섹션 제목도 바꿀 수 있다", () => {
    const { after } = run({ type: "EDIT_TITLE", itemId: "s1", title: "섹션 A" });
    expect(item(after, "s1").title).toBe("섹션 A");
  });

  it.each(["", "   "])("빈 제목 %j → 같은 객체", (title) => {
    const { before, after } = run({ type: "EDIT_TITLE", itemId: "u1", title });
    expect(after).toBe(before);
  });

  it("없는 itemId → 같은 객체", () => {
    const { before, after } = run({ type: "EDIT_TITLE", itemId: "nope", title: "x" });
    expect(after).toBe(before);
  });
});

describe("EDIT_MINUTES", () => {
  it("durationSec = 분×60, source manual", () => {
    const { after } = run({ type: "EDIT_MINUTES", itemId: "u2", minutes: 12 });
    expect(item(after, "u2")).toMatchObject({ durationSec: 720, source: "manual" });
  });

  it("0분과 1440분 허용", () => {
    expect(item(run({ type: "EDIT_MINUTES", itemId: "u1", minutes: 0 }).after, "u1").durationSec).toBe(0);
    expect(item(run({ type: "EDIT_MINUTES", itemId: "u1", minutes: 1440 }).after, "u1").durationSec).toBe(86400);
  });

  it.each([-1, 1441, 1.5, Number.NaN])("잘못된 분 %d → 같은 객체", (minutes) => {
    const { before, after } = run({ type: "EDIT_MINUTES", itemId: "u1", minutes });
    expect(after).toBe(before);
  });

  it("섹션·없는 id → 같은 객체", () => {
    for (const itemId of ["s1", "nope"]) {
      const { before, after } = run({ type: "EDIT_MINUTES", itemId, minutes: 10 });
      expect(after).toBe(before);
    }
  });
});

describe("TOGGLE_EXCLUDE", () => {
  it("제외·포함을 번갈아 바꾼다", () => {
    const once = run({ type: "TOGGLE_EXCLUDE", itemId: "u1" }).after;
    expect(item(once, "u1").excluded).toBe(true);
    const twice = draftReducer(once, { type: "TOGGLE_EXCLUDE", itemId: "u1" });
    expect(item(twice, "u1").excluded).toBe(false);
  });

  it("섹션·없는 id → 같은 객체", () => {
    for (const itemId of ["s1", "nope"]) {
      const { before, after } = run({ type: "TOGGLE_EXCLUDE", itemId });
      expect(after).toBe(before);
    }
  });
});

describe("설정", () => {
  it("SET_WEEKDAY", () => {
    const { before, after } = run({ type: "SET_WEEKDAY", weekday: 0, minutes: 0 });
    expect(after.settings.weekdayMinutes).toEqual([0, 60, 60, 60, 60, 60, 60]);
    expect(before.settings.weekdayMinutes[0]).toBe(60);
  });

  it.each([
    [-1, 30],
    [7, 30],
    [1.5, 30],
    [1, -1],
    [1, 1441],
    [1, 2.5],
  ])("SET_WEEKDAY 잘못된 값 (%d, %d) → 같은 객체", (weekday, minutes) => {
    const { before, after } = run({ type: "SET_WEEKDAY", weekday, minutes });
    expect(after).toBe(before);
  });

  it("APPLY_PRESET", () => {
    const { after } = run({ type: "APPLY_PRESET", preset: "WEEKDAYS_60" });
    expect(after.settings.weekdayMinutes).toEqual([0, 60, 60, 60, 60, 60, 0]);
    // 프리셋 배열을 공유하지 않는다
    const again = draftReducer(after, { type: "SET_WEEKDAY", weekday: 1, minutes: 30 });
    expect(after.settings.weekdayMinutes[1]).toBe(60);
    expect(again.settings.weekdayMinutes[1]).toBe(30);
  });

  it("APPLY_PRESET 없는 프리셋 → 같은 객체", () => {
    const { before, after } = run({ type: "APPLY_PRESET", preset: "NOPE" as never });
    expect(after).toBe(before);
  });

  it("SET_TOLERANCE", () => {
    expect(run({ type: "SET_TOLERANCE", minutes: 0 }).after.settings.toleranceMinutes).toBe(0);
    expect(run({ type: "SET_TOLERANCE", minutes: 1440 }).after.settings.toleranceMinutes).toBe(1440);
    for (const minutes of [-1, 1441, 2.5]) {
      const { before, after } = run({ type: "SET_TOLERANCE", minutes });
      expect(after).toBe(before);
    }
  });

  it("SET_MULTIPLIER", () => {
    expect(run({ type: "SET_MULTIPLIER", value: 0.5 }).after.settings.lectureMultiplier).toBe(0.5);
    expect(run({ type: "SET_MULTIPLIER", value: 5 }).after.settings.lectureMultiplier).toBe(5);
    for (const value of [0.4, 5.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { before, after } = run({ type: "SET_MULTIPLIER", value });
      expect(after).toBe(before);
    }
  });

  it("SET_START", () => {
    expect(run({ type: "SET_START", date: "2026-12-01" }).after.settings.startDate).toBe("2026-12-01");
    for (const date of ["2026-02-30", "2026-1-1", ""]) {
      const { before, after } = run({ type: "SET_START", date });
      expect(after).toBe(before);
    }
  });
});

describe("휴식일", () => {
  it("TOGGLE_REST: 추가는 오름차순, 다시 누르면 삭제", () => {
    let d = run({ type: "TOGGLE_REST", date: "2026-11-10" }).after;
    d = draftReducer(d, { type: "TOGGLE_REST", date: "2026-11-05" });
    expect(d.settings.restDates).toEqual(["2026-11-05", "2026-11-10"]);
    d = draftReducer(d, { type: "TOGGLE_REST", date: "2026-11-10" });
    expect(d.settings.restDates).toEqual(["2026-11-05"]);
  });

  it("TOGGLE_REST 잘못된 날짜 → 같은 객체", () => {
    const { before, after } = run({ type: "TOGGLE_REST", date: "2026-13-01" });
    expect(after).toBe(before);
  });

  it("REMOVE_REST: 있으면 삭제, 없으면 같은 객체", () => {
    const d = run({ type: "TOGGLE_REST", date: "2026-11-05" }).after;
    expect(draftReducer(d, { type: "REMOVE_REST", date: "2026-11-05" }).settings.restDates).toEqual([]);
    expect(draftReducer(d, { type: "REMOVE_REST", date: "2026-11-06" })).toBe(d);
  });
});

describe("직접 조정", () => {
  it("MOVE_ITEM: 다른 날이면 기록, 원래 날짜면 기록 삭제", () => {
    const moved = run({ type: "MOVE_ITEM", itemId: "u1", date: "2026-11-05", baseDate: "2026-11-03" }).after;
    expect(moved.overrides).toEqual({ u1: "2026-11-05" });
    const back = draftReducer(moved, { type: "MOVE_ITEM", itemId: "u1", date: "2026-11-03", baseDate: "2026-11-03" });
    expect(back.overrides).toEqual({});
    expect(moved.overrides).toEqual({ u1: "2026-11-05" });
  });

  it("MOVE_ITEM baseDate null이면 기록", () => {
    expect(run({ type: "MOVE_ITEM", itemId: "u1", date: "2026-11-05", baseDate: null }).after.overrides).toEqual({
      u1: "2026-11-05",
    });
  });

  it("MOVE_ITEM: 원래 날짜로 옮겼는데 기록이 없으면 같은 객체", () => {
    const { before, after } = run({ type: "MOVE_ITEM", itemId: "u1", date: "2026-11-03", baseDate: "2026-11-03" });
    expect(after).toBe(before);
  });

  it("MOVE_ITEM 잘못된 날짜·섹션·없는 id → 같은 객체", () => {
    const cases: DraftAction[] = [
      { type: "MOVE_ITEM", itemId: "u1", date: "nope", baseDate: null },
      { type: "MOVE_ITEM", itemId: "s1", date: "2026-11-05", baseDate: null },
      { type: "MOVE_ITEM", itemId: "x", date: "2026-11-05", baseDate: null },
    ];
    for (const action of cases) {
      const { before, after } = run(action);
      expect(after).toBe(before);
    }
  });

  it("REMOVE_ITEM → null, RESTORE_ITEM → 기록 삭제", () => {
    const removed = run({ type: "REMOVE_ITEM", itemId: "u1" }).after;
    expect(removed.overrides).toEqual({ u1: null });
    const restored = draftReducer(removed, { type: "RESTORE_ITEM", itemId: "u1" });
    expect(restored.overrides).toEqual({});
    expect(Object.hasOwn(restored.overrides, "u1")).toBe(false);
  });

  it("REMOVE_ITEM 섹션·없는 id → 같은 객체, RESTORE_ITEM 기록 없음 → 같은 객체", () => {
    for (const action of [
      { type: "REMOVE_ITEM", itemId: "s1" },
      { type: "REMOVE_ITEM", itemId: "x" },
      { type: "RESTORE_ITEM", itemId: "u1" },
    ] as DraftAction[]) {
      const { before, after } = run(action);
      expect(after).toBe(before);
    }
  });

  it("RESET_OVERRIDES: 모두 지움, 이미 비어 있으면 같은 객체", () => {
    const d = draftReducer(run({ type: "REMOVE_ITEM", itemId: "u1" }).after, {
      type: "MOVE_ITEM",
      itemId: "u2",
      date: "2026-11-09",
      baseDate: null,
    });
    expect(draftReducer(d, { type: "RESET_OVERRIDES" }).overrides).toEqual({});
    const { before, after } = run({ type: "RESET_OVERRIDES" });
    expect(after).toBe(before);
  });

  it("__proto__ 같은 id도 일반 키로 다룬다", () => {
    const draft = makeDraft();
    draft.curriculum.items.push({
      id: "__proto__",
      title: "x",
      level: 1,
      order: 3,
      sectionId: "s1",
      durationSec: 60,
      source: "origin",
      excluded: false,
    });
    const after = draftReducer(draft, { type: "REMOVE_ITEM", itemId: "__proto__" });
    expect(Object.hasOwn(after.overrides, "__proto__")).toBe(true);
    expect(after.overrides["__proto__"]).toBeNull();
  });
});
