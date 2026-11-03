import { ExtractError } from "./errors";
import { FETCH_TIMEOUT_MS, FETCH_USER_AGENT, MAX_REDIRECTS } from "./inflearn";

export interface FetchPageOptions {
  /** 요청 직전마다 호출한다(첫 URL과 모든 리다이렉트 대상). false면 요청하지 않고 UNSUPPORTED */
  isRequestable: (url: URL) => boolean;
  fetchImpl?: typeof fetch;
  /** 본문 디코딩. 기본 utf-8 */
  encoding?: "utf-8" | "euc-kr";
  /** 기본 "ko" */
  acceptLanguage?: string;
}

export interface FetchedPage {
  html: string;
  finalUrl: URL;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function discardBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // 본문 정리 실패는 무시한다
  }
}

/** 허용 URL만 요청하고, 리다이렉트는 대상마다 요청 전에 검사하며 수동으로 따라간다. */
export async function fetchPage(url: URL, options: FetchPageOptions): Promise<FetchedPage> {
  const { isRequestable, fetchImpl = fetch, encoding = "utf-8", acceptLanguage = "ko" } = options;
  if (!isRequestable(url)) throw new ExtractError("UNSUPPORTED");

  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS); // 모든 홉이 공유한다
  const init: RequestInit = {
    headers: { "User-Agent": FETCH_USER_AGENT, "Accept-Language": acceptLanguage },
    redirect: "manual",
    signal,
  };

  let current = url;
  const visited = new Set<string>([current.href]);
  let redirects = 0;

  try {
    for (;;) {
      const res = await fetchImpl(current, init);

      if (REDIRECT_STATUSES.has(res.status)) {
        await discardBody(res);
        if (redirects >= MAX_REDIRECTS) throw new ExtractError("FETCH_FAILED", "too many redirects");
        const location = res.headers.get("Location");
        if (!location) throw new ExtractError("FETCH_FAILED", "missing Location");
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          throw new ExtractError("FETCH_FAILED", "invalid Location");
        }
        if (!isRequestable(next)) throw new ExtractError("UNSUPPORTED");
        if (visited.has(next.href)) throw new ExtractError("FETCH_FAILED", "redirect loop");
        visited.add(next.href);
        redirects += 1;
        current = next;
        continue;
      }

      if (res.status === 404) {
        await discardBody(res);
        throw new ExtractError("NOT_FOUND");
      }
      if (res.status < 200 || res.status > 299) {
        await discardBody(res);
        throw new ExtractError("FETCH_FAILED", `HTTP ${res.status}`);
      }

      const html = new TextDecoder(encoding).decode(await res.arrayBuffer());
      return { html, finalUrl: current };
    }
  } catch (err) {
    if (err instanceof ExtractError) throw err;
    throw new ExtractError("FETCH_FAILED", err instanceof Error ? err.message : String(err));
  }
}
