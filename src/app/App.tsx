import { useEffect, useState } from 'react';

import { getNextSimulationWakeDelayMs } from '../features/pet/simulation/petSimulation';
import { usePetSimulationConfigStore } from '../features/pet/simulation/petSimulationConfig';
import { useSettingsStore } from '../features/settings/store/settingsStore';
import { DevToolsPanel } from '../features/system/components/DevToolsPanel';
import { SystemPanel } from '../features/system/components/SystemPanel';
import { buildPetReminderSyncPayload } from '../features/system/reminderSync';
import { subscribeToDesktopEvents } from '../features/system/tauriEvents';
import { TamagotchiDevice } from '../features/pet/components/TamagotchiDevice';
import { usePetStore } from '../features/pet/store/petStore';
import { showMainWindow, syncPetReminder } from '../lib/tauri/appCommands';

export function App() {
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const alerts = usePetStore((state) => state.alerts);
  const errorMessage = usePetStore((state) => state.errorMessage);
  const clearSaveMessage = usePetStore((state) => state.clearSaveMessage);
  const loadPet = usePetStore((state) => state.loadPet);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const notificationsEnabled = useSettingsStore(
    (state) => state.settings.notificationsEnabled,
  );
  const markSaveCompleted = usePetStore((state) => state.markSaveCompleted);
  const markSaveFailed = usePetStore((state) => state.markSaveFailed);
  const pet = usePetStore((state) => state.pet);
  const refresh = usePetStore((state) => state.refresh);
  const saveMessage = usePetStore((state) => state.saveMessage);
  const status = usePetStore((state) => state.status);
  const applyPetAction = usePetStore((state) => state.applyPetAction);
  const simulationConfig = usePetSimulationConfigStore((state) => state.config);
  const primaryAlert = alerts[0] ?? null;
  const primaryAlertCode = primaryAlert?.code ?? null;
  const primaryAlertMessage = primaryAlert?.message ?? null;

  useEffect(() => {
    void loadPet();
    void loadSettings();

    let unlisten: (() => void) | undefined;

    void subscribeToDesktopEvents({
      onOpenMainWindow: async () => {
        await showMainWindow();
      },
      onFeedShortcut: async () => {
        await applyPetAction('feed');
      },
      onPlayShortcut: async () => {
        await applyPetAction('play');
      },
      onSaveCompleted: (savedAt) => {
        markSaveCompleted(savedAt);
      },
      onSaveFailed: (message) => {
        markSaveFailed(message);
      },
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [
    applyPetAction,
    loadPet,
    loadSettings,
    markSaveCompleted,
    markSaveFailed,
    refresh,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isEditableTarget || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key !== '`') {
        return;
      }

      event.preventDefault();
      setDevToolsOpen((open) => !open);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, simulationConfig]);

  useEffect(() => {
    const delayMs = getNextSimulationWakeDelayMs(pet, Date.now(), simulationConfig);

    if (delayMs === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, Math.max(50, Math.ceil(delayMs)));

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pet, refresh, simulationConfig]);

  useEffect(() => {
    if (!saveMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clearSaveMessage();
    }, 2_500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [clearSaveMessage, saveMessage]);

  useEffect(() => {
    void syncPetReminder(
      buildPetReminderSyncPayload({
        notificationsEnabled,
        petName: pet.name,
        primaryAlert,
      }),
    ).catch(() => {});
  }, [notificationsEnabled, pet.name, primaryAlertCode, primaryAlertMessage]);

  return (
    <main className="shell">
      <TamagotchiDevice disabled={status === 'loading'} />
      <DevToolsPanel open={devToolsOpen} />
      <SystemPanel />

      {saveMessage ? <p className="save-banner">{saveMessage}</p> : null}

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </main>
  );
}
