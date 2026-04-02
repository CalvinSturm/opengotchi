import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const petCommandsMock = vi.hoisted(() => ({
  loadPet: vi.fn(),
  savePet: vi.fn(),
}));

vi.mock('../../../lib/tauri/petCommands', () => petCommandsMock);

async function loadPetStoreModule() {
  const petStoreModule = await import('./petStore');

  petStoreModule.usePetStore.setState(
    petStoreModule.usePetStore.getInitialState(),
    true,
  );

  return petStoreModule;
}

describe('pet store integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads, catches up, and persists the pet snapshot', async () => {
    vi.setSystemTime(new Date('2026-04-02T00:00:00.000Z'));

    const modelModule = await import('../model');

    petCommandsMock.loadPet.mockResolvedValue({
      ...modelModule.createLivePetState(Date.parse('2026-04-01T00:00:00.000Z')),
      name: 'Nova',
      lastUpdatedAt: '2026-04-01T23:58:00.000Z',
    });

    const { usePetStore } = await loadPetStoreModule();

    await usePetStore.getState().loadPet();

    const state = usePetStore.getState();

    expect(petCommandsMock.loadPet).toHaveBeenCalledTimes(1);
    expect(petCommandsMock.savePet).toHaveBeenCalledTimes(1);
    expect(petCommandsMock.savePet).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: expect.any(String),
        pet: expect.objectContaining({
          name: 'Nova',
          lifeState: 'alive',
        }),
      }),
    );
    expect(state.status).toBe('ready');
    expect(state.draftName).toBe('Nova');
    expect(state.pet.name).toBe('Nova');
    expect(state.pet.lastUpdatedAt).toBe('2026-04-02T00:00:00.000Z');
    expect(state.pet.lifeState).toBe('alive');
  });

  it('hatches the egg using the draft name and persists the new live pet', async () => {
    vi.setSystemTime(new Date('2026-04-01T12:00:00.000Z'));

    const { usePetStore } = await loadPetStoreModule();

    usePetStore.getState().setDraftName('Mochi');
    await usePetStore.getState().hatchPet();

    const state = usePetStore.getState();

    expect(state.pet.lifeState).toBe('alive');
    expect(state.pet.name).toBe('Mochi');
    expect(state.draftName).toBe('Mochi');
    expect(petCommandsMock.savePet).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: expect.any(String),
        pet: expect.objectContaining({
          lifeState: 'alive',
          name: 'Mochi',
        }),
      }),
    );
  });

  it('records save failure events in store state', async () => {
    const { usePetStore } = await loadPetStoreModule();

    usePetStore.setState({
      pendingSaveOperationId: 'pet-save-1',
      saveState: 'saving',
    });
    usePetStore.getState().markSaveFailed('pet-save-1', 'disk unavailable');

    expect(usePetStore.getState()).toMatchObject({
      status: 'idle',
      saveState: 'dirty',
      errorMessage: 'disk unavailable Changes are still in memory and marked unsaved.',
      saveMessage: null,
    });
  });

  it('persists only when refresh consumes a full decay tick', async () => {
    vi.setSystemTime(new Date('2026-04-01T00:00:30.000Z'));

    const modelModule = await import('../model');
    const { usePetStore } = await loadPetStoreModule();

    usePetStore.setState({
      pet: {
        ...modelModule.createLivePetState(Date.parse('2026-04-01T00:00:00.000Z')),
        lastUpdatedAt: '2026-04-01T00:00:00.000Z',
      },
      alerts: [],
      status: 'ready',
      draftName: 'Byte',
      errorMessage: null,
      saveMessage: null,
    });

    await usePetStore.getState().refresh();

    expect(usePetStore.getState().pet.lastUpdatedAt).toBe('2026-04-01T00:00:00.000Z');
    expect(petCommandsMock.savePet).not.toHaveBeenCalled();

    vi.setSystemTime(new Date('2026-04-01T00:01:05.000Z'));

    await usePetStore.getState().refresh();

    expect(usePetStore.getState().pet.lastUpdatedAt).toBe('2026-04-01T00:01:00.000Z');
    expect(petCommandsMock.savePet).toHaveBeenCalledTimes(1);
  });

  it('serializes overlapping actions so later mutations use the latest pet state', async () => {
    vi.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));

    const modelModule = await import('../model');
    const { usePetStore } = await loadPetStoreModule();

    let releaseFirstSave!: () => void;

    petCommandsMock.savePet
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirstSave = resolve;
          }),
      )
      .mockResolvedValueOnce(undefined);

    usePetStore.setState({
      pet: {
        ...modelModule.createLivePetState(Date.parse('2026-04-01T00:00:00.000Z')),
        satiety: 50,
        fun: 40,
        cleanliness: 70,
        energy: 60,
        health: 84,
        waste: 10,
      },
      alerts: [],
      status: 'ready',
      draftName: 'Byte',
      errorMessage: null,
      saveMessage: null,
      saveState: 'idle',
      pendingSaveOperationId: null,
      lastResolvedSaveOperationId: null,
    });

    const feedPromise = usePetStore.getState().applyPetAction('feed');
    const playPromise = usePetStore.getState().applyPetAction('play');

    await Promise.resolve();
    await Promise.resolve();

    expect(petCommandsMock.savePet).toHaveBeenCalledTimes(1);
    expect(usePetStore.getState().pet.satiety).toBe(72);

    releaseFirstSave();

    await Promise.all([feedPromise, playPromise]);

    const state = usePetStore.getState();

    expect(petCommandsMock.savePet).toHaveBeenCalledTimes(2);
    expect(state.pet.satiety).toBe(68);
    expect(state.pet.fun).toBe(64);
  });

  it('keeps the current pet dirty when a save fails and retries on refresh', async () => {
    vi.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));

    const modelModule = await import('../model');
    const { usePetStore } = await loadPetStoreModule();

    petCommandsMock.savePet
      .mockRejectedValueOnce(new Error('disk unavailable'))
      .mockResolvedValueOnce(undefined);

    usePetStore.setState({
      pet: {
        ...modelModule.createLivePetState(Date.parse('2026-04-01T00:00:00.000Z')),
        satiety: 50,
      },
      alerts: [],
      status: 'ready',
      draftName: 'Byte',
      errorMessage: null,
      saveMessage: null,
      saveState: 'idle',
      pendingSaveOperationId: null,
      lastResolvedSaveOperationId: null,
    });

    await usePetStore.getState().applyPetAction('feed');
    await Promise.resolve();

    expect(usePetStore.getState()).toMatchObject({
      saveState: 'dirty',
      pet: expect.objectContaining({
        satiety: 72,
      }),
    });

    await usePetStore.getState().refresh();

    expect(usePetStore.getState().saveState).toBe('idle');
    expect(petCommandsMock.savePet).toHaveBeenCalledTimes(2);
  });
});
