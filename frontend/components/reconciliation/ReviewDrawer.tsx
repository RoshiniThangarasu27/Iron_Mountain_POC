"use client";

import { useCallback, useEffect, useState } from "react";

import { contentUrl, getMatching, type MatchingDetail, type ReconciliationRow } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { ClaimMatchCard } from "@/components/matching/ClaimMatchCard";
import { ExternalIcon, SpinnerIcon, XIcon } from "@/components/ui/Icons";
import { Drawer } from "@/components/ui/Overlay";

interface Props {
  row: ReconciliationRow;
  onClose: () => void;
  onChanged: () => void;
}

export function ReviewDrawer({ row, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<MatchingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await getMatching(row.eob_document_id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the match");
    }
  }, [row.eob_document_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const item = detail?.claims.find((c) => c.index === row.claim_index) ?? null;
  const titleId = `review-${row.eob_document_id}-${row.claim_index}`;

  return (
    <Drawer onClose={onClose} labelledBy={titleId}>
      <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
        <img
          src={contentUrl(row.eob_document_id)}
          alt=""
          className="h-16 w-12 shrink-0 rounded border border-slate-200 object-cover object-top"
        />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate text-lg font-semibold text-slate-900">
            Review match · claim #{row.claim_index + 1}
          </h2>
          <p className="truncate text-sm text-slate-500">
            {row.eob_filename}
            {row.matched_at && <> · matched {formatDateTime(row.matched_at)}</>}
          </p>
          <a
            href={contentUrl(row.eob_document_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
          >
            <ExternalIcon width={12} height={12} /> Open EOB image
          </a>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Close">
          <XIcon />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto bg-slate-50 p-5">
        {row.stale && (
          <p className="mb-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
            837 claims changed since this EOB was matched; re-run matching to compare against the latest set.
          </p>
        )}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {!detail && !error && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <SpinnerIcon width={14} height={14} /> Loading match…
          </p>
        )}
        {detail && !item && <p className="text-sm text-slate-500">This claim is no longer in the latest matching result.</p>}
        {item && (
          <ClaimMatchCard
            eobDocumentId={row.eob_document_id}
            item={item}
            showNote
            onChanged={() => {
              void load();
              onChanged();
            }}
          />
        )}
      </div>
    </Drawer>
  );
}
