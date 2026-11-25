"use client";

import { useState } from "react";

import { rerunAllMatching, type EffectiveMatchStatus, type ReconciliationRow } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useReconciliation } from "@/lib/useReconciliation";
import { MATCH_STATUS_DOT, MATCH_STATUS_HINT, MATCH_STATUS_LABEL, MATCH_STATUS_ORDER } from "@/components/matching/matchStatus";
import { MatchStatusChip } from "@/components/matching/MatchStatusChip";
import { InfoIcon, RefreshIcon, SpinnerIcon } from "@/components/ui/Icons";
import { EmptyState, ErrorState } from "@/components/ui/States";

import { ReviewDrawer } from "./ReviewDrawer";

const money = (v: number | string | null | undefined) => (v == null || v === "" ? "—" : formatCurrency(String(v)));

function MatchCell({ row }: { row: ReconciliationRow }) {
  const target = row.linked ?? row.suggested;
  if (!target) return <span className="text-slate-400">—</span>;
  return (
    <div className="min-w-0">
      <p className="truncate">
        <span className="font-mono text-xs font-semibold text-slate-900">{target.claim_id ?? "?"}</span>
        {row.suggested && !row.linked && <span className="ml-1 text-xs text-slate-500">(suggested)</span>}
      </p>
      <p className="truncate text-xs text-slate-500" title={target.filename ?? undefined}>
        {target.filename ?? "837 document deleted"}
        {target.score != null && ` · ${target.score.toFixed(1)}`}
      </p>
    </div>
  );
}

export function ReconciliationView() {
  const [filter, setFilter] = useState<EffectiveMatchStatus | undefined>(undefined);
  const { data, loading, error, reload, polling } = useReconciliation({ status: filter });
  const [selected, setSelected] = useState<ReconciliationRow | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const rerun = async () => {
    setRerunning(true);
    setNotice(null);
    try {
      const res = await rerunAllMatching();
      setNotice(`Re-matching ${res.queued} EOB${res.queued === 1 ? "" : "s"}${res.skipped ? ` · ${res.skipped} skipped (not extracted or already running)` : ""}`);
      await reload(true);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not re-run matching");
    } finally {
      setRerunning(false);
    }
  };

  const docs = data?.documents;
  const total = data ? Object.values(data.summary).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Payment reconciliation</h2>
          <p className="text-sm text-slate-500">Each claim on an EOB / 835, matched to the 837 claim it pays.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => reload()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-white disabled:opacity-60"
          >
            <RefreshIcon width={16} height={16} className={loading || polling ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={rerun}
            disabled={rerunning}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
          >
            {rerunning ? <SpinnerIcon width={16} height={16} /> : <RefreshIcon width={16} height={16} />}
            Re-run matching
          </button>
        </div>
      </div>

      {notice && <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">{notice}</p>}

      {docs && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>
            <span className="font-semibold text-slate-900">{docs.total}</span> EOB{docs.total === 1 ? "" : "s"}
          </span>
          <span>{docs.matched} matched</span>
          {docs.in_progress > 0 && (
            <span className="inline-flex items-center gap-1 text-indigo-700">
              <SpinnerIcon width={12} height={12} /> {docs.in_progress} matching
            </span>
          )}
          {docs.skipped > 0 && <span className="text-amber-700">{docs.skipped} skipped (needs extraction review)</span>}
          {docs.failed > 0 && <span className="text-red-700">{docs.failed} failed</span>}
          {docs.not_started > 0 && <span>{docs.not_started} not extracted</span>}
        </p>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {MATCH_STATUS_ORDER.map((status) => {
            const active = filter === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(active ? undefined : status)}
                aria-pressed={active}
                title={MATCH_STATUS_HINT[status]}
                className={`rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-slate-300 ${
                  active ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"
                }`}
              >
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <span className={`size-2 rounded-full ${MATCH_STATUS_DOT[status]}`} />
                  {MATCH_STATUS_LABEL[status]}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{data.summary[status]}</p>
              </button>
            );
          })}
        </div>
      )}

      {filter && (
        <p className="text-sm text-slate-600">
          Showing <span className="font-medium">{MATCH_STATUS_LABEL[filter]}</span> ·{" "}
          <button type="button" onClick={() => setFilter(undefined)} className="font-medium text-teal-700 hover:underline">
            show all {total}
          </button>
        </p>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => reload()} />
      ) : loading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-200/60" />)}
        </div>
      ) : !data || data.rows.length === 0 ? (
        <EmptyState icon={<InfoIcon />} title={filter ? `No ${MATCH_STATUS_LABEL[filter].toLowerCase()} claims` : "No matched EOB claims yet"}>
          {filter
            ? "Try another filter."
            : "Upload 837 claim files and EOB images. Each EOB is matched automatically after its extraction succeeds."}
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="w-full px-4 py-3">EOB claim</th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">Service</th>
                <th scope="col" className="hidden px-4 py-3 text-right sm:table-cell">Billed / paid</th>
                <th scope="col" className="px-4 py-3">837 claim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((row) => {
                const c = row.eob_claim;
                return (
                  <tr
                    key={`${row.eob_document_id}-${row.claim_index}`}
                    onClick={() => setSelected(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(row);
                      }
                    }}
                    tabIndex={0}
                    className="cursor-pointer transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      <MatchStatusChip status={row.status} />
                      {row.stale && <p className="mt-1 text-xs text-sky-700">837s changed</p>}
                    </td>
                    <td className="max-w-0 px-4 py-3 align-top">
                      <p className="truncate font-medium text-slate-900">{c.patient_name || "Unknown patient"}</p>
                      <p className="truncate text-xs text-slate-500" title={row.eob_filename}>
                        {c.claim_id ? <span className="font-mono">{c.claim_id}</span> : "no claim ID"} · {c.date_of_service_from ?? "—"} ·{" "}
                        {row.eob_filename} #{row.claim_index + 1}
                      </p>
                      {row.reasons.length > 0 && !row.review && (
                        <p className="truncate text-xs text-amber-700" title={row.reasons.join(" · ")}>{row.reasons[0]}</p>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 align-top font-mono text-xs md:table-cell">{c.service_code ?? "—"}</td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-right align-top tabular-nums sm:table-cell">
                      <p>{money(c.billed_amount)}</p>
                      <p className="text-xs text-slate-500">{money(c.paid_amount)}</p>
                    </td>
                    <td className="max-w-48 px-4 py-3 align-top">
                      <MatchCell row={row} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <ReviewDrawer
          row={selected}
          onClose={() => setSelected(null)}
          onChanged={() => void reload(true)}
        />
      )}
    </div>
  );
}
