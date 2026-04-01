import { invoke } from '@tauri-apps/api/core';

import {
  type PetNotificationDTO,
  petNotificationDtoSchema,
} from '../../features/system/notificationModel';

function hasTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return '__TAURI_INTERNALS__' in window;
}

export async function showMainWindow(): Promise<void> {
  if (!hasTauriRuntime()) {
    return;
  }

  await invoke<void>('show_main_window');
}

export async function hideMainWindow(): Promise<void> {
  if (!hasTauriRuntime()) {
    return;
  }

  await invoke<void>('hide_main_window');
}

export async function setAlwaysOnTop(enabled: boolean): Promise<void> {
  if (!hasTauriRuntime()) {
    return;
  }

  await invoke<void>('set_always_on_top', {
    enabled,
  });
}

export async function sendPetNotification(
  payload: PetNotificationDTO,
): Promise<void> {
  const parsedPayload = petNotificationDtoSchema.parse(payload);

  if (!hasTauriRuntime()) {
    return;
  }

  await invoke<void>('send_pet_notification', {
    payload: parsedPayload,
  });
}

export async function revealSaveFolder(): Promise<void> {
  if (!hasTauriRuntime()) {
    return;
  }

  await invoke<void>('reveal_save_folder');
}

export async function quitApp(): Promise<void> {
  if (!hasTauriRuntime()) {
    return;
  }

  await invoke<void>('quit_app');
}
