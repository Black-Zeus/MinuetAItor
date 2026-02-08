// src/pages/minutes/components/MinuteCard.jsx
import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_BODY = "text-gray-700 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const STATUS_CONFIG = {
  completed: {
    label: "Completada",
    icon: "checkCircle",
    className: "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-200",
  },
  pending: {
    label: "Pendiente",
    icon: "clock",
    className: "bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-200",
  },
  "in-progress": {
    label: "En Progreso",
    icon: "spinner",
    className: "bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-200",
  },
};

const TAG_COLORS = {
  blue: "bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-200",
  green: "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-200",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-200",
  orange: "bg-warm-50 text-warm-700 dark:bg-warm-900/20 dark:text-warm-200",
  red: "bg-danger-50 text-danger-700 dark:bg-danger-900/20 dark:text-danger-200",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200",
};

// Subcomponente: CardHeader
const CardHeader = ({ minute, statusConfig }) => (
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
);

// Subcomponente: CardBody
const CardBody = ({ minute }) => (
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
);

// Subcomponente: CardFooter
const CardFooter = ({ minuteId }) => (
  <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 grid grid-cols-1 gap-2 transition-theme">
    <ActionButton
      label="Ver Línea de Tiempo"
      variant="info"
      size="sm"
      icon={<Icon name="history" />}
      onClick={() => console.log("Ver timeline", minuteId)}
      className="w-full"
    />

    <div className="grid grid-cols-4 gap-2">
      <ActionButton
        label="Ver"
        variant="soft"
        size="xs"
        icon={<Icon name="eye" />}
        onClick={() => console.log("Ver", minuteId)}
        className="w-full"
      />
      <ActionButton
        label="Editar"
        variant="soft"
        size="xs"
        icon={<Icon name="edit" />}
        onClick={() => console.log("Editar", minuteId)}
        className="w-full"
      />
      <ActionButton
        label="Descargar"
        variant="soft"
        size="xs"
        icon={<Icon name="download" />}
        onClick={() => console.log("Descargar", minuteId)}
        className="w-full"
      />
      <button
        onClick={() => console.log("Eliminar", minuteId)}
        className={`px-2 py-2 bg-surface-light dark:bg-surface-dark border border-secondary-200 dark:border-secondary-700 ${TXT_META} rounded-xl text-sm hover:bg-danger-50 dark:hover:bg-danger-900/20 hover:border-danger-500 dark:hover:border-danger-400 hover:text-danger-700 dark:hover:text-danger-200 transition-all flex items-center justify-center shadow-button hover:shadow-button-hover`}
      >
        <Icon name="delete" />
      </button>
    </div>
  </div>
);

// Componente principal
const MinuteCard = ({ minute }) => {
  const statusConfig = STATUS_CONFIG[minute.status];

  return (
    <div className="bg-surface rounded-2xl border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 overflow-hidden transition-all duration-200 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 hover:border-primary-500 dark:hover:border-primary-400">
      <CardHeader minute={minute} statusConfig={statusConfig} />
      <CardBody minute={minute} />
      <CardFooter minuteId={minute.id} />
    </div>
  );
};

export default MinuteCard;