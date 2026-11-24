"use client";

import { useMemo, useState } from "react";

import { contentUrl } from "@/lib/api";
import { useBulkDelete } from "@/lib/useBulkDelete";
import { useDocuments } from "@/lib/useDocuments";
import { useExtractionPolling } from "@/lib/useExtractionPolling";
import { useSelection } from "@/lib/useSelection";
import { formatBytes, formatDateTime } from "@/lib/format";
import { ExtractionBadge } from "@/components/extraction/ExtractionBadge";
import { Checkbox } from "@/components/ui/Checkbox";
import { ImageIcon } from "@/components/ui/Icons";
import { EmptyState, ErrorState } from "@/components/ui/States";

import { EobPreviewModal } from "./EobPreviewModal";
import { ListToolbar } from "./ListToolbar";

export function EobGallery() {
  const { items, total, loading, error, reload, removeLocal, removeManyLocal } = useDocuments("eob_835");
  const ids = useMemo(() => items.map((d) => d.id), [items]);
  const selection = useSelection(ids);
  const bulk = useBulkDelete("eob_835", selection.selectedIds, removeManyLocal, selection.clear);
  const extraction = useExtractionPolling(items);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <ListToolbar
        label="EOB / 835 images"
        total={total}
        loading={loading}
        onRefresh={reload}
        notice={bulk.notice}
        onDismissNotice={bulk.dismissNotice}
        selection={{
          count: selection.count,
          allSelected: selection.allSelected,
          someSelected: selection.someSelected,
          onToggleAll: selection.toggleAll,
          onClear: selection.clear,
          onDelete: bulk.run,
          accent: "indigo",
        }}
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && items.length === 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="aspect-3/4 animate-pulse rounded-xl bg-slate-200/60" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<ImageIcon />} title="No EOB / 835 images yet">
          Upload EOB page images from the <strong>Upload Docs</strong> tab.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((d) => {
            const checked = selection.isSelected(d.id);
            return (
              <li key={d.id} className="relative">
                <label
                  className={`absolute left-2 top-2 z-10 flex size-8 cursor-pointer items-center justify-center rounded-lg bg-white/95 shadow-sm ring-1 transition ${
                    checked ? "ring-indigo-500" : "ring-slate-200 hover:ring-slate-300"
                  }`}
                >
                  <Checkbox
                    accent="indigo"
                    checked={checked}
                    onChange={() => selection.toggle(d.id)}
                    aria-label={`Select ${d.original_filename}`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  className={`group flex w-full flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    checked ? "border-indigo-500 ring-2 ring-indigo-500" : "border-slate-200 hover:border-indigo-300"
                  } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600`}
                >
                  <div className="aspect-3/4 w-full overflow-hidden bg-slate-100">
                    <img
                      src={contentUrl(d.id)}
                      alt={`Preview of ${d.original_filename}`}
                      loading="lazy"
                      className="h-full w-full object-cover object-top transition group-hover:scale-102"
                    />
                  </div>
                  <div className="min-w-0 space-y-0.5 p-3">
                    <p className="truncate text-sm font-medium text-slate-900" title={d.original_filename}>{d.original_filename}</p>
                    <p className="truncate text-xs text-slate-500">{formatDateTime(d.created_at)}</p>
                    <p className="truncate text-xs text-slate-500">{formatBytes(d.file_size_bytes)}</p>
                    <div className="pt-1.5">
                      <ExtractionBadge status={extraction.statuses[d.id] ?? null} />
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <EobPreviewModal
          doc={selected}
          extraction={extraction.statuses[selected.id] ?? null}
          onExtractionChange={(status) => extraction.setStatus(selected.id, status)}
          onClose={() => setSelectedId(null)}
          onDeleted={(id) => {
            setSelectedId(null);
            removeLocal(id);
          }}
        />
      )}
    </div>
  );
}
