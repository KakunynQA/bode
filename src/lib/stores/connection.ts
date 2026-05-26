import { writable, derived } from 'svelte/store';
import type { ConnectionStatus } from '$lib/types';
import { createSSEConnection } from '$lib/opencode/sse';
import { checkHealth } from '$lib/opencode/client';

export const connectionStatus = writable<ConnectionStatus>('disconnected');
export const isConnected = derived(connectionStatus, ($status) => $status === 'connected');

const sse = createSSEConnection();

export function initializeConnection() {
  sse.onStatusChange((status) => {
    connectionStatus.set(status);
  });

  // Check health first, then connect SSE
  checkHealth().then((result) => {
    if (result.ok) {
      sse.connect();
    } else {
      connectionStatus.set('error');
    }
  });

  return sse;
}

export function getSSE() {
  return sse;
}
