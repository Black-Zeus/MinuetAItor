import React, { useState, useEffect, useMemo } from "react";
import ProfilesCatalogHeader from "./ProfilesCatalogHeader";
import ProfilesCatalogStats from "./ProfilesCatalogStats";
import ProfilesCatalogFilters from "./ProfilesCatalogFilters";
import ProfilesCatalogGrid from "./ProfilesCatalogGrid";
import ModalManager from "@/components/ui/modal";
import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";

// Modal de perfiles
import ProfilesCatalogModal, { PROFILE_MODAL_MODES } from "./ProfilesCatalogModal";

// (DEV) Mock data - En PROD: reemplazar por service
import profilesDataJSON from "@/data/analysisProfilesCatalog.json";


import logger from '@/utils/logger';
const profileLog = logger.scope("profile");

// ============================================================
// HELPERS
// ============================================================
const normalizeText = (v) => String(v ?? "").trim();

const normalizeStatusToUI = (v) => {
    // Acepta boolean o string y lo transforma a "activo"/"inactivo"
    if (typeof v === "boolean") return v ? "activo" : "inactivo";
    const s = normalizeText(v).toLowerCase();
    if (s === "inactivo" || s === "inactive") return "inactivo";
    if (s === "activo" || s === "active") return "activo";
    return "activo";
};

const uniqueStrings = (arr) => {
    const out = [];
    const seen = new Set();
    (Array.isArray(arr) ? arr : []).forEach((v) => {
        const s = normalizeText(v);
        if (!s) return;
        if (seen.has(s)) return;
        seen.add(s);
        out.push(s);
    });
    return out;
};

const normalizeProfileUI = (p = {}) => ({
    id: Number(p.id) || 0,
    nombre: normalizeText(p.nombre),
    categoria: normalizeText(p.categoria),
    descripcion: normalizeText(p.descripcion),
    prompt: normalizeText(p.prompt),
    status: normalizeStatusToUI(p.status ?? true), // default activo
});

