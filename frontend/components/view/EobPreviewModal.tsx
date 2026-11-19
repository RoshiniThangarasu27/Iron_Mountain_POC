"use client";

import { useState } from "react";

import { contentUrl, deleteDocument, type DocumentRecord } from "@/lib/api";
import { formatBytes, formatDateTime } from "@/lib/format";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { DownloadIcon, ExternalIcon, XIcon } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Overlay";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Props {
  doc: DocumentRecord;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export function EobPreviewModal({ doc, onClose, onDeleted }: Props) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const s = doc.parsed_summary ?? {};
  const titleId = `eob-modal-${doc.id}`;

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await deleteDocument(doc.id);
      onDeleted(doc.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const rows: [string, string][] = [
    ["Uploaded", formatDateTime(doc.created_at)],
    ["Size", formatBytes(doc.file_size_bytes)],
    ["Dimensions", s.width ? `${s.width} × ${s.height} px` : "—"],
    ["Format", s.format ?? doc.mime_type],
    ["Color mode", s.mode ?? "—"],
    ["SHA-256", doc.sha256_hash.slice(0, 16) + "…"],
  ];

  return (
    <Modal onClose={onClose} labelledBy={titleId}>
      <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-3">
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900" title={doc.original_filename}>
          {doc.original_filename}
        </h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Close preview">
          <XIcon />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-900 p-4">
          <img src={contentUrl(doc.id)} alt={doc.original_filename} className="max-h-[75vh] max-w-full rounded object-contain shadow-lg" />
        </div>

        <aside className="w-full shrink-0 space-y-4 border-t border-slate-200 p-5 lg:w-72 lg:border-l lg:border-t-0">
          <StatusBadge status={doc.status} />
          <dl className="space-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-slate-500">{k}</dt>
                <dd className="truncate text-right font-medium text-slate-900" title={k === "SHA-256" ? doc.sha256_hash : v}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-2">
            <a
              href={contentUrl(doc.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              <ExternalIcon width={16} height={16} /> Open full size
            </a>
            <a
              href={contentUrl(doc.id, true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              <DownloadIcon width={16} height={16} /> Download
            </a>
            <DeleteButton onConfirm={handleDelete} />
            {deleteError && <p role="alert" className="text-xs text-red-700">{deleteError}</p>}
          </div>
        </aside>
      </div>
    </Modal>
  );
}
