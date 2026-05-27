const CHUNK_RELOAD_FLAG = 'minuetaitor:chunk-reload-attempted';
const CURRENT_BUILD = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown';

const DYNAMIC_IMPORT_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /ChunkLoadError/i,
  /Loading chunk \d+ failed/i,
];

const isDynamicImportFailure = (value) => {
  const message = typeof value === 'string'
    ? value
    : String(value?.message || value?.reason?.message || value?.error?.message || '');

  return DYNAMIC_IMPORT_PATTERNS.some((pattern) => pattern.test(message));
};

const isScriptChunkFailure = (event) => {
  const target = event?.target;
  const src = target?.src || '';
  return target?.tagName === 'SCRIPT' && /\/js\/.+\.js(?:\?|$)/.test(src);
};

const reloadOnce = () => {
  if (sessionStorage.getItem(CHUNK_RELOAD_FLAG) === CURRENT_BUILD) {
    return;
  }

  sessionStorage.setItem(CHUNK_RELOAD_FLAG, CURRENT_BUILD);
  window.location.reload();
};

export const installChunkLoadRecovery = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('error', (event) => {
    if (isDynamicImportFailure(event?.error) || isScriptChunkFailure(event)) {
      reloadOnce();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    if (isDynamicImportFailure(event?.reason)) {
      reloadOnce();
    }
  });
};
