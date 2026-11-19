import type { DocStatus } from "@/lib/api";

const STYLES: Record<DocStatus, string> = {
  parsed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  uploaded: "bg-sky-50 text-sky-700 ring-sky-600/20",
  failed: "bg-amber-50 text-amber-800 ring-amber-600/30",
};

const TITLES: Record<DocStatus, string> = {
  parsed: "Stored and inspected successfully",
  uploaded: "Stored; no data extraction has run yet",
  failed: "Stored, but inspection could not recognize the content",
};

export function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <span
      title={TITLES[status]}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
