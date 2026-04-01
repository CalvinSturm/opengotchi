import { invoke } from '@tauri-apps/api/core';

import {
  createDefaultSettings,
  settingsDtoSchema,
  type SettingsDTO,
} from '../../features/settings/model';

function hasTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return '__TAURI_INTERNALS__' in window;
}

export async function loadSettings(): Promise<SettingsDTO> {
  if (!hasTauriRuntime()) {
    return createDefaultSettings();
  }

  const result = await invoke<unknown>('load_settings');
  return settingsDtoSchema.parse(result);
}

export async function saveSettings(settings: SettingsDTO): Promise<void> {
  const parsedSettings = settingsDtoSchema.parse(settings);

  if (!hasTauriRuntime()) {
    return;
  }

  await invoke<void>('save_settings', {
    payload: parsedSettings,
  });
}
