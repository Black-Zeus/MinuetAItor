const DEFAULT_RECONNECT_MS = 3000;

const createEvent = (eventName, data) => {
  if (typeof MessageEvent === "function") {
    return new MessageEvent(eventName, { data });
  }
  return { type: eventName, data };
};

export const createAuthorizedEventStream = (url, accessToken, options = {}) => {
  const listeners = new Map();
  const reconnectMs = Number(options.reconnectMs ?? DEFAULT_RECONNECT_MS);
  let controller = null;
  let closed = false;
  let retryTimer = null;
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

  const close = () => {
    closed = true;
    if (retryTimer) window.clearTimeout(retryTimer);
    retryTimer = null;
    controller?.abort();
    controller = null;
  };

  const scheduleReconnect = () => {
    if (closed) return;
    retryTimer = window.setTimeout(connect, reconnectMs);
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
      dispatch(eventName, dataLines.join("\n"));
    }
  };

  async function connect() {
    if (closed) return;

    controller = new AbortController();
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
        throw new Error(`SSE connection failed with status ${response.status}`);
      }

      options.onopen?.();
      api?.onopen?.();
      const reader = response.body.getReader();

      while (!closed) {
        const { value, done } = await reader.read();
        if (done) break;
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
        options.onerror?.(error);
        api?.onerror?.(error);
      }
    } finally {
      controller = null;
      scheduleReconnect();
    }
  }

  connect();

  api = {
    onopen: null,
    onerror: null,
    addEventListener,
    removeEventListener,
    close,
  };
  return api;
};
