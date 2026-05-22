import { useMemo, useState } from "react";

const normalizeComparableValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  return String(value).trim().toLocaleLowerCase("es");
};

const compareValues = (left, right) => {
  const normalizedLeft = normalizeComparableValue(left);
  const normalizedRight = normalizeComparableValue(right);

  if (normalizedLeft === null && normalizedRight === null) return 0;
  if (normalizedLeft === null) return 1;
  if (normalizedRight === null) return -1;

  if (typeof normalizedLeft === "number" && typeof normalizedRight === "number") {
    return normalizedLeft - normalizedRight;
  }

  return String(normalizedLeft).localeCompare(String(normalizedRight), "es", {
    numeric: true,
    sensitivity: "base",
  });
};

const useTableSorting = (items = [], sorters = {}) => {
  const [sortConfig, setSortConfig] = useState(null);

  const sortedItems = useMemo(() => {
    if (!sortConfig?.key || typeof sorters?.[sortConfig.key] !== "function") {
      return items;
    }

    const sorter = sorters[sortConfig.key];
    const directionMultiplier = sortConfig.direction === "desc" ? -1 : 1;

    return [...items].sort((left, right) => directionMultiplier * compareValues(sorter(left), sorter(right)));
  }, [items, sortConfig, sorters]);

  const toggleSort = (key) => {
    if (typeof sorters?.[key] !== "function") return;

    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  return {
    sortedItems,
    sortConfig,
    toggleSort,
  };
};

export default useTableSorting;
