import React from "react";

/**
 * ✅ Variantes literales (Tailwind JIT safe)
 */
const TAG_COLOR_CLASSES = {
  blue: "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-200",
  green: "bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-200",
  purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-200",
  orange: "bg-warm-50 dark:bg-warm-900/20 text-warm-700 dark:text-warm-200",
  red: "bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-200",
  yellow: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-200",
  indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-200",
  pink: "bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-200",
};

const TagBadge = ({ tag }) => {
  const cls = TAG_COLOR_CLASSES[tag.color] ?? TAG_COLOR_CLASSES.blue;

  return (
    <span className={`px-3 py-1.5 rounded-2xl text-xs font-medium ${cls} transition-theme`}>
      {tag.name} ({tag.count})
    </span>
  );
};

export default TagBadge;
