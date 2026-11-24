"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getExtractionStatuses, isExtractionActive, type ExtractionStatus } from "./api";

const MAX_BACKOFF_MS = 30000;

interface Seed {
  id: string;
  extraction: ExtractionStatus | null;
}

export function useExtractionPolling(seed: Seed[], intervalMs = 2000) {
  const [overrides, setOverrides] = useState<Record<string, ExtractionStatus>>({});
  const [pollError, setPollError] = useState<string | null>(null);
  const seedRef = useRef(seed);

  useEffect(() => {
    if (seedRef.current === seed) return;
    seedRef.current = seed;
    setOverrides({});
  }, [seed]);

  const statuses = useMemo(() => {
    const map: Record<string, ExtractionStatus | null> = {};
    for (const doc of seed) map[doc.id] = overrides[doc.id] ?? doc.extraction;
    return map;
  }, [seed, overrides]);

  const activeKey = useMemo(
    () =>
      Object.entries(statuses)
        .filter(([, status]) => isExtractionActive(status))
        .map(([id]) => id)
        .sort()
        .join(","),
    [statuses],
  );

  useEffect(() => {
    if (!activeKey) {
      setPollError((prev) => (prev === null ? prev : null));
      return;
    }
    const ids = activeKey.split(",");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const delay = failures ? Math.min(intervalMs * 2 ** failures, MAX_BACKOFF_MS) : intervalMs;
      timer = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (document.hidden) {
        schedule();
        return;
      }
      try {
        const rows = await getExtractionStatuses(ids, controller.signal);
        if (cancelled) return;
        const returned = new Set(rows.map((r) => r.document_id));
        setOverrides((prev) => {
          const next = { ...prev };
          for (const row of rows) next[row.document_id] = row.extraction;
          for (const id of ids) {
            if (!returned.has(id)) next[id] = { ...emptyStatus, error: "Document no longer exists" };
          }
          return next;
        });
        failures = 0;
        setPollError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        failures += 1;
        setPollError(err instanceof Error ? err.message : "Could not refresh extraction status");
      }
      schedule();
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeKey, intervalMs]);

  const setStatus = useCallback((id: string, status: ExtractionStatus) => {
    setOverrides((prev) => ({ ...prev, [id]: status }));
  }, []);

  return { statuses, setStatus, polling: activeKey !== "", pollError };
}

const emptyStatus: ExtractionStatus = {
  task_id: null,
  state: "not_started",
  celery_state: null,
  step: null,
  error: null,
  retries: null,
  requested_at: null,
  finished_at: null,
};
