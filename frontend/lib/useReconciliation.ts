"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getReconciliation, type EffectiveMatchStatus, type ReconciliationResponse } from "./api";

export function useReconciliation(params: { status?: EffectiveMatchStatus; edi_document_id?: string }, pollMs = 3000) {
  const [data, setData] = useState<ReconciliationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const { status, edi_document_id } = params;

  const load = useCallback(
    async (silent = false) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      if (!silent) setLoading(true);
      try {
        setData(await getReconciliation({ status, edi_document_id }, controller.signal));
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not load reconciliation");
      } finally {
        if (controllerRef.current === controller) setLoading(false);
      }
    },
    [status, edi_document_id],
  );

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  const inProgress = (data?.documents.in_progress ?? 0) > 0;
  useEffect(() => {
    if (!inProgress) return;
    const timer = setInterval(() => {
      if (!document.hidden) void load(true);
    }, pollMs);
    return () => clearInterval(timer);
  }, [inProgress, load, pollMs]);

  return { data, loading, error, reload: load, polling: inProgress };
}
