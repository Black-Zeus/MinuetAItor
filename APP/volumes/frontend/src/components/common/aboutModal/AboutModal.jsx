/**
 * AboutModal.jsx
 * - Modal tipo "Acerca de" usando ModalManager.custom()
 * - Soporta children como trigger (cualquier componente clickeable)
 * - Si NO se entrega children, renderiza un trigger por defecto (logo + texto condicionado por isCollapsed)
 * - Header del modal muestra: appName + badge versión
 * - Body: imagen 300x300 + descripción + bullets
 * - Footer: desarrollador + email (SIN duplicar versión)
 */

import React from "react";
import ModalManager from "@/components/ui/modal"; // ajusta al path real

const AboutModal = ({
  // Trigger (opcional)
  children,

  // Trigger props (para default trigger)
  isCollapsed = false,
  logoSrc,
  tagline,

  // Modal props
  appName = "Aplicación",
  version = "0.0.0",
  imageSrc,
  imageAlt = "Logo",
  developerName = "Zeus",
  developerEmail = "zeus@tudominio.cl",

  // ModalManager props
  size = "modalLarge", // si creaste "modalLarge"; si no, usa "large"
  id,
}) => {
  const descriptionText =
    "MinuetAItor centraliza la gestión de minutas, acuerdos y compromisos, habilitando trazabilidad extremo a extremo y estandarización del registro. Automatiza la extracción de puntos clave, normaliza formatos y optimiza el seguimiento de acciones, reduciendo fricción operativa y error manual. Su foco es mejorar control, visibilidad y eficiencia operativa: desde la captura de información hasta la auditoría de decisiones, con continuidad y mejora continua de procesos.";

  const open = () => {
    ModalManager.custom({
      id,

      // ✅ Título del modal: Nombre app + versión (badge)
      title: (
        <span className="flex items-center gap-3">
          <span className="font-semibold">{appName}</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
            {version}
          </span>
        </span>
      ),

      size,

      // ✅ Intentamos habilitar footer por contrato del manager
      showFooter: true,

      content: (
        <div className="w-full">
          <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 items-start">
            {/* Imagen 300x300 */}
            <div className="w-[300px] h-[300px] mx-auto md:mx-0">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={imageAlt}
                  className="w-full h-full rounded-xl object-cover border border-gray-200 dark:border-gray-700"
                />
              ) : (
                <div className="w-full h-full rounded-xl border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Sin imagen
                </div>
              )}
            </div>

            {/* Descripción */}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Descripción
              </h3>

              {/* Altura acotada para evitar modal excesivamente alto */}
              <div className="mt-2 max-h-[240px] overflow-y-auto pr-3">
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                  {descriptionText}
                </p>

                <ul className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-700 dark:text-gray-200">
                  <li className="flex gap-2">
                    <span className="mt-[2px]">•</span>
                    <span>
                      <b>Estandarización</b> de minutas y acuerdos.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-[2px]">•</span>
                    <span>
                      <b>Trazabilidad</b> con responsable, estado y evidencia.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-[2px]">•</span>
                    <span>
                      <b>Automatización</b> para reducir tiempo y error manual.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-[2px]">•</span>
                    <span>
                      <b>Optimización</b> mediante flujos repetibles.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Footer inline (fallback visual) */}
              {/* Esto NO reemplaza el footer real del modal: solo asegura que SIEMPRE se vea el dev,
                  incluso si tu Modal.jsx/SystemModals aún no renderiza footerContent. */}
              <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Desarrollado por{" "}
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {developerName}
                  </span>
                  {" · "}
                  <a
                    className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
                    href={`mailto:${developerEmail}`}
                  >
                    {developerEmail}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),

      // ✅ Footer del modal (si tu sistema lo soporta efectivamente)
      footerContent: (
        <div className="w-full flex items-center justify-between gap-4">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Desarrollado por{" "}
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {developerName}
            </span>
            {" · "}
            <a
              className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
              href={`mailto:${developerEmail}`}
            >
              {developerEmail}
            </a>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            Gestión · Trazabilidad · Estandarización
          </div>
        </div>
      ),

      // Compatibilidad defensiva si tu Modal.jsx usa otro nombre (algunos sistemas usan "footer")
      footer: (
        <div className="w-full flex items-center justify-between gap-4">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Desarrollado por{" "}
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {developerName}
            </span>
            {" · "}
            <a
              className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
              href={`mailto:${developerEmail}`}
            >
              {developerEmail}
            </a>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            Gestión · Trazabilidad · Estandarización
          </div>
        </div>
      ),
    });
  };

  const wire = (el) =>
    React.cloneElement(el, {
      onClick: (e) => {
        el.props?.onClick?.(e);
        if (!e?.defaultPrevented) open();
      },
    });

  // Trigger por defecto (si NO hay children)
  const defaultTrigger = (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir información de ${appName}`}
      className="flex flex-col items-center justify-center cursor-pointer select-none rounded-lg hover:opacity-95 active:opacity-90"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
      }}
    >
      <img
        src={logoSrc ?? imageSrc}
        alt={appName}
        className={`
          rounded-lg transition-all
          ${isCollapsed ? "w-10 h-10" : "w-16 h-16"}
        `}
      />

      {!isCollapsed && (
        <div className="mt-3 text-center">
          <h1 className="text-lg font-semibold">{appName}</h1>
          {tagline ? (
            <p className="text-xs text-white/70 mt-1">{tagline}</p>
          ) : null}
        </div>
      )}
    </div>
  );

  // Render
  if (React.isValidElement(children)) return wire(children);
  return wire(defaultTrigger);
};

export default AboutModal;
