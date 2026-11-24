"use client";

import { useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";

import { ApiError, MAX_UPLOAD_MB, uploadDocuments, type DocType, type UploadResponse } from "@/lib/api";
import { formatBytes, getExtension } from "@/lib/format";
import { useExtractionPolling } from "@/lib/useExtractionPolling";
import { ExtractionBadge } from "@/components/extraction/ExtractionBadge";
import { AlertIcon, CheckIcon, InfoIcon, SpinnerIcon, UploadIcon, XIcon } from "@/components/ui/Icons";

interface SelectedFile {
  key: string;
  file: File;
  problem: string | null;
}

interface UploadCardProps {
  docType: DocType;
  title: string;
  subtitle: string;
  extensions: string[];
  acceptMime?: string[];
  icon: ReactNode;
  accent: "teal" | "indigo";
}

const ACCENTS = {
  teal: {
    icon: "bg-teal-50 text-teal-700",
    button: "bg-teal-600 hover:bg-teal-700 focus-visible:outline-teal-600",
    drop: "border-teal-500 bg-teal-50/60",
    bar: "[&::-webkit-progress-value]:bg-teal-600 [&::-moz-progress-bar]:bg-teal-600",
    link: "text-teal-700",
  },
  indigo: {
    icon: "bg-indigo-50 text-indigo-700",
    button: "bg-indigo-600 hover:bg-indigo-700 focus-visible:outline-indigo-600",
    drop: "border-indigo-500 bg-indigo-50/60",
    bar: "[&::-webkit-progress-value]:bg-indigo-600 [&::-moz-progress-bar]:bg-indigo-600",
    link: "text-indigo-700",
  },
};

const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

export function UploadCard({ docType, title, subtitle, extensions, acceptMime = [], icon, accent }: UploadCardProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const [selected, setSelected] = useState<SelectedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const uploadedDocs = useMemo(() => result?.documents ?? [], [result]);
  const extraction = useExtractionPolling(uploadedDocs);
  const a = ACCENTS[accent];
  const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;

  const addFiles = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    setResult(null);
    setRequestError(null);
    setSelected((prev) => {
      const seen = new Set(prev.map((s) => s.key));
      const next = [...prev];
      for (const file of files) {
        const key = fileKey(file);
        if (seen.has(key)) continue;
        seen.add(key);
        let problem: string | null = null;
        if (!extensions.includes(getExtension(file.name))) problem = `Unsupported type. Allowed: ${extensions.join(", ")}`;
        else if (file.size === 0) problem = "File is empty";
        else if (file.size > maxBytes) problem = `Larger than ${MAX_UPLOAD_MB} MB`;
        next.push({ key, file, problem });
      }
      return next;
    });
  };

  const valid = selected.filter((s) => !s.problem);
  const invalidCount = selected.length - valid.length;

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!uploading) addFiles(e.dataTransfer.files);
  };

  const startUpload = async () => {
    if (valid.length === 0) return;
    setUploading(true);
    setProgress(0);
    setResult(null);
    setRequestError(null);
    const { promise, abort } = uploadDocuments(docType, valid.map((s) => s.file), setProgress);
    abortRef.current = abort;
    try {
      const res = await promise;
      setResult(res);
      setSelected((prev) => prev.filter((s) => s.problem));
    } catch (err) {
      setRequestError(err instanceof ApiError || err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  const accept = [...extensions, ...acceptMime].join(",");
  const warningsByDoc = new Map<string, UploadResponse["warnings"]>();
  for (const w of result?.warnings ?? []) warningsByDoc.set(w.document_id, [...(warningsByDoc.get(w.document_id) ?? []), w]);

  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 border-b border-slate-100 p-5">
        <div className={`rounded-xl p-2.5 ${a.icon}`}>{icon}</div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragging ? a.drop : "border-slate-300 bg-slate-50/60"
          }`}
        >
          <UploadIcon className="mb-2 text-slate-400" width={28} height={28} />
          <p className="text-sm text-slate-700">
            Drag &amp; drop files here, or{" "}
            <label htmlFor={inputId} className={`cursor-pointer font-semibold underline-offset-2 hover:underline ${a.link}`}>
              browse
            </label>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {extensions.join(", ")} · multiple files · up to {MAX_UPLOAD_MB} MB each
          </p>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            multiple
            accept={accept}
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={`mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${a.button}`}
          >
            Select files
          </button>
        </div>

        {selected.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
              <span>
                {selected.length} selected
                {invalidCount > 0 && <span className="text-amber-700"> · {invalidCount} will be skipped</span>}
              </span>
              {!uploading && (
                <button type="button" onClick={() => setSelected([])} className="normal-case tracking-normal text-slate-500 hover:text-slate-800">
                  Clear all
                </button>
              )}
            </div>
            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {selected.map((s) => (
                <li key={s.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate ${s.problem ? "text-slate-400 line-through" : "text-slate-800"}`} title={s.file.name}>
                      {s.file.name}
                    </p>
                    {s.problem && <p className="text-xs text-amber-700">{s.problem}</p>}
                  </div>
                  <span className="shrink-0 tabular-nums text-xs text-slate-500">{formatBytes(s.file.size)}</span>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={() => setSelected((prev) => prev.filter((p) => p.key !== s.key))}
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Remove ${s.file.name}`}
                    >
                      <XIcon width={16} height={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {uploading && (
          <div aria-live="polite">
            <div className="mb-1 flex justify-between text-xs text-slate-600">
              <span>{progress < 100 ? "Uploading…" : "Processing on server…"}</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <progress
              value={progress}
              max={100}
              aria-label="Upload progress"
              className={`block h-2 w-full appearance-none overflow-hidden rounded-full bg-slate-100 [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:transition-all [&::-moz-progress-bar]:rounded-full ${a.bar}`}
            />
          </div>
        )}

        <div className="mt-auto flex items-center gap-2">
          <button
            type="button"
            onClick={startUpload}
            disabled={uploading || valid.length === 0}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${a.button}`}
          >
            {uploading ? <SpinnerIcon width={16} height={16} /> : <UploadIcon width={16} height={16} />}
            {uploading ? "Uploading…" : `Upload ${valid.length || ""} file${valid.length === 1 ? "" : "s"}`}
          </button>
          {uploading && (
            <button
              type="button"
              onClick={() => abortRef.current?.()}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>

        {requestError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} />
            <span className="break-words">{requestError}</span>
          </div>
        )}

        {result && (
          <div aria-live="polite" className="rounded-lg border border-slate-200">
            <div
              className={`flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-medium ${
                result.errors.length === 0
                  ? "bg-emerald-50 text-emerald-800"
                  : result.documents.length === 0
                    ? "bg-red-50 text-red-800"
                    : "bg-amber-50 text-amber-800"
              }`}
            >
              {result.errors.length === 0 ? <CheckIcon width={16} height={16} /> : <AlertIcon width={16} height={16} />}
              {result.documents.length} uploaded
              {result.errors.length > 0 && `, ${result.errors.length} rejected`}
            </div>
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto text-sm">
              {result.documents.map((d) => {
                const warns = warningsByDoc.get(d.id) ?? [];
                return (
                  <li key={d.id} className="flex items-start gap-2 px-3 py-2">
                    <CheckIcon className="mt-0.5 shrink-0 text-emerald-600" width={16} height={16} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-slate-800" title={d.original_filename}>{d.original_filename}</p>
                      <p className="text-xs text-slate-500">
                        {formatBytes(d.file_size_bytes)}
                      </p>
                      {warns.map((w, i) => (
                        <p key={i} className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                          <InfoIcon width={12} height={12} className="shrink-0" />
                          {w.duplicate_of.length > 0 ? `Duplicate: ${w.message.toLowerCase()}` : w.message}
                        </p>
                      ))}
                      <div className="mt-1">
                        <ExtractionBadge status={extraction.statuses[d.id] ?? null} />
                      </div>
                    </div>
                  </li>
                );
              })}
              {result.errors.map((e, i) => (
                <li key={`err-${i}`} className="flex items-start gap-2 px-3 py-2">
                  <XIcon className="mt-0.5 shrink-0 text-red-600" width={16} height={16} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-slate-800" title={e.filename}>{e.filename}</p>
                    <p className="text-xs text-red-700">{e.error}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
