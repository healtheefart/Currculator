import { test, expect } from "@playwright/test";

test("creates a plan, persists it, and adjusts a lesson", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /강의 커리큘럼/ }).click();
  await page.getByRole("button", { name: "예시 강의로 해보기" }).click();
  await page.getByRole("button", { name: "목차 가져오기" }).click();
  await expect(page.getByRole("heading", { name: /클로드.*코워크/ })).toBeVisible();
  await page.getByRole("button", { name: "다음: 일정 설정" }).click();
  await page.getByRole("button", { name: "계획 만들기" }).click();
  await expect(page.getByRole("heading", { name: "계획확인" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "계획확인" })).toBeVisible();
  await page.getByRole("option", { name: /클로드.*코워크/ }).click();
  await page.getByRole("button", { name: "계획 수정" }).click();
  await expect(page.getByRole("heading", { name: "계획 조정" }).first()).toBeVisible();
  await page.getByRole("button", { name: "계획에서 제외" }).first().click();
  await expect(page.getByRole("button", { name: "다시 넣기" }).first()).toBeVisible();
});

test("rejects unsupported sites", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: /강의 커리큘럼/ }).click();
  await page.getByRole("textbox", { name: "강의 URL" }).fill("https://www.udemy.com/course/x");
  await page.getByRole("button", { name: "목차 가져오기" }).click();
  await expect(page.getByText("지금은 인프런 강의 페이지만 지원해요.")).toBeVisible();
});

test("mobile calendar has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: /강의 커리큘럼/ }).click();
  await page.getByRole("button", { name: "예시 강의로 해보기" }).click();
  await page.getByRole("button", { name: "목차 가져오기" }).click();
  await page.getByRole("button", { name: "다음: 일정 설정" }).click();
  await page.getByRole("button", { name: "계획 만들기" }).click();
  await page.getByRole("button", { name: "달력" }).click();
  await expect(page.getByRole("heading", { name: /\d{4}년 \d{1,2}월/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
