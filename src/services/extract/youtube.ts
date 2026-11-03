import type { Curriculum, CurriculumItem } from "@/types/curriculum";
import { ExtractError } from "./errors";
import { isAllowedHost, isYouTubePlaylistUrl } from "./url";

const FETCH_TIMEOUT_MS = 30_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const DEFAULT_TITLE = "YouTube 재생목록";
type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") return decodeText(value);
  if (!isObj(value)) return null;
  if (typeof value.content === "string") return decodeText(value.content);
  if (typeof value.simpleText === "string") return decodeText(value.simpleText);
  if (Array.isArray(value.runs)) {
    const text = value.runs.map((run) => (isObj(run) && typeof run.text === "string" ? decodeText(run.text) : "")).join("");
    return text || null;
  }
  return null;
}

function extractJsonAssignment(html: string, name: string): unknown {
  const assignment = new RegExp(`(?:var\\s+)?${name}\\s*=\\s*`, "g");
  const match = assignment.exec(html);
  if (!match) return null;
  const start = assignment.lastIndex;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, index + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function durationOf(value: unknown): number | null {
  const text = textOf(value);
  if (!text || !/^\d{1,3}:\d{2}(?::\d{2})?$/.test(text)) return null;
  const parts = text.split(":").map(Number);
  const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  return seconds > 0 ? seconds : null;
}

function findDuration(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findDuration(item);
      if (result !== null) return result;
    }
    return null;
  }
  const direct = durationOf(value);
  if (direct !== null) return direct;
  if (isObj(value)) {
    for (const nested of Object.values(value)) {
      const result = findDuration(nested);
      if (result !== null) return result;
    }
  }
  return null;
}

interface ParsedVideo {
  videoId: string;
  title: string;
  durationSec: number | null;
}

interface ParsedPlaylistPage {
  title: string | null;
  owner: string | null;
  videos: ParsedVideo[];
  unavailableCount: number;
  continuationToken: string | null;
}

function parseYouTubePlaylistData(data: unknown): ParsedPlaylistPage {
  if (!isObj(data)) throw new ExtractError("NO_CURRICULUM", "ytInitialData not found");
  let title: string | null = null;
  let owner: string | null = null;
  let unavailableCount = 0;
  let continuationToken: string | null = null;
  const videos: ParsedVideo[] = [];

  function visit(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isObj(value)) return;
    const metadata = value.playlistMetadataRenderer;
    if (isObj(metadata)) {
      title = textOf(metadata.title) ?? title;
      owner = textOf(metadata.owner) ?? owner;
    }
    const renderer = value.playlistVideoRenderer;
    if (isObj(renderer)) {
      const videoId = typeof renderer.videoId === "string" ? renderer.videoId : "";
      const videoTitle = textOf(renderer.title)?.trim() ?? "";
      if (!videoId || !videoTitle || renderer.isPlayable === false) unavailableCount += 1;
      else videos.push({ videoId, title: videoTitle, durationSec: durationOf(renderer.lengthText) });
    }
    const lockup = value.lockupViewModel;
    if (isObj(lockup) && lockup.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
      const videoId = typeof lockup.contentId === "string" ? lockup.contentId : "";
      const metadata = isObj(lockup.metadata) ? lockup.metadata.lockupMetadataViewModel : null;
      const title = isObj(metadata) ? textOf(metadata.title)?.trim() ?? "" : "";
      if (!videoId || !title) unavailableCount += 1;
      else videos.push({ videoId, title, durationSec: findDuration(lockup.contentImage) });
    }
    const continuation = value.continuationItemRenderer;
    const endpoint = isObj(continuation) ? continuation.continuationEndpoint : null;
    const command = isObj(endpoint) ? endpoint.continuationCommand : null;
    if (isObj(command) && typeof command.token === "string") continuationToken = command.token;
    Object.values(value).forEach(visit);
  }
  visit(data);
  return { title, owner, videos, unavailableCount, continuationToken };
}

export function parseYouTubePlaylistHtml(html: string): ParsedPlaylistPage {
  return parseYouTubePlaylistData(extractJsonAssignment(html, "ytInitialData"));
}

