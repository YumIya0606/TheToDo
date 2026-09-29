import { invoke } from '@tauri-apps/api/core';

/**
 * Talking to the reading engine.
 *
 * The engine (formerly ClassRadar) runs as its own process on a fixed port and
 * is reached through Rust rather than straight from the webview. That keeps the
 * URL in one place, means the browser side never needs a CORS exemption, and
 * gives one honest answer to "is it even running?".
 */

export interface EngineKey {
  id: number;
  provider: string;
  label: string;
  masked: string;
  status: 'active' | 'rate_limited' | 'invalid' | 'unknown';
  enabled: boolean;
  coolingDown: boolean;
  disabledUntil: number;
  ok: number;
  fail: number;
  used: number;
  lastUsed: number;
  lastOk: number;
  lastError: string | null;
}

export interface EngineConnection {
  id: string;
  kind: 'service' | 'custom';
  name: string;
  note: string;
  baseUrl: string | null;
  requiresKey: boolean;
  model: string;
  suggestedModel: string | null;
  models: Array<{ id: string; why?: string; isFree: boolean; free?: boolean | 'unknown' }>;
  modelsWarning: string | null;
  keys: EngineKey[];
  keySummary: {
    total: number;
    available: number;
    active: number;
    rateLimited: number;
    invalid: number;
  };
  active: boolean;
  removable: boolean;
}

export interface EngineConnections {
  keys: EngineKey[];
  customProviders: Array<{
    id: number;
    name: string;
    baseUrl: string;
    masked: string | null;
    model: string;
    enabled: boolean;
    providerId: string;
  }>;
  summary: Record<string, { total: number; available: number; active: number; rateLimited: number; invalid: number }>;
}

async function call<T>(path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const text = await invoke<string>('engine_request', {
    path,
    method,
    body: body === undefined ? null : JSON.stringify(body),
  });
  return (text ? JSON.parse(text) : null) as T;
}

/** False means the engine is not running; the UI says so rather than failing. */
export function engineAlive(): Promise<boolean> {
  return invoke<boolean>('engine_alive').catch(() => false);
}

export function startEngine(path: string): Promise<number> {
  return invoke<number>('engine_start', { enginePath: path });
}

export const engine = {
  connections: () => call<EngineConnections>('/api/connections', 'GET'),
  use: (id: string) => call<unknown>('/api/connections/activate', 'POST', { id }),
  setModel: (id: string, model: string) => call<unknown>(`/api/connections/${encodeURIComponent(id)}`, 'PATCH', { model }),
  removeConnection: (id: string) =>
    call<unknown>(`/api/connections/${encodeURIComponent(id)}`, 'DELETE'),
  addConnection: (name: string, baseUrl: string, apiKey: string) =>
    call<{ ok: boolean; models: unknown[]; suggested: string | null; warning?: string }>(
      '/api/connections',
      'POST',
      { name, baseUrl, apiKey },
    ),
  addKey: (provider: string, key: string, label: string) =>
    call<{ ok: boolean; id: number; suggestedModel: string | null }>('/api/keys', 'POST', {
      provider,
      key,
      label,
    }),
  updateKey: (id: number, patch: Record<string, unknown>) =>
    call<unknown>(`/api/keys/${id}`, 'PATCH', patch),
  removeKey: (id: number) => call<unknown>(`/api/keys/${id}`, 'DELETE'),
  revive: (provider: string) => call<unknown>('/api/keys/revive', 'POST', { provider }),
  testKeys: (id?: number) =>
    call<{ results: Array<{ id: number; ok: boolean; error?: string; model?: string }> }>(
      '/api/keys/test',
      'POST',
      id ? { id } : {},
    ),
  tryConnection: (id: string) =>
    call<{ ok: boolean; results: Array<{ ok: boolean; model?: string; error?: string }> }>(
      `/api/connections/${encodeURIComponent(id)}/try`,
      'POST',
      {},
    ),
  refreshModels: (id: string) =>
    call<{ models: unknown[]; suggested: string | null; warning?: string }>(
      `/api/connections/${encodeURIComponent(id)}/refresh-models`,
      'POST',
      {},
    ),
  state: () =>
    call<{
      mode: string;
      authenticated: boolean;
      providerReady: boolean;
      pendingAnalysis: number;
      advice: { headline: string; detail: string; action: string; severity: string } | null;
    }>('/api/state', 'GET'),
  sync: () => call<unknown>('/api/sync', 'POST', {}),
  analyse: () => call<unknown>('/api/analyze', 'POST', {}),
  analysisProgress: () =>
    call<{
      running: boolean;
      total: number;
      processed: number;
      ok: number;
      failed: number;
      remaining: number;
      waiting: number;
      perMinute: number;
      etaSeconds: number | null;
    }>('/api/analysis', 'GET'),
  exportSchedule: (days = 21) => call<{ ok: boolean; file: string; counts: Record<string, number> }>(
    `/api/export?days=${days}&save=1`,
    'GET',
  ),
  coverage: () =>
    call<Record<string, { messages: number; understood: number; rulesOnly: number; events: number }>>(
      '/api/channel-stats',
      'GET',
    ),
};
