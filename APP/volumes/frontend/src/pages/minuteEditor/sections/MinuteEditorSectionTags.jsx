/**
 * pages/minuteEditor/sections/MinuteEditorSectionTags.jsx
 * Tab "Tags": dos columnas.
 *
 * Reglas / Cambios:
 * - Tags IA:
 *    - Orden alfabético por name.
 *    - Descripción COMPLETA (sin clamp).
 *    - Acciones: Convertir (marcar/compilar a tag usuario) y Eliminar.
 *    - Convertir: crea un tag de usuario (addUserTag espera STRING) con nombre definido por usuario,
 *      y lo asocia visualmente al tag IA (se muestra debajo en otro color como "categoría / nombre").
 * - Tags usuario:
 *    - No texto libre directo: se agregan desde catálogo (DDL por categoría).
 *    - Orden: categoría ASC, luego nombre ASC.
 *    - Tabla estilo similar a IA (categoría, tag, descripción completa, acción).
 *
 * Nota técnica:
 * - Tu store addUserTag(name) trabaja con string (name.trim()).
 * - Para soportar "tag usuario derivado de IA" con categoría y descripción, se mantiene un mapa local
 *   (customCatalogByName) para enriquecer tags que NO existen en @/data/dataTags.json.
 *   Si quieres persistencia real, esto debería moverse al store.
 */

import React, { useMemo, useState } from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';
import tagsCatalog from '@/data/dataTags.json';

