// GlobalSpin.jsx
import React, { useState, useImperativeHandle, forwardRef } from 'react';

const GlobalSpin = forwardRef((props, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const [message, setMessage] = useState('Cargando...');
    const [submessage, setSubmessage] = useState('');
    const [type, setType] = useState('default'); // default, success, error, warning

    // Exponer métodos al componente padre
    useImperativeHandle(ref, () => ({
        show: (options = {}) => {
            setIsVisible(true);
            setMessage(options.message || 'Cargando...');
            setSubmessage(options.submessage || '');
            setType(options.type || 'default');
        },

        update: (options = {}) => {
            if (options.message !== undefined) setMessage(options.message);
            if (options.submessage !== undefined) setSubmessage(options.submessage);
            if (options.type !== undefined) setType(options.type);
        },

        hide: () => {
            setIsVisible(false);
        },

        destroy: () => {
            setIsVisible(false);
            setMessage('Cargando...');
            setSubmessage('');
            setType('default');
        }
    }));

    if (!isVisible) return null;

    const getSpinnerColor = () => {
        switch (type) {
            case 'success':
                return 'border-green-500';
            case 'error':
                return 'border-red-500';
            case 'warning':
                return 'border-yellow-500';
            default:
                return 'border-blue-500';
        }
    };

    const getTextColor = () => {
        switch (type) {
            case 'success':
                return 'text-green-700';
            case 'error':
                return 'text-red-700';
            case 'warning':
                return 'text-yellow-700';
            default:
                return 'text-gray-700';
        }
    };

    const getBgColor = () => {
        switch (type) {
            case 'success':
                return 'bg-green-50 border-green-200';
            case 'error':
                return 'bg-red-50 border-red-200';
            case 'warning':
                return 'bg-yellow-50 border-yellow-200';
            default:
                return 'bg-white border-gray-200';
        }
    };

    const getDotColor = () => {
        switch (type) {
            case 'success':
                return 'bg-green-500';
            case 'error':
                return 'bg-red-500';
            case 'warning':
                return 'bg-yellow-500';
            default:
                return 'bg-blue-500';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className={`p-8 rounded-lg shadow-xl border-2 max-w-sm w-full mx-4 transform transition-all duration-300 ${getBgColor()}`}>
                {/* Spinner */}
                <div className="flex justify-center mb-4">
                    <div className={`w-12 h-12 border-4 border-t-transparent rounded-full animate-spin ${getSpinnerColor()}`}></div>
                </div>

                {/* Mensaje principal */}
                <div className={`text-center font-medium text-lg mb-2 ${getTextColor()}`}>
                    {message}
                </div>

                {/* Submensaje */}
                {submessage && (
                    <div className={`text-center text-sm opacity-75 ${getTextColor()}`}>
                        {submessage}
                    </div>
                )}

                {/* Animación de puntos */}
                <div className="flex justify-center mt-4">
                    <div className="flex space-x-1">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${getDotColor()}`}></div>
                        <div className={`w-2 h-2 rounded-full animate-pulse delay-75 ${getDotColor()}`}></div>
                        <div className={`w-2 h-2 rounded-full animate-pulse delay-150 ${getDotColor()}`}></div>
                    </div>
                </div>
            </div>
        </div>
    );
});

GlobalSpin.displayName = 'GlobalSpin';

export default GlobalSpin;