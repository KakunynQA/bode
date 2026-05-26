import { config } from '$lib/config';
import type { Result, Provider, Agent } from '$lib/types';

async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
  signal?: AbortSignal
): Promise<Result<T>> {
  const url = `${config.opencode.baseUrl}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.api.timeout);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        ok: false,
        error: new Error(`API error: ${response.status} ${response.statusText}`),
      };
    }

    const value = (await response.json()) as T;
    return { ok: true, value };
  } catch (error) {
    clearTimeout(timeoutId);
    return { ok: false, error: error as Error };
  }
}

export async function checkHealth(signal?: AbortSignal): Promise<Result<{ healthy: boolean; version: string }>> {
  return fetchApi('/global/health', {}, signal);
}

export async function listSessions(signal?: AbortSignal): Promise<Result<unknown[]>> {
  return fetchApi('/session', {}, signal);
}

export async function getSession(id: string, signal?: AbortSignal): Promise<Result<unknown>> {
  return fetchApi(`/session/${id}`, {}, signal);
}

export async function createSession(signal?: AbortSignal): Promise<Result<{ id: string }>> {
  return fetchApi('/session', { method: 'POST' }, signal);
}

export async function updateSession(
  id: string,
  data: { title?: string },
  signal?: AbortSignal
): Promise<Result<unknown>> {
  return fetchApi(`/session/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, signal);
}

export async function deleteSession(id: string, signal?: AbortSignal): Promise<Result<void>> {
  return fetchApi(`/session/${id}`, { method: 'DELETE' }, signal);
}

export async function abortSession(id: string, signal?: AbortSignal): Promise<Result<void>> {
  return fetchApi(`/session/${id}/abort`, { method: 'POST' }, signal);
}

export async function forkSession(id: string, signal?: AbortSignal): Promise<Result<{ id: string }>> {
  return fetchApi(`/session/${id}/fork`, { method: 'POST' }, signal);
}

export async function getSessionMessages(id: string, signal?: AbortSignal): Promise<Result<unknown[]>> {
  return fetchApi(`/session/${id}/message`, {}, signal);
}

export async function sendPromptAsync(
  id: string,
  message: string,
  signal?: AbortSignal
): Promise<Result<void>> {
  return fetchApi(`/session/${id}/prompt_async`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  }, signal);
}

export async function getSessionDiff(id: string, signal?: AbortSignal): Promise<Result<string>> {
  return fetchApi(`/session/${id}/diff`, {}, signal);
}

export async function listProviders(signal?: AbortSignal): Promise<Result<{
  all: Provider[];
  default: Record<string, string>;
  connected: string[];
}>> {
  return fetchApi('/provider', {}, signal);
}

export async function listAgents(signal?: AbortSignal): Promise<Result<Agent[]>> {
  return fetchApi('/agent', {}, signal);
}

export async function getSessionStatus(signal?: AbortSignal): Promise<Result<Record<string, { kind: string }>>> {
  return fetchApi('/session/status', {}, signal);
}
