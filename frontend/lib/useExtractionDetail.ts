"use client";

import { useEffect, useState } from "react";

import { getExtraction, type ExtractionDetail, type ExtractionStatus } from "./api";

export function useExtractionDetail(documentId: string, status: ExtractionStatus | null) {
  const [detail, setDetail] = useState<ExtractionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const succeeded = status?.state === "succeeded";
  const taskId = status?.task_id ?? null;

  useEffect(() => {
    setDetail(null);
    setError(null);
    if (!succeeded) return;
    const controller = new AbortController();
    getExtraction(documentId, controller.signal)
      .then(setDetail)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not load extraction result");
      });
    return () => controller.abort();
  }, [documentId, taskId, succeeded]);

  return { detail, loading: succeeded && !detail && !error, error };
}
