/**
 * SidebarBrand.jsx
 * Branding/logo del sidebar - Tailwind
 */

import React from "react";
import AboutModal from "@/components/common/aboutModal/AboutModal";

const SidebarBrand = ({
  isCollapsed = false,
  logoSrc = "/images/chinchinAItor.jpg",
  appName = "MinuetAItor",
  tagline = "Gestión de Minutas",
}) => {
  return (
    <div
      className={`
        flex flex-col items-center justify-center p-6 border-b border-white/10
        ${isCollapsed ? "py-4" : "py-6"}
      `}
    >
      <AboutModal
        isCollapsed={isCollapsed}
        logoSrc={logoSrc}
        appName={appName}
        tagline={tagline}
        version="1.0.0"
        imageSrc={logoSrc}
        developerName="Victor Soto"
        developerEmail="victor@vsoto.cl"
        size="modalLarge"
      />

    </div>
  );
};

export default SidebarBrand;
