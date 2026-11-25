"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { deleteReview, MATCH_WEIGHTS, saveReview, type ClaimMatchItem, type MatchCandidate } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { AlertIcon, CheckIcon, SpinnerIcon, XIcon } from "@/components/ui/Icons";

import { MatchStatusChip } from "./MatchStatusChip";
import { ScoreBar } from "./ScoreBar";

interface Props {
  eobDocumentId: string;
  item: ClaimMatchItem;
  onChanged: () => void;
  showNote?: boolean;
}

const money = (v: number | string | null | undefined) => (v == null || v === "" ? "—" : formatCurrency(String(v)));

function dateRange(from: string | null | undefined, to: string | null | undefined) {
  if (!from && !to) return "—";
  if (!to || from === to) return from ?? to ?? "—";
  return `${from} – ${to}`;
}

type Verdict = "match" | "partial" | "miss" | "conflict" | "na";

function VerdictCell({ verdict, children }: { verdict: Verdict; children: ReactNode }) {
  const style = {
    match: "text-emerald-700",
    partial: "text-amber-700",
    miss: "text-slate-400",
    conflict: "text-red-700 font-medium",
    na: "text-slate-400",
  }[verdict];
  return <td className={`whitespace-nowrap px-2 py-1.5 text-right tabular-nums ${style}`}>{children}</td>;
}

function points(candidate: MatchCandidate, field: keyof typeof MATCH_WEIGHTS): [number, Verdict] {
  const earned = candidate.score_breakdown[field] ?? 0;
  const max = MATCH_WEIGHTS[field];
  return [earned, earned >= max ? "match" : earned > 0 ? "partial" : "miss"];
}