function objectAfterMarker(html: string, marker: string): unknown {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = html.indexOf("{", markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, index + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function toYouTubeCurriculum(
  pages: ParsedPlaylistPage[],
  sourceUrl: string,
  playlistId: string,
): Curriculum {
  const videos = pages.flatMap((page) => page.videos);
  if (videos.length === 0) throw new ExtractError("NO_CURRICULUM", "playlist videos not found");
  const title = pages.map((page) => page.title?.trim()).find((candidate) => candidate) ?? DEFAULT_TITLE;
  const owner = pages.map((page) => page.owner?.trim()).find((candidate) => candidate) ?? null;
  const sectionId = `youtube-playlist:${playlistId}`;
  const items: CurriculumItem[] = [
    { id: sectionId, title, level: 0, order: 0, sectionId: null, durationSec: null, source: "origin", excluded: false },
    ...videos.map((video, index): CurriculumItem => ({
      id: `youtube-video:${video.videoId}:${index}`,
      title: video.title,
      level: 1,
      order: index + 1,
      sectionId,
      durationSec: video.durationSec,
      source: "origin",
      excluded: false,
    })),
  ];
  return {
    title,
    sourceUrl,
    platform: "youtube",
    courseId: `youtube:${playlistId}`,
    instructor: owner,
    droppedCount: pages.reduce((sum, page) => sum + page.unavailableCount, 0),
    items,
  };
}

export async function fetchYouTubePlaylist(url: URL, fetchImpl: typeof fetch = fetch): Promise<Curriculum> {
  if (!isAllowedHost(url) || !isYouTubePlaylistUrl(url)) throw new ExtractError("UNSUPPORTED");
  const playlistId = url.searchParams.get("list")!;
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko" },
      redirect: "manual",
      signal,
    });
    if (response.status === 404) throw new ExtractError("NOT_FOUND");
    if (response.status >= 300 && response.status < 400) throw new ExtractError("FETCH_FAILED", "unexpected redirect");
    if (!response.ok) throw new ExtractError("FETCH_FAILED", `HTTP ${response.status}`);
    const html = await response.text();
    const page = parseYouTubePlaylistHtml(html);
    if (page.videos.length === 0) throw new ExtractError("NO_CURRICULUM", "playlist videos not found");
    const pages = [page];
    const apiKey = /["']INNERTUBE_API_KEY["']\s*:\s*["']([^"']+)["']/.exec(html)?.[1];
    const context = objectAfterMarker(html, '"INNERTUBE_CONTEXT"');
    let token = page.continuationToken;
    const seenTokens = new Set<string>();
    while (token) {
      if (!apiKey || !isObj(context) || seenTokens.has(token)) {
        throw new ExtractError("FETCH_FAILED", "playlist continuation unavailable");
      }
      if (pages.length >= 50) throw new ExtractError("FETCH_FAILED", "playlist exceeds extraction limit");
      seenTokens.add(token);
      const next = await fetchImpl(`https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/json",
          "Accept-Language": "ko",
          "X-YouTube-Client-Name": "1",
          "X-YouTube-Client-Version":
            isObj(context.client) && typeof context.client.clientVersion === "string" ? context.client.clientVersion : "2.20260101.00.00",
          Origin: "https://www.youtube.com",
        },
        body: JSON.stringify({ context, continuation: token }),
        redirect: "manual",
        signal,
      });
      if (!next.ok) throw new ExtractError("FETCH_FAILED", `playlist continuation HTTP ${next.status}`);
      let data: unknown;
      try {
        const body = (await next.text()).replace(/^\)\]\}'[^\n]*\n/, "");
        data = JSON.parse(body);
      } catch {
        throw new ExtractError("NO_CURRICULUM", "playlist continuation is invalid JSON");
      }
      const nextPage = parseYouTubePlaylistData(data);
      pages.push(nextPage);
      token = nextPage.continuationToken;
    }
    return toYouTubeCurriculum(pages, url.href, playlistId);
  } catch (error) {
    if (error instanceof ExtractError) throw error;
    throw new ExtractError("FETCH_FAILED", error instanceof Error ? error.message : String(error));
  }
}
