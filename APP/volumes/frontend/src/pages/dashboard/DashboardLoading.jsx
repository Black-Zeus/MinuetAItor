import React from "react";
import { TXT_BODY } from "./Dashboard";

const DashboardLoading = ({ label = "Cargando dashboard..." }) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh] bg-background-light dark:bg-background-dark transition-theme">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className={`${TXT_BODY} transition-theme`}>{label}</p>
      </div>
    </div>
  );
};

export default DashboardLoading;
