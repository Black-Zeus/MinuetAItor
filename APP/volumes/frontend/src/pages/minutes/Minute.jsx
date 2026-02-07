// src/pages/minutes/Minutes.jsx
import React, { useState } from "react";
import ActionButton from "@/components/ui/button/ActionButton";
import NewMinute from "@/components/ui/button/newMinute";
import Icon from "@/components/ui/icon/iconManager";
import minutesData from "@/data/minutes.json";

/**
 * Componente Minutes - Gestión de minutas de reuniones
 * Usa 100% clases de Tailwind basadas en la configuración del proyecto
 */

// Constantes de estilo de texto (consistente con Dashboard)
const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_BODY = "text-gray-700 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const STATUS_CONFIG = {
    completed: {
        label: "Completada",
        icon: "checkCircle",
        className: "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-200"
    },
    pending: {
        label: "Pendiente",
        icon: "clock",
        className: "bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-200"
    },
    "in-progress": {
        label: "En Progreso",
        icon: "spinner",
        className: "bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-200"
    }
};

const TAG_COLORS = {
    blue: "bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-200",
    green: "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-200",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-200",
    orange: "bg-warm-50 text-warm-700 dark:bg-warm-900/20 dark:text-warm-200",
    red: "bg-danger-50 text-danger-700 dark:bg-danger-900/20 dark:text-danger-200",
    yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200"
};

