"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getExtractionStatuses, isExtractionActive, type ExtractionStatus, type MatchingStatus } from "./api";

const MAX_BACKOFF_MS = 30000;

interface Seed {
  id: string;
  extraction: ExtractionStatus | null;
  matching?: MatchingStatus | null;
}

interface Override {
  extraction?: ExtractionStatus;
  matching?: MatchingStatus | null;
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

export function useExtractionPolling(seed: Seed[], intervalMs = 2000) {
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [pollError, setPollError] = useState<string | null>(null);
  const seedRef = useRef(seed);

  useEffect(() => {
    if (seedRef.current === seed) return;
    seedRef.current = seed;
    setOverrides({});
  }, [seed]);

  const { statuses, matching } = useMemo(() => {
    const extractionMap: Record<string, ExtractionStatus | null> = {};
    const matchingMap: Record<string, MatchingStatus | null> = {};
    for (const doc of seed) {
      const o = overrides[doc.id];
      extractionMap[doc.id] = o?.extraction ?? doc.extraction;
      matchingMap[doc.id] = o && "matching" in o ? (o.matching ?? null) : (doc.matching ?? null);
    }
    return { statuses: extractionMap, matching: matchingMap };
  }, [seed, overrides]);

  const activeKey = useMemo(
    () =>
      seed
        .map((d) => d.id)
        .filter((id) => isExtractionActive(statuses[id]) || isExtractionActive(matching[id]))
        .sort()
        .join(","),
    [seed, statuses, matching],
  );

  const applyRows = useCallback(
    (ids: string[], rows: { document_id: string; extraction: ExtractionStatus; matching: MatchingStatus | null }[]) => {
      const returned = new Set(rows.map((r) => r.document_id));
      setOverrides((prev) => {
        const next = { ...prev };
        for (const row of rows) next[row.document_id] = { extraction: row.extraction, matching: row.matching };
        for (const id of ids) {
          if (!returned.has(id)) next[id] = { extraction: { ...emptyStatus, error: "Document no longer exists" }, matching: null };
        }
        return next;
      });
    },
    [],
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
        applyRows(ids, rows);
        failures = 0;
        setPollError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        failures += 1;
        setPollError(err instanceof Error ? err.message : "Could not refresh status");
      }
      schedule();
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeKey, intervalMs, applyRows]);

  const setStatus = useCallback((id: string, status: ExtractionStatus) => {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], extraction: status } }));
  }, []);

  const setMatching = useCallback((id: string, status: MatchingStatus | null) => {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], matching: status } }));
  }, []);

  const refresh = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      try {
        applyRows(ids, await getExtractionStatuses(ids));
      } catch {
        return;
      }
    },
    [applyRows],
  );

  return { statuses, matching, setStatus, setMatching, refresh, polling: activeKey !== "", pollError };
}
