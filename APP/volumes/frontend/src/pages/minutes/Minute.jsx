// src/pages/minutes/Minutes.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";

import MinutesHeader from "./MinutesHeader";
import MinutesFilters from "./MinutesFilters";
import MinutesResults from "./MinutesResults";
import MinuteCard from "./MinuteCard";
import MinutesPagination from "./MinutesPagination";
import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";

import { listMinutes, transitionMinute } from "@/services/minutesService";

// ─── Constantes ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 12;

const EMPTY_FILTERS = {
  status: "",
  client_id: "",
  project_id: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const extractOptions = (minutes) => {
  const clientMap  = new Map();
  const projectMap = new Map();

  (minutes ?? []).forEach((m) => {
    if (m.client_id  && m.client)  clientMap.set(m.client_id,   m.client);
    if (m.project_id && m.project) projectMap.set(m.project_id, m.project);
  });

  return {
    clients:  [...clientMap.entries()].map(([id, name])  => ({ id, name })),
    projects: [...projectMap.entries()].map(([id, name]) => ({ id, name })),
  };
};

// ─── Componente ───────────────────────────────────────────────────────────────
const Minutes = () => {

  // ── Estado de carga ──────────────────────────────────────────────────────
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState(null);

  // ── Datos ────────────────────────────────────────────────────────────────
  const [minutes, setMinutes] = useState([]);
  const [total,   setTotal]   = useState(0);

  // ── Paginación ───────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);

  // ── Filtros draft / aplicados ─────────────────────────────────────────────
  const [filtersDraft,    setFiltersDraft]    = useState({ ...EMPTY_FILTERS });
  const [appliedFilters,  setAppliedFilters]  = useState({ ...EMPTY_FILTERS });

  // ─── Fetch principal ──────────────────────────────────────────────────────
  const fetchMinutes = useCallback(async (page, filters, showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    else             setIsRefreshing(true);
    setError(null);

    try {
      const skip = (page - 1) * PAGE_SIZE;
      const data = await listMinutes({
        skip,
        limit:         PAGE_SIZE,
        status_filter: filters.status     || null,
        client_id:     filters.client_id  || null,
        project_id:    filters.project_id || null,
      });

      setMinutes(data?.minutes ?? []);
      setTotal(data?.total     ?? 0);
    } catch {
      setError("No se pudieron cargar las minutas. Intenta nuevamente.");
      setMinutes([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchMinutes(1, EMPTY_FILTERS, true);
  }, [fetchMinutes]);

  // ── Re-fetch al cambiar filtros aplicados o página ────────────────────────
  useEffect(() => {
    fetchMinutes(currentPage, appliedFilters, false);
  }, [currentPage, appliedFilters, fetchMinutes]);

  // ── Exponer refresh global para useMinuteSSE ──────────────────────────────
  // El hook SSE llama window.__minutesRefresh() al recibir "completed" o "failed"
  // para actualizar la lista sin que el usuario tenga que hacer F5.
  useEffect(() => {
    window.__minutesRefresh = () => {
      fetchMinutes(currentPage, appliedFilters, false);
    };
    return () => {
      window.__minutesRefresh = null;
    };
  }, [fetchMinutes, currentPage, appliedFilters]);

  // ─── Handlers de filtros ──────────────────────────────────────────────────
  const handleFilterChange = (name, value) => {
    setFiltersDraft((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    setAppliedFilters({ ...filtersDraft });
  };

  const handleClearFilters = () => {
    setFiltersDraft({ ...EMPTY_FILTERS });
    setCurrentPage(1);
    setAppliedFilters({ ...EMPTY_FILTERS });
  };

  // ─── Handler de transición de estado ─────────────────────────────────────
  const handleStatusChange = useCallback(async (minuteId, targetStatus, commitMessage) => {
    try {
      await transitionMinute(minuteId, targetStatus, commitMessage ?? null);
      fetchMinutes(currentPage, appliedFilters, false);
    } catch {
      // El interceptor de axios ya muestra el toast de error
    }
  }, [currentPage, appliedFilters, fetchMinutes]);

  // ─── Opciones para filtros ────────────────────────────────────────────────
  const { clients, projects } = useMemo(() => extractOptions(minutes), [minutes]);

  // ─── Paginación ───────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return <PageLoadingSpinner message="Cargando Minutas..." />;
  }

  return (
    <div className="w-full p-6 md:p-8">
      <MinutesHeader
        onNewMinute={() => {
          setCurrentPage(1);
          fetchMinutes(1, appliedFilters, false);
        }}
      />

      <MinutesFilters
        filters={filtersDraft}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onApplyFilters={handleApplyFilters}
        clients={clients}
        projects={projects}
      />

      <MinutesResults
        count={minutes.length}
        total={total}
        isRefreshing={isRefreshing}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
      />

      {/* Error state */}
      {error && (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!error && minutes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No se encontraron minutas con los filtros aplicados.
          </p>
        </div>
      )}

      {/* Grid */}
      {!error && minutes.length > 0 && (
        <>
          <div className={`grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8 transition-opacity duration-200
            ${isRefreshing ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
            {minutes.map((minute) => (
              <MinuteCard
                key={minute.id}
                minute={minute}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <MinutesPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Minutes;