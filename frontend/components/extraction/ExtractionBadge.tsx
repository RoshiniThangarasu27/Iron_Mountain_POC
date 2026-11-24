import type { ExtractionState, ExtractionStatus } from "@/lib/api";
import { AlertIcon, CheckIcon, SpinnerIcon } from "@/components/ui/Icons";

const STEP_LABELS: Record<string, string> = {
  starting: "starting",
  reading_file: "reading file",
  extracting_claim: "parsing claim",
  calling_model: "calling AI model",
};

const STYLES: Record<ExtractionState, string> = {
  not_started: "bg-slate-100 text-slate-600 ring-slate-500/20",
  queued: "bg-sky-50 text-sky-700 ring-sky-600/20",
  running: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  retrying: "bg-amber-50 text-amber-800 ring-amber-600/30",
  succeeded: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
};

export function extractionLabel(status: ExtractionStatus | null): string {
  if (!status) return "Not extracted";
  switch (status.state) {
    case "not_started":
      return "Not extracted";
    case "queued":
      return "Queued";
    case "running":
      return status.step ? `Extracting · ${STEP_LABELS[status.step] ?? status.step}` : "Extracting";
    case "retrying":
      return `Retrying${status.retries ? ` (${status.retries + 1})` : ""}`;
    case "succeeded":
      return "Extracted";
    case "failed":
      return "Extraction failed";
  }
}

export function ExtractionBadge({ status }: { status: ExtractionStatus | null }) {
  const state = status?.state ?? "not_started";
  const busy = state === "queued" || state === "running" || state === "retrying";
  return (
    <span
      title={status?.error ?? undefined}
      aria-live="polite"
      className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[state]}`}
    >
      {busy && <SpinnerIcon width={12} height={12} className="shrink-0" />}
      {state === "succeeded" && <CheckIcon width={12} height={12} className="shrink-0" />}
      {state === "failed" && <AlertIcon width={12} height={12} className="shrink-0" />}
      <span className="truncate">{extractionLabel(status)}</span>
    </span>
  );
}
