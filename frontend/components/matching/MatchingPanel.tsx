"use client";

import { useState } from "react";

import { isExtractionActive, startMatching, type ExtractionStatus, type MatchingStatus } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useMatchingDetail } from "@/lib/useMatchingDetail";
import { AlertIcon, InfoIcon, RefreshIcon, SpinnerIcon } from "@/components/ui/Icons";

import { ClaimMatchCard } from "./ClaimMatchCard";
import { MatchingBadge } from "./MatchingBadge";

interface Props {
  documentId: string;
  extraction: ExtractionStatus | null;
  status: MatchingStatus | null;
  onStatusChange: (status: MatchingStatus) => void;
  onReviewed: () => void;
}

export function MatchingPanel({ documentId, extraction, status, onStatusChange, onReviewed }: Props) {
  const { detail, loading, error: detailError, reload } = useMatchingDetail(documentId, status);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const active = isExtractionActive(status);
  const canMatch = extraction?.state === "succeeded" && !active;
  const summary = status?.summary;

  const start = async (force: boolean) => {
    setStarting(true);
    setStartError(null);
    try {
      onStatusChange(await startMatching(documentId, force));
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Could not start matching");
    } finally {
      setStarting(false);
    }
  };

  const handleReviewed = () => {
    reload();
    onReviewed();
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Claim matching</h3>
          <MatchingBadge status={status} />
        </div>
        <button
          type="button"
          onClick={() => start(Boolean(detail?.forced))}
          disabled={!canMatch || starting}
          title={extraction?.state !== "succeeded" ? "Extract the EOB first" : undefined}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          {starting ? <SpinnerIcon width={14} height={14} /> : <RefreshIcon width={14} height={14} />}
          {status && status.state !== "not_started" ? "Re-match" : "Match claims"}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Links each EOB claim to the 837 claim it pays, using patient, date of service, service code, billed amount and
        provider.
        {detail?.matched_at && (
          <>
            {" "}
            Last run {formatDateTime(detail.matched_at)} against {detail.repository_size ?? 0} extracted 837 claim
            {detail.repository_size === 1 ? "" : "s"}.
          </>
        )}
      </p>

      {startError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{startError}</p>}

      {(!status || status.state === "not_started") && (
        <p className="text-sm text-slate-500">
          {extraction?.state === "failed"
            ? "Matching runs after a successful extraction. Fix the extraction first."
            : "Matching will run automatically once the EOB is extracted."}
        </p>
      )}

      {active && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <SpinnerIcon width={14} height={14} />
          {status?.step === "waiting_for_extraction" ? "Waiting for the extraction to finish…" : "Comparing against extracted 837 claims…"}
        </p>
      )}

      {status?.state === "failed" && status.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{status.error}</p>
      )}

      {summary?.skipped && (
        <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-start gap-2">
            <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
            <span>
              <span className="font-medium">Matching skipped</span> · {summary.skip_reason}. The extraction needs a human check
              before claims are matched.
            </span>
          </p>
          <button
            type="button"
            onClick={() => start(true)}
            disabled={!canMatch || starting}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-300 hover:bg-amber-100 disabled:opacity-50"
          >
            Match anyway
          </button>
        </div>
      )}

      {summary?.stale && !summary.skipped && (
        <p className="flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
          <InfoIcon width={16} height={16} className="mt-0.5 shrink-0" />
          The set of extracted 837 claims changed since this match ran. Re-match to include them.
        </p>
      )}

      {loading && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <SpinnerIcon width={14} height={14} /> Loading matches…
        </p>
      )}
      {detailError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{detailError}</p>}

      {detail && !summary?.skipped && detail.claims.length === 0 && (
        <p className="text-sm text-slate-500">The extraction found no claims on this EOB.</p>
      )}
      <div className="space-y-3">
        {detail?.claims.map((item) => (
          <ClaimMatchCard key={item.index} eobDocumentId={documentId} item={item} onChanged={handleReviewed} />
        ))}
      </div>
    </section>
  );
}
