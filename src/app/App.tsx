import { useEffect } from 'react';

import { PetControls } from '../features/pet/components/PetControls';
import { PetNurseryPanel } from '../features/pet/components/PetNurseryPanel';
import { PetStatusPanel } from '../features/pet/components/PetStatusPanel';
import { useSettingsStore } from '../features/settings/store/settingsStore';
import { SystemPanel } from '../features/system/components/SystemPanel';
import { buildPetReminderSyncPayload } from '../features/system/reminderSync';
import { subscribeToDesktopEvents } from '../features/system/tauriEvents';
import { usePetStore } from '../features/pet/store/petStore';
import { showMainWindow, syncPetReminder } from '../lib/tauri/appCommands';

export function App() {
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
  const primaryAlert = alerts[0] ?? null;
  const primaryAlertCode = primaryAlert?.code ?? null;
  const primaryAlertMessage = primaryAlert?.message ?? null;

  useEffect(() => {
    void loadPet();
    void loadSettings();

    const intervalId = window.setInterval(() => {
      refresh();
    }, 1_000);

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
      window.clearInterval(intervalId);
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
      <section className="hero-card">
        <p className="eyebrow">Desktop Pet Bootstrap</p>
        <h1>OpenGotchi</h1>
        <p className="hero-copy">
          A minimal Tauri desktop pet with a TypeScript simulation core and a
          narrow Rust persistence edge.
        </p>
      </section>

      <PetStatusPanel alerts={alerts} pet={pet} status={status} />
      <PetNurseryPanel disabled={status === 'loading'} />
      <PetControls disabled={status === 'loading'} />
      <SystemPanel />

      {saveMessage ? <p className="save-banner">{saveMessage}</p> : null}

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </main>
  );
}
