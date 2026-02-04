/**
 * App.jsx
 * SOLUCIÓN DEFINITIVA - Usa useLayoutEffect para aplicar ANTES del render
 */

import React, { useLayoutEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from "@components/layout/Layout";
import Demo from "@pages/Demo";
import useBaseSiteStore from "@store/baseSiteStore";

function App() {
  const { theme } = useBaseSiteStore();

  // ✅ useLayoutEffect se ejecuta ANTES del render (síncrono)
  // Esto previene cualquier flash o conflicto de timing
  useLayoutEffect(() => {
    console.log('⚡ useLayoutEffect - Aplicando theme:', theme);
    
    const html = document.documentElement;
    
    if (theme === 'dark') {
      html.classList.add('dark');
      console.log('✅ Dark mode ACTIVADO');
    } else {
      html.classList.remove('dark');
      console.log('☀️ Light mode ACTIVADO');
    }
    
    // Verificar que se aplicó
    console.log('📋 classList actual:', Array.from(html.classList));
    
  }, [theme]);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/demo" element={<Demo />} />
          <Route path="/" element={<Demo />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;