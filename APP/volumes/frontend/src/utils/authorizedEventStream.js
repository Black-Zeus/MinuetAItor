const BASE_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30000;
const RECONNECT_FACTOR = 2;
const RECONNECT_JITTER = 0.2;
const STABLE_CONNECTION_MS = 30000;
const MAX_RETRIES_PER_WINDOW = 10;
const RETRY_WINDOW_MS = 5 * 60 * 1000;
const TERMINAL_HTTP_EVENTS = new Map([
  [400, "invalid_request"],
  [401, "auth_error"],
  [403, "auth_error"],
  [404, "not_found"],
  [410, "not_found"],
  [422, "invalid_request"],
]);
const DEFAULT_TERMINAL_EVENTS = new Set([
  "auth_error",
  "session_expired",
  "session_revoked",
  "forbidden",
  "not_found",
  "invalid_request",
  "completed",
  "failed",
  "cancelled",
]);
const retryWindowsByStreamKey = new Map();

const isSseDebugEnabled = () => {
  try {
    return typeof window !== "undefined" && window.localStorage?.getItem("sseDebug") === "1";
  } catch {
    return false;
  }
};

const parseStreamKey = (url) => {
  const value = String(url || "");
  const publicMatch = value.match(/\/minutes\/public\/([^/]+)\/events$/);
  if (publicMatch) {
    return {
      streamKey: `minutes_public:${publicMatch[1]}`,
      recordId: publicMatch[1],
      transactionId: null,
    };
  }
  const observationMatch = value.match(/\/minutes\/([^/]+)\/observations\/events$/);
  if (observationMatch) {
    return {
      streamKey: `minute_observations:${observationMatch[1]}`,
      recordId: observationMatch[1],
      transactionId: null,
    };
  }
  const transactionMatch = value.match(/\/minutes\/([^/]+)\/events$/);
  if (transactionMatch) {
    return {
      streamKey: `minutes_transaction:${transactionMatch[1]}`,
      recordId: null,
      transactionId: transactionMatch[1],
    };
  }
  return {
    streamKey: value,
    recordId: null,
    transactionId: null,
  };
};

const debugLog = (event, context, details = {}) => {
  if (!isSseDebugEnabled()) return;
  const now = Date.now();
  const startedAt = details.startedAt ?? context.startedAt;
  // eslint-disable-next-line no-console
  console.debug(event, {
    streamKey: context.streamKey,
    recordId: context.recordId,
    transactionId: context.transactionId,
    retryCount: context.retryCount,
    duration: startedAt ? now - startedAt : null,
    closeReason: details.closeReason ?? null,
  });
};

const parseEventData = (data) => {
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
};

const calculateReconnectDelay = (retryCount) => {
  const exponent = Math.max(0, retryCount - 1);
  const rawDelay = Math.min(
    MAX_RECONNECT_MS,
    BASE_RECONNECT_MS * (RECONNECT_FACTOR ** exponent)
  );
  const jitterRange = rawDelay * RECONNECT_JITTER;
  const jitter = (Math.random() * jitterRange * 2) - jitterRange;
  return Math.max(0, Math.round(rawDelay + jitter));
};

const registerRetryAttempt = (streamKey, now = Date.now()) => {
  const previous = retryWindowsByStreamKey.get(streamKey) ?? [];
  const recent = previous.filter((timestamp) => now - timestamp <= RETRY_WINDOW_MS);
  recent.push(now);
  retryWindowsByStreamKey.set(streamKey, recent);
  return recent.length <= MAX_RETRIES_PER_WINDOW;
};

const resetRetryWindow = (streamKey) => {
  retryWindowsByStreamKey.delete(streamKey);
};

const createEvent = (eventName, data) => {
  if (typeof MessageEvent === "function") {
    return new MessageEvent(eventName, { data });
  }
  return { type: eventName, data };
};

