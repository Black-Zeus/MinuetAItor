import React, { useEffect, useMemo, useState } from "react";

import Icon from "@/components/ui/icon/iconManager";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import {
  ConfigActionBar,
  DraftModeNotice,
  MaintenanceField,
  MaintenanceInput,
  SectionCard,
  TXT_BODY,
  clonePlainObject,
} from "@/pages/system/SystemSettingsShared";
import organizationSettingsService from "@/services/organizationSettingsService";

const INITIAL_ORGANIZATION_DRAFT = {
  name: "",
  logoUrl: "",
  bannerUrl: "",
  legalName: "",
  taxId: "",
  description: "",
  industry: "",
  email: "",
  phone: "",
  website: "",
  publicBaseUrl: "",
  address: "",
  country: "",
  region: "",
  city: "",
  postalCode: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  contactPosition: "",
  contactDepartment: "",
  notes: "",
  createdAt: null,
  updatedAt: null,
  createdBy: null,
  updatedBy: null,
};

const toDraftShape = (payload) => ({
  name: String(payload?.name || ""),
  logoUrl: String(payload?.logoUrl || payload?.logo_url || ""),
  bannerUrl: String(payload?.bannerUrl || payload?.banner_url || ""),
  legalName: String(payload?.legalName || payload?.legal_name || ""),
  taxId: String(payload?.taxId || payload?.tax_id || ""),
  description: String(payload?.description || ""),
  industry: String(payload?.industry || ""),
  email: String(payload?.email || ""),
  phone: String(payload?.phone || ""),
  website: String(payload?.website || ""),
  publicBaseUrl: String(payload?.publicBaseUrl || payload?.public_base_url || ""),
  address: String(payload?.address || ""),
  country: String(payload?.country || ""),
  region: String(payload?.region || ""),
  city: String(payload?.city || ""),
  postalCode: String(payload?.postalCode || payload?.postal_code || ""),
  contactName: String(payload?.contactName || payload?.contact_name || ""),
  contactEmail: String(payload?.contactEmail || payload?.contact_email || ""),
  contactPhone: String(payload?.contactPhone || payload?.contact_phone || ""),
  contactPosition: String(payload?.contactPosition || payload?.contact_position || ""),
  contactDepartment: String(payload?.contactDepartment || payload?.contact_department || ""),
  notes: String(payload?.notes || ""),
  createdAt: payload?.createdAt || payload?.created_at || null,
  updatedAt: payload?.updatedAt || payload?.updated_at || null,
  createdBy: payload?.createdBy || payload?.created_by || null,
  updatedBy: payload?.updatedBy || payload?.updated_by || null,
});

const cn = (...classes) => classes.filter(Boolean).join(" ");

const ORGANIZATION_LOGO_MAX_BYTES = 2 * 1024 * 1024;
const ORGANIZATION_BANNER_MAX_BYTES = 4 * 1024 * 1024;
const ORGANIZATION_MEDIA_TYPES = ["image/jpeg", "image/png"];
const PUBLIC_BASE_URL_ERROR =
  "Ingresa una URL absoluta con http:// o https://, sin rutas ni parámetros.";

const svgToDataUri = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const LOGO_PLACEHOLDER_SRC = svgToDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480">
    <rect width="480" height="480" rx="44" fill="#f8fafc"/>
    <rect x="24" y="24" width="432" height="432" rx="36" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="8"/>
    <rect x="88" y="88" width="304" height="208" rx="24" fill="#ffffff"/>
    <circle cx="152" cy="152" r="28" fill="#94a3b8"/>
    <rect x="196" y="132" width="132" height="18" rx="9" fill="#64748b"/>
    <rect x="196" y="166" width="96" height="14" rx="7" fill="#94a3b8"/>
    <rect x="110" y="334" width="260" height="40" rx="20" fill="#0f172a"/>
    <text x="240" y="359" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#ffffff">LOGO 1:1</text>
    <text x="240" y="404" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="600" fill="#334155">Referencia visual</text>
  </svg>
