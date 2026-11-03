import type { BookSearchResult } from "@/types/curriculum";

export const runtime = "nodejs";

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(row: Row, key: string): string {
  const value = row[key];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function parseChapters(raw: string, pageCount: number | null): BookSearchResult["chapters"] {
  const lines = raw
    .replace(/<\/?(?:br|p|div|li|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .split(/[\r\n]+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const parsed: { title: string; pageStart: number; explicitEnd: number | null }[] = [];
  for (const line of lines) {
    const page = line.match(/(?:p\.?\s*)?(\d{1,4})(?:\s*[-~–]\s*(\d{1,4}))?\s*$/i);
    if (!page) continue;
    const title = line.slice(0, page.index).replace(/[.·…\-–—\s]+$/, "").trim();
    const pageStart = Number(page[1]);
    if (title.length < 2 || pageStart < 1) continue;
    parsed.push({ title, pageStart, explicitEnd: page[2] ? Number(page[2]) : null });
  }
  return parsed.map((chapter, index) => ({
    title: chapter.title,
    pageStart: chapter.pageStart,
    pageEnd: chapter.explicitEnd ?? Math.max(chapter.pageStart, (parsed[index + 1]?.pageStart ?? pageCount ?? chapter.pageStart + 1) - 1),
  }));
}

function normalizeRow(raw: unknown): BookSearchResult | null {
  if (!isRow(raw)) return null;
  const isbn = text(raw, "EA_ISBN") || text(raw, "ISBN");
  const title = text(raw, "TITLE");
  if (!isbn || !title) return null;
  const pageCountMatch = text(raw, "PAGE").match(/\d+/);
  return {
    isbn,
    title,
    author: text(raw, "AUTHOR"),
    publisher: text(raw, "PUBLISHER"),
    publishDate: text(raw, "PUBLISH_PREDATE"),
    pageCount: pageCountMatch ? Number(pageCountMatch[0]) : null,
    coverUrl: text(raw, "TITLE_URL") || null,
    chapters: parseChapters(text(raw, "BOOK_TB_CNT"), pageCountMatch ? Number(pageCountMatch[0]) : null),
  };
}

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) return Response.json({ error: "검색어를 2자 이상 입력해 주세요." }, { status: 400 });
  const certKey = process.env.NL_API_CERT_KEY;
  if (!certKey) return Response.json({ error: "국립중앙도서관 API 키가 설정되지 않았습니다. NL_API_CERT_KEY를 설정해 주세요." }, { status: 503 });

  const url = new URL("https://www.nl.go.kr/seoji/SearchApi.do");
  const searchParams = new URLSearchParams({ cert_key: certKey, result_style: "json", page_no: "1", page_size: "20" });
  if (/^\d{10,13}$/.test(query.replaceAll("-", ""))) searchParams.set("isbn", query.replaceAll("-", ""));
  else searchParams.set("title", query);
  url.search = searchParams.toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" });
    if (!response.ok) return Response.json({ error: "도서 검색 서비스에 연결하지 못했습니다." }, { status: 502 });
    const payload: unknown = await response.json();
    if (!isRow(payload)) return Response.json({ error: "도서 검색 결과를 읽지 못했습니다." }, { status: 502 });
    const docs = payload.docs;
    const rows = Array.isArray(docs) ? docs : isRow(docs) ? [docs] : [];
    const books = rows.map(normalizeRow).filter((book): book is BookSearchResult => book !== null);
    return Response.json({ books });
  } catch {
    return Response.json({ error: "도서 검색 서비스에 연결하지 못했습니다." }, { status: 502 });
  }
}