const ProfilesCatalog = () => {
    const [profiles, setProfiles] = useState([]);
    const [filteredProfiles, setFilteredProfiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [filters, setFilters] = useState({
        search: "",
        status: "", // "" | "activo" | "inactivo"
        categoria: "",
        sort: "az",
    });

    // Pagination
    const [page, setPage] = useState(1);
    const itemsPerPage = 12;

    // ============================================================
    // LOAD DATA
    // ============================================================
    useEffect(() => {
        const loadProfiles = async () => {
            try {
                await new Promise((resolve) => setTimeout(resolve, 500));

                const src = Array.isArray(profilesDataJSON) ? profilesDataJSON : [];
                const transformed = src.map((p) => normalizeProfileUI(p));

                setProfiles(transformed);
                setFilteredProfiles(transformed);
            } catch (error) {
                profileLog.error("[ProfilesCatalog] Error loading profiles:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadProfiles();
    }, []);

    // ============================================================
    // CATEGORÍAS DISPONIBLES (catálogo cerrado)
    // ============================================================
    const categoryOptions = useMemo(() => {
        const cats = profiles.map((p) => p.categoria);
        return uniqueStrings(cats).sort((a, b) => a.localeCompare(b));
    }, [profiles]);

    // ============================================================
    // FILTERING
    // ============================================================
    useEffect(() => {
        let filtered = [...profiles];

        // Search
        if (filters.search) {
            const term = filters.search.toLowerCase();
            filtered = filtered.filter((p) => {
                const nombre = (p.nombre || "").toLowerCase();
                const descripcion = (p.descripcion || "").toLowerCase();
                const categoria = (p.categoria || "").toLowerCase();
                const prompt = (p.prompt || "").toLowerCase();
                return (
                    nombre.includes(term) ||
                    descripcion.includes(term) ||
                    categoria.includes(term) ||
                    prompt.includes(term)
                );
            });
        }

        // Status
        if (filters.status) {
            filtered = filtered.filter((p) => p.status === filters.status);
        }

        // Categoria
        if (filters.categoria) {
            filtered = filtered.filter((p) => p.categoria === filters.categoria);
        }

        // Sort
        if (filters.sort === "az") {
            filtered.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
        } else if (filters.sort === "za") {
            filtered.sort((a, b) => (b.nombre || "").localeCompare(a.nombre || ""));
        } else if (filters.sort === "status") {
            filtered.sort((a, b) => {
                if (a.status === b.status) return (a.nombre || "").localeCompare(b.nombre || "");
                return a.status === "activo" ? -1 : 1;
            });
        } else if (filters.sort === "categoria") {
            filtered.sort((a, b) => {
                if (a.categoria === b.categoria) return (a.nombre || "").localeCompare(b.nombre || "");
                return (a.categoria || "").localeCompare(b.categoria || "");
            });
        }

        setFilteredProfiles(filtered);
        setPage(1);
    }, [filters, profiles]);

    // ============================================================
    // FILTER HANDLERS
    // ============================================================
    const handleFilterChange = (filterName, value) => {
        setFilters((prev) => ({ ...prev, [filterName]: value }));
    };

    const handleClearFilters = () => {
        setFilters({
            search: "",
            status: "",
            categoria: "",
            sort: "az",
        });
    };

    const handleApplyFilters = () => {
        profileLog.log("[ProfilesCatalog] Filtros aplicados:", filters);
    };

    // ============================================================
    // PAGINACIÓN
    // ============================================================
    const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / itemsPerPage));
    const paginatedProfiles = filteredProfiles.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
    };

    // ============================================================
    // MODAL ORQUESTACIÓN (VIEW / EDIT)
    // ============================================================
    const openViewModal = (profile) => {
        ModalManager.show({
            type: "custom",
            title: "Detalles del Perfil",
            size: "large",
            showFooter: false,
            content: (
                <ProfilesCatalogModal
                    mode={PROFILE_MODAL_MODES.VIEW}
                    profile={profile}
                    categories={categoryOptions} // ✅ (aunque en view no sea obligatorio)
                    onClose={() => ModalManager.close?.()}
                />
            ),
        });
    };

    const openEditModal = (profile) => {
        ModalManager.show({
            type: "custom",
            title: "Editar Perfil",
            size: "large",
            showFooter: false,
            content: (
                <ProfilesCatalogModal
                    mode={PROFILE_MODAL_MODES.EDIT}
                    profile={profile}
                    categories={categoryOptions} // ✅
                    onSubmit={(payload) => {
                        handleUpdate(profile.id, payload);
                        ModalManager.close?.();
                    }}
                    onClose={() => ModalManager.close?.()}
                />
            ),
        });
    };

    // ============================================================
    // CRUD
    // ============================================================
    const handleCreate = (newProfile) => {
        const nextId = Math.max(0, ...profiles.map((p) => Number(p.id) || 0)) + 1;

        const profile = normalizeProfileUI({
            id: nextId,
            nombre: newProfile?.nombre,
            categoria: newProfile?.categoria,
            descripcion: newProfile?.descripcion,
            prompt: newProfile?.prompt,
            status: newProfile?.status, // boolean|string
        });

        // catálogo cerrado
        if (!categoryOptions.includes(profile.categoria)) {
            ModalManager.error?.({
                title: "Categoría inválida",
                message: "La categoría seleccionada no pertenece al catálogo existente.",
            });
            return;
        }

        setProfiles((prev) => [profile, ...prev]);

        ModalManager.success({
            title: "Perfil Creado",
            message: `El perfil "${profile.nombre}" ha sido creado exitosamente.`,
        });
    };

    const handleUpdate = (id, updatedData) => {
        const patch = {
            nombre: updatedData?.nombre,
            categoria: updatedData?.categoria,
            descripcion: updatedData?.descripcion,
            prompt: updatedData?.prompt,
            status: updatedData?.status,
        };

        const normalizedPatch = normalizeProfileUI(patch);
        delete normalizedPatch.id;

        // catálogo cerrado
        if (normalizeText(normalizedPatch.categoria) && !categoryOptions.includes(normalizedPatch.categoria)) {
            ModalManager.error?.({
                title: "Categoría inválida",
                message: "La categoría seleccionada no pertenece al catálogo existente.",
            });
            return;
        }

        setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...normalizedPatch } : p)));

        ModalManager.success({
            title: "Perfil Actualizado",
            message: "El perfil ha sido actualizado exitosamente.",
        });
    };

    const handleToggleStatus = (id) => {
        // aunque el toggle se mueva al modal, se mantiene por compatibilidad con Grid
        setProfiles((prev) =>
            prev.map((p) => (p.id === id ? { ...p, status: p.status === "activo" ? "inactivo" : "activo" } : p))
        );
    };

    const handleDelete = (id) => {
        const profile = profiles.find((p) => p.id === id);
        if (!profile) return;

        ModalManager.confirm({
            title: "Eliminar Perfil",
            message: `¿Estás seguro de eliminar el perfil "${profile.nombre}"? Esta acción no se puede deshacer.`,
            confirmText: "Eliminar",
            cancelText: "Cancelar",
            variant: "danger",
            onConfirm: () => {
                setProfiles((prev) => prev.filter((p) => p.id !== id));
                ModalManager.success({
                    title: "Perfil Eliminado",
                    message: "El perfil ha sido eliminado exitosamente.",
                });
            },
        });
    };

    // ============================================================
    // EXPORT
    // ============================================================
    const handleExport = () => {
        const exported = profiles.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            categoria: p.categoria,
            descripcion: p.descripcion,
            prompt: p.prompt,
            status: p.status, // "activo"|"inactivo"
        }));

        const blob = new Blob([JSON.stringify(exported, null, 2)], {
            type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "analysis-profiles-catalog.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    // ============================================================
    // STATS
    // ============================================================
    const stats = useMemo(() => {
        return {
            total: profiles.length,
            activos: profiles.filter((p) => p.status === "activo").length,
            inactivos: profiles.filter((p) => p.status === "inactivo").length,
            conPrompt: profiles.filter((p) => (p.prompt || "").trim()).length,
        };
    }, [profiles]);

    // ============================================================
    // RENDER
    // ============================================================
    if (isLoading) {
        return <PageLoadingSpinner message="Cargando Perfiles de Análisis..." />;
    }

    return (
        <div className="space-y-6">
            <ProfilesCatalogHeader />

            <ProfilesCatalogFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
                onApplyFilters={handleApplyFilters}
                categories={categoryOptions}     // ✅ aquí se llena el combo
                profiles={profiles}             // (opcional) fallback
            />

            <ProfilesCatalogStats stats={stats} />

            <ProfilesCatalogGrid
                profiles={paginatedProfiles}
                allProfiles={filteredProfiles}
                page={page}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onView={openViewModal}
                onEdit={(idOrProfile, maybeProfile) => {
                    const p =
                        typeof idOrProfile === "object"
                            ? idOrProfile
                            : maybeProfile || profiles.find((x) => x.id === idOrProfile);
                    if (p) openEditModal(p);
                }}
                onToggleStatus={handleToggleStatus}
                onDelete={handleDelete}
                hasFilters={!!(filters.search || filters.status || filters.categoria)}
                sortValue={filters.sort}
                onSortChange={(sort) => handleFilterChange("sort", sort)}
            />
        </div>
    );
};

export default ProfilesCatalog;