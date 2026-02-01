// LazyWrapper.jsx - Wrapper simple para lazy loading
// Maneja Suspense y estados de carga de forma elegante

import React, { Suspense } from 'react';

// Loading fallback por defecto
const DefaultFallback = ({ message = 'Cargando página...' }) => (
    <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
        </div>
    </div>
);

// Loading para páginas completas
const PageFallback = ({ message = 'Cargando...' }) => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {message}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                Preparando la interfaz...
            </p>
        </div>
    </div>
);

// Loading para componentes específicos
const ComponentFallback = ({ message = 'Cargando componente...' }) => (
    <div className="flex items-center justify-center py-8">
        <div className="text-center">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-gray-500 dark:text-gray-400">{message}</p>
        </div>
    </div>
);

const LazyWrapper = ({
    children,
    fallback = null,
    type = 'default', // 'default', 'page', 'component'
    message = null,
    className = ''
}) => {
    // Determinar el fallback apropiado
    let loadingComponent;

    if (fallback) {
        loadingComponent = fallback;
    } else {
        switch (type) {
            case 'page':
                loadingComponent = <PageFallback message={message} />;
                break;
            case 'component':
                loadingComponent = <ComponentFallback message={message} />;
                break;
            default:
                loadingComponent = <DefaultFallback message={message} />;
        }
    }

    return (
        <div className={className}>
            <Suspense fallback={loadingComponent}>
                {children}
            </Suspense>
        </div>
    );
};

export default LazyWrapper;