import { config } from '$lib/config';
import type { SSEEvent, ConnectionStatus } from '$lib/types';

type SSECallback = (event: SSEEvent) => void;
type StatusCallback = (status: ConnectionStatus) => void;

export function createSSEConnection() {
  let eventSource: EventSource | null = null;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners: Set<SSECallback> = new Set();
  const statusListeners: Set<StatusCallback> = new Set();
  let currentStatus: ConnectionStatus = 'disconnected';

  function setStatus(status: ConnectionStatus) {
    currentStatus = status;
    for (const listener of statusListeners) {
      listener(status);
    }
  }

  function getReconnectDelay(): number {
    const delay = Math.min(
      config.opencode.sseReconnectBaseDelay * Math.pow(2, reconnectAttempt),
      config.opencode.sseReconnectMaxDelay
    );
    return delay;
  }

  function connect() {
    if (eventSource) {
      eventSource.close();
    }

    setStatus('connecting');

    eventSource = new EventSource(config.opencode.eventEndpoint);

    eventSource.onopen = () => {
      reconnectAttempt = 0;
      setStatus('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as SSEEvent;
        for (const listener of listeners) {
          listener(parsed);
        }
      } catch {
        // Ignore malformed events
      }
    };

    eventSource.onerror = () => {
      setStatus('error');
      eventSource?.close();
      eventSource = null;
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    const delay = getReconnectDelay();
    reconnectAttempt++;
    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    setStatus('disconnected');
  }

  function onEvent(callback: SSECallback): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  function onStatusChange(callback: StatusCallback): () => void {
    statusListeners.add(callback);
    callback(currentStatus);
    return () => statusListeners.delete(callback);
  }

  return {
    connect,
    disconnect,
    onEvent,
    onStatusChange,
    getStatus: () => currentStatus,
  };
}
