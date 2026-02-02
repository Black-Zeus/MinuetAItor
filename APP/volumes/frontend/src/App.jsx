import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import  Layout  from "@components/layout/Layout";
//import { Layout } from "./components/layout/Layout"

// Tus páginas
import Demo from "@pages/Demo";


function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/Demo" element={<Demo />} />
          <Route path="/" element={<Demo />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;