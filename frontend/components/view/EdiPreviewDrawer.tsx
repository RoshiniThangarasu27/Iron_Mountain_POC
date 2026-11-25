"use client";

import { useEffect, useMemo, useState } from "react";

import { contentUrl, deleteDocument, fetchDocumentText, type DocumentRecord, type ExtractionStatus } from "@/lib/api";
import { formatBytes, formatDateTime } from "@/lib/format";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { DownloadIcon, SpinnerIcon, XIcon } from "@/components/ui/Icons";
import { ExtractionPanel } from "@/components/extraction/ExtractionPanel";
import { MatchedPayments } from "@/components/matching/MatchedPayments";
import { Drawer } from "@/components/ui/Overlay";

type ViewMode = "segments" | "raw";

const SEGMENT_TERMINATOR = "~";
const ELEMENT_SEPARATOR = "*";

interface Props {
  extraction: ExtractionStatus | null;
  onExtractionChange: (status: ExtractionStatus) => void;
  doc: DocumentRecord;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export function EdiPreviewDrawer({ doc, extraction, onExtractionChange, onClose, onDeleted }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("segments");

  useEffect(() => {
    const controller = new AbortController();
    setText(null);
    setLoadError(null);
    fetchDocumentText(doc.id, controller.signal)
      .then(setText)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError(err instanceof Error ? err.message : "Failed to load file");
      });
    return () => controller.abort();
  }, [doc.id]);

  const segments = useMemo(() => {
    if (text == null) return [];
    return text
      .split(SEGMENT_TERMINATOR)
      .map((seg) => seg.trim())
      .filter(Boolean);
  }, [text]);

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await deleteDocument(doc.id);
      onDeleted(doc.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const titleId = `edi-drawer-${doc.id}`;

  return (
    <Drawer onClose={onClose} labelledBy={titleId}>
      <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate text-lg font-semibold text-slate-900" title={doc.original_filename}>
            {doc.original_filename}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{formatBytes(doc.file_size_bytes)}</span>
            <span aria-hidden>·</span>
            <span>{formatDateTime(doc.created_at)}</span>
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Close preview">
          <XIcon />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-slate-100 px-5 py-4">
          <ExtractionPanel documentId={doc.id} docType={doc.doc_type} status={extraction} onStatusChange={onExtractionChange} />
        </div>
        <div className="border-b border-slate-100 px-5 py-4">
          <MatchedPayments ediDocumentId={doc.id} />
        </div>
        <section className="px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">File content</h3>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-sm" role="group" aria-label="Content view mode">
              {(["segments", "raw"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`rounded-md px-3 py-1 font-medium transition ${mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                >
                  {m === "segments" ? "Line by line" : "Raw"}
                </button>
              ))}
            </div>
          </div>

          {loadError ? (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{loadError}</p>
          ) : text == null ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><SpinnerIcon width={16} height={16} /> Loading content…</div>
          ) : mode === "raw" ? (
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">{text}</pre>
          ) : (
            <ol className="max-h-[60vh] overflow-auto rounded-lg bg-slate-950 py-3 font-mono text-xs leading-relaxed">
              {segments.map((seg, i) => {
                const idx = seg.indexOf(ELEMENT_SEPARATOR);
                const id = idx > 0 ? seg.slice(0, idx) : seg;
                const rest = idx > 0 ? seg.slice(idx) : "";
                return (
                  <li key={i} className="flex gap-3 px-4 hover:bg-slate-800/60">
                    <span className="w-8 shrink-0 select-none text-right tabular-nums text-slate-500">{i + 1}</span>
                    <span className="min-w-0 break-all text-slate-200">
                      <span className="font-semibold text-teal-300">{id}</span>
                      {rest}
                      <span className="text-slate-500">{SEGMENT_TERMINATOR}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
        <div className="text-xs text-red-700">{deleteError}</div>
        <div className="flex items-center gap-2">
          <a
            href={contentUrl(doc.id, true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
          >
            <DownloadIcon width={16} height={16} /> Download
          </a>
          <DeleteButton onConfirm={handleDelete} />
        </div>
      </footer>
    </Drawer>
  );
}