const MinuteEditorSectionTags = () => {
    const { aiTags, userTags, deleteAiTag, addUserTag, deleteUserTag } = useMinuteEditorStore();

    // DDL usuario (catálogo)
    const [selectedCatalogId, setSelectedCatalogId] = useState('');

    // Para "compilar" IA -> Usuario (enriquecimiento local)
    // - aiToUserAlias: por aiTagId guardo { category, name }
    // - customCatalogByName: por userTagName guardo { category, description, status, source }
    const [aiToUserAlias, setAiToUserAlias] = useState({});
    const [customCatalogByName, setCustomCatalogByName] = useState({});

    // ---------------------------
    // Helpers
    // ---------------------------
    const normalizeName = (v) => String(v ?? '').trim().toLowerCase();
    const normalizeText = (v) => String(v ?? '').trim();

    // ---------------------------
    // Catálogo indexado
    // ---------------------------
    const catalogById = useMemo(() => {
        const map = new Map();
        (tagsCatalog ?? []).forEach((t) => map.set(String(t.id), t));
        return map;
    }, []);

    const catalogByName = useMemo(() => {
        const map = new Map();
        (tagsCatalog ?? []).forEach((t) => map.set(normalizeName(t.name), t));
        return map;
    }, []);

    const catalogCategories = useMemo(() => {
        const set = new Set();
        (tagsCatalog ?? []).forEach((t) => {
            const c = normalizeText(t.category);
            if (c) set.add(c);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    }, []);

    const userTagNamesSet = useMemo(() => {
        const set = new Set();
        (userTags ?? []).forEach((t) => set.add(normalizeName(t.name)));
        return set;
    }, [userTags]);

    // ---------------------------
    // Catálogo "activo" disponible (para DDL usuario)
    // ---------------------------
    const activeCatalog = useMemo(() => {
        const list = (tagsCatalog ?? []).filter(
            (t) => String(t.status ?? '').toLowerCase() === 'activo'
        );
        return list.filter((t) => !userTagNamesSet.has(normalizeName(t.name)));
    }, [userTagNamesSet]);

    const catalogGrouped = useMemo(() => {
        const groups = new Map();
        activeCatalog.forEach((t) => {
            const key = normalizeText(t.category) || 'Sin categoría';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(t);
        });

        return Array.from(groups.entries())
            .sort(([a], [b]) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
            .map(([cat, items]) => [
                cat,
                items.sort((x, y) =>
                    String(x.name).localeCompare(String(y.name), 'es', { sensitivity: 'base' })
                ),
            ]);
    }, [activeCatalog]);

    // ---------------------------
    // Tags usuario enriquecidos + ORDEN (categoría, luego nombre)
    // ---------------------------
    const userTagsEnrichedSorted = useMemo(() => {
        const enriched = (userTags ?? []).map((ut) => {
            const key = normalizeName(ut.name);

            // 1) Catálogo oficial por name
            const fromCatalog = catalogByName.get(key);

            // 2) Catálogo local (derivado IA / custom)
            const fromCustom = customCatalogByName[key];

            const category =
                normalizeText(fromCatalog?.category) ||
                normalizeText(fromCustom?.category) ||
                'Sin categoría';

            const description =
                normalizeText(fromCatalog?.description) ||
                normalizeText(fromCustom?.description) ||
                '—';

            return {
                ...ut,
                category,
                description,
                source: fromCustom?.source || (fromCatalog ? 'catalog' : 'custom'),
            };
        });

        // Orden: categoría ASC, luego tag/name ASC
        enriched.sort((a, b) => {
            const c = String(a.category).localeCompare(String(b.category), 'es', { sensitivity: 'base' });
            if (c !== 0) return c;
            return String(a.name).localeCompare(String(b.name), 'es', { sensitivity: 'base' });
        });

        return enriched;
    }, [userTags, catalogByName, customCatalogByName]);

    // ---------------------------
    // Tags IA ordenados alfabéticamente
    // ---------------------------
    const aiTagsSorted = useMemo(() => {
        const list = Array.isArray(aiTags) ? [...aiTags] : [];
        list.sort((a, b) =>
            String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'es', { sensitivity: 'base' })
        );
        return list;
    }, [aiTags]);

    // ---------------------------
    // Acciones: eliminar
    // ---------------------------
    const handleDeleteAiTag = (id, name) => {
        ModalManager.confirm({
            title: 'Eliminar tag sugerido por IA',
            message: `¿Eliminar el tag "${name}"? Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            onConfirm: () => deleteAiTag(id),
        });
    };

    const handleDeleteUserTag = (id, name) => {
        ModalManager.confirm({
            title: 'Eliminar tag de usuario',
            message: `¿Eliminar el tag "${name}"?`,
            confirmText: 'Eliminar',
            onConfirm: () => deleteUserTag(id),
        });
    };

    // ---------------------------
    // Acción: agregar usuario desde catálogo (DDL)
    // ---------------------------
    const handleAddUserTagFromCatalog = () => {
        const idStr = String(selectedCatalogId ?? '').trim();
        if (!idStr) return;

        const picked = catalogById.get(idStr);
        if (!picked) {
            ModalManager.warning({
                title: 'Selección inválida',
                message: 'El tag seleccionado no existe en el catálogo.',
            });
            return;
        }

        if (userTagNamesSet.has(normalizeName(picked.name))) {
            ModalManager.warning({
                title: 'Tag duplicado',
                message: 'Este tag ya fue agregado.',
            });
            return;
        }

        // store espera STRING
        addUserTag(picked.name);
        setSelectedCatalogId('');
    };

    // ---------------------------
    // Acción: Convertir IA -> Usuario (renombrar + categoría)
    // ---------------------------
    const openConvertAiToUser = (aiTag) => {
        let draft = {
            category: catalogCategories[0] || 'Sin categoría',
            name: '',
        };

        const already = aiToUserAlias?.[aiTag?.id];

        const modalIdTag = ModalManager.custom({
            title: already ? 'Editar conversión de tag IA' : 'Convertir tag IA a tag de usuario',
            size: 'medium',
            showFooter: true,
            content: (
                <div className="p-6 space-y-4">
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 transition-theme">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 transition-theme">
                            Tag IA original
                        </p>
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200/50 dark:border-primary-700/50 transition-theme font-mono">
                            {aiTag?.name}
                        </span>

                        <div className="mt-3">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 transition-theme">
                                Descripción (IA)
                            </p>
                            <div className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words transition-theme">
                                {aiTag?.description || 'Sin descripción.'}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">
                                Categoría (tag usuario) <span className="text-red-500">*</span>
                            </label>
                            <select
                                defaultValue={already?.category || draft.category}
                                onChange={(e) => {
                                    draft.category = e.target.value;
                                }}
                                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                            >
                                {catalogCategories.length === 0 ? (
                                    <option value="Sin categoría">Sin categoría</option>
                                ) : (
                                    catalogCategories.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))
                                )}
                                <option value="Sin categoría">Sin categoría</option>
                            </select>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 transition-theme">
                                Define la jerarquía visual (categoría / nombre).
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">
                                Nuevo nombre (tag usuario) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                defaultValue={already?.name || draft.name}
                                onChange={(e) => {
                                    draft.name = e.target.value;
                                }}
                                placeholder="Ej: Infra TI / VLANs / Backup / ..."
                                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 transition-theme">
                                Este nombre se registrará como tag de usuario y quedará asociado al tag IA.
                            </p>
                        </div>
                    </div>
                </div>
            ),
            buttons: [
                {
                    text: already ? 'Actualizar' : 'Convertir',
                    variant: 'primary',
                    onClick: () => {
                        const newName = normalizeText(draft.name);
                        const newCat = normalizeText(draft.category) || 'Sin categoría';

                        if (!newName) {
                            ModalManager.warning({
                                title: 'Campo requerido',
                                message: 'Debes ingresar el nuevo nombre del tag de usuario.',
                            });
                            return;
                        }

                        // Evita duplicado en userTags (por nombre)
                        if (!already || normalizeName(already.name) !== normalizeName(newName)) {
                            if (userTagNamesSet.has(normalizeName(newName))) {
                                ModalManager.warning({
                                    title: 'Tag duplicado',
                                    message: 'Ya existe un tag de usuario con ese nombre.',
                                });
                                return;
                            }
                        }

                        // 1) Registrar/asegurar el tag usuario (store espera string)
                        //    - Si ya existía conversión, no eliminamos el anterior del store para no perder datos.
                        //      (Si quieres "renombrar" real, eso requiere update en store.)
                        if (!already) {
                            addUserTag(newName);
                        } else if (normalizeName(already.name) !== normalizeName(newName)) {
                            addUserTag(newName);
                        }

                        // 2) Asociar visualmente (IA -> Usuario)
                        setAiToUserAlias((prev) => ({
                            ...prev,
                            [aiTag.id]: { category: newCat, name: newName },
                        }));

                        // 3) Enriquecer tabla de usuario para tags "custom" (no catálogo)
                        setCustomCatalogByName((prev) => ({
                            ...prev,
                            [normalizeName(newName)]: {
                                category: newCat,
                                description: `Derivado de IA (${aiTag?.name || 'tag'}).`,
                                status: 'activo',
                                source: 'ai-derived',
                            },
                        }));

                        //Aca va el cierre del modal
                        ModalManager.close(modalIdTag);
                    },
                },
            ],
        });
    };

    return (
        <div className="grid grid-cols-12 gap-6">
            {/* Tags sugeridos por IA */}
            <article className="col-span-12 lg:col-span-6 bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme flex items-center gap-2">
                            <Icon name="brain" className="text-primary-600 dark:text-primary-400" />
                            Tags sugeridos por IA
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme">
                            Orden alfabético. Descripción completa. Acciones: convertir / eliminar.
                        </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/50 transition-theme whitespace-nowrap">
                        <Icon name="lock" className="mr-1" />
                        Controlado
                    </span>
                </div>

                <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 transition-theme">
                                <th className="pb-3 pr-4">Tag</th>
                                <th className="pb-3 pr-4">Descripción</th>
                                <th className="pb-3">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-900 dark:text-gray-100 transition-theme">
                            {aiTagsSorted.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="py-6 text-center text-gray-400 dark:text-gray-600 text-sm italic">
                                        Sin tags de IA.
                                    </td>
                                </tr>
                            ) : (
                                aiTagsSorted.map((t) => {
                                    const alias = aiToUserAlias?.[t.id];

                                    return (
                                        <tr
                                            key={t.id}
                                            className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 align-top transition-theme"
                                        >
                                            <td className="py-3 pr-4">
                                                {/* Tag IA (azul) */}
                                                <div className="space-y-1">
                                                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200/50 dark:border-primary-700/50 transition-theme font-mono inline-flex items-center gap-2">
                                                        {t.name}
                                                    </span>

                                                    {/* Alias usuario debajo (otro color) */}
                                                    {alias && (
                                                        <div className="text-xs">
                                                            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-700/50 transition-theme font-mono">
                                                                {alias.category} / {alias.name}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Descripción COMPLETA (sin clamp) */}
                                            <td className="py-3 pr-4 text-xs text-gray-500 dark:text-gray-400">
                                                <div className="whitespace-pre-wrap break-words">
                                                    {t.description || 'Sin descripción.'}
                                                </div>
                                            </td>

                                            <td className="py-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openConvertAiToUser(t)}
                                                        className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-theme text-xs flex items-center gap-1.5"
                                                        title={aiToUserAlias?.[t.id] ? 'Editar conversión' : 'Convertir a tag de usuario'}
                                                    >
                                                        <Icon name="edit" />
                                                        {aiToUserAlias?.[t.id] ? 'Editar' : 'Convertir'}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteAiTag(t.id, t.name)}
                                                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-theme text-xs flex items-center gap-1.5"
                                                        title="Eliminar"
                                                    >
                                                        <Icon name="delete" />
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 rounded-xl border border-gray-200/70 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 transition-theme">
                    <p className="text-xs text-gray-600 dark:text-gray-300 transition-theme">
                        “Convertir” transforma un tag sugerido por la IA en un tag interno del sistema.<br />
                        Se registra con categoría y nombre definidos por ti, queda disponible en la base de datos y podrás reutilizarlo en futuras minutas.
                    </p>
                </div>
            </article>

            {/* Tags del usuario */}
            <article className="col-span-12 lg:col-span-6 bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
                <div className="flex flex-col gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme flex items-center gap-2">
                            <Icon name="tags" className="text-primary-600 dark:text-primary-400" />
                            Tags del usuario
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme">
                            Ordenado por categoría y luego tag. Agregar desde catálogo (no texto libre).
                        </p>
                    </div>

                    {/* Selector desde catálogo */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <select
                            value={selectedCatalogId}
                            onChange={(e) => setSelectedCatalogId(e.target.value)}
                            className="w-full sm:w-auto min-w-[260px] px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                        >
                            <option value="">
                                {activeCatalog.length === 0 ? 'No hay tags disponibles' : 'Selecciona un tag…'}
                            </option>

                            {catalogGrouped.map(([cat, items]) => (
                                <optgroup key={cat} label={cat}>
                                    {items.map((t) => (
                                        <option key={t.id} value={String(t.id)}>
                                            {t.name}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={handleAddUserTagFromCatalog}
                            disabled={!selectedCatalogId}
                            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:hover:bg-gray-300 dark:disabled:bg-gray-700 text-white transition-theme shadow-sm text-sm font-medium whitespace-nowrap"
                        >
                            <Icon name="plus" className="mr-1" />
                            Agregar
                        </button>
                    </div>
                </div>

                {/* Tabla usuario enriquecida + ordenada */}
                <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 transition-theme">
                                <th className="pb-3 pr-4">Categoría</th>
                                <th className="pb-3 pr-4">Tag</th>
                                <th className="pb-3 pr-4">Descripción</th>
                                <th className="pb-3">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-900 dark:text-gray-100 transition-theme">
                            {userTagsEnrichedSorted.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-6 text-center text-gray-400 dark:text-gray-600 text-sm italic">
                                        Sin tags de usuario.
                                    </td>
                                </tr>
                            ) : (
                                userTagsEnrichedSorted.map((t) => (
                                    <tr
                                        key={t.id}
                                        className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 align-top transition-theme"
                                    >
                                        <td className="py-3 pr-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {t.category || 'Sin categoría'}
                                        </td>

                                        <td className="py-3 pr-4">
                                            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/50 transition-theme font-mono">
                                                {t.name}
                                            </span>
                                        </td>

                                        <td className="py-3 pr-4 text-xs text-gray-500 dark:text-gray-400">
                                            <div className="whitespace-pre-wrap break-words">
                                                {t.description || '—'}
                                            </div>
                                        </td>

                                        <td className="py-3">
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteUserTag(t.id, t.name)}
                                                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-theme text-xs flex items-center gap-1.5"
                                            >
                                                <Icon name="delete" />
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </article>
        </div>
    );
};

export default MinuteEditorSectionTags;