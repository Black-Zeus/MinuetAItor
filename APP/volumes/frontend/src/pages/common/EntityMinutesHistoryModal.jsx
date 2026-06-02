import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Icon from "@/components/ui/icon/iconManager";
import { openPdfViewer } from "@/components/ui/pdf/PdfViewerModal";
import { listMinutes } from "@/services/minutesService";
import { formatDateMedium } from "@/utils/formats";
import {
  buildMinuteFilename,
  getMinuteStatusConfig,
} from "@/pages/minutes/MinuteCard";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const TXT_HEAD = "text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400";
const TXT_BODY = "text-sm text-gray-700 dark:text-gray-300";
const TXT_TITLE = "text-sm font-semibold text-gray-900 dark:text-gray-50";
const TXT_META = "text-xs text-gray-500 dark:text-gray-400";

const normalizeEntity = (type, data = {}) => {
  if (type === "project") {
    return {
      id: data.id ?? data.projectId ?? "",
      name: data.projectName ?? data.name ?? "Proyecto",
      subtitle: data.clientName ?? data.client_name ?? data.client?.name ?? "Sin cliente",
      description: data.projectDescription ?? data.description ?? "",
      logoUrl: data.logoUrl ?? data.logo_url ?? "",
      icon: "FaFolderOpen",
      badge: (data.projectStatus ?? data.status ?? "activo") === "inactivo" ? "Inactivo" : "Activo",
    };
  }

  return {
    id: data.id ?? data.clientId ?? "",
    name: data.companyName ?? data.name ?? "Cliente",
    subtitle: data.industry ?? data.companyEmail ?? data.email ?? "Sin industria registrada",
    description: data.description ?? data.companyLegalName ?? data.legal_name ?? "",
    logoUrl: data.logoUrl ?? data.logo_url ?? "",
    icon: "FaBuilding",
    badge: (data.isActive ?? data.is_active ?? true) ? "Activo" : "Inactivo",
  };
};

const EntityLogo = ({ entity, type }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [entity.logoUrl]);

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
      {entity.logoUrl && !failed ? (
        <img
          src={entity.logoUrl}
          alt={entity.name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon name={entity.icon || (type === "project" ? "FaFolderOpen" : "FaBuilding")} className="h-6 w-6" />
      )}
    </div>
  );
};

const Header = ({ entity, type, total, onBack }) => (
  <header className="border-b border-gray-200 pb-4 transition-theme dark:border-gray-800">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <EntityLogo entity={entity} type={type} />
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
            Historial de minutas
          </div>
          <h3 className="mt-1 truncate text-2xl font-semibold text-gray-900 dark:text-white">
            {entity.name}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <Icon name={type === "project" ? "FaBuilding" : "FaIndustry"} className="text-xs" />
              {entity.subtitle}
            </span>
            {entity.description ? (
              <span className="max-w-xl truncate text-sm text-gray-500 dark:text-gray-400">
                {entity.description}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            entity.badge === "Activo"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300"
          )}
        >
          {entity.badge}
        </span>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-300">
          {total} minutas
        </span>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Icon name="arrowLeft" className="text-xs" />
          Volver
        </button>
      </div>
    </div>
  </header>
);

const EmptyState = ({ loading, error, type }) => (
  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-8 text-center dark:border-slate-700 dark:bg-slate-900/30">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
      <Icon name={loading ? "spinner" : error ? "triangleExclamation" : "fileLines"} className={loading ? "animate-spin" : ""} />
    </div>
    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
      {loading ? "Cargando historial..." : error ? "No se pudo cargar el historial" : "Sin minutas registradas"}
    </h4>
    <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">
      {loading
        ? "Estamos consultando las minutas asociadas."
        : error || `No hay minutas asociadas a este ${type === "project" ? "proyecto" : "cliente"}.`}
    </p>
  </div>
);

const ActionButton = ({ icon, label, onClick, tone = "default", disabled = false }) => {
  const toneClass = {
    default:
      "border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-300",
    success:
      "border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/20",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        toneClass[tone] ?? toneClass.default
      )}
    >
      <Icon name={icon} className="text-[11px]" />
      {label}
    </button>
  );
};

