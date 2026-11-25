"use client";

import { useCallback, useEffect, useState } from "react";

import { getMatching, type MatchingDetail, type MatchingStatus } from "./api";

export function useMatchingDetail(documentId: string | null, status: MatchingStatus | null) {
  const [detail, setDetail] = useState<MatchingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const succeeded = status?.state === "succeeded";
  const taskId = status?.task_id ?? null;

  useEffect(() => {
    setError(null);
    if (!documentId || !succeeded) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    getMatching(documentId, controller.signal)
      .then(setDetail)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not load matching result");
      });
    return () => controller.abort();
  }, [documentId, taskId, succeeded, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { detail, loading: succeeded && !detail && !error, error, reload };
}
