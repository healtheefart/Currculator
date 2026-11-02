import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  isValidIsoDate,
  monthCells,
  monthOf,
  toKstIsoDate,
  weekdayOf,
} from "./kst";

describe("toKstIsoDate", () => {
  it("UTC 14:59:59는 같은 날, 15:00:00은 다음 날(KST)", () => {
    expect(toKstIsoDate(new Date("2026-11-02T14:59:59Z"))).toBe("2026-11-02");
    expect(toKstIsoDate(new Date("2026-11-02T15:00:00Z"))).toBe("2026-11-03");
  });

  it("연말 경계", () => {
    expect(toKstIsoDate(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });
});

describe("addDays", () => {
  it("월말·연말·윤년", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("음수와 0", () => {
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-11-03", 0)).toBe("2026-11-03");
    expect(addDays("2026-11-03", 365)).toBe("2027-11-03");
  });
});

describe("weekdayOf", () => {
  it("0 = 일요일", () => {
    expect(weekdayOf("2026-11-02")).toBe(1);
    expect(weekdayOf("2026-11-01")).toBe(0);
    expect(weekdayOf("2026-11-07")).toBe(6);
    expect(weekdayOf("2028-02-29")).toBe(2);
  });
});

describe("isValidIsoDate", () => {
  it("올바른 날짜", () => {
    expect(isValidIsoDate("2026-11-03")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
  });

  it("잘못된 형식·존재하지 않는 날짜", () => {
    expect(isValidIsoDate("2027-02-29")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-11-31")).toBe(false);
    expect(isValidIsoDate("2026-11-00")).toBe(false);
    expect(isValidIsoDate("2026-1-03")).toBe(false);
    expect(isValidIsoDate("2026-11-03T00:00")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate("abcd-ef-gh")).toBe(false);
  });
});

describe("monthOf / addMonths", () => {
  it("monthOf", () => {
    expect(monthOf("2026-11-03")).toBe("2026-11");
  });

  it("연 경계를 넘는다", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", 0)).toBe("2026-11");
    expect(addMonths("2026-11", 14)).toBe("2028-01");
    expect(addMonths("2026-11", -23)).toBe("2024-12");
  });
});

describe("monthCells", () => {
  it("2026-11은 1일이 일요일이라 빈칸 없이 30칸", () => {
    const cells = monthCells("2026-11");
    expect(cells).toHaveLength(30);
    expect(cells[0]).toBe("2026-11-01");
    expect(cells[29]).toBe("2026-11-30");
  });

  it("2026-12는 빈칸 2개(1일 화요일) + 31칸", () => {
    const cells = monthCells("2026-12");
    expect(cells).toHaveLength(33);
    expect(cells.slice(0, 2)).toEqual([null, null]);
    expect(cells[2]).toBe("2026-12-01");
    expect(cells[32]).toBe("2026-12-31");
  });

  it("윤년 2028-02는 29일까지", () => {
    const cells = monthCells("2028-02");
    expect(cells[cells.length - 1]).toBe("2028-02-29");
    expect(cells.filter((c) => c !== null)).toHaveLength(29);
  });
});
