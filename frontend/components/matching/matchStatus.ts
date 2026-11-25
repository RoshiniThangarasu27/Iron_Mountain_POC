import type { EffectiveMatchStatus } from "@/lib/api";

export const MATCH_STATUS_ORDER: EffectiveMatchStatus[] = [
  "needs_review",
  "unmatched",
  "auto_matched",
  "confirmed",
  "no_match",
];

export const MATCH_STATUS_LABEL: Record<EffectiveMatchStatus, string> = {
  auto_matched: "Auto-matched",
  needs_review: "Needs review",
  unmatched: "Unmatched",
  confirmed: "Confirmed",
  no_match: "Marked no match",
};

export const MATCH_STATUS_HINT: Record<EffectiveMatchStatus, string> = {
  auto_matched: "Score ≥ 85 with no conflicts or close runner-up",
  needs_review: "A likely match that a person should confirm",
  unmatched: "No 837 claim scored high enough",
  confirmed: "A reviewer confirmed the 837 claim",
  no_match: "A reviewer said no 837 claim matches",
};

export const MATCH_STATUS_STYLE: Record<EffectiveMatchStatus, string> = {
  auto_matched: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  needs_review: "bg-amber-50 text-amber-800 ring-amber-600/30",
  unmatched: "bg-rose-50 text-rose-700 ring-rose-600/20",
  confirmed: "bg-teal-50 text-teal-700 ring-teal-600/20",
  no_match: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export const MATCH_STATUS_DOT: Record<EffectiveMatchStatus, string> = {
  auto_matched: "bg-emerald-500",
  needs_review: "bg-amber-500",
  unmatched: "bg-rose-500",
  confirmed: "bg-teal-600",
  no_match: "bg-slate-400",
};
