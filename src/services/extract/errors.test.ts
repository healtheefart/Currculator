// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ExtractError } from "./errors";

describe("ExtractError", () => {
  it("오류 코드를 담고 Error를 상속한다", () => {
    const err = new ExtractError("NOT_FOUND");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ExtractError);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.name).toBe("ExtractError");
    expect(err.message).toBe("NOT_FOUND");
  });

  it("메시지를 따로 줄 수 있다", () => {
    const err = new ExtractError("FETCH_FAILED", "HTTP 500");
    expect(err.code).toBe("FETCH_FAILED");
    expect(err.message).toBe("HTTP 500");
  });
});
