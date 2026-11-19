"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { contentUrl, deleteDocument, fetchDocumentText, type DocumentRecord } from "@/lib/api";
import { describeDelimiter, formatBytes, formatCurrency, formatDateTime } from "@/lib/format";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { AlertIcon, DownloadIcon, SpinnerIcon, XIcon } from "@/components/ui/Icons";
import { Drawer } from "@/components/ui/Overlay";
import { StatusBadge } from "@/components/ui/StatusBadge";

type ViewMode = "segments" | "raw";

interface Props {
  doc: DocumentRecord;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-slate-900">{children ?? "—"}</dd>
    </div>
  );
}

export function EdiPreviewDrawer({ doc, onClose, onDeleted }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("segments");
  const s = doc.parsed_summary ?? {};
  const delimiters = s.delimiters;

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
    const terminator = delimiters?.segment || "~";
    return text
      .split(terminator)
      .map((seg) => seg.trim())
      .filter(Boolean);
  }, [text, delimiters?.segment]);

  const element = delimiters?.element || "*";

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
  const isa = s.interchange ?? {};
  const st = s.transaction_set ?? {};
  const bht = s.beginning_of_transaction ?? {};
  const gs = s.functional_group ?? {};

  return (
    <Drawer onClose={onClose} labelledBy={titleId}>
      <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate text-lg font-semibold text-slate-900" title={doc.original_filename}>
            {doc.original_filename}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <StatusBadge status={doc.status} />
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
        <section className="space-y-4 border-b border-slate-100 px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Field label="Segments">{s.segment_count ?? "—"}</Field>
            <Field label="Claims (CLM)">{s.claim_count ?? "—"}</Field>
            <Field label="Service lines">{s.service_line_count ?? "—"}</Field>
            <Field label="Total charges">{formatCurrency(s.total_claim_charges)}</Field>
            <Field label="Claim type">{s.claim_type ? <span className="capitalize">{s.claim_type}</span> : "—"}</Field>
            <Field label="ISA control #">{isa.control_number}</Field>
            <Field label="GS control #">{gs.control_number}</Field>
            <Field label="ST control #">{st.control_number != null ? String(st.control_number) : "—"}</Field>
            <Field label="Sender → Receiver">
              {isa.sender_id || gs.sender_code ? `${isa.sender_id ?? gs.sender_code} → ${isa.receiver_id ?? gs.receiver_code ?? "?"}` : "—"}
            </Field>
            <Field label="BHT reference">{bht.reference_id}</Field>
            <Field label="Version">{(st.implementation_reference as string | null) ?? gs.version ?? isa.version}</Field>
            <Field label="Usage">{isa.usage_indicator === "P" ? "Production" : isa.usage_indicator === "T" ? "Test" : isa.usage_indicator}</Field>
          </dl>

          {delimiters && (
            <p className="text-xs text-slate-500">
              Delimiters: element {describeDelimiter(delimiters.element)} · component {describeDelimiter(delimiters.component)} ·
              segment {describeDelimiter(delimiters.segment)}
              {delimiters.repetition && <> · repetition {describeDelimiter(delimiters.repetition)}</>} ({delimiters.method.replace(/_/g, " ")})
            </p>
          )}

          {s.claim_ids && s.claim_ids.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Claim IDs (CLM01)</p>
              <div className="flex flex-wrap gap-1.5">
                {s.claim_ids.map((id, i) => (
                  <span key={`${id}-${i}`} className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">{id}</span>
                ))}
              </div>
            </div>
          )}

          {s.detected_loops && s.detected_loops.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-slate-500 hover:text-slate-700">
                Detected loops ({s.detected_loops.length})
              </summary>
              <ul className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
                {s.detected_loops.map((l) => <li key={l} className="font-mono text-xs">{l}</li>)}
              </ul>
            </details>
          )}

          {s.warnings && s.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <p className="mb-1 flex items-center gap-1.5 font-medium"><AlertIcon width={16} height={16} /> Inspection notes</p>
              <ul className="list-disc space-y-0.5 pl-6">
                {s.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </section>

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
                const idx = seg.indexOf(element);
                const id = idx > 0 ? seg.slice(0, idx) : seg;
                const rest = idx > 0 ? seg.slice(idx) : "";
                return (
                  <li key={i} className="flex gap-3 px-4 hover:bg-slate-800/60">
                    <span className="w-8 shrink-0 select-none text-right tabular-nums text-slate-500">{i + 1}</span>
                    <span className="min-w-0 break-all text-slate-200">
                      <span className="font-semibold text-teal-300">{id}</span>
                      {rest}
                      <span className="text-slate-500">{delimiters?.segment && delimiters.segment !== "\n" ? delimiters.segment : ""}</span>
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
