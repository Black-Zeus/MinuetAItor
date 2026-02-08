// src/pages/minutes/components/MinutesPagination.jsx
import React from "react";
import Icon from "@/components/ui/icon/iconManager";

const TXT_META = "text-gray-500 dark:text-gray-400";

const MinutesPagination = ({ currentPage, totalPages }) => {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex justify-center items-center gap-2 py-8">
      <button
        disabled={currentPage === 1}
        className={`min-w-[40px] px-4 py-2 bg-surface shadow-card border border-secondary-200 dark:border-secondary-700 ${TXT_META} rounded-xl text-sm font-medium transition-theme disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
      >
        <Icon name="chevronLeft" />
      </button>

      {pages.map((page) => (
        <button
          key={page}
          className={
            page === currentPage
              ? "min-w-[40px] px-4 py-2 bg-primary-500 border border-primary-500 text-white rounded-xl text-sm font-medium shadow-button hover:shadow-button-hover transition-all"
              : `min-w-[40px] px-4 py-2 bg-surface shadow-card border border-secondary-200 dark:border-secondary-700 ${TXT_META} rounded-xl text-sm font-medium hover:bg-secondary-50 dark:hover:bg-secondary-800/50 hover:border-secondary-300 dark:hover:border-secondary-600 hover:text-gray-900 dark:hover:text-gray-50 transition-theme`
          }
        >
          {page}
        </button>
      ))}

      <button
        disabled={currentPage === totalPages}
        className={`min-w-[40px] px-4 py-2 bg-surface shadow-card border border-secondary-200 dark:border-secondary-700 ${TXT_META} rounded-xl text-sm font-medium hover:bg-secondary-50 dark:hover:bg-secondary-800/50 hover:border-secondary-300 dark:hover:border-secondary-600 hover:text-gray-900 dark:hover:text-gray-50 transition-theme flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <Icon name="chevronRight" />
      </button>
    </div>
  );
};

export default MinutesPagination;
