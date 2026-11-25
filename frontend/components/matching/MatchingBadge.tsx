import type { MatchingStatus } from "@/lib/api";
import { SpinnerIcon } from "@/components/ui/Icons";

const chip = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

export function MatchingBadge({ status }: { status: MatchingStatus | null }) {
  if (!status || status.state === "not_started") return null;

  if (status.state === "queued" || status.state === "running" || status.state === "retrying") {
    const label = status.step === "waiting_for_extraction" ? "Matching after extraction" : "Matching claims…";
    return (
      <span className={`${chip} bg-indigo-50 text-indigo-700 ring-indigo-600/20`}>
        <SpinnerIcon width={12} height={12} className="shrink-0" />
        {label}
      </span>
    );
  }
  if (status.state === "failed") {
    return <span title={status.error ?? undefined} className={`${chip} bg-red-50 text-red-700 ring-red-600/20`}>Matching failed</span>;
  }

  const s = status.summary;
  if (!s) return null;
  if (s.skipped) {
    return (
      <span title={s.skip_reason ?? undefined} className={`${chip} bg-amber-50 text-amber-800 ring-amber-600/30`}>
        Matching skipped
      </span>
    );
  }
  const linked = s.auto_matched + s.confirmed;
  const open = s.needs_review + s.unmatched;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {linked > 0 && <span className={`${chip} bg-emerald-50 text-emerald-700 ring-emerald-600/20`}>{linked} matched</span>}
      {open > 0 && <span className={`${chip} bg-amber-50 text-amber-800 ring-amber-600/30`}>{open} to review</span>}
      {s.no_match > 0 && <span className={`${chip} bg-slate-100 text-slate-600 ring-slate-500/20`}>{s.no_match} no match</span>}
      {s.claims === 0 && <span className={`${chip} bg-slate-100 text-slate-600 ring-slate-500/20`}>No claims</span>}
    </span>
  );
}
