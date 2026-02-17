/**
 * ProfilesCatalog.jsx
 * Orquestador para gestión de Perfiles de Análisis
 * Alineado al patrón visual/arquitectónico de Project.jsx
 */

import React, { useState, useEffect, useMemo } from "react";
import ProfilesCatalogHeader from "./ProfilesCatalogHeader";
import ProfilesCatalogStats from "./ProfilesCatalogStats";
import ProfilesCatalogFilters from "./ProfilesCatalogFilters";
import ProfilesCatalogGrid from "./ProfilesCatalogGrid";
import ModalManager from "@/components/ui/modal";
import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";

// (DEV) Mock data - En PROD: reemplazar por service
import profilesDataJSON from "@/data/analysisProfilesCatalog.json";

const ProfilesCatalog = () => {
    const [profiles, setProfiles] = useState([]);
    const [filteredProfiles, setFilteredProfiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters (mismo patrón que Project.jsx)
    const [filters, setFilters] = useState({
        search: "",
        status: "",
        categoria: "",
        sort: "az",
    });

    // Pagination
    const [page, setPage] = useState(1);
    const itemsPerPage = 12;

    // ============================================================
    // LOAD DATA (patrón Project)
    // ============================================================
    useEffect(() => {
        const loadProfiles = async () => {
            try {
                // Simulación carga (igual a Project)
                await new Promise((resolve) => setTimeout(resolve, 500));

                // Normalización: status -> activo/inactivo
                // Si tu JSON no trae status, dejamos activo por defecto.
                const transformed = (Array.isArray(profilesDataJSON) ? profilesDataJSON : []).map((p) => ({
                    id: p.id,
                    nombre: String(p.nombre ?? "").trim(),
                    categoria: String(p.categoria ?? "").trim(),
                    descripcion: String(p.descripcion ?? "").trim(),
                    prompt: String(p.prompt ?? "").trim(),
                    // true => activo, false => inactivo (default: activo si viene null/undefined)
                    status: (p.status ?? true) ? "activo" : "inactivo",
                }));

                setProfiles(transformed);
                setFilteredProfiles(transformed);
            } catch (error) {
                console.error("[ProfilesCatalog] Error loading profiles:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadProfiles();
    }, []);

    // ============================================================
    // FILTERING (patrón Project)
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
    // FILTER HANDLERS (igual a Project.jsx)
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
        // Hook para futuro (igual que Project)
        console.log("[ProfilesCatalog] Filtros aplicados:", filters);
    };

    // ============================================================
    // PAGINACIÓN
    // ============================================================
    const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / itemsPerPage));
    const paginatedProfiles = filteredProfiles.slice(
        (page - 1) * itemsPerPage,
        page * itemsPerPage
    );

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
    };

    // ============================================================
    // CRUD (igual enfoque que Profile original, pero coherente)
    // ============================================================
    const handleCreate = (newProfile) => {
        const nextId = Math.max(0, ...profiles.map((p) => Number(p.id) || 0)) + 1;

        const profile = {
            id: nextId,
            nombre: String(newProfile?.nombre ?? "").trim(),
            categoria: String(newProfile?.categoria ?? "").trim(),
            descripcion: String(newProfile?.descripcion ?? "").trim(),
            prompt: String(newProfile?.prompt ?? "").trim(),
            status: newProfile?.status === "inactivo" ? "inactivo" : "activo",
        };

        setProfiles((prev) => [profile, ...prev]);

        ModalManager.success({
            title: "Perfil Creado",
            message: `El perfil "${profile.nombre}" ha sido creado exitosamente.`,
        });
    };

    const handleUpdate = (id, updatedData) => {
        setProfiles((prev) =>
            prev.map((p) => (p.id === id ? { ...p, ...updatedData } : p))
        );

        ModalManager.success({
            title: "Perfil Actualizado",
            message: "El perfil ha sido actualizado exitosamente.",
        });
    };

    const handleToggleStatus = (id) => {
        setProfiles((prev) =>
            prev.map((p) =>
                p.id === id
                    ? { ...p, status: p.status === "activo" ? "inactivo" : "activo" }
                    : p
            )
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
    // EXPORT (sin cambios funcionales)
    // ============================================================
    const handleExport = () => {
        const exported = profiles.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            categoria: p.categoria,
            descripcion: p.descripcion,
            prompt: p.prompt,
            status: p.status,
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
    // STATS (patrón similar a Project)
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
            <ProfilesCatalogHeader onExport={handleExport} />

            <ProfilesCatalogFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
                onApplyFilters={handleApplyFilters}
                onExport={handleExport}
            />

            <ProfilesCatalogStats stats={stats} />

            <ProfilesCatalogGrid
                profiles={paginatedProfiles}
                allProfiles={filteredProfiles}
                page={page}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onCreate={handleCreate}
                onEdit={handleUpdate}
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