const HistoryTable = ({ minutes, type, navigate }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40">
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-900/70">
            {type === "client" ? <th className={`px-4 py-3 text-left ${TXT_HEAD}`}>Proyecto</th> : null}
            <th className={`px-4 py-3 text-left ${TXT_HEAD}`}>Minuta</th>
            <th className={`px-4 py-3 text-left ${TXT_HEAD}`}>Fecha</th>
            <th className={`px-4 py-3 text-left ${TXT_HEAD}`}>Estado</th>
            <th className={`px-4 py-3 text-left ${TXT_HEAD}`}>Metadatos</th>
            <th className={`px-4 py-3 text-right ${TXT_HEAD}`}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {minutes.map((minute) => {
            const status = String(minute?.status ?? "in-progress");
            const statusConfig = getMinuteStatusConfig(minute);
            const isCompleted = status === "completed";
            const isPdfDisabled = ["cancelled", "deleted", "llm-failed", "processing-error", "in-progress"].includes(status);
            const filename = buildMinuteFilename(minute?.title, minute?.date);

            const openMinute = () => {
              if (!minute?.id) return;
              navigate(`/minutes/process/${minute.id}`);
            };

            const openPdf = () => {
              if (!minute?.id || isPdfDisabled) return;
              openPdfViewer({
                recordId: minute.id,
                pdfType: isCompleted ? "published" : "draft",
                filename,
                title: `PDF — ${minute?.title || "Minuta"}`,
              });
            };

            return (
              <tr
                key={minute.id}
                className="border-b border-slate-200/80 align-top last:border-0 hover:bg-slate-50/70 dark:border-slate-700/60 dark:hover:bg-slate-800/30"
              >
                {type === "client" ? (
                  <td className={`px-4 py-4 ${TXT_BODY}`}>
                    <div className="min-w-[160px]">{minute?.project || "Sin proyecto"}</div>
                  </td>
                ) : null}
                <td className="px-4 py-4">
                  <div className="min-w-[240px]">
                    <p className={TXT_TITLE}>{minute?.title || "Minuta sin título"}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                      {minute?.summary || "Sin resumen disponible"}
                    </p>
                  </div>
                </td>
                <td className={`px-4 py-4 ${TXT_BODY}`}>
                  <div>{minute?.date ? formatDateMedium(minute.date) : "-"}</div>
                  <div className={cn("mt-1", TXT_META)}>{[minute?.time, minute?.duration].filter(Boolean).join(" · ") || "Sin horario"}</div>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusConfig.className}`}>
                    <Icon name={statusConfig.icon} className={statusConfig.icon === "spinner" ? "animate-spin text-[11px]" : "text-[11px]"} />
                    {statusConfig.label}
                  </span>
                </td>
                <td className={`px-4 py-4 ${TXT_BODY}`}>
                  <div>{minute?.preparedBy || "Sin elaborador"}</div>
                  <div className={cn("mt-1", TXT_META)}>
                    {Array.isArray(minute?.participants) && minute.participants.length
                      ? `${minute.participants.length} participantes`
                      : "Sin participantes"}
                  </div>
                  {Number(minute?.totalTokens || 0) > 0 ? (
                    <div className={cn("mt-1", TXT_META)}>{minute.totalTokens} tokens</div>
                  ) : null}
                </td>
                <td className="px-4 py-4">
                  <div className="flex min-w-[170px] justify-end gap-2">
                    <ActionButton icon="eye" label="Ver" onClick={openMinute} />
                    <ActionButton
                      icon="fileLines"
                      label={isCompleted ? "PDF final" : "PDF borrador"}
                      onClick={openPdf}
                      tone="success"
                      disabled={isPdfDisabled}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

const EntityMinutesHistoryModal = ({ type = "client", entity, onBack }) => {
  const navigate = useNavigate();
  const normalizedEntity = useMemo(() => normalizeEntity(type, entity), [type, entity]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div className="space-y-6 transition-theme [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <Header
        entity={normalizedEntity}
        type={type}
        total={total}
        onBack={onBack || (() => navigate(type === "project" ? "/projects" : "/clients"))}
      />

      <main>
        {loading || error || items.length === 0 ? (
          <EmptyState loading={loading} error={error} type={type} />
        ) : (
          <HistoryTable
            minutes={items}
            type={type}
            navigate={navigate}
          />
        )}
      </main>
    </div>
  );
};

export default EntityMinutesHistoryModal;
