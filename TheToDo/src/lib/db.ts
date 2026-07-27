import { invoke } from '@tauri-apps/api/core';

export async function initDatabase(): Promise<void> {
  try {
    await invoke('init_db');
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export async function executeQuery<T>(query: string, params?: unknown[]): Promise<T> {
  try {
    return await invoke<T>('execute_query', { query, params });
  } catch (error) {
    console.error('Query execution failed:', error);
    throw error;
  }
}

export async function fetchAll<T>(query: string, params?: unknown[]): Promise<T[]> {
  try {
    return await invoke<T[]>('fetch_all', { query, params });
  } catch (error) {
    console.error('Fetch all failed:', error);
    throw error;
  }
}

export async function fetchOne<T>(query: string, params?: unknown[]): Promise<T | null> {
  try {
    return await invoke<T | null>('fetch_one', { query, params });
  } catch (error) {
    console.error('Fetch one failed:', error);
    throw error;
  }
}
