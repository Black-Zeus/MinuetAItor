/**
 * utils/logger.js
 * Logger centralizado — lee su configuración desde environment.js
 *
 * Uso:
 *   import logger from "@/utils/logger";
 *   logger.info("App boot");                    // => [MinuetAItor] [core] App boot
 *
 *   const authLog = logger.scope("auth");
 *   authLog.info("Login OK", { userId });       // => [MinuetAItor] [auth] Login OK
 *   authLog.group("Proceso login");
 *   authLog.groupEnd();
 *
 * Controlado por variables de entorno (via environment.js):
 *   VITE_LOG_ENABLED       true|false|1|0
 *   VITE_LOG_LEVELS        debug,log,info,warn,error
 *   VITE_LOG_SCOPES        core,auth,api,ui,...
 *   VITE_LOG_DEFAULT_SCOPE core
 *   VITE_LOG_PREFIX        [MinuetAItor]
 */

import { getLoggerConfig } from '@/utils/environment';

// ==========================================
// CONSTANTES
// ==========================================

export const LEVELS = ['debug', 'log', 'info', 'warn', 'error'];

// ==========================================
// HELPERS INTERNOS
// ==========================================

function envToBool(v, fallback = false) {
  if (v == null) return fallback;
  const s = String(v).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(s);
}

function parseCsvSet(v) {
  if (!v) return null; // null = sin restricción
  const set = new Set(
    String(v).split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
  );
  return set.size ? set : null;
}

function parseLevelsCsv(v, fallbackSet) {
  const set = parseCsvSet(v);
  if (!set) return fallbackSet;
  for (const k of Array.from(set)) {
    if (!LEVELS.includes(k)) set.delete(k);
  }
  return set.size ? set : fallbackSet;
}

function normalizeScope(scope) {
  return String(scope || '').trim().toLowerCase();
}

// ==========================================
// CONFIGURACIÓN — leída desde environment.js
// ==========================================

const cfg = getLoggerConfig();

// default: dev=true, prod=false
const defaultEnabled = cfg.mode !== 'production';
const LOG_ENABLED = envToBool(cfg.enabled, defaultEnabled);

// default levels: dev=all, prod=warn+error
const defaultLevels = cfg.mode === 'production'
  ? new Set(['warn', 'error'])
  : new Set(['debug', 'log', 'info', 'warn', 'error']);

const ALLOWED_LEVELS = parseLevelsCsv(cfg.levels, defaultLevels);

// scopes permitidos: null = sin restricción
const ALLOWED_SCOPES = parseCsvSet(cfg.scopes);

const DEFAULT_SCOPE = normalizeScope(cfg.defaultScope || 'core');

const PREFIX = (cfg.prefix || '').trim();

// ==========================================
// LÓGICA CENTRAL
// ==========================================

function resolveScope(scope) {
  return normalizeScope(scope) || DEFAULT_SCOPE;
}

function canPrint(level, scope) {
  if (level === 'error') return true;          // errores siempre visibles
  if (!LOG_ENABLED) return false;
  if (!ALLOWED_LEVELS.has(level)) return false;
  if (ALLOWED_SCOPES) return ALLOWED_SCOPES.has(resolveScope(scope));
  return true;
}

function buildPrefix(scope) {
  const parts = [];
  if (PREFIX) parts.push(PREFIX);
  const s = resolveScope(scope);
  if (s) parts.push(`[${s}]`);
  return parts.join(' ');
}

function callConsole(level, scope, args) {
  try {
    const fn = console[level] || console.log;
    const pfx = buildPrefix(scope);
    fn.apply(console, pfx ? [pfx, ...args] : args);
  } catch {
    // nunca romper la app por logging
  }
}

function group(label, scope, { collapsed = false } = {}) {
  if (!LOG_ENABLED) return;
  const sc = resolveScope(scope);
  if (ALLOWED_SCOPES && !ALLOWED_SCOPES.has(sc)) return;
  try {
    const pfx = buildPrefix(sc);
    const text = pfx ? `${pfx} ${label}` : label;
    const fn = collapsed ? console.groupCollapsed : console.group;
    if (fn) fn.call(console, text);
  } catch { /* noop */ }
}

function groupEnd() {
  if (!LOG_ENABLED) return;
  try { if (console.groupEnd) console.groupEnd(); } catch { /* noop */ }
}

// ==========================================
// FACTORY DE SCOPED LOGGER
// ==========================================

function makeScopedLogger(scope) {
  const sc = resolveScope(scope);
  return {
    group:    (label, opts) => group(label, sc, opts),
    groupEnd: ()            => groupEnd(),
    debug: (...args) => canPrint('debug', sc) && callConsole('debug', sc, args),
    log:   (...args) => canPrint('log',   sc) && callConsole('log',   sc, args),
    info:  (...args) => canPrint('info',  sc) && callConsole('info',  sc, args),
    warn:  (...args) => canPrint('warn',  sc) && callConsole('warn',  sc, args),
    error: (...args) => canPrint('error', sc) && callConsole('error', sc, args),
  };
}

// ==========================================
// LOGGER PRINCIPAL
// ==========================================

const logger = {
  scope: (scopeName) => makeScopedLogger(scopeName),

  group:    (label, opts) => group(label, DEFAULT_SCOPE, opts),
  groupEnd: ()            => groupEnd(),

  debug: (...args) => canPrint('debug', DEFAULT_SCOPE) && callConsole('debug', DEFAULT_SCOPE, args),
  log:   (...args) => canPrint('log',   DEFAULT_SCOPE) && callConsole('log',   DEFAULT_SCOPE, args),
  info:  (...args) => canPrint('info',  DEFAULT_SCOPE) && callConsole('info',  DEFAULT_SCOPE, args),
  warn:  (...args) => canPrint('warn',  DEFAULT_SCOPE) && callConsole('warn',  DEFAULT_SCOPE, args),
  error: (...args) => canPrint('error', DEFAULT_SCOPE) && callConsole('error', DEFAULT_SCOPE, args),

  /** Introspección — útil para debug */
  config: () => ({
    enabled:       LOG_ENABLED,
    allowedLevels: Array.from(ALLOWED_LEVELS),
    allowedScopes: ALLOWED_SCOPES ? Array.from(ALLOWED_SCOPES) : null,
    defaultScope:  DEFAULT_SCOPE,
    prefix:        PREFIX,
    mode:          cfg.mode,
  }),
};

export default logger;