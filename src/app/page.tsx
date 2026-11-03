"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { SourceStep } from "@/components/build/SourceStep";
import { UrlStep } from "@/components/build/UrlStep";
import { BookStep } from "@/components/build/BookStep";
import { CurriculumEditor } from "@/components/build/CurriculumEditor";
import { PlanSettings } from "@/components/build/PlanSettings";
import { PlanSummary } from "@/components/plan/PlanSummary";
import { PlanViewTabs } from "@/components/plan/PlanViewTabs";
import { PlanList } from "@/components/plan/PlanList";
import { PlanCalendar } from "@/components/plan/PlanCalendar";
import { PlanPicker } from "@/components/plan/PlanPicker";
import { RemovedList } from "@/components/plan/RemovedList";
import { daysFromAdjusted, daysFromMerged } from "@/components/plan/view-model";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GlobalNav } from "@/components/ui/GlobalNav";
import { StepBar } from "@/components/ui/StepBar";
import { monthOf, toKstIsoDate } from "@/lib/date/kst";
import { extractCurriculum } from "@/lib/extract-client";
import { PLAN_FAILURE_MESSAGES } from "@/lib/errors/messages";
import { applyOverrides } from "@/lib/planner/overrides";
import { mergePlans } from "@/lib/planner/merge";
import { buildPlan } from "@/lib/planner/schedule";
import { appReducer, createInitialState, type BuildStage } from "@/lib/state/app-reducer";
import { loadPlans, savePlans } from "@/lib/storage/plans";
import { checkCourseUrl, cidFromUrl } from "@/lib/url-input";
import type { IsoDate, PlanFailureReason } from "@/types/plan";

const COURSE_STEPS: { key: BuildStage; label: string }[] = [{ key: "type", label: "자료 선택" }, { key: "url", label: "강의 URL" }, { key: "edit", label: "목차 확인" }, { key: "schedule", label: "일정 설정" }];
const BOOK_STEPS: { key: BuildStage; label: string }[] = [{ key: "type", label: "자료 선택" }, { key: "book", label: "책 검색" }, { key: "edit", label: "목차 확인" }, { key: "schedule", label: "일정 설정" }];
const EDIT_STEPS: { key: BuildStage; label: string }[] = [{ key: "edit", label: "목차 확인" }, { key: "schedule", label: "일정 설정" }, { key: "adjust", label: "계획 조정" }];

