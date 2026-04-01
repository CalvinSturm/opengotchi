import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsCommandsMock = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

const appCommandsMock = vi.hoisted(() => ({
  quitApp: vi.fn(),
  revealSaveFolder: vi.fn(),
  sendPetNotification: vi.fn(),
  setAlwaysOnTop: vi.fn(),
  syncPetReminder: vi.fn(),
  showMainWindow: vi.fn(),
  hideMainWindow: vi.fn(),
}));

vi.mock('../../../lib/tauri/settingsCommands', () => settingsCommandsMock);
vi.mock('../../../lib/tauri/appCommands', () => appCommandsMock);

async function loadSettingsStoreModule() {
  const settingsStoreModule = await import('./settingsStore');

  settingsStoreModule.useSettingsStore.setState(
    settingsStoreModule.useSettingsStore.getInitialState(),
    true,
  );

  return settingsStoreModule;
}

describe('settings store integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('loads settings and applies always-on-top through the desktop command', async () => {
    settingsCommandsMock.loadSettings.mockResolvedValue({
      version: 1,
      alwaysOnTop: true,
      notificationsEnabled: false,
    });

    const { useSettingsStore } = await loadSettingsStoreModule();

    await useSettingsStore.getState().loadSettings();

    expect(appCommandsMock.setAlwaysOnTop).toHaveBeenCalledWith(true);
    expect(useSettingsStore.getState()).toMatchObject({
      status: 'ready',
      settings: {
        version: 1,
        alwaysOnTop: true,
        notificationsEnabled: false,
      },
    });
  });

  it('persists notification preference changes', async () => {
    const { useSettingsStore } = await loadSettingsStoreModule();

    await useSettingsStore.getState().setNotificationsEnabled(false);

    expect(settingsCommandsMock.saveSettings).toHaveBeenCalledWith({
      version: 1,
      alwaysOnTop: false,
      notificationsEnabled: false,
    });
    expect(useSettingsStore.getState().settings.notificationsEnabled).toBe(false);
  });
});
