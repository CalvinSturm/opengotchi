import { create } from 'zustand';

import {
  createDefaultSettings,
  SETTINGS_VERSION,
  type SettingsDTO,
} from '../model';
import {
  quitApp as quitAppCommand,
  revealSaveFolder as revealSaveFolderCommand,
  sendPetNotification,
  setAlwaysOnTop,
} from '../../../lib/tauri/appCommands';
import {
  loadSettings as loadSettingsCommand,
  saveSettings as saveSettingsCommand,
} from '../../../lib/tauri/settingsCommands';

type SettingsStoreStatus = 'idle' | 'loading' | 'ready' | 'error';

type SettingsStoreState = {
  status: SettingsStoreStatus;
  settings: SettingsDTO;
  errorMessage: string | null;
  loadSettings: () => Promise<void>;
  setAlwaysOnTopEnabled: (enabled: boolean) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  revealSaveFolder: () => Promise<void>;
  sendTestNotification: () => Promise<void>;
  quitApp: () => Promise<void>;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown settings error.';
}

async function persistSettings(nextSettings: SettingsDTO): Promise<void> {
  await saveSettingsCommand(nextSettings);
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  status: 'idle',
  settings: createDefaultSettings(),
  errorMessage: null,
  async loadSettings() {
    set({ status: 'loading', errorMessage: null });

    try {
      const settings = await loadSettingsCommand();
      await setAlwaysOnTop(settings.alwaysOnTop);

      set({
        settings,
        status: 'ready',
        errorMessage: null,
      });
    } catch (error) {
      set({
        status: 'error',
        errorMessage: toErrorMessage(error),
      });
    }
  },
  async setAlwaysOnTopEnabled(enabled) {
    const previousSettings = get().settings;
    const nextSettings: SettingsDTO = {
      ...previousSettings,
      version: SETTINGS_VERSION,
      alwaysOnTop: enabled,
    };

    set({
      settings: nextSettings,
      errorMessage: null,
    });

    try {
      await setAlwaysOnTop(enabled);
      await persistSettings(nextSettings);
    } catch (error) {
      set({
        settings: previousSettings,
        status: 'error',
        errorMessage: toErrorMessage(error),
      });
    }
  },
  async setNotificationsEnabled(enabled) {
    const previousSettings = get().settings;
    const nextSettings: SettingsDTO = {
      ...previousSettings,
      version: SETTINGS_VERSION,
      notificationsEnabled: enabled,
    };

    set({
      settings: nextSettings,
      errorMessage: null,
    });

    try {
      await persistSettings(nextSettings);
      set({ status: 'ready' });
    } catch (error) {
      set({
        settings: previousSettings,
        status: 'error',
        errorMessage: toErrorMessage(error),
      });
    }
  },
  async revealSaveFolder() {
    try {
      await revealSaveFolderCommand();
    } catch (error) {
      set({
        status: 'error',
        errorMessage: toErrorMessage(error),
      });
    }
  },
  async sendTestNotification() {
    if (!get().settings.notificationsEnabled) {
      set({
        status: 'error',
        errorMessage: 'Enable notifications before sending a test notification.',
      });
      return;
    }

    try {
      await sendPetNotification({
        title: 'OpenGotchi',
        body: 'Notifications are enabled.',
      });
      set({
        status: 'ready',
        errorMessage: null,
      });
    } catch (error) {
      set({
        status: 'error',
        errorMessage: toErrorMessage(error),
      });
    }
  },
  async quitApp() {
    try {
      await quitAppCommand();
    } catch (error) {
      set({
        status: 'error',
        errorMessage: toErrorMessage(error),
      });
    }
  },
}));
