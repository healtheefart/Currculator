import { join } from "node:path";
import { ExtractError } from "@/services/extract/errors";
import { createFixtureFetch } from "@/services/extract/fixture-fetch";
import { fetchFastcampusCurriculum } from "@/services/extract/fastcampus";
import { fetchInflearnCurriculum } from "@/services/extract/inflearn";
import { fetchMegastudyCurriculum } from "@/services/extract/megastudy";
import {
  FASTCAMPUS_HOSTS,
  INFLEARN_SITE_HOSTS,
  MEGASTUDY_HOSTS,
  YOUTUBE_HOSTS,
  normalizeInputUrl,
} from "@/services/extract/url";
import { fetchYouTubePlaylist } from "@/services/extract/youtube";
import type { Curriculum } from "@/types/curriculum";
import type { ExtractErrorCode, ExtractResponse } from "@/types/curriculum";

export const runtime = "nodejs";

const STATUS: Record<ExtractErrorCode, number> = {
  INVALID_URL: 400,
  UNSUPPORTED: 422,
  NOT_FOUND: 404,
  NO_CURRICULUM: 422,
  FETCH_FAILED: 502,
};

function respond(body: ExtractResponse, status: number): Response {
  return Response.json(body, { status });
}

function fail(code: ExtractErrorCode): Response {
  return respond({ ok: false, code }, STATUS[code]);
}

function pickFetch(): typeof fetch {
  if (process.env.EXTRACT_FIXTURES === "1") {
    return createFixtureFetch(join(process.cwd(), "tests", "fixtures"));
  }
  return fetch;
}

/** hostname 정확 일치로 추출기를 고른다. 맡는 플랫폼이 없으면 null(요청하지 않음). */
function extract(url: URL, fetchImpl: typeof fetch): Promise<Curriculum> | null {
  const host = url.hostname;
  if (INFLEARN_SITE_HOSTS.includes(host)) return fetchInflearnCurriculum(url, fetchImpl);
  if (YOUTUBE_HOSTS.includes(host)) return fetchYouTubePlaylist(url, fetchImpl);
  if (FASTCAMPUS_HOSTS.includes(host)) return fetchFastcampusCurriculum(url, fetchImpl);
  if (MEGASTUDY_HOSTS.includes(host)) return fetchMegastudyCurriculum(url, fetchImpl);
  return null;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("INVALID_URL");
  }
  const raw =
    typeof body === "object" && body !== null ? (body as Record<string, unknown>).url : undefined;
  if (typeof raw !== "string") return fail("INVALID_URL");

  const url = normalizeInputUrl(raw);
  if (url === null) return fail("INVALID_URL");

  try {
    const pending = extract(url, pickFetch());
    if (pending === null) return fail("UNSUPPORTED");
    const curriculum = await pending;
    return respond({ ok: true, curriculum }, 200);
  } catch (err) {
    // 상세(원인·stack)는 서버 로그에만 남기고 응답에는 code만 넣는다
    console.error("[api/extract]", url.href, err);
    if (err instanceof ExtractError) return fail(err.code);
    return fail("FETCH_FAILED");
  }
}
