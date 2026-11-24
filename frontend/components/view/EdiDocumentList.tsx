"use client";

import { useMemo, useState } from "react";

import { useBulkDelete } from "@/lib/useBulkDelete";
import { useDocuments } from "@/lib/useDocuments";
import { useExtractionPolling } from "@/lib/useExtractionPolling";
import { useSelection } from "@/lib/useSelection";
import { formatBytes, formatDateTime } from "@/lib/format";
import { ExtractionBadge } from "@/components/extraction/ExtractionBadge";
import { Checkbox } from "@/components/ui/Checkbox";
import { FileTextIcon } from "@/components/ui/Icons";
import { EmptyState, ErrorState } from "@/components/ui/States";

import { EdiPreviewDrawer } from "./EdiPreviewDrawer";
import { ListToolbar } from "./ListToolbar";

export function EdiDocumentList() {
  const { items, total, loading, error, reload, removeLocal, removeManyLocal } = useDocuments("edi_837");
  const ids = useMemo(() => items.map((d) => d.id), [items]);
  const selection = useSelection(ids);
  const bulk = useBulkDelete("edi_837", selection.selectedIds, removeManyLocal, selection.clear);
  const extraction = useExtractionPolling(items);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <ListToolbar
        label="837 EDI documents"
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
          accent: "teal",
        }}
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-200/60" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<FileTextIcon />} title="No 837 EDI files yet">
          Upload claim files from the <strong>Upload Docs</strong> tab.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="w-10 py-3 pl-4 pr-0">
                  <span className="sr-only">Select</span>
                </th>
                <th scope="col" className="w-full px-4 py-3">File</th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">Uploaded</th>
                <th scope="col" className="hidden px-4 py-3 text-right sm:table-cell">Size</th>
                <th scope="col" className="px-4 py-3">Extraction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((d) => {
                const checked = selection.isSelected(d.id);
                return (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(d.id);
                      }
                    }}
                    tabIndex={0}
                    className={`cursor-pointer transition hover:bg-teal-50/50 focus:bg-teal-50/70 focus:outline-none ${checked ? "bg-teal-50/60" : ""}`}
                    aria-label={`Open ${d.original_filename}`}
                    aria-selected={checked}
                  >
                    <td className="w-10 py-3 pl-4 pr-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <Checkbox
                        accent="teal"
                        checked={checked}
                        onChange={() => selection.toggle(d.id)}
                        aria-label={`Select ${d.original_filename}`}
                        className="align-middle"
                      />
                    </td>
                    <td className="w-full max-w-0 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FileTextIcon className="hidden shrink-0 text-slate-400 sm:block" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900" title={d.original_filename}>{d.original_filename}</p>
                          <p className="truncate text-xs text-slate-500 md:hidden">{formatDateTime(d.created_at)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-slate-600 md:table-cell">{formatDateTime(d.created_at)}</td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600 sm:table-cell">{formatBytes(d.file_size_bytes)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <ExtractionBadge status={extraction.statuses[d.id] ?? null} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <EdiPreviewDrawer
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
