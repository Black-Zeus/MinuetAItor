import React from "react";
import { FaPlus } from "react-icons/fa";
import { TXT_BODY, TXT_TITLE } from "./Dashboard";
import NewMinute from "@/components/ui/button/newMinute";

const DashboardHeader = ({ userName, subtitle, onNewMinute }) => {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <h1 className={`text-3xl font-bold ${TXT_TITLE} transition-theme`}>
                    Bienvenido, {userName}
                </h1>
                <p className={`mt-1 text-sm ${TXT_BODY} transition-theme`}>{subtitle}</p>
            </div>

            <NewMinute />
            
        </div>
    );
};

export default DashboardHeader;