function Comparison({ item, candidate }: { item: ClaimMatchItem; candidate: MatchCandidate }) {
  const eob = item.input;
  const claim = candidate.claim;
  const lines = claim.service_lines ?? [];
  const matchingLine = lines.find(
    (l) => (l.procedure_code ?? "").toUpperCase() === String(eob.service_code ?? "").toUpperCase(),
  );

  const idVerdict = (label: string): [string, Verdict] => {
    if (candidate.identifier_matches.includes(label)) return ["agrees", "match"];
    if (candidate.identifier_conflicts.some((c) => c.label === label)) return ["conflict", "conflict"];
    return ["not scored", "na"];
  };

  const rows: { label: string; eob: ReactNode; claim: ReactNode; verdict: [ReactNode, Verdict] }[] = [
    { label: "Claim ID", eob: eob.claim_id ?? "—", claim: claim.claim_id ?? "—", verdict: idVerdict("Claim ID") },
    { label: "Member ID", eob: eob.patient_id ?? "—", claim: claim.member_id ?? "—", verdict: idVerdict("Member ID") },
  ];
  const scored: [string, keyof typeof MATCH_WEIGHTS, ReactNode, ReactNode][] = [
    ["Patient", "patient_name", eob.patient_name ?? "—", claim.patient_name ?? "—"],
    [
      "Date of service",
      "date_of_service",
      dateRange(eob.date_of_service_from, eob.date_of_service_to),
      dateRange(claim.date_of_service_from, claim.date_of_service_to),
    ],
    [
      "Service code",
      "service_code",
      eob.service_code ?? "—",
      matchingLine?.procedure_code ?? (lines.map((l) => l.procedure_code).filter(Boolean).join(", ") || "—"),
    ],
    ["Billed amount", "billed_amount", money(eob.billed_amount), money(matchingLine?.line_charge_amount ?? claim.claim_amount)],
    ["Provider", "provider_name", eob.provider_name ?? "—", claim.provider_name ?? "—"],
  ];
  for (const [label, field, eobValue, claimValue] of scored) {
    const [earned, verdict] = points(candidate, field);
    rows.push({ label, eob: eobValue, claim: claimValue, verdict: [`${Number(earned.toFixed(2))}/${MATCH_WEIGHTS[field]}`, verdict] });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-2 py-1.5">Field</th>
            <th className="px-2 py-1.5">EOB</th>
            <th className="px-2 py-1.5">837 claim</th>
            <th className="px-2 py-1.5 text-right">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.label} className={row.verdict[1] === "conflict" ? "bg-red-50/60" : undefined}>
              <td className="whitespace-nowrap px-2 py-1.5 font-medium text-slate-600">{row.label}</td>
              <td className="break-words px-2 py-1.5 text-slate-900">{row.eob}</td>
              <td className="break-words px-2 py-1.5 text-slate-900">{row.claim}</td>
              <VerdictCell verdict={row.verdict[1]}>{row.verdict[0]}</VerdictCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClaimMatchCard({ eobDocumentId, item, onChanged, showNote = false }: Props) {
  const reviewedIndex = useMemo(
    () => (item.review?.edi_document_id ? item.candidates.findIndex((c) => c.document_id === item.review?.edi_document_id) : -1),
    [item],
  );
  const [selected, setSelected] = useState(reviewedIndex >= 0 ? reviewedIndex : 0);
  const [note, setNote] = useState(item.review?.note ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(reviewedIndex >= 0 ? reviewedIndex : 0);
    setNote(item.review?.note ?? "");
  }, [item, reviewedIndex]);

  const candidate = item.candidates[selected] ?? null;
  const reasons = item.hitl.reasons ?? [];
  const eob = item.input;

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the review");
    } finally {
      setBusy(null);
    }
  };

  const confirm = () =>
    candidate?.document_id &&
    run("confirm", () =>
      saveReview(eobDocumentId, item.index, { decision: "accepted", edi_document_id: candidate.document_id, note: note || null }),
    );
  const noMatch = () => run("no_match", () => saveReview(eobDocumentId, item.index, { decision: "no_match", note: note || null }));
  const undo = () => run("undo", () => deleteReview(eobDocumentId, item.index));

  const confirmedThis = item.review?.decision === "accepted" && item.review.edi_document_id === candidate?.document_id;

  return (
    <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">EOB claim #{item.index + 1}</p>
          <p className="truncate font-semibold text-slate-900">{eob.patient_name || "Unknown patient"}</p>
          <p className="text-xs text-slate-500">
            {eob.claim_id ? <span className="font-mono">{eob.claim_id}</span> : "No claim ID"} ·{" "}
            {dateRange(eob.date_of_service_from, eob.date_of_service_to)} · {eob.service_code || "—"} · billed {money(eob.billed_amount)} · paid{" "}
            {money(eob.paid_amount)}
          </p>
        </div>
        <MatchStatusChip status={item.effective_status} />
      </header>

      {item.review && (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
          <div className="min-w-0">
            {item.review.decision === "accepted" ? (
              <p>
                Confirmed as <span className="font-mono font-semibold">{item.review.edi_claim_id ?? "?"}</span>
                {!item.review.edi_document_id && <span className="text-amber-800"> (837 document was deleted)</span>}
              </p>
            ) : (
              <p>Marked as no matching 837 claim</p>
            )}
            {item.review.note && <p className="truncate text-xs text-teal-800">“{item.review.note}”</p>}
          </div>
          <button
            type="button"
            onClick={undo}
            disabled={busy !== null}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-300 hover:bg-teal-100 disabled:opacity-50"
          >
            {busy === "undo" ? "Undoing…" : "Undo"}
          </button>
        </div>
      )}

      {!item.review && reasons.length > 0 && (
        <ul className="space-y-0.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {reasons.map((r) => (
            <li key={r} className="flex items-start gap-1.5">
              <AlertIcon width={12} height={12} className="mt-0.5 shrink-0" /> {r}
            </li>
          ))}
        </ul>
      )}

      {item.candidates.length === 0 ? (
        <p className="text-sm text-slate-500">No extracted 837 claims were available to compare against.</p>
      ) : (
        <>
          <div role="tablist" aria-label="Candidate 837 claims" className="flex flex-wrap gap-1.5">
            {item.candidates.map((c, i) => (
              <button
                key={`${c.document_id}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === selected}
                onClick={() => setSelected(i)}
                title={c.filename ?? undefined}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${
                  i === selected ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {i === 0 ? "Best · " : ""}
                <span className="font-mono">{c.claim_id ?? "?"}</span> · {c.score.toFixed(1)}
              </button>
            ))}
          </div>

          {candidate && (
            <div className="space-y-3">
              <p className="truncate text-xs text-slate-500">
                From <span className="font-medium text-slate-700">{candidate.filename}</span>
              </p>
              <ScoreBar score={candidate.score} />
              <Comparison item={item} candidate={candidate} />
            </div>
          )}
        </>
      )}

      {showNote && (
        <label className="block text-xs font-medium text-slate-600">
          Reviewer note
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="Optional"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-normal text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </label>
      )}

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={!candidate?.document_id || busy !== null || confirmedThis}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
        >
          {busy === "confirm" ? <SpinnerIcon width={14} height={14} /> : <CheckIcon width={14} height={14} />}
          {confirmedThis ? "Confirmed" : `Confirm ${candidate?.claim_id ?? "match"}`}
        </button>
        <button
          type="button"
          onClick={noMatch}
          disabled={busy !== null || item.review?.decision === "no_match"}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "no_match" ? <SpinnerIcon width={14} height={14} /> : <XIcon width={14} height={14} />}
          No match
        </button>
      </div>
    </article>
  );
}
