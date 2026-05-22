import { useCallback, useEffect, useMemo, useRef } from "react";

const resolveSignal = (value) => {
  if (!value) return null;
  if (typeof value.aborted === "boolean") return value;
  if (value.signal && typeof value.signal.aborted === "boolean") return value.signal;
  return null;
};

export const useAbortableRequestScope = () => {
  const controllersRef = useRef(new Set());

  const cancelAll = useCallback(() => {
    for (const controller of controllersRef.current) {
      try {
        controller.abort();
      } catch {}
    }
    controllersRef.current.clear();
  }, []);

  const createRequestConfig = useCallback((requestConfig = {}) => {
    const controller = new AbortController();
    controllersRef.current.add(controller);

    controller.signal.addEventListener(
      "abort",
      () => {
        controllersRef.current.delete(controller);
      },
      { once: true }
    );

    return {
      ...requestConfig,
      signal: controller.signal,
    };
  }, []);

  const wasAborted = useCallback((signalLike) => {
    return Boolean(resolveSignal(signalLike)?.aborted);
  }, []);

  useEffect(() => cancelAll, [cancelAll]);

  return useMemo(
    () => ({
      cancelAll,
      createRequestConfig,
      wasAborted,
    }),
    [cancelAll, createRequestConfig, wasAborted]
  );
};

export default useAbortableRequestScope;
