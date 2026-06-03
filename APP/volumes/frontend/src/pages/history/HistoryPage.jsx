import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import Icon from "@/components/ui/icon/iconManager";
import clientService from "@/services/clientService";
import projectService from "@/services/projectService";
import participantsService from "@/services/participantsService";
import EntityMinutesHistoryPanel from "@/pages/common/EntityMinutesHistoryPanel";

const HISTORY_TYPES = new Set(["client", "project", "participant"]);

const HistoryPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id") || "";
  const requestedType = searchParams.get("type") || (id ? "client" : "all");
  const type = id && HISTORY_TYPES.has(requestedType) ? requestedType : id ? "client" : "all";
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const backPath = useMemo(() => ({
    client: "/clients",
    project: "/projects",
    participant: "/participants",
    all: "/dashboard",
  }[type] ?? "/clients"), [type]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!id) {
        setError("");
        setEntity({
          id: "all",
          name: "Historial",
          subtitle: "Todas las minutas registradas",
          description: "Consulta transversal por cliente, proyecto, estado y fecha",
          badge: "General",
        });
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const detail = type === "project"
          ? await projectService.getById(id)
          : type === "participant"
            ? await participantsService.getById(id)
            : await clientService.getById(id);
        if (!cancelled) setEntity(detail);
      } catch (_) {
        if (!cancelled) {
          setEntity(null);
          setError("No fue posible cargar los datos base del historial.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, type]);

  if (loading || error || !entity) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center px-6">
        <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
            <Icon name={loading ? "spinner" : "triangleExclamation"} className={loading ? "animate-spin" : ""} />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {loading ? "Cargando historial..." : "No se pudo abrir el historial"}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {loading ? "Estamos preparando la vista." : error}
          </p>
          {!loading ? (
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="mt-6 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 dark:bg-sky-300 dark:text-slate-900 dark:hover:bg-sky-200"
            >
              Volver
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <EntityMinutesHistoryPanel
        type={type}
        entity={entity}
        onBack={() => navigate(backPath)}
      />
    </div>
  );
};

export default HistoryPage;