`);

const BANNER_PLACEHOLDER_SRC = svgToDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 480">
    <rect width="1440" height="480" rx="40" fill="#f8fafc"/>
    <rect x="24" y="24" width="1392" height="432" rx="28" fill="#ffffff" stroke="#cbd5e1" stroke-width="8"/>
    <rect x="84" y="94" width="308" height="292" rx="24" fill="#e2e8f0"/>
    <rect x="438" y="114" width="502" height="42" rx="21" fill="#0f172a"/>
    <rect x="438" y="184" width="390" height="26" rx="13" fill="#94a3b8"/>
    <rect x="438" y="232" width="318" height="26" rx="13" fill="#cbd5e1"/>
    <rect x="438" y="320" width="232" height="52" rx="26" fill="#0f172a"/>
    <text x="554" y="353" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff">BANNER</text>
    <text x="1118" y="180" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#0f172a">1200 x 320</text>
    <text x="1118" y="228" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="600" fill="#64748b">Referencia de proporcion</text>
  </svg>
`);

const releaseBlobUrl = (value) => {
  if (typeof value === "string" && value.startsWith("blob:")) {
    URL.revokeObjectURL(value);
  }
};

const validatePublicBaseUrl = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return PUBLIC_BASE_URL_ERROR;
  }

  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
    return PUBLIC_BASE_URL_ERROR;
  }

  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    return PUBLIC_BASE_URL_ERROR;
  }

  return "";
};

const getDraggedImageFile = (event) => {
  const files = Array.from(event?.dataTransfer?.files || []);
  return files[0] || null;
};

const validateMediaFile = (file, { label, maxBytes }) => {
  if (!file) return false;

  if (!ORGANIZATION_MEDIA_TYPES.includes(file.type)) {
    toastError("Archivo no permitido", `Usa JPEG o PNG para el ${label}.`, { autoClose: 3000 });
    return false;
  }

  if (file.size > maxBytes) {
    toastError(
      "Archivo demasiado grande",
      `El ${label} no puede superar ${Math.floor(maxBytes / (1024 * 1024))} MB.`,
      { autoClose: 3000 }
    );
    return false;
  }

  return true;
};

const OrganizationTextarea = ({ className = "", ...props }) => (
  <textarea
    {...props}
    className={[
      "min-h-[116px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition",
      "focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-primary-900/40",
      props.disabled ? "cursor-not-allowed opacity-70" : "",
      className,
    ].join(" ")}
  />
);

const MediaActionButton = ({ as = "button", children, className = "", ...props }) => {
  const Component = as;
  return (
    <Component
      {...props}
      className={cn(
        "rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
        "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
        className
      )}
    >
      {children}
    </Component>
  );
};

const MediaOverlayDeleteButton = ({ onClick, label }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick?.();
    }}
    className={cn(
      "absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full",
      "border border-red-200 bg-white/92 text-red-600 shadow-sm backdrop-blur",
      "transition-colors hover:bg-red-50",
      "dark:border-red-900/70 dark:bg-slate-950/88 dark:text-red-300 dark:hover:bg-red-950/40"
    )}
  >
    <Icon name="FaTrash" className="h-4 w-4" />
  </button>
);

const OrganizationLogoPreview = ({ logoUrl, name, failed, onError }) => {
  const previewSrc = logoUrl && !failed ? logoUrl : LOGO_PLACEHOLDER_SRC;
  return (
    <img
      src={previewSrc}
      alt={logoUrl && !failed ? name || "Logo de la organización" : "Referencia visual para logo"}
      className="h-full w-full object-contain"
      onError={logoUrl && !failed ? onError : undefined}
    />
  );
};

const OrganizationBannerPreview = ({ bannerUrl, name, failed, onError }) => {
  const previewSrc = bannerUrl && !failed ? bannerUrl : BANNER_PLACEHOLDER_SRC;
  return (
    <img
      src={previewSrc}
      alt={bannerUrl && !failed ? name ? `Banner de ${name}` : "Banner de la organización" : "Referencia visual para banner"}
      className="h-full w-full object-cover"
      onError={bannerUrl && !failed ? onError : undefined}
    />
  );
};

