import { describe, expect, it } from "vitest";
import { formatDuration } from "./duration";

describe("formatDuration", () => {
  it("분 단위로 반올림해 표시한다", () => {
    expect(formatDuration(5100)).toBe("1시간 25분");
    expect(formatDuration(2700)).toBe("45분");
    expect(formatDuration(3600)).toBe("1시간");
    expect(formatDuration(0)).toBe("0분");
  });

  it("반올림 경계", () => {
    expect(formatDuration(29)).toBe("0분");
    expect(formatDuration(30)).toBe("1분");
    expect(formatDuration(3570)).toBe("1시간");
    expect(formatDuration(4567.5)).toBe("1시간 16분");
    expect(formatDuration(36000)).toBe("10시간");
  });
});
