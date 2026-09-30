import { invoke } from '@tauri-apps/api/core';
import type { ScheduleExport } from './classRadar';

export interface ScheduleCounts {
  classes: number;
  studyPlan: number;
  messages: number;
  understood: number;
  links: number;
}

/**
 * Read the schedule the engine exported.
 *
 * Goes through Rust rather than a browser fetch, for the same reason the rest of
 * the engine does: the file lives outside anything the webview is allowed to
 * touch, and the path should be validated in one place.
 */
export async function readScheduleFile(): Promise<
  { ok: true; data: ScheduleExport; counts: ScheduleCounts } | { ok: false; error: string }
> {
  try {
    // An omitted path means the default, resolved in Rust so one place owns it.
    const text = await invoke<string>('read_classradar_schedule', { exportPath: null });
    const data = JSON.parse(text) as ScheduleExport;
    return {
      ok: true,
      data,
      counts: {
        classes: data.events?.length ?? 0,
        studyPlan: data.boosterPlan?.length ?? 0,
        messages: data.counts?.messages ?? 0,
        understood: data.counts?.understood ?? 0,
        links: data.counts?.links ?? 0,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
