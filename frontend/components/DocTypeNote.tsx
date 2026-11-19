"use client";

import { useState } from "react";

import { InfoIcon } from "@/components/ui/Icons";

export function DocTypeNote() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-950">
      <div className="flex items-start gap-3">
        <InfoIcon className="mt-0.5 shrink-0 text-sky-600" />
        <div className="min-w-0 flex-1">
          <p>
            <strong>837 EDI</strong> = health care <em>claim</em> files (X12 text). <strong>EOB / 835</strong> = images of
            claim payment / Explanation of Benefits documents.{" "}
            <button type="button" onClick={() => setOpen((o) => !o)} className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900" aria-expanded={open}>
              {open ? "Hide details" : "What about 834?"}
            </button>
          </p>
          {open && (
            <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold">X12 837</dt>
              <dd>Health care claim sent by a provider to a payer. Plain-text X12 (<code>.txt</code>, <code>.edi</code>, <code>.x12</code>, <code>.dat</code>). Accepted in the <em>837 EDI</em> upload.</dd>
              <dt className="font-semibold">X12 835 (ERA)</dt>
              <dd>Electronic Remittance Advice: the payer&apos;s machine-readable claim payment/adjudication response.</dd>
              <dt className="font-semibold">EOB</dt>
              <dd>Explanation of Benefits: the human-readable payment explanation, often a scanned page. It carries the same adjudication information as an 835, so this app groups EOB images under <em>EOB / 835</em> (<code>.png</code>, <code>.jpg</code>, <code>.jpeg</code>, <code>.webp</code>).</dd>
              <dt className="font-semibold">X12 834</dt>
              <dd>Benefit <em>enrollment</em> and maintenance (member eligibility). It is <strong>not</strong> an EOB and is not handled by this app.</dd>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
