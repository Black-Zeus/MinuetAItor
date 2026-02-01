// SimpleSpinner.jsx
import React, { useState, useImperativeHandle, forwardRef } from 'react';

const SimpleSpinner = forwardRef((props, ref) => {
    const [isVisible, setIsVisible] = useState(false);

    // Exponer métodos
    useImperativeHandle(ref, () => ({
        show: () => setIsVisible(true),
        hide: () => setIsVisible(false),
        destroy: () => setIsVisible(false)
    }));

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
});

SimpleSpinner.displayName = 'SimpleSpinner';

export default SimpleSpinner;