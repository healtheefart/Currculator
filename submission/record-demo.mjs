import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const courseUrl = "https://www.inflearn.com/course/%ED%81%B4%EB%A1%9C%EB%93%9C-%EC%BD%94%EB%93%9C-%EC%99%84%EB%B2%BD-%EB%A7%88%EC%8A%A4%ED%84%B0-ai-%EA%B0%9C%EB%B0%9C?cid=339317";
const appUrl = process.env.DEMO_APP_URL ?? "http://localhost:3000";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function scrollWholePage(page, duration = 12_000) {
  await pause(700);
  const { bottom } = await page.evaluate(() => ({ bottom: document.documentElement.scrollHeight - innerHeight }));
  const steps = Math.max(1, Math.ceil(duration / 50));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, bottom / steps);
    await pause(50);
  }
  await pause(900);
}

async function returnToTop(page) {
  const { top } = await page.evaluate(() => ({ top: window.scrollY }));
  const steps = 30;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, -top / steps);
    await pause(35);
  }
  await pause(700);
}

async function stage(name, work) {
  console.log(name);
  await page.evaluate((title) => {
    let caption = document.getElementById("demo-caption");
    if (!caption) {
      caption = document.createElement("div");
      caption.id = "demo-caption";
      Object.assign(caption.style, { position: "fixed", left: "50%", bottom: "28px", transform: "translateX(-50%)", zIndex: "2147483646", width: "max-content", maxWidth: "88vw", padding: "14px 24px", borderRadius: "12px", background: "rgba(20,27,36,.92)", color: "white", textAlign: "center", font: "600 22px 'Noto Sans', 'Noto Sans KR', sans-serif", lineHeight: "1.5", pointerEvents: "none", boxShadow: "0 3px 14px #0004" });
      document.body.append(caption);
    }
    caption.textContent = title;
  }, name);
  await pause(600);
  await work();
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
  recordVideo: { dir: join(here, ".recording"), size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
page.setDefaultTimeout(45_000);
let complete = false;

await page.addInitScript(() => {
  const addCursor = () => {
    if (document.getElementById("demo-pointer")) return;
    const cursor = document.createElement("div");
    cursor.id = "demo-pointer";
    cursor.innerHTML = '<svg width="30" height="38" viewBox="0 0 30 38" aria-hidden="true"><path d="M3 2v27l7-7 5 11 5-2-5-11h10L3 2z" fill="#fff" stroke="#111827" stroke-width="2.5" stroke-linejoin="round"/></svg>';
    Object.assign(cursor.style, { position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none", transform: "translate(-3px,-2px)", transition: "left 180ms ease-out, top 180ms ease-out" });
    document.body.append(cursor);
    document.addEventListener("mousemove", (event) => { cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px`; });
    document.addEventListener("mousedown", () => { cursor.style.filter = "drop-shadow(0 0 5px #1685ff)"; });
    document.addEventListener("mouseup", () => { cursor.style.filter = "none"; });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addCursor, { once: true });
  else addCursor();
});

try {
  await page.goto(appUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /강의 커리큘럼/ }).waitFor();

  await stage("학습 자료에서 강의 커리큘럼을 선택합니다", async () => {
    await scrollWholePage(page, 600);
    await returnToTop(page);
    await page.getByRole("button", { name: /강의 커리큘럼/ }).click();
    await pause(1000);
  });

  await stage("인프런에서 강의 주소를 복사해 붙여넣고 목차를 가져옵니다", async () => {
    const courseTab = await context.newPage();
    await courseTab.setContent(`<style>body{margin:0;font:18px Arial;color:#222}.bar{padding:14px 24px;background:#f2f3f5}.address{display:inline-block;width:1000px;padding:12px;border:1px solid #bbb;border-radius:20px;background:white}.site{padding:30px 90px}h1{font-size:34px}</style><div class="bar">‹　›　↻　<span class="address">${courseUrl}</span></div><main class="site"><p>인프런　강의　챌린지　컨설팅　커뮤니티</p><h1>클로드 코드 완벽 마스터: AI 개발 워크플로우 기초부터 실전까지</h1><p>짐코딩 · 수강평 1,723개 · 입문</p><hr><h2>커리큘럼</h2><p>30개 섹션 · 167개 수업</p></main>`);
    await pause(1800);
    const addressInput = courseTab.locator(".address");
    await courseTab.mouse.move(550, 55, { steps: 24 });
    await courseTab.mouse.click(550, 55);
    await courseTab.keyboard.press("ControlOrMeta+A");
    await courseTab.keyboard.press("ControlOrMeta+C");
    const address = courseUrl;
    await pause(700);
    await courseTab.close();
    await page.bringToFront();
    await page.mouse.move(450, 510, { steps: 24 });
    await page.getByRole("textbox", { name: "강의 URL" }).click();
    await page.keyboard.insertText(address);
    await pause(1800);
    await page.getByRole("button", { name: "목차 가져오기" }).click();
    await page.getByRole("heading", { name: /클로드 코드 완벽 마스터/ }).waitFor({ timeout: 60_000 });
    await pause(1200);
  });

  await stage("목차를 확인하고 계획에 포함할 수업을 편집합니다", async () => {
    await scrollWholePage(page, 350);
    await page.getByRole("button", { name: "다음: 일정 설정" }).click();
    await pause(1000);
  });

  await stage("요일별 학습 시간과 시작일을 설정해 계획을 만듭니다", async () => {
    await page.getByRole("button", { name: "평일만 60분" }).click();
    await pause(700);
    await page.getByRole("textbox", { name: "수요일 가용 분" }).fill("90");
    await pause(700);
    await scrollWholePage(page, 600);
    await page.getByRole("button", { name: "계획 만들기" }).click();
    await page.getByRole("heading", { name: "계획확인" }).waitFor();
    await pause(1100);
  });

  await stage("저장된 계획을 날짜별 목록으로 확인합니다", async () => {
    await scrollWholePage(page, 300);
    await returnToTop(page);
  });

  await stage("달력에서 날짜를 선택해 그날의 수업을 확인합니다", async () => {
    await page.getByRole("button", { name: "달력" }).click();
    await pause(900);
    await page.locator('section button[aria-pressed]:not([disabled])').nth(1).click();
    await pause(900);
    await scrollWholePage(page, 550);
    await returnToTop(page);
    await page.getByRole("button", { name: "다음 달" }).last().click();
    await pause(900);
    await scrollWholePage(page, 550);
    await returnToTop(page);
  });

  await stage("수업 날짜를 옮기고 제외하거나 다시 넣은 뒤 저장합니다", async () => {
    await page.getByRole("option", { name: /클로드 코드 완벽 마스터/ }).click();
    await pause(900);
    await page.getByRole("button", { name: "계획 수정" }).click();
    await page.getByRole("heading", { name: "계획 조정" }).first().waitFor();
    await pause(900);
    await page.locator('li button[aria-pressed]').first().click();
    await pause(650);
    await page.getByRole("button", { name: /에 놓기/ }).nth(1).click();
    await pause(900);
    await page.getByRole("button", { name: "계획에서 제외" }).first().click();
    await pause(800);
    await scrollWholePage(page, 300);
    await page.getByRole("button", { name: "다시 넣기" }).first().click();
    await pause(850);
    await page.getByRole("button", { name: "수정 저장" }).click();
    await page.getByRole("heading", { name: "계획확인" }).waitFor();
    await pause(1200);
  });

  await page.reload();
  await page.getByRole("heading", { name: "계획확인" }).waitFor();
  await pause(1600);
  complete = true;
  console.log("녹화 완료");
} finally {
  const video = page.video();
  await context.close();
  if (video && complete) await video.saveAs(join(here, "Currculator-시연.webm"));
  if (video) await video.delete();
  await browser.close();
}