export const createAuthorizedEventStream = (url, accessToken, options = {}) => {
  const listeners = new Map();
  const streamInfo = parseStreamKey(url);
  const debugContext = {
    ...streamInfo,
    retryCount: 0,
    startedAt: null,
  };
  let controller = null;
  let closed = false;
  let connecting = false;
  let retryTimer = null;
  let stableTimer = null;
  let api = null;

  const addEventListener = (eventName, handler) => {
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName).add(handler);
  };

  const removeEventListener = (eventName, handler) => {
    listeners.get(eventName)?.delete(handler);
  };

  const dispatch = (eventName, data) => {
    const event = createEvent(eventName, data);
    for (const handler of listeners.get(eventName) ?? []) {
      try {
        handler(event);
      } catch {
        // Never let one listener break the stream loop.
      }
    }
  };

  const close = (closeReason = "manual_close") => {
    debugLog(closeReason === "unmount" ? "sse_unmount" : "sse_close", debugContext, { closeReason });
    closed = true;
    if (retryTimer) window.clearTimeout(retryTimer);
    if (stableTimer) window.clearTimeout(stableTimer);
    retryTimer = null;
    stableTimer = null;
    controller?.abort();
    controller = null;
  };

  const resetBackoff = () => {
    debugContext.retryCount = 0;
    resetRetryWindow(debugContext.streamKey);
  };

  const closeTerminal = (closeReason, eventName, data = {}) => {
    debugLog("sse_terminal", debugContext, { closeReason });
    dispatch(eventName, JSON.stringify(data));
    close(closeReason);
  };

  const scheduleStableReset = () => {
    if (stableTimer) window.clearTimeout(stableTimer);
    stableTimer = window.setTimeout(() => {
      if (!closed && controller) resetBackoff();
    }, STABLE_CONNECTION_MS);
  };

  const scheduleReconnect = (closeReason = "retryable_close") => {
    if (closed) return;
    if (retryTimer) window.clearTimeout(retryTimer);
    debugContext.retryCount += 1;
    const retryCount = debugContext.retryCount;

    if (!registerRetryAttempt(debugContext.streamKey)) {
      const error = new Error("SSE max retries exceeded");
      error.code = "max_retries_exceeded";
      debugLog("sse_terminal", debugContext, { closeReason: "max_retries_exceeded" });
      options.onmaxretries?.(error);
      api?.onmaxretries?.(error);
      options.onerror?.(error);
      api?.onerror?.(error);
      close("max_retries_exceeded");
      return;
    }

    const delayMs = calculateReconnectDelay(retryCount);
    debugLog("sse_reconnect", debugContext, { closeReason });
    options.onreconnect?.({ ...streamInfo, retryCount, delayMs, closeReason });
    api?.onreconnect?.({ ...streamInfo, retryCount, delayMs, closeReason });
    retryTimer = window.setTimeout(connect, delayMs);
  };

  const consumeEventBlock = (block) => {
    let eventName = "message";
    const dataLines = [];

    for (const rawLine of block.split("\n")) {
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      if (!line || line.startsWith(":")) continue;

      const separator = line.indexOf(":");
      const field = separator >= 0 ? line.slice(0, separator) : line;
      const value = separator >= 0 ? line.slice(separator + 1).replace(/^ /, "") : "";

      if (field === "event") eventName = value || "message";
      if (field === "data") dataLines.push(value);
    }

    if (dataLines.length > 0) {
      const data = dataLines.join("\n");
      dispatch(eventName, data);
      if (eventName === "keepalive") resetBackoff();
      if (eventName === "error") {
        const payload = parseEventData(data);
        if (payload.retryable === false) {
          debugLog("sse_terminal", debugContext, { closeReason: "error_non_retryable" });
          close("terminal_event");
        }
        return;
      }
      if (DEFAULT_TERMINAL_EVENTS.has(eventName)) {
        debugLog("sse_terminal", debugContext, { closeReason: eventName });
        close("terminal_event");
      }
    }
  };

  async function connect() {
    if (closed) return;
    if (connecting || controller) return;
    connecting = true;
    retryTimer = null;

    controller = new AbortController();
    debugContext.startedAt = Date.now();
    debugLog("sse_connect", debugContext, { closeReason: "connect" });
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const terminalEvent = TERMINAL_HTTP_EVENTS.get(response.status);
        if (terminalEvent) {
          closeTerminal(`http_${response.status}`, terminalEvent, { status: response.status });
          return;
        }
        throw new Error(`SSE connection failed with status ${response.status}`);
      }

      debugLog("sse_open", debugContext, { closeReason: "open" });
      const openedRetryCount = debugContext.retryCount;
      options.onopen?.({ ...streamInfo, retryCount: openedRetryCount });
      api?.onopen?.({ ...streamInfo, retryCount: openedRetryCount });
      if (openedRetryCount > 0) {
        options.onreconnected?.({ ...streamInfo, retryCount: openedRetryCount });
        api?.onreconnected?.({ ...streamInfo, retryCount: openedRetryCount });
      }
      scheduleStableReset();
      const reader = response.body.getReader();

      while (!closed) {
        const { value, done } = await reader.read();
        if (done) {
          debugLog("sse_close", debugContext, { closeReason: "eof" });
          break;
        }
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          consumeEventBlock(block);
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      if (!closed && error?.name !== "AbortError") {
        debugLog("sse_retry", debugContext, { closeReason: error?.message || "error" });
        options.onerror?.(error);
        api?.onerror?.(error);
      }
    } finally {
      connecting = false;
      controller = null;
      if (stableTimer) window.clearTimeout(stableTimer);
      stableTimer = null;
      scheduleReconnect("stream_closed");
    }
  }

  connect();

  api = {
    onopen: null,
    onerror: null,
    onreconnect: null,
    onreconnected: null,
    onmaxretries: null,
    addEventListener,
    removeEventListener,
    close,
  };
  return api;
};
