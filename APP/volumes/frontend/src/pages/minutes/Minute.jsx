// src/pages/minutes/Minutes.jsx
import React, { useState, useEffect } from "react";
import LoadingSpinner from "@/components/ui/modal/types/system/LoadingSpinner";
import minutesData from "@/data/minutes.json";
import MinutesHeader from "./MinutesHeader";
import MinutesFilters from "./MinutesFilters";
import MinutesResults from "./MinutesResults";
import MinuteCard from "./MinuteCard";
import MinutesPagination from "./MinutesPagination";

const Minutes = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    client: "",
    project: "",
    dateFrom: "",
    dateTo: "",
    participant: "",
  });

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 250);
    return () => clearTimeout(t);
  }, []);

  const handleFilterChange = (filterName, value) => {
    setFilters((prev) => ({ ...prev, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      client: "",
      project: "",
      dateFrom: "",
      dateTo: "",
      participant: "",
    });
  };

  const handleApplyFilters = () => {
    console.log("Aplicar filtros", filters);
  };

  if (isLoading) {
    return (
      <div className="w-full p-6 md:p-8">
        <div className="bg-surface shadow-card rounded-2xl p-8 border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 transition-theme">
          <LoadingSpinner
            message="Cargando..."
            variant="default"
            size="medium"
            spinnerType="default"
            showProgress={false}
            indeterminate={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 md:p-8">
      <MinutesHeader />
      
      <MinutesFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onApplyFilters={handleApplyFilters}
        data={minutesData}
      />

      <MinutesResults count={minutesData.minutes.length} />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {minutesData.minutes.map((minute) => (
          <MinuteCard key={minute.id} minute={minute} />
        ))}
      </div>

      <MinutesPagination currentPage={1} totalPages={3} />
    </div>
  );
};

export default Minutes;