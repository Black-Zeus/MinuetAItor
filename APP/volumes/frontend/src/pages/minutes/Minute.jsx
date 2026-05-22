// src/pages/minutes/Minutes.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";

import MinutesHeader from "./MinutesHeader";
import MinutesFilters from "./MinutesFilters";
import MinutesResults from "./MinutesResults";
import MinuteCard from "./MinuteCard";
import MinuteListRow from "./MinuteListRow";
import MinutesTableView from "./MinutesTableView";
import MinutesGroupedByClient from "./MinutesGroupedByClient";
import MinutesPagination from "./MinutesPagination";
import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";
import { toastInfo } from "@/components/common/toast/toastHelpers";
import useAbortableRequestScope from "@/hooks/useAbortableRequestScope";
import useModuleViewMode from "@/hooks/useModuleViewMode";

import { listMinutes, reprocessMinute, transitionMinute } from "@/services/minutesService";
import useMinuteNotificationStore from "@/store/minuteNotificationStore";

// ─── Constantes ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 12;
const GROUPED_VIEW_PAGE_SIZE = 5000;

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
  const addPending = useMinuteNotificationStore((s) => s.addPending);
  const requestScope = useAbortableRequestScope();

  // ── Estado de carga ──────────────────────────────────────────────────────
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState(null);

  // ── Datos ────────────────────────────────────────────────────────────────
  const [minutes, setMinutes] = useState([]);
  const [total,   setTotal]   = useState(0);

  // ── Paginación ───────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useModuleViewMode(["base", "list", "table", "client"]);
  const isGroupedByClientView = viewMode === "client";

  // ── Filtros reactivos ─────────────────────────────────────────────────────
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });

  // ─── Fetch principal ──────────────────────────────────────────────────────
  const fetchMinutes = useCallback(async (page, filters, showSpinner = false) => {
    const requestConfig = requestScope.createRequestConfig();

    if (showSpinner) setIsLoading(true);
    else             setIsRefreshing(true);
    setError(null);

    try {
      const normalizedPage = isGroupedByClientView ? 1 : page;
      const limit = isGroupedByClientView ? GROUPED_VIEW_PAGE_SIZE : PAGE_SIZE;
      const skip = isGroupedByClientView ? 0 : (normalizedPage - 1) * PAGE_SIZE;
      const data = await listMinutes({
        skip,
        limit,
        status_filter: filters.status     || null,
        client_id:     filters.client_id  || null,
        project_id:    filters.project_id || null,
      }, requestConfig);

      if (requestScope.wasAborted(requestConfig.signal)) return;

      setMinutes(data?.minutes ?? []);
      setTotal(data?.total     ?? 0);
    } catch (error) {
      if (requestScope.wasAborted(requestConfig.signal)) return;
      setError("No se pudieron cargar las minutas. Intenta nuevamente.");
      setMinutes([]);
      setTotal(0);
    } finally {
      if (!requestScope.wasAborted(requestConfig.signal)) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [isGroupedByClientView, requestScope]);

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchMinutes(1, EMPTY_FILTERS, true);
  }, [fetchMinutes]);

  // ── Re-fetch al cambiar filtros aplicados o página ────────────────────────
  useEffect(() => {
    fetchMinutes(currentPage, filters, false);
  }, [currentPage, filters, fetchMinutes]);

  // ── Exponer refresh global para useMinuteSSE ──────────────────────────────
  // El hook SSE llama window.__minutesRefresh() al recibir "completed" o "failed"
  // para actualizar la lista sin que el usuario tenga que hacer F5.
  useEffect(() => {
    window.__minutesRefresh = () => {
      fetchMinutes(currentPage, filters, false);
    };
    return () => {
      window.__minutesRefresh = null;
    };
  }, [fetchMinutes, currentPage, filters]);

  // ─── Handlers de filtros ──────────────────────────────────────────────────
  const handleFilterChange = (name, value) => {
    setCurrentPage(1);
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setCurrentPage(1);
    setFilters({ ...EMPTY_FILTERS });
  };

  // ─── Handler de transición de estado ─────────────────────────────────────
  const handleStatusChange = useCallback(async (minuteId, targetStatus, commitMessage) => {
    try {
      await transitionMinute(minuteId, targetStatus, commitMessage ?? null);
      fetchMinutes(currentPage, filters, false);
    } catch {
      // El interceptor de axios ya muestra el toast de error
    }
  }, [currentPage, filters, fetchMinutes]);

  const handleReprocess = useCallback(async (minuteId) => {
    try {
      const result = await reprocessMinute(minuteId);
      const minute = minutes.find((item) => item.id === minuteId);
      const title = minute?.title ?? minute?.client ?? "Minuta";
      addPending(
        result?.transactionId,
        result?.recordId ?? minuteId,
        title
      );
      toastInfo(
        "Reproceso encolado",
        `"${title}" volvió a cola y comenzará a procesarse.`,
        {
          autoClose: 5000,
          toastId: `minute-reprocess:${result?.transactionId ?? minuteId}`,
        }
      );
      fetchMinutes(currentPage, filters, false);
    } catch {
      // El interceptor de axios ya muestra el toast de error
    }
  }, [addPending, currentPage, filters, minutes, fetchMinutes]);

  // ─── Opciones para filtros ────────────────────────────────────────────────
  const { clients, projects } = useMemo(() => extractOptions(minutes), [minutes]);

  // ─── Paginación ───────────────────────────────────────────────────────────
  const totalPages = isGroupedByClientView ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleViewModeChange = (nextMode) => {
    if (nextMode === viewMode) return;
    setCurrentPage(1);
    setViewMode(nextMode);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return <PageLoadingSpinner message="Cargando Minutas..." />;
  }

  return (
    <div className="space-y-6">
      <MinutesHeader
        onNewMinute={() => {
          setCurrentPage(1);
          fetchMinutes(1, filters, false);
        }}
      />

      <MinutesFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        data={{ clients, projects }}
      />

      <MinutesResults
        count={minutes.length}
        total={total}
        isRefreshing={isRefreshing}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
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
          {viewMode === "base" ? (
            <div
              className={`mb-8 grid grid-cols-1 gap-6 transition-opacity duration-200 lg:grid-cols-2 xl:grid-cols-3 ${
                isRefreshing ? "opacity-50 pointer-events-none" : "opacity-100"
              }`}
            >
              {minutes.map((minute) => (
                <MinuteCard
                  key={minute.id}
                  minute={minute}
                  onStatusChange={handleStatusChange}
                  onReprocess={handleReprocess}
                />
              ))}
            </div>
          ) : null}

          {viewMode === "list" ? (
            <div className={`mb-8 space-y-4 transition-opacity duration-200 ${isRefreshing ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
              {minutes.map((minute) => (
                <MinuteListRow
                  key={minute.id}
                  minute={minute}
                  onStatusChange={handleStatusChange}
                  onReprocess={handleReprocess}
                />
              ))}
            </div>
          ) : null}

          {viewMode === "table" ? (
            <MinutesTableView
              minutes={minutes}
              onStatusChange={handleStatusChange}
              onReprocess={handleReprocess}
              isRefreshing={isRefreshing}
            />
          ) : null}

          {viewMode === "client" ? (
            <div className="mb-8">
              <MinutesGroupedByClient
                minutes={minutes}
                onStatusChange={handleStatusChange}
                onReprocess={handleReprocess}
                isRefreshing={isRefreshing}
              />
            </div>
          ) : null}

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
