import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import CatalogViewBar from "@/components/common/CatalogViewBar";
import useModuleViewMode from "@/hooks/useModuleViewMode";
import { listMinutes } from "@/services/minutesService";
import HistoryCardView from "./entityMinutesHistory/HistoryCardView";
import HistoryEmptyState from "./entityMinutesHistory/HistoryEmptyState";
import HistoryFilters from "./entityMinutesHistory/HistoryFilters";
import HistoryHeader from "./entityMinutesHistory/HistoryHeader";
import HistoryListView from "./entityMinutesHistory/HistoryListView";
import HistoryStats from "./entityMinutesHistory/HistoryStats";
import HistoryTable from "./entityMinutesHistory/HistoryTable";
import {
  applyHistoryFilters,
  buildOptionCatalog,
  getDefaultHistoryFilters,
  getMinutePdfState,
  normalizeEntity,
} from "./entityMinutesHistory/utils";
import { getMinuteStatusConfig } from "@/pages/minutes/MinuteCard";

const EntityMinutesHistoryPanel = ({ type = "client", entity, onBack }) => {
  const navigate = useNavigate();
  const normalizedEntity = useMemo(() => normalizeEntity(type, entity), [type, entity]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(() => getDefaultHistoryFilters());
  const [viewMode, setViewMode] = useModuleViewMode();

  useEffect(() => {
    setFilters(getDefaultHistoryFilters());
  }, [normalizedEntity.id, type]);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      if (!normalizedEntity.id) {
        setItems([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await listMinutes(
          {
            skip: 0,
            limit: 200,
            client_id: type === "client" ? normalizedEntity.id : null,
            project_id: type === "project" ? normalizedEntity.id : null,
            participant_id: type === "participant" ? normalizedEntity.id : null,
          },
          { signal: controller.signal }
        );
        setItems(Array.isArray(result?.minutes) ? result.minutes : []);
        setTotal(Number(result?.total ?? 0));
      } catch (err) {
        if (controller.signal.aborted) return;
        setError("No fue posible consultar las minutas asociadas.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [normalizedEntity.id, type]);

  const statusOptions = useMemo(() => {
    const byStatus = new Map();
    items.forEach((minute) => {
      const value = String(minute?.status ?? "").trim();
      if (!value) return;
      const config = getMinuteStatusConfig(minute);
      byStatus.set(value, config.label || value);
    });
    return [...byStatus.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [items]);

  const clientOptions = useMemo(() => buildOptionCatalog(items, "client", "client"), [items]);
  const projectOptions = useMemo(() => buildOptionCatalog(items, "project", "project"), [items]);

  const activeFiltersCount = useMemo(() => (
    Object.values(filters).filter((value) => String(value ?? "").trim() !== "").length
  ), [filters]);

  const filteredItems = useMemo(() => applyHistoryFilters(items, filters), [items, filters]);
  const hasFilters = items.length > 0 && activeFiltersCount > 0;

  const stats = useMemo(() => ({
    total: total || items.length,
    completed: items.filter((minute) => String(minute?.status ?? "") === "completed").length,
    inProgress: items.filter((minute) => ["in-progress", "processing", "queued"].includes(String(minute?.status ?? ""))).length,
    withPdf: items.filter((minute) => !getMinutePdfState(minute).disabled).length,
  }), [items, total]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(getDefaultHistoryFilters());
  };

  return (
    <div className="space-y-6 transition-theme [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <HistoryHeader
        entity={normalizedEntity}
        type={type}
        total={total}
        onBack={onBack || (() => navigate(type === "project" ? "/projects" : type === "participant" ? "/participants" : "/clients"))}
      />

      <main>
        <HistoryFilters
          type={type}
          filters={filters}
          statusOptions={statusOptions}
          clientOptions={clientOptions}
          projectOptions={projectOptions}
          activeFiltersCount={activeFiltersCount}
          onFilterChange={handleFilterChange}
          onClearFilters={clearFilters}
        />

        <HistoryStats stats={stats} />

        <CatalogViewBar
          count={filteredItems.length}
          singularLabel="minuta"
          pluralLabel="minutas"
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {loading || error ? (
          <HistoryEmptyState loading={loading} error={error} type={type} />
        ) : viewMode === "base" ? (
          <HistoryCardView minutes={filteredItems} type={type} hasFilters={hasFilters} />
        ) : viewMode === "list" ? (
          <HistoryListView minutes={filteredItems} type={type} hasFilters={hasFilters} />
        ) : (
          <HistoryTable
            minutes={filteredItems}
            type={type}
            navigate={navigate}
            hasFilters={hasFilters}
          />
        )}
      </main>
    </div>
  );
};

export default EntityMinutesHistoryPanel;
