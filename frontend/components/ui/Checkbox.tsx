"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";

const ACCENTS = {
  teal: "accent-teal-600 focus-visible:outline-teal-600",
  indigo: "accent-indigo-600 focus-visible:outline-indigo-600",
};

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  indeterminate?: boolean;
  accent?: keyof typeof ACCENTS;
};

export function Checkbox({ indeterminate = false, accent = "teal", className = "", ...props }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={`size-4 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2 ${ACCENTS[accent]} ${className}`}
      {...props}
    />
  );
}
