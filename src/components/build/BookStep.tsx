"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import type { BookSearchResult, Curriculum } from "@/types/curriculum";

interface Props {
  extracting: boolean;
  hasDup: boolean;
  onSearchStart: () => void;
  onSearchEnd: () => void;
  onSelect: (curriculum: Curriculum) => void;
  onBack: () => void;
  onOpenDup: () => void;
}

export function BookStep({ extracting, hasDup, onSearchStart, onSearchEnd, onSelect, onBack, onOpenDup }: Props) {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BookSearchResult[]>([]);
  const [error, setError] = useState("");

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (extracting || query.trim().length < 2) return;
    onSearchStart();
    setError("");
    setBooks([]);
    try {
      const response = await fetch(`/api/books?q=${encodeURIComponent(query.trim())}`);
      const payload: unknown = await response.json();
      if (!response.ok || typeof payload !== "object" || payload === null) {
        setError(typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "책을 검색하지 못했습니다.");
        return;
      }
      const result = payload as { books?: BookSearchResult[] };
      setBooks(Array.isArray(result.books) ? result.books : []);
      if (!Array.isArray(result.books) || result.books.length === 0) setError("검색 결과가 없습니다. 다른 제목으로 검색해 주세요.");
    } catch {
      setError("책을 검색하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      onSearchEnd();
    }
  }

  function choose(book: BookSearchResult) {
    if (book.chapters.length === 0) return;
    const sectionId = `${book.isbn}-contents`;
    const items = [
      { id: sectionId, title: "전체 목차", level: 0 as const, order: 0, sectionId: null, durationSec: null, source: "origin" as const, excluded: false },
      ...book.chapters.map((chapter, index) => ({
      id: `${book.isbn}-${index}`,
      title: `${chapter.title} · ${chapter.pageStart}–${chapter.pageEnd}쪽`,
      level: 1 as const,
      order: index + 1,
      sectionId,
      durationSec: (chapter.pageEnd - chapter.pageStart + 1) * 120,
      source: "origin" as const,
      excluded: false,
      pageStart: chapter.pageStart,
      pageEnd: chapter.pageEnd,
      })),
    ];
    onSelect({
      title: book.title,
      sourceUrl: "https://www.nl.go.kr/",
      platform: "book",
      courseId: `book:${book.isbn}`,
      instructor: [book.author, book.publisher].filter(Boolean).join(" · ") || null,
      droppedCount: 0,
      items,
    });
  }

  return (
    <main className="mx-auto max-w-[760px] px-5 pb-24 pt-10">
      <button type="button" onClick={onBack} className="mb-6 cursor-pointer text-text-secondary">← 자료 선택</button>
      <h1 className="cc-type-display-lg mb-2">책 목차로 학습계획 만들기</h1>
      <p className="mb-6 text-text-secondary">책 제목이나 ISBN을 검색하고, 목차와 페이지를 계획에 담아요. 한 페이지를 2분 학습으로 계산합니다.</p>
      <form onSubmit={search} className="flex gap-3">
        <input aria-label="책 제목 또는 ISBN" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="책 제목 또는 ISBN" className="min-w-0 flex-1 rounded-lg border border-hairline bg-canvas px-4 py-3" />
        <Button disabled={extracting || query.trim().length < 2}>{extracting ? "검색 중…" : "검색"}</Button>
      </form>
      {error && <p role="status" className="mt-5 text-text-secondary">{error}</p>}
      {hasDup && <div className="mt-4 rounded-lg bg-parchment p-4"><p>이미 학습계획에 포함된 책입니다.</p><Button variant="secondary" onClick={onOpenDup}>기존 계획 보기</Button></div>}
      <ul className="mt-6 flex list-none flex-col gap-3 p-0">
        {books.map((book) => (
          <li key={`${book.isbn}-${book.title}`} className="flex gap-4 rounded-xl border border-hairline bg-canvas p-4">
            <div className="min-w-0 flex-1">
              <h2 className="cc-type-body-strong">{book.title}</h2>
              <p className="mt-1 text-sm text-text-secondary">{[book.author, book.publisher, book.publishDate, book.pageCount ? `${book.pageCount}쪽` : ""].filter(Boolean).join(" · ")}</p>
              <p className="mt-2 text-sm">{book.chapters.length ? `페이지 정보가 있는 목차 ${book.chapters.length}개` : "페이지 정보가 있는 목차를 제공하지 않는 책입니다."}</p>
              <Button className="mt-3" disabled={book.chapters.length === 0} onClick={() => choose(book)}>이 책으로 계획 만들기</Button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