export const OrganizationPanel = () => {
  const [draft, setDraft] = useState(() => clonePlainObject(INITIAL_ORGANIZATION_DRAFT));
  const [savedDraft, setSavedDraft] = useState(() => clonePlainObject(INITIAL_ORGANIZATION_DRAFT));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const [localLogoUrl, setLocalLogoUrl] = useState("");
  const [removeLogoRequested, setRemoveLogoRequested] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [pendingBannerFile, setPendingBannerFile] = useState(null);
  const [localBannerUrl, setLocalBannerUrl] = useState("");
  const [removeBannerRequested, setRemoveBannerRequested] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);
  const [logoDragActive, setLogoDragActive] = useState(false);
  const [bannerDragActive, setBannerDragActive] = useState(false);
  const publicBaseUrlError = useMemo(
    () => validatePublicBaseUrl(draft.publicBaseUrl),
    [draft.publicBaseUrl]
  );

  const hasChanges = useMemo(
    () =>
      JSON.stringify(draft) !== JSON.stringify(savedDraft) ||
      Boolean(pendingLogoFile || pendingBannerFile || removeLogoRequested || removeBannerRequested),
    [draft, savedDraft, pendingLogoFile, pendingBannerFile, removeLogoRequested, removeBannerRequested]
  );

  const updateDraft = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const resetMediaState = () => {
    releaseBlobUrl(localLogoUrl);
    releaseBlobUrl(localBannerUrl);
    setPendingLogoFile(null);
    setLocalLogoUrl("");
    setRemoveLogoRequested(false);
    setLogoFailed(false);
    setPendingBannerFile(null);
    setLocalBannerUrl("");
    setRemoveBannerRequested(false);
    setBannerFailed(false);
    setLogoDragActive(false);
    setBannerDragActive(false);
  };

  const loadOrganizationConfig = async () => {
    setIsLoading(true);
    try {
      const payload = await organizationSettingsService.getConfig();
      const nextDraft = toDraftShape(payload);
      resetMediaState();
      setDraft(clonePlainObject(nextDraft));
      setSavedDraft(clonePlainObject(nextDraft));
    } catch (error) {
      toastError(
        "No se pudo cargar la organización",
        error?.message ?? "No fue posible obtener la configuración actual de la organización."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscard = () => {
    resetMediaState();
    setDraft(clonePlainObject(savedDraft));
  };

  const currentLogoUrl = removeLogoRequested ? "" : localLogoUrl || draft.logoUrl || "";
  const currentBannerUrl = removeBannerRequested ? "" : localBannerUrl || draft.bannerUrl || "";

  const handleSelectLogo = (file) => {
    if (!validateMediaFile(file, { label: "logo", maxBytes: ORGANIZATION_LOGO_MAX_BYTES })) return;

    releaseBlobUrl(localLogoUrl);
    setPendingLogoFile(file);
    setLocalLogoUrl(URL.createObjectURL(file));
    setRemoveLogoRequested(false);
    setLogoFailed(false);
  };

  const handleRemoveLogo = () => {
    releaseBlobUrl(localLogoUrl);
    setPendingLogoFile(null);
    setLocalLogoUrl("");
    setRemoveLogoRequested(true);
    setLogoFailed(false);
  };

  const handleSelectBanner = (file) => {
    if (!validateMediaFile(file, { label: "banner", maxBytes: ORGANIZATION_BANNER_MAX_BYTES })) return;

    releaseBlobUrl(localBannerUrl);
    setPendingBannerFile(file);
    setLocalBannerUrl(URL.createObjectURL(file));
    setRemoveBannerRequested(false);
    setBannerFailed(false);
  };

  const handleRemoveBanner = () => {
    releaseBlobUrl(localBannerUrl);
    setPendingBannerFile(null);
    setLocalBannerUrl("");
    setRemoveBannerRequested(true);
    setBannerFailed(false);
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (publicBaseUrlError) {
      toastError("URL pública inválida", publicBaseUrlError);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: draft.name,
        legalName: draft.legalName,
        taxId: draft.taxId,
        description: draft.description,
        industry: draft.industry,
        email: draft.email,
        phone: draft.phone,
        website: draft.website,
        publicBaseUrl: draft.publicBaseUrl,
        address: draft.address,
        country: draft.country,
        region: draft.region,
        city: draft.city,
        postalCode: draft.postalCode,
        contactName: draft.contactName,
        contactEmail: draft.contactEmail,
        contactPhone: draft.contactPhone,
        contactPosition: draft.contactPosition,
        contactDepartment: draft.contactDepartment,
        notes: draft.notes,
      };
      const updated = await organizationSettingsService.update(payload);

      if (removeLogoRequested && draft.logoUrl) {
        await organizationSettingsService.deleteLogo();
      } else if (pendingLogoFile) {
        await organizationSettingsService.uploadLogo(pendingLogoFile);
      }

      if (removeBannerRequested && draft.bannerUrl) {
        await organizationSettingsService.deleteBanner();
      } else if (pendingBannerFile) {
        await organizationSettingsService.uploadBanner(pendingBannerFile);
      }

      const mustReloadMedia =
        Boolean(pendingLogoFile) ||
        Boolean(pendingBannerFile) ||
        removeLogoRequested ||
        removeBannerRequested;

      const nextDraft = toDraftShape(
        mustReloadMedia ? await organizationSettingsService.getConfig() : updated
      );

      resetMediaState();
      setDraft(clonePlainObject(nextDraft));
      setSavedDraft(clonePlainObject(nextDraft));
      toastSuccess("Organización actualizada", "La configuración institucional quedó guardada.");
    } catch (error) {
      toastError(
        "No se pudo guardar la organización",
        error?.message ?? "No fue posible persistir los datos institucionales."
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    loadOrganizationConfig();
  }, []);

  useEffect(
    () => () => {
      releaseBlobUrl(localLogoUrl);
      releaseBlobUrl(localBannerUrl);
    },
    [localLogoUrl, localBannerUrl]
  );

  if (isLoading) {
    return <p className={`text-sm ${TXT_BODY}`}>Cargando configuración de organización...</p>;
  }

  return (
    <div className="space-y-6">
      {hasChanges ? <DraftModeNotice /> : null}

      <SectionCard
        title="Identidad visual"
        icon="FaCamera"
        description="Selecciona o arrastra imágenes para logo y banner. Los cambios se guardan solo al pulsar Guardar organización."
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <div className="flex h-full flex-col rounded-[28px] border border-slate-200/60 bg-black/[0.02] p-3 dark:border-slate-700/70 dark:bg-white/[0.02]">
            <label
              className={cn(
                "relative flex h-44 cursor-pointer items-center justify-center overflow-hidden rounded-3xl border transition-colors",
                logoDragActive
                  ? "border-primary-400 bg-primary-50/40 dark:border-primary-500 dark:bg-primary-900/10"
                  : "border-slate-200/80 bg-transparent dark:border-slate-700/80 dark:bg-transparent"
              )}
              onDragEnter={(event) => {
                event.preventDefault();
                setLogoDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                if (!logoDragActive) setLogoDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setLogoDragActive(false);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                setLogoDragActive(false);
                handleSelectLogo(getDraggedImageFile(event));
              }}
            >
              <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-950/30">
                {currentLogoUrl ? (
                  <MediaOverlayDeleteButton
                    label="Quitar logo"
                    onClick={handleRemoveLogo}
                  />
                ) : null}
                <OrganizationLogoPreview
                  logoUrl={currentLogoUrl}
                  name={draft.name || draft.legalName}
                  failed={logoFailed}
                  onError={() => setLogoFailed(true)}
                />
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(event) => {
                  handleSelectLogo(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>

            <div className="flex flex-wrap justify-center gap-3 pt-3">
              <MediaActionButton as="label">
                Cargar logo
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(event) => {
                    handleSelectLogo(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </MediaActionButton>
            </div>
          </div>

          <div className="flex h-full flex-col rounded-[28px] border border-slate-200/60 bg-black/[0.02] p-3 dark:border-slate-700/70 dark:bg-white/[0.02]">
            <label
              className={cn(
                "relative block aspect-[3/1] min-h-56 max-h-[360px] cursor-pointer overflow-hidden rounded-3xl border transition-colors",
                bannerDragActive
                  ? "border-primary-400 bg-primary-50/40 dark:border-primary-500 dark:bg-primary-900/10"
                  : "border-slate-200/80 bg-transparent dark:border-slate-700/80 dark:bg-transparent"
              )}
              onDragEnter={(event) => {
                event.preventDefault();
                setBannerDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                if (!bannerDragActive) setBannerDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setBannerDragActive(false);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                setBannerDragActive(false);
                handleSelectBanner(getDraggedImageFile(event));
              }}
            >
              {currentBannerUrl ? (
                <MediaOverlayDeleteButton
                  label="Quitar banner"
                  onClick={handleRemoveBanner}
                />
              ) : null}
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-white dark:bg-slate-950/30">
                <OrganizationBannerPreview
                  bannerUrl={currentBannerUrl}
                  name={draft.name || draft.legalName}
                  failed={bannerFailed}
                  onError={() => setBannerFailed(true)}
                />
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(event) => {
                  handleSelectBanner(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>

            <div className="flex flex-wrap justify-center gap-3 pt-3">
              <MediaActionButton as="label">
                Cargar banner
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(event) => {
                    handleSelectBanner(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </MediaActionButton>
            </div>
          </div>
        </div>

        <div className="px-1 pt-3 text-sm text-slate-500 dark:text-slate-400">
          Formatos soportados: JPEG y PNG. Tamaño máximo: logo/avatar hasta 2 MB y banner hasta 4 MB. Al guardar, las imágenes se optimizan, redimensionan y se limpian sus metadatos.
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard
          title="Identidad y registro"
          icon="FaBuilding"
          description="Datos legales y de identificación que representan a la organización dentro de esta instancia."
        >
          <div className="grid grid-cols-1 gap-5">
            <MaintenanceField label="Nombre de la organización" hint="Nombre visible o comercial.">
              <MaintenanceInput
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
                placeholder="Ej. ACME Consultores"
              />
            </MaintenanceField>

            <MaintenanceField label="Razón social" hint="Nombre legal o registral completo.">
              <MaintenanceInput
                value={draft.legalName}
                onChange={(event) => updateDraft("legalName", event.target.value)}
                placeholder="Ej. ACME Consultores SpA"
              />
            </MaintenanceField>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <MaintenanceField label="Identificador tributario" hint="RUT, NIT, CUIT u otro equivalente.">
                <MaintenanceInput
                  value={draft.taxId}
                  onChange={(event) => updateDraft("taxId", event.target.value)}
                  placeholder="Ej. 76.123.456-7"
                />
              </MaintenanceField>

              <MaintenanceField label="Industria" hint="Rubro o sector principal.">
                <MaintenanceInput
                  value={draft.industry}
                  onChange={(event) => updateDraft("industry", event.target.value)}
                  placeholder="Ej. Consultoría tecnológica"
                />
              </MaintenanceField>
            </div>

            <MaintenanceField label="Descripción" hint="Contexto institucional breve para uso administrativo futuro.">
              <OrganizationTextarea
                value={draft.description}
                onChange={(event) => updateDraft("description", event.target.value)}
                placeholder="Describe el alcance o propósito general de la organización."
              />
            </MaintenanceField>
          </div>
        </SectionCard>

        <SectionCard
          title="Contacto institucional"
          icon="FaUser"
          description="Canales base y persona de referencia para administración de esta instancia."
        >
          <div className="grid grid-cols-1 gap-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <MaintenanceField label="Correo institucional" hint="Canal principal de contacto.">
                <MaintenanceInput
                  value={draft.email}
                  onChange={(event) => updateDraft("email", event.target.value)}
                  placeholder="contacto@organizacion.cl"
                />
              </MaintenanceField>

              <MaintenanceField label="Teléfono" hint="Número principal de la organización.">
                <MaintenanceInput
                  value={draft.phone}
                  onChange={(event) => updateDraft("phone", event.target.value)}
                  placeholder="+56 2 1234 5678"
                />
              </MaintenanceField>
            </div>

            <MaintenanceField label="Sitio web" hint="URL institucional principal.">
              <MaintenanceInput
                value={draft.website}
                onChange={(event) => updateDraft("website", event.target.value)}
                placeholder="https://www.organizacion.cl"
              />
            </MaintenanceField>

            <MaintenanceField
              label="URL pública de la plataforma"
              hint="Se usa en enlaces de correos, minutas y accesos externos. Usa la URL final publicada, por ejemplo https://minutas.tudominio.cl."
            >
              <MaintenanceInput
                value={draft.publicBaseUrl}
                onChange={(event) => updateDraft("publicBaseUrl", event.target.value)}
                invalid={Boolean(publicBaseUrlError)}
                placeholder="https://minutas.tudominio.cl"
              />
              {publicBaseUrlError ? (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{publicBaseUrlError}</p>
              ) : null}
            </MaintenanceField>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <MaintenanceField label="Contacto responsable" hint="Persona administradora o contraparte base.">
                <MaintenanceInput
                  value={draft.contactName}
                  onChange={(event) => updateDraft("contactName", event.target.value)}
                  placeholder="Nombre y apellido"
                />
              </MaintenanceField>

              <MaintenanceField label="Cargo del contacto" hint="Rol o posición institucional.">
                <MaintenanceInput
                  value={draft.contactPosition}
                  onChange={(event) => updateDraft("contactPosition", event.target.value)}
                  placeholder="Ej. Gerencia de Operaciones"
                />
              </MaintenanceField>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <MaintenanceField label="Correo del contacto" hint="Correo directo de la contraparte principal.">
                <MaintenanceInput
                  value={draft.contactEmail}
                  onChange={(event) => updateDraft("contactEmail", event.target.value)}
                  placeholder="persona@organizacion.cl"
                />
              </MaintenanceField>

              <MaintenanceField label="Teléfono del contacto" hint="Número directo si aplica.">
                <MaintenanceInput
                  value={draft.contactPhone}
                  onChange={(event) => updateDraft("contactPhone", event.target.value)}
                  placeholder="+56 9 1234 5678"
                />
              </MaintenanceField>
            </div>

            <MaintenanceField label="Área o departamento" hint="Unidad organizacional del contacto responsable.">
              <MaintenanceInput
                value={draft.contactDepartment}
                onChange={(event) => updateDraft("contactDepartment", event.target.value)}
                placeholder="Ej. Administración, Operaciones, PMO"
              />
            </MaintenanceField>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Ubicación y observaciones"
        icon="FaLocationDot"
        description="Dirección institucional y notas internas para completar la base estructural de la organización."
      >
        <div className="grid grid-cols-1 gap-5">
          <MaintenanceField label="Dirección" hint="Dirección principal o registral.">
            <MaintenanceInput
              value={draft.address}
              onChange={(event) => updateDraft("address", event.target.value)}
              placeholder="Calle, número, oficina"
            />
          </MaintenanceField>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <MaintenanceField label="País">
              <MaintenanceInput
                value={draft.country}
                onChange={(event) => updateDraft("country", event.target.value)}
                placeholder="Chile"
              />
            </MaintenanceField>

            <MaintenanceField label="Región / estado">
              <MaintenanceInput
                value={draft.region}
                onChange={(event) => updateDraft("region", event.target.value)}
                placeholder="Metropolitana"
              />
            </MaintenanceField>

            <MaintenanceField label="Ciudad">
              <MaintenanceInput
                value={draft.city}
                onChange={(event) => updateDraft("city", event.target.value)}
                placeholder="Santiago"
              />
            </MaintenanceField>

            <MaintenanceField label="Código postal">
              <MaintenanceInput
                value={draft.postalCode}
                onChange={(event) => updateDraft("postalCode", event.target.value)}
                placeholder="8320000"
              />
            </MaintenanceField>
          </div>

          <MaintenanceField label="Notas internas" hint="Observaciones administrativas o contexto que quieras preservar.">
            <OrganizationTextarea
              value={draft.notes}
              onChange={(event) => updateDraft("notes", event.target.value)}
              placeholder="Notas institucionales para futuros acoples del sistema."
            />
          </MaintenanceField>
        </div>
      </SectionCard>

      <ConfigActionBar
        hasChanges={hasChanges}
        onDiscard={handleDiscard}
        onSave={handleSave}
        saveLabel={isSaving ? "Guardando..." : "Guardar organización"}
        saveDisabled={Boolean(publicBaseUrlError)}
        dirtyMessage="Los datos institucionales quedarán disponibles para futuros acoples de branding, minutas y trazabilidad."
        cleanMessage="La configuración institucional guardada será la base para futuros acoples del sistema."
      />
    </div>
  );
};
