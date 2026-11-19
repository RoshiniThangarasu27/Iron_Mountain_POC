"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { listDocuments, type DocType, type DocumentRecord } from "./api";

export function useDocuments(docType: DocType) {
  const [items, setItems] = useState<DocumentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const data = await listDocuments(docType, controller.signal);
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      if (controllerRef.current === controller) setLoading(false);
    }
  }, [docType]);

  useEffect(() => {
    void reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  const removeLocal = useCallback((id: string) => {
    setItems((prev) => prev.filter((d) => d.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }, []);

  const removeManyLocal = useCallback((ids: string[]) => {
    const gone = new Set(ids);
    setItems((prev) => {
      const next = prev.filter((d) => !gone.has(d.id));
      const removed = prev.length - next.length;
      setTotal((t) => Math.max(0, t - removed));
      return next;
    });
  }, []);

  return { items, total, loading, error, reload, removeLocal, removeManyLocal };
}
