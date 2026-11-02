import type { ClientErrorCode } from "@/types/curriculum";
import type { PlanFailureReason } from "@/types/plan";

/** docs/USER_FLOW.md "오류 문구" 표 그대로 */
export const ERROR_MESSAGES: Record<ClientErrorCode, string> = {
  INVALID_URL: "링크 형식이 올바르지 않아요. 인프런 강의 페이지 주소를 붙여 넣어 주세요.",
  UNSUPPORTED: "지금은 인프런 강의 페이지만 지원해요.",
  NOT_FOUND: "강의를 찾을 수 없어요. 주소를 다시 확인해 주세요.",
  FETCH_FAILED: "강의 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.",
  NO_CURRICULUM: "이 페이지에서 커리큘럼을 찾지 못했어요.",
  ALREADY_PLANNED:
    "이미 계획을 만든 강의예요. 강의 하나에는 계획 하나만 만들 수 있어요. 기존 계획을 수정해 주세요.",
};

/** docs/USER_FLOW.md "계획 실패" 표 그대로 */
export const PLAN_FAILURE_MESSAGES: Record<PlanFailureReason, string> = {
  NO_STUDY_DAYS: "학습할 요일을 하나 이상 정해 주세요.",
  NO_ITEMS: "배정할 수업이 없어요.",
};
