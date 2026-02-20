// pages/errorPages/UnderConstructionPage.jsx
// Página "En Desarrollo / Bajo construcción" (homologada)
// - Limpieza de imports/variables no usados
// - Disclaimer ("letra chica") al pie, con redacción institucional

import React, { useEffect, useState } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const UnderConstructionPage = () => {
    const [mounted, setMounted] = useState(false);

    const logoSrc = "/images/chinchinAItor.jpg";

    useDocumentTitle("Sección en Desarrollo");

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div
            className="
        relative
        bg-gradient-to-br from-amber-50 via-white to-red-50
        dark:from-gray-900 dark:via-gray-800 dark:to-amber-900
        w-full h-full flex items-center justify-center overflow-hidden
      "
        >
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-amber-400/10 dark:bg-amber-600/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-400/10 dark:bg-red-600/10 rounded-full blur-3xl animate-pulse delay-1000" />
                <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-orange-400/10 dark:bg-orange-600/10 rounded-full blur-2xl animate-pulse delay-500" />
            </div>

            {/* Main container */}
            <div
                className={`
          relative z-10 w-full max-w-[70%] max-h-[85vh] overflow-auto
          transition-all duration-1000 ease-out
          ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
        `}
            >
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/20 dark:border-gray-700 rounded-lg shadow-2xl shadow-amber-500/10 dark:shadow-amber-500/20 p-4">
                    {/* Main content */}
                    <div className="text-center mb-6">
                        <div className="relative mb-4">
                            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-red-500 to-orange-500 animate-pulse">
                                EN DESARROLLO
                            </div>
                            <div className="absolute inset-0 text-4xl font-black text-amber-500/15 dark:text-amber-400/15 blur-sm">
                                EN DESARROLLO
                            </div>
                        </div>

                        <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto mb-6">
                            Esta funcionalidad aún no está disponible. Estamos evaluando su
                            implementación para publicarla con el estándar de calidad y
                            trazabilidad requerido.
                        </p>


                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-100 to-red-100 dark:from-amber-900/30 dark:to-red-900/30 rounded-full mb-2">
                            <div className="text-3xl animate-pulse">🚧</div>
                        </div>

                        {/* Logo */}
                        <div className="flex items-center justify-center mb-4">
                            <div className="inline-flex items-stretch gap-4 px-5 py-4 rounded-xl bg-gradient-to-br from-amber-100 to-red-100 dark:from-amber-900/30 dark:to-red-900/30 border border-white/30 dark:border-gray-700/50">
                                <div className="w-[120px] flex items-center justify-center">
                                    <img
                                        src={logoSrc}
                                        alt="ChinchinAItor"
                                        className="w-[120px] h-[180px] rounded-lg object-cover shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                                        loading="lazy"
                                    />
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-center">
                                        ChinchinAItor
                                    </p>

                                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 text-center leading-relaxed">
                                        Prototipo en iteración.
                                    </p>

                                    <p className="mt-2 text-xs text-gray-700 dark:text-gray-300 text-center leading-relaxed">
                                        Se están consolidando:
                                    </p>

                                    {/* Lista alineada a la izquierda, con "marca" */}
                                    <ul className="mt-2 mx-auto w-fit text-xs text-gray-700 dark:text-gray-300 space-y-1">
                                        <li className="relative pl-6 text-left leading-relaxed
                       before:absolute before:left-0 before:top-0
                       before:content-['✓'] before:font-bold
                       before:text-amber-700 dark:before:text-amber-300">
                                            Flujos
                                        </li>
                                        <li className="relative pl-6 text-left leading-relaxed
                       before:absolute before:left-0 before:top-0
                       before:content-['✓'] before:font-bold
                       before:text-amber-700 dark:before:text-amber-300">
                                            Validaciones
                                        </li>
                                        <li className="relative pl-6 text-left leading-relaxed
                       before:absolute before:left-0 before:top-0
                       before:content-['✓'] before:font-bold
                       before:text-amber-700 dark:before:text-amber-300">
                                            Trazabilidad
                                        </li>
                                    </ul>

                                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-center leading-relaxed">
                                        Antes de su liberación.
                                    </p>

                                    <div className="mt-3 flex items-center justify-center gap-2">
                                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium
                         bg-amber-100/70 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200
                         border border-amber-200/60 dark:border-amber-800/40">
                                            Work in progress
                                        </span>
                                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium
                         bg-gray-100/70 text-gray-700 dark:bg-gray-700/40 dark:text-gray-200
                         border border-gray-200/60 dark:border-gray-600/40">
                                            Pre-release
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Info block */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-md p-4 max-w-2xl mx-auto">
                        <div className="flex items-start gap-3">
                            <svg
                                className="w-5 h-5 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                                />
                            </svg>

                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                                    Estado:&nbsp;&nbsp;
                                    <span className="text-sm text-amber-600 dark:text-amber-400">
                                        En evaluación / implementación
                                    </span>
                                </p>

                                <p className="text-sm text-amber-700/90 dark:text-amber-200/90 leading-relaxed">
                                    Esta vista indica indisponibilidad temporal.<br />
                                    No corresponde a un error de permisos.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Disclaimer / letra chica */}
                    <div className="mt-4 border-t border-gray-200/80 dark:border-gray-700/80 pt-3">
                        <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 text-center">
                            Nota informativa: este módulo se encuentra en etapa de evaluación
                            y su disponibilidad está sujeta a priorización, factibilidad y
                            cambios de alcance.
                        </p>
                        <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 text-center">
                            En consecuencia, su implementación puede ser
                            ajustada, postergada o discontinuada sin previo aviso.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnderConstructionPage;
