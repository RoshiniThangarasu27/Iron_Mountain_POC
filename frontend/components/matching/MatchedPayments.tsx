"use client";

import { formatCurrency } from "@/lib/format";
import { useReconciliation } from "@/lib/useReconciliation";
import { SpinnerIcon } from "@/components/ui/Icons";

import { MatchStatusChip } from "./MatchStatusChip";

export function MatchedPayments({ ediDocumentId }: { ediDocumentId: string }) {
  const { data, loading, error } = useReconciliation({ edi_document_id: ediDocumentId });
  const rows = data?.rows ?? [];

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-900">Matched EOB payments</h3>
      {loading && !data ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <SpinnerIcon width={14} height={14} /> Loading…
        </p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No EOB claims are linked to this 837 claim yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {rows.map((row) => (
            <li key={`${row.eob_document_id}-${row.claim_index}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-slate-900">
                  {row.eob_filename} <span className="text-slate-500">#{row.claim_index + 1}</span>
                </p>
                <p className="truncate text-xs text-slate-500">
                  {row.eob_claim.patient_name ?? "—"} · billed{" "}
                  {row.eob_claim.billed_amount != null ? formatCurrency(String(row.eob_claim.billed_amount)) : "—"} · paid{" "}
                  {row.eob_claim.paid_amount != null ? formatCurrency(String(row.eob_claim.paid_amount)) : "—"}
                </p>
              </div>
              <MatchStatusChip status={row.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
