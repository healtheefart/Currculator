import type { ExtractErrorCode, ExtractResponse } from "@/types/curriculum";

const ERROR_CODES: readonly ExtractErrorCode[] = [
  "INVALID_URL",
  "UNSUPPORTED",
  "NOT_FOUND",
  "FETCH_FAILED",
  "NO_CURRICULUM",
];

const FAILED: ExtractResponse = { ok: false, code: "FETCH_FAILED" };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isExtractResponse(v: unknown): v is ExtractResponse {
  if (!isObj(v)) return false;
  if (v.ok === false) return ERROR_CODES.includes(v.code as ExtractErrorCode);
  if (v.ok !== true) return false;
  const c = v.curriculum;
  return (
    isObj(c) && typeof c.title === "string" && typeof c.courseId === "string" && Array.isArray(c.items)
  );
}

/** 클라이언트 → /api/extract. 실패해도 던지지 않고 오류 응답을 돌려준다. */
export async function extractCurriculum(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExtractResponse> {
  try {
    const res = await fetchImpl("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const json: unknown = await res.json();
    return isExtractResponse(json) ? json : FAILED;
  } catch {
    return FAILED;
  }
}
