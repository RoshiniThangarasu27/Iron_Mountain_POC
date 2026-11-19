"use client";

import { useCallback, useMemo, useState } from "react";

export function useSelection(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const selectedIds = useMemo(() => ids.filter((id) => selected.has(id)), [ids, selected]);
  const count = selectedIds.length;
  const allSelected = ids.length > 0 && count === ids.length;

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(ids));
  }, [allSelected, ids]);

  const clear = useCallback(() => setSelected(new Set()), []);
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  return { selectedIds, count, allSelected, someSelected: count > 0 && !allSelected, toggle, toggleAll, clear, isSelected };
}
