/**
 * pages/minuteEditor/MinuteEditorHeader.jsx
 * Header del editor:
 * - Izquierda: Cliente + Asunto + badge estado
 * - Derecha: acciones (Rollback / Reprocesar / Descargar PDF)
 *
 * Requisitos:
 * - Store expone: getChangesSinceSnapshot(), rollbackToSnapshot(), takeSnapshot()
 */

import React, { useState } from "react";
import Icon from "@components/ui/icon/iconManager";
import useMinuteEditorStore from "@/store/minuteEditorStore";
import ModalManager from "@components/ui/modal";
import { useNavigate } from "react-router-dom";
import ActionButton from "@/components/ui/button/ActionButton";

import logger from '@/utils/logger';
const minEdLog = logger.scope("minute-editor");

// ─── URL demo del PDF (reemplazar por URL real en producción) ───────────────
const DEMO_PDF_URL = "/pdf/demo.pdf";

// ─── Helpers ────────────────────────────────────────────────────────────────

const buildFilename_old = (subject, transactionId) => {
    const rawTitle = String(subject ?? "minuta").trim() || "minuta";
    const safeTitle = rawTitle
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60);
    const id = String(transactionId ?? "NA").slice(0, 8);
    return `MinuetAItor_Minuta_${safeTitle}_${id}.pdf`;
};

/**
 * buildFilename(subject, dateMeeting)
 * dateMeeting SIEMPRE: "YYYY-MM-DD"
 * Nombre final: yyyymmdd_0000_${safeTitle}.pdf
 */
const buildFilename = (subject, dateMeeting) => {
    const rawTitle = String(subject ?? "minuta").trim() || "minuta";

    const safeTitle =
        rawTitle
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9_-]+/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 60) || "minuta";

    const s = String(dateMeeting ?? "").trim(); // "YYYY-MM-DD"
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    // si por alguna razón viene vacío/incorrecto, fallback a fecha actual
    const d = m ? { yyyy: m[1], mm: m[2], dd: m[3] } : (() => {
        const now = new Date();
        const pad2 = (n) => String(n).padStart(2, "0");
        return { yyyy: String(now.getFullYear()), mm: pad2(now.getMonth() + 1), dd: pad2(now.getDate()) };
    })();

    const stamp = `${d.yyyy}${d.mm}${d.dd}`;

    return `${stamp}_${safeTitle}.pdf`;
};