const Minutes = () => {
    const [filters, setFilters] = useState({
        client: "",
        project: "",
        dateFrom: "",
        dateTo: "",
        participant: ""
    });

    const [visibleFilters, setVisibleFilters] = useState({
        client: true,
        project: true,
        dateFrom: false,
        dateTo: false,
        participant: false
    });

    const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);
    const [filtersExpanded, setFiltersExpanded] = useState(false);

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const handleClearFilters = () => {
        setFilters({
            client: "",
            project: "",
            dateFrom: "",
            dateTo: "",
            participant: ""
        });
    };

    const toggleFilterVisibility = (filterName) => {
        setVisibleFilters(prev => ({ ...prev, [filterName]: !prev[filterName] }));
    };

    return (
        <div className="w-full p-6 md:p-8">
            {/* Page Header */}
            <div className="bg-surface shadow-card rounded-2xl p-6 md:p-8 mb-6 border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 transition-theme">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex-1">
                        <h1 className={`text-3xl font-bold ${TXT_TITLE} flex items-center gap-3 mb-2 transition-theme`}>
                            <Icon name="fileLines" className="text-primary-500 dark:text-primary-400" />
                            Minutas
                        </h1>
                        <p className={`text-base ${TXT_META} transition-theme`}>
                            Gestiona y organiza todas tus minutas de reuniones
                        </p>
                    </div>
                    <NewMinute />
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-surface shadow-card rounded-2xl p-6 mb-6 border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 transition-theme">
                {/* Filters Header */}
                <div className="flex justify-between items-center pb-4 border-b border-secondary-200 dark:border-secondary-700/60 transition-theme">
                    <button
                        onClick={() => setFiltersExpanded(!filtersExpanded)}
                        className={`flex items-center gap-2 text-base font-semibold ${TXT_TITLE} hover:text-primary-600 dark:hover:text-primary-400 transition-theme`}
                    >
                        <Icon name="filter" className="text-primary-500 dark:text-primary-400" />
                        Filtros Activos
                        <Icon 
                            name={filtersExpanded ? "chevronUp" : "chevronDown"} 
                            className="text-sm transition-transform duration-200"
                        />
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setShowFiltersDropdown(!showFiltersDropdown)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${TXT_META} bg-transparent border border-secondary-200 dark:border-secondary-700 rounded-xl hover:bg-secondary-50 dark:hover:bg-secondary-800/50 hover:border-secondary-300 dark:hover:border-secondary-600 hover:text-gray-900 dark:hover:text-gray-50 transition-theme`}
                        >
                            <Icon name="sliders" className="text-sm" />
                            Gestionar Filtros
                        </button>

                        {/* Dropdown de gestión de filtros */}
                        {showFiltersDropdown && (
                            <>
                                {/* Backdrop */}
                                <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={() => setShowFiltersDropdown(false)}
                                />
                                {/* Dropdown Menu */}
                                <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 border border-secondary-200 dark:border-secondary-700 rounded-2xl shadow-dropdown p-4 min-w-[250px] z-50 transition-theme">
                                    {Object.keys(visibleFilters).map(filterKey => (
                                        <div
                                            key={filterKey}
                                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary-50 dark:hover:bg-gray-700/50 cursor-pointer transition-theme"
                                            onClick={() => toggleFilterVisibility(filterKey)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={visibleFilters[filterKey]}
                                                onChange={() => {}}
                                                className="w-4 h-4 cursor-pointer accent-primary-500"
                                            />
                                            <label className={`cursor-pointer text-sm ${TXT_TITLE} flex-1 capitalize transition-theme`}>
                                                {filterKey === "dateFrom" ? "Fecha Desde" : 
                                                 filterKey === "dateTo" ? "Fecha Hasta" : 
                                                 filterKey === "participant" ? "Participante" :
                                                 filterKey}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Filters Container - Collapsible */}
                {filtersExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end mt-6">
                        {/* Cliente Filter */}
                        {visibleFilters.client && (
                            <div className="flex flex-col gap-2">
                                <label className={`text-sm font-semibold ${TXT_META} flex items-center gap-2 transition-theme`}>
                                    <Icon name="business" className="text-primary-500 dark:text-primary-400 text-sm" />
                                    Cliente
                                </label>
                                <select
                                    value={filters.client}
                                    onChange={(e) => handleFilterChange("client", e.target.value)}
                                    className={`w-full px-4 py-2.5 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
                                >
                                    <option value="" className="bg-white dark:bg-gray-800">Todos los clientes</option>
                                    {minutesData.clients.map(client => (
                                        <option key={client.id} value={client.id} className="bg-white dark:bg-gray-800">{client.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Proyecto Filter */}
                        {visibleFilters.project && (
                            <div className="flex flex-col gap-2">
                                <label className={`text-sm font-semibold ${TXT_META} flex items-center gap-2 transition-theme`}>
                                    <Icon name="folder" className="text-primary-500 dark:text-primary-400 text-sm" />
                                    Proyecto
                                </label>
                                <select
                                    value={filters.project}
                                    onChange={(e) => handleFilterChange("project", e.target.value)}
                                    className={`w-full px-4 py-2.5 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
                                >
                                    <option value="" className="bg-white dark:bg-gray-800">Todos los proyectos</option>
                                    {minutesData.projects.map(project => (
                                        <option key={project.id} value={project.id} className="bg-white dark:bg-gray-800">{project.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Fecha Desde */}
                        {visibleFilters.dateFrom && (
                            <div className="flex flex-col gap-2">
                                <label className={`text-sm font-semibold ${TXT_META} flex items-center gap-2 transition-theme`}>
                                    <Icon name="calendar" className="text-primary-500 dark:text-primary-400 text-sm" />
                                    Desde
                                </label>
                                <input
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                                    className={`w-full px-4 py-2.5 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
                                />
                            </div>
                        )}

                        {/* Fecha Hasta */}
                        {visibleFilters.dateTo && (
                            <div className="flex flex-col gap-2">
                                <label className={`text-sm font-semibold ${TXT_META} flex items-center gap-2 transition-theme`}>
                                    <Icon name="calendar" className="text-primary-500 dark:text-primary-400 text-sm" />
                                    Hasta
                                </label>
                                <input
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                                    className={`w-full px-4 py-2.5 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
                                />
                            </div>
                        )}

                        {/* Participante Filter */}
                        {visibleFilters.participant && (
                            <div className="flex flex-col gap-2">
                                <label className={`text-sm font-semibold ${TXT_META} flex items-center gap-2 transition-theme`}>
                                    <Icon name="users" className="text-primary-500 dark:text-primary-400 text-sm" />
                                    Participante
                                </label>
                                <select
                                    value={filters.participant}
                                    onChange={(e) => handleFilterChange("participant", e.target.value)}
                                    className={`w-full px-4 py-2.5 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
                                >
                                    <option value="" className="bg-white dark:bg-gray-800">Todos los participantes</option>
                                    {minutesData.participants.map(participant => (
                                        <option key={participant.id} value={participant.id} className="bg-white dark:bg-gray-800">{participant.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Filter Actions */}
                        <div className="flex flex-col gap-2 lg:col-start-6">
                            <ActionButton
                                label="Limpiar"
                                variant="soft"
                                size="sm"
                                icon={<Icon name="filterClear" />}
                                onClick={handleClearFilters}
                                className="w-full"
                            />
                            <ActionButton
                                label="Filtrar"
                                variant="primary"
                                size="sm"
                                icon={<Icon name="search" />}
                                onClick={() => console.log("Aplicar filtros", filters)}
                                className="w-full"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Results Info */}
            <div className="flex justify-start items-center px-2 py-4 mb-4">
                <div className={`text-sm ${TXT_META} flex items-center gap-2 transition-theme`}>
                    <Icon name="listCheck" />
                    Mostrando <strong className={`${TXT_TITLE} font-semibold transition-theme`}>{minutesData.minutes.length} minutas</strong>
                </div>
            </div>

            {/* Minutes Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {minutesData.minutes.map((minute) => (
                    <MinuteCard key={minute.id} minute={minute} />
                ))}
            </div>

            {/* Pagination */}
            <div className="flex justify-center items-center gap-2 py-8">
                <button
                    disabled
                    className={`min-w-[40px] px-4 py-2 bg-surface shadow-card border border-secondary-200 dark:border-secondary-700 ${TXT_META} rounded-xl text-sm font-medium transition-theme disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
                >
                    <Icon name="chevronLeft" />
                </button>
                <button className="min-w-[40px] px-4 py-2 bg-primary-500 border border-primary-500 text-white rounded-xl text-sm font-medium shadow-button hover:shadow-button-hover transition-all">
                    1
                </button>
                <button className={`min-w-[40px] px-4 py-2 bg-surface shadow-card border border-secondary-200 dark:border-secondary-700 ${TXT_META} rounded-xl text-sm font-medium hover:bg-secondary-50 dark:hover:bg-secondary-800/50 hover:border-secondary-300 dark:hover:border-secondary-600 hover:text-gray-900 dark:hover:text-gray-50 transition-theme`}>
                    2
                </button>
                <button className={`min-w-[40px] px-4 py-2 bg-surface shadow-card border border-secondary-200 dark:border-secondary-700 ${TXT_META} rounded-xl text-sm font-medium hover:bg-secondary-50 dark:hover:bg-secondary-800/50 hover:border-secondary-300 dark:hover:border-secondary-600 hover:text-gray-900 dark:hover:text-gray-50 transition-theme`}>
                    3
                </button>
                <button className={`min-w-[40px] px-4 py-2 bg-surface shadow-card border border-secondary-200 dark:border-secondary-700 ${TXT_META} rounded-xl text-sm font-medium hover:bg-secondary-50 dark:hover:bg-secondary-800/50 hover:border-secondary-300 dark:hover:border-secondary-600 hover:text-gray-900 dark:hover:text-gray-50 transition-theme flex items-center justify-center`}>
                    <Icon name="chevronRight" />
                </button>
            </div>
        </div>
    );
}

// Componente MinuteCard
function MinuteCard({ minute }) {
    const statusConfig = STATUS_CONFIG[minute.status];

    return (
        <div className="bg-surface rounded-2xl border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 overflow-hidden transition-all duration-200 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 hover:border-primary-500 dark:hover:border-primary-400">
            {/* Header */}
            <div className="p-6 border-b border-secondary-200 dark:border-secondary-700/60 flex justify-between items-start gap-4 transition-theme">
                <div className="flex-1 min-w-0">
                    <h3 className={`text-lg font-semibold ${TXT_TITLE} mb-2 leading-snug transition-theme`}>
                        {minute.title}
                    </h3>
                    <div className={`flex flex-wrap gap-4 text-xs ${TXT_META} transition-theme`}>
                        <span className="flex items-center gap-1.5">
                            <Icon name="calendar" className="text-xs" />
                            {minute.date}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Icon name="clock" className="text-xs" />
                            {minute.time}
                        </span>
                    </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-theme ${statusConfig.className}`}>
                    <Icon name={statusConfig.icon} />
                    {statusConfig.label}
                </div>
            </div>

            {/* Body */}
            <div className="p-6">
                <div className={`flex flex-wrap gap-4 mb-4 text-sm ${TXT_BODY} transition-theme`}>
                    <div className="flex items-center gap-2">
                        <Icon name="business" className="text-primary-500 dark:text-primary-400 text-sm" />
                        <span>{minute.client}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Icon name="folder" className="text-primary-500 dark:text-primary-400 text-sm" />
                        <span>{minute.project}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 mb-4">
                    <Icon name="users" className="text-primary-500 dark:text-primary-400 text-sm" />
                    <div className="flex flex-wrap gap-2">
                        {minute.participants.map((participant, idx) => (
                            <span
                                key={idx}
                                className={`px-2.5 py-1 bg-gray-100 dark:bg-gray-800/60 ${TXT_BODY} rounded-lg text-xs font-medium transition-theme`}
                            >
                                {participant}
                            </span>
                        ))}
                    </div>
                </div>

                <div className={`text-sm ${TXT_BODY} leading-relaxed mb-4 line-clamp-3 transition-theme`}>
                    {minute.summary}
                </div>

                <div className="flex flex-wrap gap-2">
                    {minute.tags.map((tag, idx) => (
                        <span
                            key={idx}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-theme ${TAG_COLORS[tag.color]}`}
                        >
                            {tag.label}
                        </span>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 grid grid-cols-1 gap-2 transition-theme">
                <ActionButton
                    label="Ver Línea de Tiempo"
                    variant="info"
                    size="sm"
                    icon={<Icon name="history" />}
                    onClick={() => console.log("Ver timeline", minute.id)}
                    className="w-full"
                />

                <div className="grid grid-cols-4 gap-2">
                    <ActionButton
                        label="Ver"
                        variant="soft"
                        size="xs"
                        icon={<Icon name="eye" />}
                        onClick={() => console.log("Ver", minute.id)}
                        className="w-full"
                    />
                    <ActionButton
                        label="Editar"
                        variant="soft"
                        size="xs"
                        icon={<Icon name="edit" />}
                        onClick={() => console.log("Editar", minute.id)}
                        className="w-full"
                    />
                    <ActionButton
                        label="Descargar"
                        variant="soft"
                        size="xs"
                        icon={<Icon name="download" />}
                        onClick={() => console.log("Descargar", minute.id)}
                        className="w-full"
                    />
                    <button
                        onClick={() => console.log("Eliminar", minute.id)}
                        className={`px-2 py-2 bg-surface-light dark:bg-surface-dark border border-secondary-200 dark:border-secondary-700 ${TXT_META} rounded-xl text-sm hover:bg-danger-50 dark:hover:bg-danger-900/20 hover:border-danger-500 dark:hover:border-danger-400 hover:text-danger-700 dark:hover:text-danger-200 transition-all flex items-center justify-center shadow-button hover:shadow-button-hover`}
                    >
                        <Icon name="delete" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Minutes;