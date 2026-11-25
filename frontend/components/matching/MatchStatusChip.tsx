import type { EffectiveMatchStatus } from "@/lib/api";

import { MATCH_STATUS_HINT, MATCH_STATUS_LABEL, MATCH_STATUS_STYLE } from "./matchStatus";

export function MatchStatusChip({ status }: { status: EffectiveMatchStatus }) {
  return (
    <span
      title={MATCH_STATUS_HINT[status]}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${MATCH_STATUS_STYLE[status]}`}
    >
      {MATCH_STATUS_LABEL[status]}
    </span>
  );
}
