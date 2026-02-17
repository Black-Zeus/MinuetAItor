// src/pages/minutes/Minutes.jsx
import React, { useState, useEffect, useMemo } from "react";
import minutesData from "@/data/minutes.json";

import MinutesHeader from "./MinutesHeader";
import MinutesFilters from "./MinutesFilters";
import MinutesResults from "./MinutesResults";
import MinuteCard from "./MinuteCard";
import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";

/** Helpers defensivos */
const normalizeText = (v) => String(v ?? "").trim().toLowerCase();

const parseDateAny = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yy = Number(m[3]);
    const d = new Date(yy, mm - 1, dd);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const Minutes = () => {
  const [isLoading, setIsLoading] = useState(true);

  // 1) Estado que controla el UI (lo que el usuario va seleccionando)
  const [filtersDraft, setFiltersDraft] = useState({
    client: "",
    project: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  // 2) Estado que se usa realmente para filtrar (se actualiza al presionar "Filtrar")
  const [appliedFilters, setAppliedFilters] = useState({
    client: "",
    project: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 250);
    return () => clearTimeout(t);
  }, []);

  const handleFilterChange = (filterName, value) => {
    setFiltersDraft((prev) => ({ ...prev, [filterName]: value }));
  };

  const handleClearFilters = () => {
    const empty = { client: "", project: "", status: "", dateFrom: "", dateTo: "" };
    setFiltersDraft(empty);
    setAppliedFilters(empty);
  };

  const handleApplyFilters = () => {
    setAppliedFilters(filtersDraft);
  };

  // Mapas opcionales para resolver ID -> name (si tus selects usan id, pero minutes usa texto)
  const clientById = useMemo(() => {
    const map = new Map();
    (minutesData?.clients ?? []).forEach((c) => {
      const id = String(c?.id ?? "");
      if (id) map.set(id, String(c?.name ?? c?.label ?? ""));
    });
    return map;
  }, []);

  const projectById = useMemo(() => {
    const map = new Map();
    (minutesData?.projects ?? []).forEach((p) => {
      const id = String(p?.id ?? "");
      if (id) map.set(id, String(p?.name ?? p?.label ?? ""));
    });
    return map;
  }, []);

  // Derivar minutos filtradas (esto es lo que alimenta MinutesResults + grid)
  const filteredMinutes = useMemo(() => {
    const minutes = Array.isArray(minutesData?.minutes) ? minutesData.minutes : [];

    const fClient = String(appliedFilters?.client ?? "").trim();
    const fProject = String(appliedFilters?.project ?? "").trim();
    const fStatus = String(appliedFilters?.status ?? "").trim();
    const fFrom = parseDateAny(appliedFilters?.dateFrom);
    const fTo = parseDateAny(appliedFilters?.dateTo);

    // Resolver “valor seleccionado” a texto, si venía como id
    const clientSelectedText = fClient ? (clientById.get(fClient) || fClient) : "";
    const projectSelectedText = fProject ? (projectById.get(fProject) || fProject) : "";

    return minutes.filter((m) => {
      // Cliente: soporta minuto con clientId o client (texto)
      if (fClient) {
        const mClientId = String(m?.clientId ?? "");
        const mClientText = String(m?.client ?? "");
        const okById = mClientId && mClientId === fClient;
        const okByText = normalizeText(mClientText) === normalizeText(clientSelectedText);
        if (!okById && !okByText) return false;
      }

      // Proyecto: soporta minuto con projectId o project (texto)
      if (fProject) {
        const mProjectId = String(m?.projectId ?? "");
        const mProjectText = String(m?.project ?? "");
        const okById = mProjectId && mProjectId === fProject;
        const okByText = normalizeText(mProjectText) === normalizeText(projectSelectedText);
        if (!okById && !okByText) return false;
      }

      // Estado
      if (fStatus) {
        const mStatus = String(m?.status ?? "");
        if (mStatus !== fStatus) return false;
      }

      // Rango de fechas: usa m.date (si no existe o no parsea, no pasa el filtro cuando hay rango)
      if (fFrom || fTo) {
        const mDate = parseDateAny(m?.date);
        if (!mDate) return false;

        if (fFrom && mDate < fFrom) return false;
        if (fTo) {
          // Inclusivo “hasta”: setea fin del día
          const end = new Date(fTo);
          end.setHours(23, 59, 59, 999);
          if (mDate > end) return false;
        }
      }

      return true;
    });
  }, [appliedFilters, clientById, projectById]);

  if (isLoading) {
    return <PageLoadingSpinner message="Cargando Minutas..." />;
  }

  return (
    <div className="w-full p-6 md:p-8">
      <MinutesHeader />

      <MinutesFilters
        filters={filtersDraft}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onApplyFilters={handleApplyFilters}
        data={minutesData}
      />

      <MinutesResults count={filteredMinutes.length} />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {filteredMinutes.map((minute) => (
          <MinuteCard key={minute.id} minute={minute} />
        ))}
      </div>
    </div>
  );
};

export default Minutes;