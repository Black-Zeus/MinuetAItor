// src/debug/exposeEnv.js
import logger from "@/utils/logger";

const log = logger.scope("env-debug");

export function exposeViteEnvToWindow() {
  window.__VITE_ENV__ = import.meta.env;
  log.info("window.__VITE_ENV__ disponible:", Object.keys(import.meta.env));
}