import React from "react";
import { FaBuilding } from "react-icons/fa";
import SectionCard from "./SectionCard";
import ClientItem from "./ClientItem";

const DIVIDER_FRAME = "divide-y divide-secondary-200 dark:divide-secondary-700/60";

const ClientsActivityList = ({ clients = [], limit = 5 }) => {
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <FaBuilding className="w-4 h-4 text-success-600 dark:text-success-400" />
          Clientes Activos
        </span>
      }
    >
      <div className={DIVIDER_FRAME}>
        {clients.slice(0, limit).map((client) => (
          <ClientItem key={client.id} client={client} />
        ))}
      </div>
    </SectionCard>
  );
};

export default ClientsActivityList;
