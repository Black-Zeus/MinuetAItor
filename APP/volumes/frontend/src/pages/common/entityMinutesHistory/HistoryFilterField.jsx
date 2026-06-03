import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import { FILTER_META, FILTER_TEXT } from "./constants";

const HistoryFilterField = ({ type, label, icon, value, onChange, options = [], placeholder }) => (
  <div className="flex flex-col gap-2">
    <label className={`flex items-center gap-2 text-sm font-semibold ${FILTER_META} transition-theme`}>
      <Icon name={icon} className="text-sm text-primary-500 dark:text-primary-400" />
      {label}
    </label>

    {type === "select" ? (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border border-secondary-200 bg-white px-4 py-2.5 text-sm ${FILTER_TEXT} transition-theme hover:border-secondary-300 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10 dark:border-secondary-700 dark:bg-gray-800 dark:hover:border-secondary-600`}
      >
        <option value="" className="bg-white dark:bg-gray-800">
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-white dark:bg-gray-800">
            {option.label}
          </option>
        ))}
      </select>
    ) : type === "date" ? (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border border-secondary-200 bg-white px-4 py-2.5 text-sm ${FILTER_TEXT} transition-theme hover:border-secondary-300 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10 dark:border-secondary-700 dark:bg-gray-800 dark:hover:border-secondary-600`}
      />
    ) : (
      <div className="relative">
        <Icon name="FaSearch" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-secondary-200 bg-white py-2.5 pl-10 pr-4 text-sm ${FILTER_TEXT} placeholder-gray-400 transition-theme hover:border-secondary-300 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10 dark:border-secondary-700 dark:bg-gray-800 dark:placeholder:text-secondary-500 dark:hover:border-secondary-600`}
        />
      </div>
    )}
  </div>
);

export default HistoryFilterField;
