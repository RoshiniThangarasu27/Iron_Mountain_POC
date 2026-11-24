"use client";

import { useState, type ReactNode } from "react";

import {
  isExtractionActive,
  startExtraction,
  type DocType,
  type EobPayload,
  type ExtractedClaim,
  type ExtractionResult,
  type ExtractionStatus,
} from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useExtractionDetail } from "@/lib/useExtractionDetail";
import { AlertIcon, RefreshIcon, SpinnerIcon } from "@/components/ui/Icons";

import { ExtractionBadge } from "./ExtractionBadge";

interface Props {
  documentId: string;
  docType: DocType;
  status: ExtractionStatus | null;
  onStatusChange: (status: ExtractionStatus) => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-slate-900">{children || "—"}</dd>
    </div>
  );
}

const money = (value: number | string | null | undefined) => (value == null || value === "" ? "—" : formatCurrency(String(value)));
const percent = (value: number | null | undefined) => (value == null ? "—" : `${Math.round(value * 100)}%`);

function ClaimResult({ claim }: { claim: ExtractedClaim }) {
  const dos =
    claim.date_of_service_from && claim.date_of_service_to && claim.date_of_service_from !== claim.date_of_service_to
      ? `${claim.date_of_service_from} – ${claim.date_of_service_to}`
      : claim.date_of_service_from;
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Field label="Claim ID">{claim.claim_id}</Field>
        <Field label="Claim amount">{money(claim.claim_amount)}</Field>
        <Field label="Date of service">{dos}</Field>
        <Field label="Member ID">{claim.member_id}</Field>
        <Field label="Patient">{claim.patient_name}</Field>
        <Field label="Provider">{claim.provider_name}</Field>
        <Field label="Provider NPI">{claim.provider_npi}</Field>
      </dl>
      {claim.service_lines && claim.service_lines.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Procedure</th>
                <th className="px-3 py-2 text-right">Charge</th>
                <th className="px-3 py-2 text-right">Units</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claim.service_lines.map((line, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-mono text-xs">{line.procedure_code ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(line.line_charge_amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.units ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EobResult({ result, payload }: { result: ExtractionResult; payload: EobPayload }) {
  const claims = payload.claims ?? [];
  const remarks = (payload.remark_codes ?? []).filter((r) => r.code || r.description);
  const validation = Object.entries(result.validation_errors ?? {});
  return (
    <div className="space-y-4">
      {result.review?.required ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} />
          <span>
            <span className="font-medium">Needs human review</span>
            {result.review.reason && <> · {result.review.reason}</>}
          </span>
        </div>
      ) : (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">No review required</p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Document confidence">{percent(payload.document_confidence)}</Field>
        <Field label="Claims found">{claims.length}</Field>
        <Field label="Payment date">{payload.payment_info?.payment_date}</Field>
        <Field label="Payment reference">{payload.payment_info?.payment_reference}</Field>
      </dl>

      {validation.length > 0 && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <p className="mb-1 font-medium">Amount checks</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {validation.map(([claimId, issues]) => (
              <li key={claimId}>
                <span className="font-mono text-xs">{claimId}</span>: {issues.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {claims.map((claim, i) => (
        <div key={`${claim.claim_id ?? "claim"}-${i}`} className="space-y-3 rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-mono text-sm font-semibold text-slate-900">{claim.claim_id || `Claim ${i + 1}`}</p>
            <p className="text-xs text-slate-500">
              {claim.date_of_service_from}
              {claim.date_of_service_to && claim.date_of_service_to !== claim.date_of_service_from && ` – ${claim.date_of_service_to}`}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Field label="Patient">{claim.patient_name}</Field>
            <Field label="Patient ID">{claim.patient_id}</Field>
            <Field label="Provider">{claim.provider_name}</Field>
            <Field label="Service code">
              {claim.service_code}
              {claim.modifier ? `-${claim.modifier}` : ""}
            </Field>
            <Field label="Billed">{money(claim.billed_amount)}</Field>
            <Field label="Allowed">{money(claim.allowed_amount)}</Field>
            <Field label="Paid">{money(claim.paid_amount)}</Field>
            <Field label="Patient owes">{money(claim.patient_responsibility)}</Field>
          </dl>
          {claim.confidence && (
            <p className="text-xs text-slate-500">
              Confidence:{" "}
              {Object.entries(claim.confidence)
                .map(([k, v]) => `${k.replace(/_/g, " ")} ${percent(v)}`)
                .join(" · ")}
            </p>
          )}
        </div>
      ))}

      {remarks.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Remark codes</p>
          <ul className="space-y-1 text-sm">
            {remarks.map((r, i) => (
              <li key={i}>
                <span className="font-mono text-xs font-semibold">{r.code}</span> {r.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ExtractionPanel({ documentId, docType, status, onStatusChange }: Props) {
  const { detail, loading, error: detailError } = useExtractionDetail(documentId, status);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const active = isExtractionActive(status);
  const result = detail?.result ?? null;

  const rerun = async () => {
    setStarting(true);
    setStartError(null);
    try {
      onStatusChange(await startExtraction(documentId));
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Could not start extraction");
    } finally {
      setStarting(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Extraction</h3>
          <ExtractionBadge status={status} />
        </div>
        <button
          type="button"
          onClick={rerun}
          disabled={active || starting}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          {starting ? <SpinnerIcon width={14} height={14} /> : <RefreshIcon width={14} height={14} />}
          {status?.state === "not_started" || !status ? "Run extraction" : "Re-run"}
        </button>
      </div>

      {(status?.requested_at || status?.finished_at) && (
        <p className="text-xs text-slate-500">
          {status.requested_at && <>Requested {formatDateTime(status.requested_at)}</>}
          {status.finished_at && <> · finished {formatDateTime(status.finished_at)}</>}
          {result && <> · {result.duration_ms} ms</>}
          {result?.model && <> · model {result.model}</>}
        </p>
      )}

      {startError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{startError}</p>}

      {status?.state === "failed" && status.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{status.error}</p>
      )}
      {status?.state === "retrying" && status.error && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Last attempt failed: {status.error}</p>
      )}
      {active && status?.state !== "retrying" && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <SpinnerIcon width={14} height={14} /> {docType === "eob_835" ? "The AI model is reading the image…" : "Parsing the claim…"}
        </p>
      )}

      {loading && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <SpinnerIcon width={14} height={14} /> Loading result…
        </p>
      )}
      {detailError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{detailError}</p>}

      {result?.claim && <ClaimResult claim={result.claim} />}
      {result?.payload && <EobResult result={result} payload={result.payload} />}

      {result && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-slate-500 hover:text-slate-700">
            Raw JSON
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100">
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      )}
    </section>
  );
}
