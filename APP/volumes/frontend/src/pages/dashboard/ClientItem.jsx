import React from "react";
import { TXT_BODY, TXT_TITLE } from "./Dashboard";

const ClientItem = ({ client }) => {
  const statusDot =
    client.status === "active"
      ? "bg-success-500 dark:bg-success-400"
      : "bg-secondary-400 dark:bg-secondary-500";

  return (
    <div className="p-4 hover:bg-secondary-50 dark:hover:bg-gray-800/40 transition-theme">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 flex items-center justify-center font-semibold text-sm flex-shrink-0 transition-theme">
          {client.avatar}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`text-sm font-semibold ${TXT_TITLE} truncate`}>{client.name}</h4>
            <div className={`w-2 h-2 rounded-full ${statusDot}`} />
          </div>

          <div className={`flex items-center gap-3 mt-1 text-xs ${TXT_BODY} transition-theme`}>
            <span>{client.projects} proyectos</span>
            <span>•</span>
            <span>{client.minutes} minutas</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientItem;
