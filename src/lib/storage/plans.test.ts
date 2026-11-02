import { describe, expect, it } from "vitest";
import type { SavedPlan } from "@/types/plan";
import { clearPlans, loadPlans, PLANS_KEY, savePlans } from "./plans";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

function throwingStorage(): Storage {
  const fail = () => {
    throw new Error("SecurityError");
  };
  return { length: 0, clear: fail, getItem: fail, key: fail, removeItem: fail, setItem: fail };
}

function makePlan(id: string): SavedPlan {
  return {
    id,
    curriculum: {
      title: "강의",
      sourceUrl: "https://www.inflearn.com/course/x?cid=1",
      platform: "inflearn",
      courseId: "1",
      instructor: "강사",
      droppedCount: 1,
      items: [
        { id: "s1", title: "섹션", level: 0, order: 0, sectionId: null, durationSec: null, source: "origin", excluded: false },
        { id: "u1", title: "수업 1", level: 1, order: 1, sectionId: "s1", durationSec: 600, source: "origin", excluded: false },
        { id: "u2", title: "수업 2", level: 1, order: 2, sectionId: "s1", durationSec: 0, source: "manual", excluded: true },
        { id: "u3", title: "수업 3", level: 1, order: 3, sectionId: "s1", durationSec: null, source: "origin", excluded: false },
      ],
    },
    settings: {
      startDate: "2026-11-03",
      weekdayMinutes: [0, 60, 60, 60, 60, 60, 120],
      toleranceMinutes: 10,
      restDates: ["2026-11-05"],
      lectureMultiplier: 1.5,
    },
    overrides: { u1: "2026-11-04", u3: null },
    savedAt: "2026-11-03T01:00:00.000Z",
  };
}

function storageWith(value: unknown): MemoryStorage {
  const s = new MemoryStorage();
  s.setItem(PLANS_KEY, typeof value === "string" ? value : JSON.stringify(value));
  return s;
}

function rawPlan(id: string): Record<string, unknown> {
  return JSON.parse(JSON.stringify(makePlan(id))) as Record<string, unknown>;
}

