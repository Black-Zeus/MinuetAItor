/**
 * ProfilesCatalogGrid.jsx
 * Grid de perfiles con paginación y estado vacío
 * Patrón: TagsGrid.jsx
 */

import React from "react";
import Icon                 from "@/components/ui/icon/iconManager";
import ProfilesCatalogCard  from "./ProfilesCatalogCard";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META  = "text-gray-500 dark:text-gray-400";

// ─── Estado vacío ─────────────────────────────────────────────────────────────

const EmptyState = ({ hasFilters }) => (
  <div className="text-center py-12">
    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
      <Icon name="FaInbox" className={`${TXT_META} w-8 h-8`} />
    </div>
    <h3 className={`text-lg font-medium ${TXT_TITLE} mb-2 transition-theme`}>
      No se encontraron perfiles
    </h3>
    <p className={TXT_META}>
      {hasFilters ? "Intenta ajustar los filtros" : "Crea un nuevo perfil para comenzar"}
    </p>
  </div>
);

// ─── Paginación ───────────────────────────────────────────────────────────────

const Pagination = ({ page, totalPages, onPageChange, total, itemsPerPage }) => {
  if (totalPages <= 1) return null;
  const from = (page - 1) * itemsPerPage + 1;
  const to   = Math.min(page * itemsPerPage, total);

  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
      <span className={`text-sm ${TXT_META}`}>
        Mostrando {from}–{to} de {total} perfiles
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          ← Anterior
        </button>
        <span className={`px-3 py-1.5 text-sm ${TXT_META}`}>
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
};

// ─── Grid principal ───────────────────────────────────────────────────────────

const ProfilesCatalogGrid = ({
  profiles    = [],
  allProfiles = [],
  categories  = [],
  page        = 1,
  totalPages  = 1,
  itemsPerPage = 12,
  onPageChange,
  onUpdated,
  onDeleted,
}) => {
  const hasFilters = allProfiles.length !== profiles.length || profiles.length === 0;

  if (!profiles || profiles.length === 0) {
    return <EmptyState hasFilters={hasFilters} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {profiles.map((profile) => (
          <ProfilesCatalogCard
            key={profile.id}
            id={profile.id}
            summary={profile}
            categories={categories}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
          />
        ))}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        total={allProfiles.length}
        itemsPerPage={itemsPerPage}
      />
    </div>
  );
};

export default ProfilesCatalogGrid;