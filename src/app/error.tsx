"use client";

import { Button } from "@/components/ui/Button";
import { clearPlans } from "@/lib/storage/plans";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-[640px] px-5 py-24 text-center">
    <h1 className="cc-type-display-lg">문제가 생겼어요</h1>
    <p className="mb-8 text-text-secondary">저장된 계획을 지우고 다시 시작할 수 있어요.</p>
    <Button onClick={() => { clearPlans(); reset(); }}>다시 시작</Button>
  </main>;
}
