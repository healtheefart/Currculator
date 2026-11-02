import { describe, expect, it } from "vitest";
import { WEEKDAY_LABELS, formatDateLabel, formatMonthDay, formatMonthLabel } from "./date";

describe("date format", () => {
  it("WEEKDAY_LABELS는 일요일부터", () => {
    expect(WEEKDAY_LABELS).toEqual(["일", "월", "화", "수", "목", "금", "토"]);
  });

  it("formatMonthDay", () => {
    expect(formatMonthDay("2026-11-03")).toBe("11월 3일");
    expect(formatMonthDay("2027-01-15")).toBe("1월 15일");
  });

  it("formatDateLabel", () => {
    expect(formatDateLabel("2026-11-03")).toBe("11월 3일 (화)");
    expect(formatDateLabel("2026-11-04")).toBe("11월 4일 (수)");
    expect(formatDateLabel("2026-11-01")).toBe("11월 1일 (일)");
  });

  it("formatMonthLabel", () => {
    expect(formatMonthLabel("2026-11")).toBe("2026년 11월");
    expect(formatMonthLabel("2027-01")).toBe("2027년 1월");
  });
});
