import React, { useCallback, useEffect, useMemo, useState } from "react";
import ParticipantsHeader from "./ParticipantsHeader";
import ParticipantsFilters from "./ParticipantsFilters";
import ParticipantsStats from "./ParticipantsStats";
import ParticipantsGrid from "./ParticipantsGrid";
import ParticipantsListView from "./ParticipantsListView";
import ParticipantsTableView from "./ParticipantsTableView";
import CatalogBasePagination from "@/components/common/CatalogBasePagination";
import CatalogPagePagination from "@/components/common/CatalogPagePagination";
import participantsService from "@/services/participantsService";
import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";
import CatalogViewBar from "@/components/common/CatalogViewBar";
import useModuleViewMode from "@/hooks/useModuleViewMode";
import logger from "@/utils/logger";

const participantsLog = logger.scope("participants");
const DEFAULT_ITEMS_PER_PAGE = 18;
const TABLE_ITEMS_PER_PAGE = 100;

const calcStats = (participants) => ({
  total: participants.length,
  active: participants.filter((item) => item.isActive).length,
  inactive: participants.filter((item) => !item.isActive).length,
  withEmail: participants.filter((item) => Array.isArray(item.emails) && item.emails.length > 0).length,
});

const normalizeText = (value) => String(value ?? "").toLowerCase();

const applyLocalFilters = (participants, filters) => {
  let result = [...participants];

  if (filters.search) {
    const term = normalizeText(filters.search);
    result = result.filter((item) => {
      const emails = Array.isArray(item.emails) ? item.emails.map((email) => email.email).join(" ") : "";
      return [
        item.displayName,
        item.organization,
        item.title,
        emails,
      ].some((value) => normalizeText(value).includes(term));
    });
  }

  if (filters.status === "active") {
    result = result.filter((item) => item.isActive);
  }
  if (filters.status === "inactive") {
    result = result.filter((item) => !item.isActive);
  }

  if (filters.emailMode === "with-email") {
    result = result.filter((item) => Array.isArray(item.emails) && item.emails.length > 0);
  }
  if (filters.emailMode === "without-email") {
    result = result.filter((item) => !Array.isArray(item.emails) || item.emails.length === 0);
  }

  result.sort((left, right) => String(left.displayName ?? "").localeCompare(String(right.displayName ?? "")));
  return result;
};

const Participants = () => {
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    emailMode: "",
  });
  const [viewMode, setViewMode] = useModuleViewMode();
  const [page, setPage] = useState(1);
  const itemsPerPage = viewMode === "table" ? TABLE_ITEMS_PER_PAGE : DEFAULT_ITEMS_PER_PAGE;

  const loadParticipants = useCallback(async () => {
    setIsLoading(true);
    try {
      const { items } = await participantsService.list({ skip: 0, limit: 100, filters: { isActive: null } });
      setParticipants(Array.isArray(items) ? items : []);
    } catch (error) {
      participantsLog.error("[Participants] Error cargando participantes:", error);
      setParticipants([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  const filteredParticipants = useMemo(
    () => applyLocalFilters(participants, filters),
    [participants, filters]
  );
  const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / itemsPerPage));
  const paginatedParticipants = useMemo(
    () => filteredParticipants.slice((page - 1) * itemsPerPage, page * itemsPerPage),
    [filteredParticipants, itemsPerPage, page]
  );

  const stats = useMemo(() => calcStats(participants), [participants]);
  const hasFilters = Boolean(filters.search || filters.status || filters.emailMode);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleFilterChange = useCallback((name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ search: "", status: "", emailMode: "" });
  }, []);

  const handlePageChange = useCallback((nextPage) => {
    if (nextPage >= 1 && nextPage <= totalPages) setPage(nextPage);
  }, [totalPages]);

  const handleCreated = useCallback((created) => {
    setParticipants((prev) => [created, ...prev]);
  }, []);

  const handleUpdated = useCallback((updated) => {
    setParticipants((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

  const handleDeleted = useCallback((deletedId) => {
    setParticipants((prev) => prev.filter((item) => item.id !== deletedId));
  }, []);

  if (isLoading) {
    return <PageLoadingSpinner message="Cargando participantes..." />;
  }

  return (
    <div className="space-y-6">
      <ParticipantsHeader onCreated={handleCreated} />
      <ParticipantsFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />
      <ParticipantsStats stats={stats} />
      <CatalogViewBar
        count={filteredParticipants.length}
        singularLabel="participante"
        pluralLabel="participantes"
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      {viewMode === "base" ? (
        <ParticipantsGrid
          participants={paginatedParticipants}
          hasFilters={hasFilters}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      ) : null}
      {viewMode === "list" ? (
        <ParticipantsListView
          participants={paginatedParticipants}
          hasFilters={hasFilters}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      ) : null}
      {viewMode === "table" ? (
        <ParticipantsTableView
          participants={paginatedParticipants}
          hasFilters={hasFilters}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      ) : null}

      {viewMode === "base" ? (
        <CatalogBasePagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          total={filteredParticipants.length}
          itemsPerPage={itemsPerPage}
          singularLabel="participante"
          pluralLabel="participantes"
        />
      ) : null}

      {viewMode !== "base" ? (
        <CatalogPagePagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      ) : null}
    </div>
  );
};

export default Participants;
