import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const eventApiMock = vi.hoisted(() => ({
  listen: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => eventApiMock);

type EventCallback = (event: { payload: unknown }) => void;

describe('desktop event subscription', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('subscribes to tray and save-status events and routes them to handlers', async () => {
    const callbacks = new Map<string, EventCallback>();
    const unlistenFns = Array.from({ length: 5 }, () => vi.fn());

    (globalThis as { window?: unknown }).window = {
      __TAURI_INTERNALS__: {},
    };

    eventApiMock.listen.mockImplementation(async (eventName: string, callback: EventCallback) => {
      callbacks.set(eventName, callback);
      return unlistenFns.shift() ?? vi.fn();
    });

    const { subscribeToDesktopEvents } = await import('./tauriEvents');

    const handlers = {
      onOpenMainWindow: vi.fn(),
      onFeedShortcut: vi.fn(),
      onPlayShortcut: vi.fn(),
      onSaveCompleted: vi.fn(),
      onSaveFailed: vi.fn(),
    };

    const dispose = await subscribeToDesktopEvents(handlers);

    callbacks.get('tray://open-main-window')?.({ payload: null });
    callbacks.get('tray://feed-shortcut')?.({ payload: null });
    callbacks.get('tray://play-shortcut')?.({ payload: null });
    callbacks.get('pet://save-completed')?.({
      payload: {
        operationId: 'pet-save-1',
        savedAt: '2026-04-01T17:00:00.000Z',
      },
    });
    callbacks.get('pet://save-failed')?.({
      payload: {
        operationId: 'pet-save-2',
        message: 'save failed',
      },
    });

    expect(handlers.onOpenMainWindow).toHaveBeenCalledTimes(1);
    expect(handlers.onFeedShortcut).toHaveBeenCalledTimes(1);
    expect(handlers.onPlayShortcut).toHaveBeenCalledTimes(1);
    expect(handlers.onSaveCompleted).toHaveBeenCalledWith(
      'pet-save-1',
      '2026-04-01T17:00:00.000Z',
    );
    expect(handlers.onSaveFailed).toHaveBeenCalledWith(
      'pet-save-2',
      'save failed',
    );

    dispose();

    for (const unlisten of unlistenFns) {
      expect(unlisten).not.toHaveBeenCalled();
    }
  });

  it('returns a noop unsubscriber when Tauri runtime is unavailable', async () => {
    const { subscribeToDesktopEvents } = await import('./tauriEvents');

    const dispose = await subscribeToDesktopEvents({
      onOpenMainWindow: vi.fn(),
      onFeedShortcut: vi.fn(),
      onPlayShortcut: vi.fn(),
      onSaveCompleted: vi.fn(),
      onSaveFailed: vi.fn(),
    });

    expect(eventApiMock.listen).not.toHaveBeenCalled();
    expect(() => dispose()).not.toThrow();
  });
});
