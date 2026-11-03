import { describe, expect, it } from "vitest";
import { PLATFORM_LABELS } from "./platform";

describe("PLATFORM_LABELS", () => {
  it("플랫폼마다 표시 이름", () => {
    expect(PLATFORM_LABELS).toEqual({
      inflearn: "인프런",
      youtube: "YouTube",
      fastcampus: "패스트캠퍼스",
      megastudy: "메가스터디",
      book: "책",
    });
  });
});
