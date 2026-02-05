import React from "react";
import { TXT_BODY } from "./Dashboard";

const DashboardError = ({ message = "Ocurrió un error." }) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh] bg-background-light dark:bg-background-dark transition-theme">
      <div className="text-center">
        <p className={`${TXT_BODY} transition-theme`}>{message}</p>
      </div>
    </div>
  );
};

export default DashboardError;
