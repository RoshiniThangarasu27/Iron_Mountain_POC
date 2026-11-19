"use client";

import { useCallback, useEffect, useState } from "react";

import { bulkDeleteDocuments, type DocType } from "./api";

export interface Notice {
  kind: "success" | "error";
  text: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function useBulkDelete(
  docType: DocType,
  selectedIds: string[],
  onRemoved: (ids: string[]) => void,
  clearSelection: () => void,
) {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (notice?.kind !== "success") return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const run = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setNotice(null);
    try {
      const res = await bulkDeleteDocuments(selectedIds, docType);
      onRemoved([...res.deleted, ...res.not_found]);
      clearSelection();
      const parts = [`Deleted ${plural(res.deleted.length, "document")}`];
      if (res.not_found.length) parts.push(`${res.not_found.length} had already been removed`);
      if (res.file_cleanup_failed.length) parts.push(`${plural(res.file_cleanup_failed.length, "file")} could not be removed from disk`);
      setNotice({ kind: "success", text: parts.join(" · ") });
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Bulk delete failed" });
    }
  }, [selectedIds, docType, onRemoved, clearSelection]);

  return { run, notice, dismissNotice: () => setNotice(null) };
}
