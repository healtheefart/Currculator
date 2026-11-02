"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel);

  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      data-testid="confirm-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(0,0,0,0.4)] p-5"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-[360px] flex-col gap-3 rounded-lg bg-canvas p-7"
      >
        <h2 id={titleId} className="cc-type-tagline m-0">
          {title}
        </h2>
        <p className="cc-type-body m-0 text-text-secondary">{body}</p>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            취소
          </Button>
          <Button ref={confirmRef} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
