import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import { z } from 'zod';

const saveCompletedEventSchema = z.object({
  savedAt: z.string().datetime({ offset: true }),
});

const saveFailedEventSchema = z.object({
  message: z.string().min(1),
});

function hasTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return '__TAURI_INTERNALS__' in window;
}

export async function subscribeToDesktopEvents(handlers: {
  onOpenMainWindow: () => void | Promise<void>;
  onFeedShortcut: () => void | Promise<void>;
  onPlayShortcut: () => void | Promise<void>;
  onSaveCompleted: (savedAt: string) => void;
  onSaveFailed: (message: string) => void;
}): Promise<UnlistenFn> {
  if (!hasTauriRuntime()) {
    return () => {};
  }

  const unlistenFunctions = await Promise.all([
    listen('tray://open-main-window', () => {
      void handlers.onOpenMainWindow();
    }),
    listen('tray://feed-shortcut', () => {
      void handlers.onFeedShortcut();
    }),
    listen('tray://play-shortcut', () => {
      void handlers.onPlayShortcut();
    }),
    listen('pet://save-completed', (event) => {
      const payload = saveCompletedEventSchema.parse(event.payload);
      handlers.onSaveCompleted(payload.savedAt);
    }),
    listen('pet://save-failed', (event) => {
      const payload = saveFailedEventSchema.parse(event.payload);
      handlers.onSaveFailed(payload.message);
    }),
  ]);

  return () => {
    for (const unlisten of unlistenFunctions) {
      unlisten();
    }
  };
}