const triggerBrowserDownload = async (url, filename) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Error al descargar PDF (${res.status})`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
};

// ─── Modal: Reprocesar ────────────────────────────────────────────────────────

const ReprocessModalContent = ({ onNoteChange }) => {
    const [note, setNote] = useState("");
    const [touched, setTouched] = useState(false);

    const handleChange = (e) => {
        const val = e.target.value;
        setNote(val);
        setTouched(true);
        onNoteChange(val);
    };

    return (
        <div className="space-y-5">
            <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 transition-theme">
                    Nota de versión
                    <span className="text-red-500 ml-1">*</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 transition-theme">
                    Describe brevemente qué cambios incluye esta versión. Aparecerá en el historial junto a la fecha y tu nombre.
                </p>
                <textarea
                    value={note}
                    onChange={handleChange}
                    rows={3}
                    maxLength={300}
                    placeholder="Ej: Corrección de participantes y actualización de fechas en acuerdos AGR-001 y AGR-002"
                    className={`w-full px-3 py-2 rounded-xl border text-sm
            text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2
            focus:ring-primary-500/40 resize-none
            ${touched && !note.trim()
                            ? "border-red-400 dark:border-red-500"
                            : "border-gray-200 dark:border-gray-700"
                        }`}
                />
                <div className="flex justify-between mt-1">
                    {touched && !note.trim() ? (
                        <p className="text-xs text-red-500">La nota es obligatoria para continuar.</p>
                    ) : (
                        <span />
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-600 transition-theme ml-auto">
                        {note.length}/300
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                <div
                    className="flex items-start gap-3 px-4 py-3 rounded-xl
          bg-blue-50 dark:bg-blue-900/15
          border border-blue-200/60 dark:border-blue-700/40
          transition-theme"
                >
                    <Icon name="circleInfo" className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="text-sm text-blue-900/90 dark:text-blue-200 leading-relaxed transition-theme">
                        <p className="font-semibold">Reproceso y versionado</p>
                        <p className="mt-1">
                            El <strong>reproceso</strong> consolida los cambios del editor y genera una{" "}
                            <strong>nueva versión</strong> de la minuta{" "}
                            <span className="opacity-90">(sin volver a ejecutar IA)</span>.
                        </p>
                        <ul className="mt-2 ml-4 list-disc space-y-1">
                            <li>
                                Se registra en la <strong>Línea de Tiempo</strong>: <strong>fecha/hora</strong>,{" "}
                                <strong>nota/observación</strong> y <strong>usuario ejecutor</strong>.
                            </li>
                            <li>Mantiene la <strong>trazabilidad de versiones</strong> para auditoría y control de cambios.</li>
                        </ul>
                    </div>
                </div>

                <div
                    className="flex items-start gap-3 px-4 py-3 rounded-xl
          bg-amber-50 dark:bg-amber-900/15
          border border-amber-200/60 dark:border-amber-700/40
          transition-theme"
                >
                    <Icon name="triangleExclamation" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="text-sm text-amber-900/90 dark:text-amber-200 leading-relaxed transition-theme">
                        <p className="font-semibold">Importante</p>
                        <p className="mt-1">
                            Este reproceso <strong>no</strong> re-ejecuta IA. Si requieres un{" "}
                            <strong>nuevo procesamiento por IA</strong>, debes <strong>eliminar la minuta</strong> y reiniciar el{" "}
                            <strong>flujo completo</strong>.
                        </p>
                        <p className="mt-2">
                            La eliminación queda registrada en <strong>auditoría</strong>{" "}
                            <span className="opacity-90">(tipo de evento, fecha/hora y usuario)</span>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Modal: Descargar PDF ────────────────────────────────────────────────────

const showDownloadModal = (filename) => {
    const handleDownload = async () => {
        try {
            await triggerBrowserDownload(DEMO_PDF_URL, filename);
        } catch (e) {
            minEdLog.error("Error descarga PDF:", e);
            ModalManager.custom({
                title: "Error al descargar",
                size: "small",
                showFooter: false,
                content: (
                    <div>
                        <div
                            className="flex items-start gap-3 px-4 py-3 rounded-xl
              bg-red-50 dark:bg-red-900/15 border border-red-200/60 dark:border-red-700/40 transition-theme"
                        >
                            <Icon name="triangleExclamation" className="text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                            <span className="text-sm text-red-800 dark:text-red-300 transition-theme">
                                No fue posible descargar el PDF. Intenta nuevamente.
                            </span>
                        </div>
                    </div>
                ),
            });
        }
    };

    ModalManager.custom({
        title: "Descargar minuta en PDF",
        size: "xlarge",
        showFooter: false,
        content: (
            <div className="p-1 space-y-4">
                <div
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl
          bg-gray-50 dark:bg-gray-900 border border-gray-200/50 dark:border-gray-700/50 transition-theme"
                >
                    <ActionButton
                        label="Descargar"
                        variant="primary"
                        size="sm"
                        className="w-full"
                        icon={<Icon name="download" />}
                        onClick={handleDownload}
                        tooltip={`Descargar ${filename}`}
                    />
                </div>
                <div className="rounded-xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50 transition-theme">
                    <div
                        className="flex items-center gap-2 px-4 py-2 border-b border-gray-200/50 dark:border-gray-700/50
            bg-gray-50 dark:bg-gray-900 transition-theme"
                    >
                        <Icon name="eye" className="text-gray-500 dark:text-gray-400 text-xs" />
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 transition-theme">
                            Vista previa
                        </span>
                    </div>
                    <div className="w-full h-[60vh] bg-white dark:bg-gray-950 transition-theme">
                        <iframe src={DEMO_PDF_URL} title="Vista previa PDF" className="w-full h-full" />
                    </div>
                </div>
            </div>
        ),
    });
};

// ─── Modal: Rollback (contenido) ─────────────────────────────────────────────

const RollbackModalContent = ({ changes = [] }) => {
    return (
        <div className="p-6 space-y-4">
            <div className="space-y-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 transition-theme">
                    Confirmar rollback
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme">
                    Se descartarán las modificaciones actuales y el editor volverá al último estado “limpio” (snapshot).
                </p>
            </div>

            {changes.length === 0 ? (
                <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 p-4 transition-theme">
                    <p className="text-sm text-gray-700 dark:text-gray-200 transition-theme">
                        No se detectaron diferencias normalizadas. Si sigues viendo cambios en pantalla,
                        probablemente existe estado local en subcomponentes (inputs no controlados, acordeones, etc.).
                    </p>
                </div>
            ) : (
                <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 overflow-hidden transition-theme">
                    <div className="max-h-[55vh] overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-white dark:bg-gray-800 border-b border-secondary-200 dark:border-secondary-700 transition-theme">
                                <tr className="text-left">
                                    <th className="p-3 font-semibold text-gray-700 dark:text-gray-200">Sección</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-gray-200">Campo</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-gray-200">Antes</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-gray-200">Después</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary-200 dark:divide-secondary-700 transition-theme">
                                {changes.map((c, idx) => (
                                    <tr key={idx} className="align-top">
                                        <td className="p-3 whitespace-nowrap text-gray-800 dark:text-gray-100 transition-theme">
                                            {c.section}
                                        </td>
                                        <td className="p-3 whitespace-nowrap text-gray-700 dark:text-gray-200 transition-theme">
                                            {c.field}
                                        </td>
                                        <td className="p-3 text-gray-600 dark:text-gray-300 transition-theme">
                                            <div className="whitespace-pre-wrap break-words">{c.before || "—"}</div>
                                        </td>
                                        <td className="p-3 text-gray-600 dark:text-gray-300 transition-theme">
                                            <div className="whitespace-pre-wrap break-words">{c.after || "—"}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200/60 dark:border-red-700/40 p-4 transition-theme">
                <div className="flex items-start gap-3">
                    <Icon name="triangleExclamation" className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed transition-theme">
                        Esta acción no puede deshacerse. Si necesitas conservar estos cambios, utiliza <strong>Reprocesar</strong>.
                    </p>
                </div>
            </div>
        </div>
    );
};

// ─── Componente principal ────────────────────────────────────────────────────

const MinuteEditorHeader = () => {
    const navigate = useNavigate();

    const {
        meetingInfo = {},
        metadataLocked = {},
        isDirty,
        addTimelineEntry,
        markClean,
        getExportPayload,

        // rollback / snapshot
        getChangesSinceSnapshot,
        rollbackToSnapshot,
        takeSnapshot,
    } = useMinuteEditorStore();

    const filename = buildFilename(meetingInfo.subject, meetingInfo?.meetingDate);

    const clientName = (meetingInfo.client ?? "").trim() || "Cliente no definido";
    const subject = (meetingInfo.subject ?? "").trim() || "Sin asunto";

    // ─── Handler: Rollback ────────────────────────────────────────────────
    const handleRollback = () => {
        const changes = (getChangesSinceSnapshot?.() ?? []);

        ModalManager.custom({
            title: "Rollback de cambios",
            size: "xlarge",
            showFooter: true,
            content: <RollbackModalContent changes={changes} />,
            buttons: [
                {
                    text: "Cancelar",
                    variant: "secondary",
                    onClick: () => ModalManager.hide?.(),
                },
                {
                    text: "Confirmar rollback",
                    variant: "primary",
                    onClick: () => {
                        rollbackToSnapshot?.();
                        ModalManager.hide?.();

                        ModalManager.custom({
                            title: "Rollback aplicado",
                            size: "small",
                            showFooter: false,
                            content: (
                                <div className="p-1">
                                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/15 border border-green-200/60 dark:border-green-700/40 transition-theme">
                                        <Icon name="check" className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                                        <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed transition-theme">
                                            El editor volvió al último snapshot. Los cambios fueron descartados.
                                        </p>
                                    </div>
                                </div>
                            ),
                            onClose: () => {
                                ModalManager.closeAll?.();
                            },
                        });
                    },
                },
            ],
        });
    };

    // ─── Handler: Reprocesar ────────────────────────────────────────────────
    const handleReprocess = () => {
        let commitNote = "";

        ModalManager.custom({
            title: "Reprocesar minuta",
            size: "medium",
            showFooter: true,
            content: <ReprocessModalContent onNoteChange={(val) => { commitNote = val; }} />,
            buttons: [
                {
                    text: "Reprocesar",
                    variant: "primary",
                    onClick: () => {
                        if (!commitNote.trim()) {
                            ModalManager.error({
                                title: "Nota de versión requerida para reprocesar",
                                message:
                                    "El reproceso genera una nueva versión del documento. Para mantener el historial y la auditoría de cambios, la Nota de versión es obligatoria.",
                                details: [
                                    "Motivo: Control de cambios / Línea de tiempo",
                                    "Sugerencia: indique qué se corrigió o actualizó",
                                ],
                            });
                            return false;
                        }

                        const payload = getExportPayload();
                        minEdLog.log("Reprocesando payload:", payload);

                        addTimelineEntry({
                            publishedBy: meetingInfo.preparedBy ?? "Usuario",
                            observation: commitNote.trim(),
                            changesSummary: commitNote.trim(),
                        });

                        const publishedAt = new Date().toISOString();
                        markClean(publishedAt);

                        // Avanza snapshot baseline (el nuevo estado “publicado”)
                        takeSnapshot?.();

                        ModalManager.custom({
                            title: "Minuta reprocesada",
                            size: "small",
                            showFooter: false,
                            onClose: () => {
                                ModalManager.closeAll?.();
                                navigate("/minutes", { replace: true });
                            },
                            content: (
                                <div className="p-1">
                                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/15 border border-green-200/60 dark:border-green-700/40 transition-theme">
                                        <Icon name="check" className="text-green-500 dark:text-green-400 mt-0.5 shrink-0" />
                                        <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed transition-theme">
                                            Espere mientras se procesa la nueva versión.<br />
                                            Se le informará una vez termine el proceso en segundo plano.
                                        </p>
                                    </div>
                                </div>
                            ),
                        });
                    },
                },
            ],
        });
    };

    // ─── Handler: Descargar PDF ────────────────────────────────────────────────
    const handleDownloadPDF = () => {
        if (isDirty) {
            ModalManager.custom({
                title: "Hay cambios sin reprocesar",
                size: "small",
                showFooter: true,
                content: (
                    <div className="space-y-4 p-1">
                        <div
                            className="flex items-start gap-3 px-4 py-3 rounded-xl
              bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-700/40 transition-theme"
                        >
                            <Icon name="triangleExclamation" className="text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed transition-theme">
                                Realizaste modificaciones en el editor que aún no han sido procesadas.
                                Usa <strong>Reprocesar</strong> para generar la versión actualizada antes de descargar el PDF.
                            </p>
                        </div>
                    </div>
                ),
                buttons: [{ text: "Entendido", variant: "primary", onClick: () => ModalManager.hide?.() }],
            });
            return;
        }

        showDownloadModal(filename);
    };

    return (
        <header className="backdrop-blur border-b border-gray-200 dark:border-gray-800 transition-theme">
            <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                {/* IZQUIERDA: Cliente + Asunto */}
                <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white transition-theme truncate max-w-[48rem]">
                            {clientName}
                        </h1>
                    </div>

                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 transition-theme truncate max-w-[60rem]">
                        {subject}
                    </p>
                </div>

                {/* DERECHA: acciones */}
                <div className="flex items-center gap-3 shrink-0">
                    {/* Acciones SOLO si hay cambios pendientes */}
                    {isDirty && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleReprocess}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-theme
                  bg-amber-500 hover:bg-amber-600 border-amber-500 text-white shadow-md"
                            >
                                <Icon name="rotate" />
                                Reprocesar
                            </button>

                            <button
                                type="button"
                                onClick={handleRollback}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-theme
                  bg-red-600 hover:bg-red-700 border-red-600 text-white shadow-md"
                            >
                                <Icon name="rotateLeft" />
                                Rollback
                            </button>
                        </div>
                    )}

                    {/* Descargar PDF: siempre visible (bloquea si isDirty) */}
                    <button
                        type="button"
                        onClick={handleDownloadPDF}
                        title={isDirty ? "Debes reprocesar antes de descargar" : "Descargar PDF"}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-theme
              ${isDirty
                                ? "bg-gray-100 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500"
                                : "bg-primary-600 hover:bg-primary-700 text-white border border-primary-600 shadow-md"
                            }`}
                    >
                        <Icon name="download" />
                        Descargar PDF
                        {isDirty && <Icon name="lock" className="text-[10px] opacity-50" />}
                    </button>
                </div>
            </div>
        </header>
    );
};

export default MinuteEditorHeader;