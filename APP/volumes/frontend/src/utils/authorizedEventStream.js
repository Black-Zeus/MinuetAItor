const BASE_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30000;
const RECONNECT_FACTOR = 2;
const RECONNECT_JITTER = 0.2;
const STABLE_CONNECTION_MS = 30000;
const MAX_RETRIES_PER_WINDOW = 10;
const RETRY_WINDOW_MS = 5 * 60 * 1000;
const SHARED_LEADER_TTL_MS = 9000;
const SHARED_LEADER_HEARTBEAT_MS = 3000;
const SHARED_LEADER_CHECK_MS = 1500;
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

const createClientId = () =>
  `sse_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const hashTokenHint = (value) => {
  const raw = String(value || "");
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const safeStorageGet = (key) => {
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const safeStorageSet = (key, value) => {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // localStorage can be unavailable in strict privacy modes.
  }
};

const safeStorageRemove = (key) => {
  try {
    window.localStorage?.removeItem(key);
  } catch {
    // localStorage can be unavailable in strict privacy modes.
  }
};

const readSharedLeader = (key) => {
  try {
    const parsed = JSON.parse(safeStorageGet(key) || "{}");
    return {
      ownerId: String(parsed?.ownerId || ""),
      updatedAt: Number(parsed?.updatedAt || 0),
    };
  } catch {
    return { ownerId: "", updatedAt: 0 };
  }
};

const isLeaderFresh = (leader, now = Date.now()) =>
  Boolean(leader?.ownerId) && now - Number(leader?.updatedAt || 0) <= SHARED_LEADER_TTL_MS;

const createEvent = (eventName, data) => {
  if (typeof MessageEvent === "function") {
    return new MessageEvent(eventName, { data });
  }
  return { type: eventName, data };
};

export const createAuthorizedEventStream = (url, accessToken, options = {}) => {
  const listeners = new Map();
  const streamInfo = parseStreamKey(url);
  const sharedStreamKey = options.sharedKey
    ? `${String(options.sharedKey)}:${hashTokenHint(accessToken)}`
    : options.shared
      ? `${streamInfo.streamKey}:${hashTokenHint(accessToken)}`
      : "";
  const sharedChannelName = sharedStreamKey ? `minuet:sse:${sharedStreamKey}` : "";
  const sharedLeaderKey = sharedStreamKey ? `minuet:sse:leader:${sharedStreamKey}` : "";
  const clientId = createClientId();
  const debugContext = {
    ...streamInfo,
    retryCount: 0,
    startedAt: null,
  };
  let channel = null;
  let controller = null;
  let closed = false;
  let connecting = false;
  let retryTimer = null;
  let stableTimer = null;
  let leaderHeartbeatTimer = null;
  let leaderCheckTimer = null;
  let isLeader = !sharedStreamKey;
  let api = null;

  if (sharedChannelName && typeof BroadcastChannel === "function") {
    channel = new BroadcastChannel(sharedChannelName);
  } else if (sharedStreamKey) {
    isLeader = true;
  }

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

  const publishSharedEvent = (eventName, data) => {
    if (!channel || !isLeader) return;
    try {
      channel.postMessage({
        type: "event",
        ownerId: clientId,
        eventName,
        data,
      });
    } catch {
      // BroadcastChannel is best-effort; local dispatch still happened.
    }
  };

  const dispatchFromStream = (eventName, data) => {
    dispatch(eventName, data);
    publishSharedEvent(eventName, data);
  };

  const releaseLeadership = () => {
    if (!sharedLeaderKey || !isLeader) return;
    const currentLeader = readSharedLeader(sharedLeaderKey);
    if (currentLeader.ownerId === clientId) {
      safeStorageRemove(sharedLeaderKey);
    }
    isLeader = false;
  };

  const demoteLeadership = () => {
    if (!isLeader) return;
    debugLog("sse_shared_demote", debugContext, { closeReason: "other_leader_detected" });
    isLeader = false;
    if (leaderHeartbeatTimer) window.clearInterval(leaderHeartbeatTimer);
    leaderHeartbeatTimer = null;
    if (retryTimer) window.clearTimeout(retryTimer);
    retryTimer = null;
    controller?.abort();
    controller = null;
  };

  const writeLeaderHeartbeat = () => {
    if (!sharedLeaderKey || !isLeader) return;
    const currentLeader = readSharedLeader(sharedLeaderKey);
    if (
      currentLeader.ownerId &&
      currentLeader.ownerId !== clientId &&
      isLeaderFresh(currentLeader)
    ) {
      demoteLeadership();
      return;
    }
    safeStorageSet(
      sharedLeaderKey,
      JSON.stringify({
        ownerId: clientId,
        updatedAt: Date.now(),
      })
    );
  };

  const close = (closeReason = "manual_close") => {
    debugLog(closeReason === "unmount" ? "sse_unmount" : "sse_close", debugContext, { closeReason });
    closed = true;
    if (retryTimer) window.clearTimeout(retryTimer);
    if (stableTimer) window.clearTimeout(stableTimer);
    if (leaderHeartbeatTimer) window.clearInterval(leaderHeartbeatTimer);
    if (leaderCheckTimer) window.clearInterval(leaderCheckTimer);
    retryTimer = null;
    stableTimer = null;
    leaderHeartbeatTimer = null;
    leaderCheckTimer = null;
    controller?.abort();
    controller = null;
    releaseLeadership();
    channel?.close?.();
    channel = null;
  };

  const resetBackoff = () => {
    debugContext.retryCount = 0;
    resetRetryWindow(debugContext.streamKey);
  };

  const closeTerminal = (closeReason, eventName, data = {}) => {
    debugLog("sse_terminal", debugContext, { closeReason });
    dispatchFromStream(eventName, JSON.stringify(data));
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
    if (sharedStreamKey && !isLeader) return;
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
      dispatchFromStream(eventName, data);
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
    if (closed || !isLeader) return;
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

  const tryBecomeLeader = () => {
    if (!sharedStreamKey || isLeader || closed) return;

    const now = Date.now();
    const currentLeader = readSharedLeader(sharedLeaderKey);
    if (isLeaderFresh(currentLeader, now) && currentLeader.ownerId !== clientId) return;

    isLeader = true;
    writeLeaderHeartbeat();
    connect();
  };

  if (channel) {
    channel.onmessage = (event) => {
      const message = event?.data || {};
      if (message?.type !== "event") return;
      if (message?.ownerId === clientId) return;
      if (!message?.eventName) return;
      dispatch(message.eventName, message.data ?? "");
    };
  }

  if (sharedStreamKey) {
    const currentLeader = readSharedLeader(sharedLeaderKey);
    if (!isLeaderFresh(currentLeader) || currentLeader.ownerId === clientId) {
      isLeader = true;
      writeLeaderHeartbeat();
      connect();
    } else {
      isLeader = false;
    }

    if (isLeader) {
      leaderHeartbeatTimer = window.setInterval(writeLeaderHeartbeat, SHARED_LEADER_HEARTBEAT_MS);
    }

    leaderCheckTimer = window.setInterval(() => {
      if (closed) return;
      if (isLeader) {
        writeLeaderHeartbeat();
        return;
      }
      tryBecomeLeader();
      if (isLeader && !leaderHeartbeatTimer) {
        leaderHeartbeatTimer = window.setInterval(writeLeaderHeartbeat, SHARED_LEADER_HEARTBEAT_MS);
      }
    }, SHARED_LEADER_CHECK_MS);
  } else {
    connect();
  }

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
