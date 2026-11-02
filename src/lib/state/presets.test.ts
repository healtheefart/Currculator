import { describe, expect, it } from "vitest";
import { createDefaultSettings, matchPreset, PRESET_ORDER, PRESETS } from "./presets";

describe("PRESETS", () => {
  it("화면 표시 순서와 라벨", () => {
    expect(PRESET_ORDER).toEqual(["DAILY_60", "WEEKDAYS_60", "WEEKDAY60_WEEKEND120"]);
    expect(PRESET_ORDER.map((id) => PRESETS[id].label)).toEqual([
      "매일 60분",
      "평일만 60분",
      "평일 60분·주말 120분",
    ]);
  });

  it("요일별 분 값(일~토)", () => {
    expect(PRESETS.DAILY_60.weekdayMinutes).toEqual([60, 60, 60, 60, 60, 60, 60]);
    expect(PRESETS.WEEKDAYS_60.weekdayMinutes).toEqual([0, 60, 60, 60, 60, 60, 0]);
    expect(PRESETS.WEEKDAY60_WEEKEND120.weekdayMinutes).toEqual([120, 60, 60, 60, 60, 60, 120]);
  });
});

describe("createDefaultSettings", () => {
  it("시작일 오늘, 매일 60분, 오차 10, 배수 1.5, 휴식일 없음", () => {
    expect(createDefaultSettings("2026-11-03")).toEqual({
      startDate: "2026-11-03",
      weekdayMinutes: [60, 60, 60, 60, 60, 60, 60],
      toleranceMinutes: 10,
      restDates: [],
      lectureMultiplier: 1.5,
    });
  });

  it("프리셋 배열을 공유하지 않는다", () => {
    const a = createDefaultSettings("2026-11-03");
    a.weekdayMinutes[0] = 0;
    expect(PRESETS.DAILY_60.weekdayMinutes[0]).toBe(60);
    expect(createDefaultSettings("2026-11-03").weekdayMinutes[0]).toBe(60);
  });
});

describe("matchPreset", () => {
  it("같은 값이면 프리셋 id", () => {
    expect(matchPreset([60, 60, 60, 60, 60, 60, 60])).toBe("DAILY_60");
    expect(matchPreset([0, 60, 60, 60, 60, 60, 0])).toBe("WEEKDAYS_60");
    expect(matchPreset([120, 60, 60, 60, 60, 60, 120])).toBe("WEEKDAY60_WEEKEND120");
  });

  it("다르면 null", () => {
    expect(matchPreset([60, 60, 60, 60, 60, 60, 0])).toBeNull();
    expect(matchPreset([0, 0, 0, 0, 0, 0, 0])).toBeNull();
  });
});
