"use client";

import { useEffect, useState } from "react";

import { SpinnerIcon, TrashIcon } from "./Icons";

export function DeleteButton({ onConfirm, label = "Delete" }: { onConfirm: () => Promise<void>; label?: string }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setArmed(false), [label]);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const handleClick = async () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-60 ${
        armed ? "bg-red-600 text-white hover:bg-red-700" : "text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50"
      }`}
    >
      {busy ? <SpinnerIcon width={16} height={16} /> : <TrashIcon width={16} height={16} />}
      {busy ? "Deleting…" : armed ? `Click again to ${label.charAt(0).toLowerCase()}${label.slice(1)}` : label}
    </button>
  );
}
