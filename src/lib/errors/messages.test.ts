import { describe, expect, it } from "vitest";
import { ERROR_MESSAGES, PLAN_FAILURE_MESSAGES } from "./messages";

describe("ERROR_MESSAGES", () => {
  it("모든 코드에 비어 있지 않은 문구가 있다", () => {
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual(
      ["ALREADY_PLANNED", "FETCH_FAILED", "INVALID_URL", "NOT_FOUND", "NO_CURRICULUM", "UNSUPPORTED"].sort(),
    );
    Object.values(ERROR_MESSAGES).forEach((m) => expect(m.trim()).not.toBe(""));
  });

  it("USER_FLOW 오류 문구 표와 글자가 같다", () => {
    expect(ERROR_MESSAGES).toEqual({
      INVALID_URL: "링크 형식이 올바르지 않아요. 강의나 재생목록 주소를 붙여 넣어 주세요.",
      UNSUPPORTED: "지금은 인프런·패스트캠퍼스·메가스터디 강의와 YouTube 재생목록만 지원해요.",
      NOT_FOUND: "강의 또는 재생목록을 찾을 수 없어요. 주소를 다시 확인해 주세요.",
      FETCH_FAILED: "강의 또는 재생목록 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.",
      NO_CURRICULUM: "이 주소에서 커리큘럼을 찾지 못했어요.",
      ALREADY_PLANNED:
        "이미 계획을 만든 강의예요. 강의 하나에는 계획 하나만 만들 수 있어요. 기존 계획을 수정해 주세요.",
    });
  });
});

describe("PLAN_FAILURE_MESSAGES", () => {
  it("USER_FLOW 계획 실패 표와 글자가 같다", () => {
    expect(PLAN_FAILURE_MESSAGES).toEqual({
      NO_STUDY_DAYS: "학습할 요일을 하나 이상 정해 주세요.",
      NO_ITEMS: "배정할 수업이 없어요.",
    });
  });
});