export default function Home() {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);
  const [ready, setReady] = useState(false);
  const [today] = useState<IsoDate>(() => toKstIsoDate(new Date()));
  const [elapsedSec, setElapsedSec] = useState(0);
  const [adjustTab, setAdjustTab] = useState<"list" | "calendar">("list");
  const lastSavedRevision = useRef(0);
  const extractingRef = useRef(false);

  useEffect(() => { dispatch({ type: "INIT", plans: loadPlans() }); queueMicrotask(() => setReady(true)); }, []);
  useEffect(() => { if (state.plansRevision > 0 && state.plansRevision !== lastSavedRevision.current) { savePlans(state.plans); lastSavedRevision.current = state.plansRevision; } }, [state.plans, state.plansRevision]);
  useEffect(() => { if (!state.build.extracting) return; const timer = window.setInterval(() => setElapsedSec((sec) => sec + 1), 1000); return () => window.clearInterval(timer); }, [state.build.extracting]);

  const draft = state.build.draft;
  const draftResult = useMemo(() => draft ? buildPlan(draft.curriculum, draft.settings) : null, [draft]);
  const adjusted = useMemo(() => draft && draftResult?.ok ? applyOverrides(draftResult.plan, draft.curriculum, draft.settings, draft.overrides) : null, [draft, draftResult]);
  const draftDays = useMemo(() => draft && adjusted ? daysFromAdjusted(draft.curriculum, draft.settings, adjusted) : [], [draft, adjusted]);
  const calculated = useMemo(() => state.plans.flatMap((plan) => { const result = buildPlan(plan.curriculum, plan.settings); if (!result.ok) return []; const adjustedPlan = applyOverrides(result.plan, plan.curriculum, plan.settings, plan.overrides); return [{ plan, adjusted: adjustedPlan }]; }), [state.plans]);
  const selectedPlan = state.plans.find((plan) => plan.id === state.view.selected);
  const viewDays = useMemo(() => {
    if (state.view.selected === "all") return daysFromMerged(state.plans, mergePlans(calculated.map(({ plan, adjusted: planAdjusted }) => ({ planId: plan.id, curriculum: plan.curriculum, settings: plan.settings, adjusted: planAdjusted }))));
    const current = calculated.find(({ plan }) => plan.id === state.view.selected);
    return current ? daysFromAdjusted(current.plan.curriculum, current.plan.settings, current.adjusted) : [];
  }, [state.view.selected, state.plans, calculated]);

  function go(stage: BuildStage) { dispatch({ type: "GO_STAGE", stage }); window.scrollTo?.(0, 0); }
  function navigate(menu: "build" | "view") { dispatch({ type: "NAVIGATE", menu }); window.scrollTo?.(0, 0); }
  async function submitUrl() {
    if (extractingRef.current || state.build.extracting) return;
    const code = checkCourseUrl(state.build.url);
    if (code) { dispatch({ type: "SUBMIT_REJECTED", code }); return; }
    const cid = cidFromUrl(state.build.url);
    const duplicate = cid ? state.plans.find((plan) => plan.curriculum.courseId === cid) : null;
    if (duplicate) { dispatch({ type: "SUBMIT_REJECTED", code: "ALREADY_PLANNED", dupPlanId: duplicate.id }); return; }
    extractingRef.current = true; setElapsedSec(0); dispatch({ type: "EXTRACT_START" });
    try { const result = await extractCurriculum(state.build.url); if (result.ok) dispatch({ type: "EXTRACT_SUCCESS", curriculum: result.curriculum, today }); else dispatch({ type: "EXTRACT_FAILURE", code: result.code }); }
    finally { extractingRef.current = false; }
  }
  const saveTime = () => new Date().toISOString();
  const create = () => { if (!draftResult?.ok) return; dispatch({ type: "CREATE_PLAN", id: globalThis.crypto?.randomUUID?.() ?? `p${Date.now()}`, savedAt: saveTime() }); window.scrollTo?.(0, 0); };
  const saveEdit = () => { if (!draftResult?.ok) return; dispatch({ type: "SAVE_EDIT", savedAt: saveTime() }); window.scrollTo?.(0, 0); };
  const steps = state.build.editingId ? EDIT_STEPS : draft?.curriculum.platform === "book" ? BOOK_STEPS : COURSE_STEPS;
  const reachable = draft ? (state.build.editingId ? ["edit", "schedule", "adjust"] : ["edit", "schedule"]) : (state.build.stage === "url" || state.build.stage === "book") && !state.build.extracting ? ["type", state.build.stage] : ["type"];
  const failure: PlanFailureReason | null = draftResult && !draftResult.ok ? draftResult.reason : null;
  const defaultViewMonth = monthOf(viewDays.find((day) => day.date >= today)?.date ?? viewDays[0]?.date ?? today);

  return <>
    <GlobalNav active={state.menu} onNavigate={navigate} onBrand={() => navigate("build")} />
    {!ready ? <main className="mx-auto max-w-[980px] px-5 py-20" aria-busy="true" /> : state.menu === "build" ? <>
      <StepBar steps={steps} currentKey={state.build.stage} reachableKeys={reachable} onSelect={(key) => go(key as BuildStage)} editing={state.build.editingId !== null} />
      {state.build.stage === "type" && <SourceStep bookNotice={state.build.bookNotice} onPick={(source) => dispatch({ type: "PICK_SOURCE", source })} />}
      {state.build.stage === "url" && <UrlStep url={state.build.url} site={state.build.site} extracting={state.build.extracting} elapsedSec={elapsedSec} errorCode={state.build.errorCode} hasDup={Boolean(state.build.dupPlanId)} onUrlChange={(url) => dispatch({ type: "SET_URL", url })} onSubmit={submitUrl} onPickSite={(site) => dispatch({ type: "PICK_SITE", site })} onFillSample={() => dispatch({ type: "FILL_SAMPLE" })} onBack={() => dispatch({ type: "BACK_TO_TYPE" })} onOpenDup={() => dispatch({ type: "OPEN_DUP" })} />}
      {state.build.stage === "book" && <BookStep extracting={state.build.extracting} hasDup={Boolean(state.build.dupPlanId)} onSearchStart={() => dispatch({ type: "BOOK_SEARCH_START" })} onSearchEnd={() => dispatch({ type: "BOOK_SEARCH_END" })} onSelect={(curriculum) => dispatch({ type: "BOOK_SELECTED", curriculum, today })} onBack={() => dispatch({ type: "BACK_TO_TYPE" })} onOpenDup={() => dispatch({ type: "OPEN_DUP" })} />}
      {draft && <main className="mx-auto max-w-[980px] px-5 pb-24 pt-10">
        {state.build.stage === "edit" && <CurriculumEditor curriculum={draft.curriculum} multiplier={draft.settings.lectureMultiplier} onAction={(action) => dispatch({ type: "DRAFT", action })} />}
        {state.build.stage === "schedule" && <PlanSettings settings={draft.settings} today={today} platform={draft.curriculum.platform} onAction={(action) => dispatch({ type: "DRAFT", action })} />}
        {state.build.stage === "adjust" && <><h1 className="cc-type-display-lg mb-6">계획 조정</h1><PlanSummary title={draft.curriculum.title} days={draftDays} /><PlanViewTabs heading="계획 조정" tab={adjustTab} onTab={setAdjustTab}>{adjustTab === "list" ? <><PlanList days={draftDays} today={today} editable baseDateById={adjusted?.baseDateById} hasOverrides={Object.keys(draft.overrides).length > 0} onAction={(action) => dispatch({ type: "DRAFT", action })} /><RemovedList curriculum={draft.curriculum} settings={draft.settings} removedItemIds={adjusted?.removedItemIds ?? []} onRestore={(itemId) => dispatch({ type: "DRAFT", action: { type: "RESTORE_ITEM", itemId } })} /></> : <PlanCalendar days={draftDays} today={today} defaultMonth={monthOf(draftDays[0]?.date ?? today)} />}</PlanViewTabs></>}
        <div className="mt-10 flex flex-wrap items-center justify-end gap-3 border-t border-hairline pt-6">
          {state.build.editingId && <Button variant="secondary" onClick={() => dispatch({ type: "CANCEL_EDIT" })}>수정 취소</Button>}
          {state.build.stage === "edit" && <Button onClick={() => go("schedule")}>다음: 일정 설정</Button>}
          {state.build.stage === "schedule" && <><Button variant="secondary" onClick={() => go("edit")}>이전</Button><Button disabled={!draftResult?.ok} onClick={state.build.editingId ? () => go("adjust") : create}>{state.build.editingId ? "다음: 계획 조정" : "계획 만들기"}</Button></>}
          {state.build.stage === "adjust" && <Button disabled={!draftResult?.ok} onClick={saveEdit}>수정 저장</Button>}
        </div>
        {failure && <p role="alert" className="mt-3 text-right text-text-secondary">{PLAN_FAILURE_MESSAGES[failure]}</p>}
        <div className="mt-6 text-right"><button type="button" onClick={() => dispatch({ type: "ASK_RESET" })} className="cursor-pointer text-primary">처음부터 다시</button></div>
      </main>}
    </> : <main className="mx-auto max-w-[980px] px-5 pb-24 pt-12">
      <h1 className="cc-type-display-lg mb-7">계획확인</h1>
      {state.plans.length === 0 ? <section className="rounded-lg border border-hairline bg-canvas p-8 text-center"><p className="mb-5">아직 만든 계획이 없어요.</p><Button onClick={() => navigate("build")}>계획 짜기</Button></section> : <>
        <PlanPicker rows={[{ id: "all", title: "전체 보기", sub: `계획 ${state.plans.length}개` }, ...state.plans.map((plan) => ({ id: plan.id, title: plan.curriculum.title, sub: `수업 ${plan.curriculum.items.filter((item) => item.level === 1 && !item.excluded).length}개` }))]} selected={state.view.selected} onSelect={(selected) => dispatch({ type: "SELECT_PLAN", selected })} />
        <div className="mt-6"><PlanSummary title={selectedPlan?.curriculum.title ?? "전체 계획"} planCount={selectedPlan ? undefined : state.plans.length} days={viewDays} onEdit={selectedPlan ? () => dispatch({ type: "START_EDIT", planId: selectedPlan.id }) : undefined} onDelete={selectedPlan ? () => dispatch({ type: "ASK_DELETE", planId: selectedPlan.id }) : undefined} /></div>
        <PlanViewTabs heading={selectedPlan ? "일정" : "날짜별 전체 일정"} tab={state.view.tab} onTab={(tab) => dispatch({ type: "SET_TAB", tab })}>{state.view.tab === "list" ? <PlanList days={viewDays} today={today} /> : <PlanCalendar days={viewDays} today={today} defaultMonth={defaultViewMonth} />}</PlanViewTabs>
      </>}
    </main>}
    <ConfirmDialog open={state.confirm !== null} title={state.confirm?.kind === "delete" ? "이 계획을 삭제할까요?" : "처음부터 다시 할까요?"} body={state.confirm?.kind === "delete" ? "삭제한 계획은 되돌릴 수 없어요." : "작성 중인 내용이 지워져요."} confirmLabel={state.confirm?.kind === "delete" ? "삭제" : "처음부터"} onCancel={() => dispatch({ type: "CANCEL_CONFIRM" })} onConfirm={() => dispatch({ type: "CONFIRM" })} />
  </>;
}
