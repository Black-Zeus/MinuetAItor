import React from "react";
import { FaPlus } from "react-icons/fa";
import { TXT_BODY, TXT_TITLE } from "./Dashboard";

const DashboardHeader = ({ userName, subtitle, onNewMinute }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className={`text-3xl font-bold ${TXT_TITLE} transition-theme`}>
          Bienvenido, {userName}
        </h1>
        <p className={`mt-1 text-sm ${TXT_BODY} transition-theme`}>{subtitle}</p>
      </div>

      <button
        type="button"
        onClick={onNewMinute}
        className="btn-base btn-md gap-2 bg-primary-600 hover:bg-primary-700 text-white shadow-button hover:shadow-button-hover transition-theme rounded-2xl"
      >
        <FaPlus className="w-4 h-4" />
        Nueva Minuta
      </button>
    </div>
  );
};

export default DashboardHeader;
