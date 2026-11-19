"use client";

import { useEffect, useRef, type ReactNode } from "react";

function useOverlayBehaviour(onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);
  return panelRef;
}

export function Drawer({ onClose, labelledBy, children }: { onClose: () => void; labelledBy: string; children: ReactNode }) {
  const panelRef = useOverlayBehaviour(onClose);
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl focus:outline-none"
      >
        {children}
      </div>
    </div>
  );
}

export function Modal({ onClose, labelledBy, children }: { onClose: () => void; labelledBy: string; children: ReactNode }) {
  const panelRef = useOverlayBehaviour(onClose);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl focus:outline-none sm:h-auto sm:max-h-[92vh] sm:rounded-2xl"
      >
        {children}
      </div>
    </div>
  );
}
