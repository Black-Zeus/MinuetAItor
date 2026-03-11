import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import ParticipantsCard from "./ParticipantsCard";

const EmptyState = ({ hasFilters }) => (
  <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
    <Icon
      name={hasFilters ? "FaSearch" : "FaUsers"}
      className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4"
    />
    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
      {hasFilters ? "Sin resultados" : "Sin participantes registrados"}
    </h3>
    <p className="text-sm text-gray-500 dark:text-gray-400">
      {hasFilters
        ? "Ningún participante coincide con los filtros aplicados."
        : "Crea el primer participante del catálogo para comenzar."}
    </p>
  </div>
);

const ParticipantsGrid = ({ participants, hasFilters, onUpdated, onDeleted }) => {
  if (!participants.length) {
    return <EmptyState hasFilters={hasFilters} />;
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {participants.length} participante{participants.length !== 1 ? "s" : ""}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {participants.map((participant) => (
          <ParticipantsCard
            key={participant.id}
            id={participant.id}
            summary={participant}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
          />
        ))}
      </div>
    </div>
  );
};

export default ParticipantsGrid;
