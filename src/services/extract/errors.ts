import type { ExtractErrorCode } from "@/types/curriculum";

/** 추출 실패. code는 그대로 API 응답의 오류 코드가 된다. */
export class ExtractError extends Error {
  constructor(
    public readonly code: ExtractErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ExtractError";
  }
}
