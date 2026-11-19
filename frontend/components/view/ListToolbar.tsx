"use client";

import type { Notice } from "@/lib/useBulkDelete";
import { Checkbox } from "@/components/ui/Checkbox";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { CheckIcon, AlertIcon, RefreshIcon, XIcon } from "@/components/ui/Icons";

interface SelectionControls {
  count: number;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onClear: () => void;
  onDelete: () => Promise<void>;
  accent: "teal" | "indigo";
}

interface ListToolbarProps {
  label: string;
  total: number;
  loading: boolean;
  onRefresh: () => void;
  selection?: SelectionControls;
  notice?: Notice | null;
  onDismissNotice?: () => void;
}

export function ListToolbar({ label, total, loading, onRefresh, selection, notice, onDismissNotice }: ListToolbarProps) {
  const count = selection?.count ?? 0;
  return (
    <div className="space-y-3">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {selection && total > 0 && (
            <Checkbox
              accent={selection.accent}
              checked={selection.allSelected}
              indeterminate={selection.someSelected}
              onChange={selection.onToggleAll}
              aria-label={selection.allSelected ? "Deselect all" : `Select all ${label}`}
              title={selection.allSelected ? "Deselect all" : "Select all"}
            />
          )}
          {count > 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
              <span>
                <span className="font-semibold text-slate-900">{count}</span> of {total} selected
              </span>
              <button type="button" onClick={selection?.onClear} className="font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline">
                Clear
              </button>
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{total}</span> {label}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selection && count > 0 && <DeleteButton onConfirm={selection.onDelete} label={`Delete ${count} selected`} />}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-white disabled:opacity-60"
          >
            <RefreshIcon width={16} height={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            notice.kind === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {notice.kind === "error" ? <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} /> : <CheckIcon className="mt-0.5 shrink-0" width={16} height={16} />}
          <span className="flex-1 break-words">{notice.text}</span>
          {onDismissNotice && (
            <button type="button" onClick={onDismissNotice} className="rounded p-0.5 opacity-70 hover:opacity-100" aria-label="Dismiss">
              <XIcon width={14} height={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
