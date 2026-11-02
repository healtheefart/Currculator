import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { RemovedList } from "./RemovedList";

it("restores an excluded lesson", () => {
  const onRestore = vi.fn();
  render(<RemovedList curriculum={{ title: "강의", sourceUrl: "", platform: "inflearn", courseId: "1", instructor: null, droppedCount: 0, items: [{ id: "a", title: "수업", level: 1, order: 0, sectionId: null, durationSec: 600, source: "origin", excluded: false }] }} settings={{ startDate: "2026-11-03", weekdayMinutes: [60,60,60,60,60,60,60], toleranceMinutes: 0, restDates: [], lectureMultiplier: 1 }} removedItemIds={["a"]} onRestore={onRestore} />);
  fireEvent.click(screen.getByRole("button", { name: "다시 넣기" }));
  expect(onRestore).toHaveBeenCalledWith("a");
});
