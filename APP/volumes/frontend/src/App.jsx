/**
 * App.jsx
 * Componente principal con integración de Zustand store para theme
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from "@components/layout/Layout";
import Demo from "@pages/Demo";
import useBaseSiteStore from "@store/baseSiteStore";

function App() {
  // ====================================
  // ZUSTAND STORE - THEME
  // ====================================
  const { theme } = useBaseSiteStore();

  // ====================================
  // APLICAR DARK MODE AL <html>
  // ====================================
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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