describe("savePlans / loadPlans", () => {
  it("키와 형식", () => {
    expect(PLANS_KEY).toBe("currculator:plans:v1");
    const s = new MemoryStorage();
    expect(savePlans([makePlan("a")], s)).toBe(true);
    expect(JSON.parse(s.getItem(PLANS_KEY)!)).toEqual({ version: 1, plans: [makePlan("a")] });
  });

  it("왕복", () => {
    const s = new MemoryStorage();
    savePlans([makePlan("a"), makePlan("b")], s);
    expect(loadPlans(s)).toEqual([makePlan("a"), makePlan("b")]);
  });

  it("저장본이 없으면 빈 목록", () => {
    expect(loadPlans(new MemoryStorage())).toEqual([]);
  });

  it.each([
    ["깨진 JSON", "{not json"],
    ["version 2", { version: 2, plans: [makePlan("a")] }],
    ["plans가 배열 아님", { version: 1, plans: {} }],
    ["null", "null"],
    ["배열", "[]"],
  ])("%s → 빈 목록", (_, value) => {
    expect(loadPlans(storageWith(value))).toEqual([]);
  });

  it("계획 하나만 잘못되면 그것만 버린다", () => {
    const bad = rawPlan("bad");
    (bad.curriculum as Record<string, unknown>).platform = "udemy";
    expect(loadPlans(storageWith({ version: 1, plans: [rawPlan("a"), bad, rawPlan("b"), 42, null] }))).toEqual([
      makePlan("a"),
      makePlan("b"),
    ]);
  });

  it("id 중복이면 뒤의 것을 버린다", () => {
    const second = rawPlan("a");
    second.savedAt = "later";
    const plans = loadPlans(storageWith({ version: 1, plans: [rawPlan("a"), second] }));
    expect(plans).toHaveLength(1);
    expect(plans[0].savedAt).toBe("2026-11-03T01:00:00.000Z");
  });

  type Mutator = (p: Record<string, any>) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  it.each<[string, Mutator]>([
    ["빈 id", (p) => (p.id = "")],
    ["savedAt 숫자", (p) => (p.savedAt = 1)],
    ["title 없음", (p) => delete p.curriculum.title],
    ["courseId 숫자", (p) => (p.curriculum.courseId = 1)],
    ["instructor 숫자", (p) => (p.curriculum.instructor = 3)],
    ["droppedCount 음수", (p) => (p.curriculum.droppedCount = -1)],
    ["droppedCount 소수", (p) => (p.curriculum.droppedCount = 1.5)],
    ["items 배열 아님", (p) => (p.curriculum.items = {})],
    ["item level 2", (p) => (p.curriculum.items[1].level = 2)],
    ["item durationSec 음수", (p) => (p.curriculum.items[1].durationSec = -5)],
    ["item durationSec 문자열", (p) => (p.curriculum.items[1].durationSec = "600")],
    ["item source 이상", (p) => (p.curriculum.items[1].source = "x")],
    ["item excluded 문자열", (p) => (p.curriculum.items[1].excluded = "true")],
    ["item sectionId 숫자", (p) => (p.curriculum.items[1].sectionId = 1)],
    ["item order 문자열", (p) => (p.curriculum.items[1].order = "1")],
    ["item id 숫자", (p) => (p.curriculum.items[1].id = 1)],
    ["startDate 형식", (p) => (p.settings.startDate = "2026/11/03")],
    ["weekdayMinutes 길이 6", (p) => (p.settings.weekdayMinutes = [60, 60, 60, 60, 60, 60])],
    ["weekdayMinutes 1441", (p) => (p.settings.weekdayMinutes[0] = 1441)],
    ["weekdayMinutes 소수", (p) => (p.settings.weekdayMinutes[0] = 1.5)],
    ["tolerance 범위 밖", (p) => (p.settings.toleranceMinutes = 1441)],
    ["multiplier 범위 밖", (p) => (p.settings.lectureMultiplier = 6)],
    ["multiplier 문자열", (p) => (p.settings.lectureMultiplier = "1.5")],
    ["restDates 잘못된 날짜", (p) => (p.settings.restDates = ["2026-02-30"])],
    ["restDates 배열 아님", (p) => (p.settings.restDates = "2026-11-05")],
    ["overrides 값 오류", (p) => (p.overrides.u1 = "tomorrow")],
    ["overrides 값 숫자", (p) => (p.overrides.u1 = 1)],
    ["overrides 배열", (p) => (p.overrides = [])],
    ["overrides null", (p) => (p.overrides = null)],
    ["settings 없음", (p) => delete p.settings],
  ])("%s → 그 계획 버림", (_, mutate) => {
    const bad = rawPlan("bad");
    mutate(bad);
    expect(loadPlans(storageWith({ version: 1, plans: [bad, rawPlan("ok")] }))).toEqual([makePlan("ok")]);
  });

  it("추가 키는 버리고 새 객체로 다시 만든다", () => {
    const raw = rawPlan("a");
    raw.extra = "x";
    (raw.curriculum as Record<string, unknown>).extra = 1;
    ((raw.curriculum as { items: Record<string, unknown>[] }).items[1]).extra = true;
    (raw.settings as Record<string, unknown>).extra = [];
    const json = JSON.stringify({ version: 1, plans: [raw] }).replace('"extra":"x"', '"extra":"x","__proto__":{"polluted":true}');
    const [plan] = loadPlans(storageWith(json));
    expect(plan).toEqual(makePlan("a"));
    expect(Object.keys(plan).sort()).toEqual(["curriculum", "id", "overrides", "savedAt", "settings"]);
    expect(Object.getPrototypeOf(plan)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((plan as unknown as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("overrides의 __proto__ 키도 자기 속성으로만 남는다", () => {
    const json = JSON.stringify({ version: 1, plans: [rawPlan("a")] }).replace(
      '"overrides":{',
      '"overrides":{"__proto__":null,',
    );
    const [plan] = loadPlans(storageWith(json));
    expect(Object.getPrototypeOf(plan.overrides)).toBe(Object.prototype);
    expect(Object.hasOwn(plan.overrides, "__proto__")).toBe(true);
    expect(plan.overrides.u1).toBe("2026-11-04");
  });

  it("이전 키 currculator:draft:v1은 읽지 않는다", () => {
    const s = new MemoryStorage();
    s.setItem("currculator:draft:v1", JSON.stringify({ version: 1, plans: [makePlan("a")] }));
    expect(loadPlans(s)).toEqual([]);
  });

  it("storage가 throw해도 예외를 던지지 않는다", () => {
    const s = throwingStorage();
    expect(loadPlans(s)).toEqual([]);
    expect(savePlans([makePlan("a")], s)).toBe(false);
    expect(() => clearPlans(s)).not.toThrow();
  });

  it("storage null이면 저장 없이 동작", () => {
    expect(loadPlans(null)).toEqual([]);
    expect(savePlans([makePlan("a")], null)).toBe(false);
    expect(() => clearPlans(null)).not.toThrow();
  });

  it("기본값은 globalThis.localStorage", () => {
    localStorage.clear();
    expect(savePlans([makePlan("a")])).toBe(true);
    expect(loadPlans()).toEqual([makePlan("a")]);
    clearPlans();
    expect(localStorage.getItem(PLANS_KEY)).toBeNull();
  });
});

describe("clearPlans", () => {
  it("키를 지운다", () => {
    const s = new MemoryStorage();
    savePlans([makePlan("a")], s);
    s.setItem("other", "1");
    clearPlans(s);
    expect(s.getItem(PLANS_KEY)).toBeNull();
    expect(s.getItem("other")).toBe("1");
  });
});
