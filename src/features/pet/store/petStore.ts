import { create } from 'zustand';

import {
  createDefaultPetState,
  toIsoTimestamp,
  type PetState,
} from '../model';
import {
  applyAction,
  catchup,
  deriveAlertsWithConfig,
  tickPet,
  type PetAction,
  type PetAlert,
} from '../simulation/petSimulation';
import { getPetSimulationConfig } from '../simulation/petSimulationConfig';
import {
  loadPet as loadPetCommand,
  savePet as savePetCommand,
} from '../../../lib/tauri/petCommands';

type PetStoreStatus = 'idle' | 'loading' | 'ready' | 'error';
type PetSaveState = 'idle' | 'saving' | 'dirty';

type PetStoreState = {
  status: PetStoreStatus;
  saveState: PetSaveState;
  pendingSaveOperationId: string | null;
  lastResolvedSaveOperationId: string | null;
  pet: PetState;
  alerts: PetAlert[];
  draftName: string;
  errorMessage: string | null;
  saveMessage: string | null;
  loadPet: () => Promise<void>;
  refresh: () => Promise<void>;
  setDraftName: (name: string) => void;
  hatchPet: () => Promise<void>;
  applyPetAction: (action: PetAction) => Promise<void>;
  markSaveCompleted: (operationId: string, savedAt: string) => void;
  markSaveFailed: (operationId: string, message: string) => void;
  clearSaveMessage: () => void;
};

const INITIAL_PET = createDefaultPetState();
let petOperationQueue: Promise<unknown> = Promise.resolve();
let nextSaveOperationCount = 0;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown pet persistence error.';
}

function createPetSnapshot(pet: PetState): Pick<PetStoreState, 'pet' | 'alerts'> {
  const simulationConfig = getPetSimulationConfig();

  return {
    pet,
    alerts: deriveAlertsWithConfig(pet, simulationConfig),
  };
}

function createSaveOperationId(): string {
  nextSaveOperationCount += 1;
  return `pet-save-${nextSaveOperationCount}`;
}

function enqueuePetOperation<T>(operation: () => Promise<T>): Promise<T> {
  const nextOperation = petOperationQueue.then(operation);
  petOperationQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

function buildUnsavedChangesMessage(message: string): string {
  return `${message} Changes are still in memory and marked unsaved.`;
}

function resolveSaveCompletedState(
  state: PetStoreState,
  operationId: string,
  savedAt: string,
): Partial<PetStoreState> | null {
  if (state.lastResolvedSaveOperationId === operationId) {
    return null;
  }

  if (state.pendingSaveOperationId !== operationId) {
    return null;
  }

  return {
    status: state.status === 'loading' ? 'ready' : state.status,
    saveState: 'idle',
    pendingSaveOperationId: null,
    lastResolvedSaveOperationId: operationId,
    saveMessage: `Saved at ${new Date(savedAt).toLocaleTimeString()}`,
    errorMessage: null,
  };
}

function resolveSaveFailedState(
  state: PetStoreState,
  operationId: string,
  message: string,
): Partial<PetStoreState> | null {
  if (state.lastResolvedSaveOperationId === operationId) {
    return null;
  }

  if (state.pendingSaveOperationId !== operationId) {
    return null;
  }

  return {
    status: state.status === 'loading' ? 'ready' : state.status,
    saveState: 'dirty',
    pendingSaveOperationId: null,
    lastResolvedSaveOperationId: operationId,
    saveMessage: null,
    errorMessage: buildUnsavedChangesMessage(message),
  };
}

export const usePetStore = create<PetStoreState>((set, get) => {
  const persistPetSnapshot = async (pet: PetState): Promise<void> => {
    const operationId = createSaveOperationId();

    set({
      saveState: 'saving',
      pendingSaveOperationId: operationId,
      saveMessage: null,
      errorMessage: null,
    });

    try {
      await savePetCommand({
        operationId,
        pet,
      });
      get().markSaveCompleted(operationId, toIsoTimestamp());
    } catch (error) {
      get().markSaveFailed(operationId, toErrorMessage(error));
    }
  };

  return {
    status: 'idle',
    saveState: 'idle',
    pendingSaveOperationId: null,
    lastResolvedSaveOperationId: null,
    ...createPetSnapshot(INITIAL_PET),
    draftName: INITIAL_PET.name,
    errorMessage: null,
    saveMessage: null,
    loadPet() {
      return enqueuePetOperation(async () => {
        set({
          status: 'loading',
          errorMessage: null,
        });

        try {
          const simulationConfig = getPetSimulationConfig();
          const { pet, consumedTicks } = tickPet(
            await loadPetCommand(),
            Date.now(),
            simulationConfig,
          );

          set({
            ...createPetSnapshot(pet),
            draftName: pet.name,
            status: 'ready',
            saveState: 'idle',
            pendingSaveOperationId: null,
            lastResolvedSaveOperationId: null,
            saveMessage: null,
            errorMessage: null,
          });

          if (consumedTicks > 0) {
            await persistPetSnapshot(pet);
          }
        } catch (error) {
          set({
            status: 'error',
            saveState: 'idle',
            pendingSaveOperationId: null,
            errorMessage: toErrorMessage(error),
          });
        }
      });
    },
    refresh() {
      return enqueuePetOperation(async () => {
        const nowMs = Date.now();
        const simulationConfig = getPetSimulationConfig();
        const currentState = get();
        const { pet, consumedTicks } = tickPet(
          currentState.pet,
          nowMs,
          simulationConfig,
        );

        set({
          ...createPetSnapshot(pet),
          draftName: pet.name,
        });

        if (consumedTicks === 0 && get().saveState !== 'dirty') {
          return;
        }

        await persistPetSnapshot(pet);
      });
    },
    setDraftName(name) {
      set({
        draftName: name,
        errorMessage: null,
      });
    },
    hatchPet() {
      return enqueuePetOperation(async () => {
        const nowMs = Date.now();
        const currentPet = get().pet;
        const nextName = get().draftName.trim();

        if (!nextName) {
          set({
            status: 'error',
            errorMessage: 'Choose a pet name before hatching.',
          });
          return;
        }

        const nextPet = applyAction(
          {
            ...currentPet,
            name: nextName,
          },
          'hatch',
          nowMs,
        );

        set({
          ...createPetSnapshot(nextPet),
          draftName: nextName,
          status: 'ready',
          saveMessage: null,
          errorMessage: null,
        });

        await persistPetSnapshot(nextPet);
      });
    },
    applyPetAction(action) {
      return enqueuePetOperation(async () => {
        const nowMs = Date.now();
        const simulationConfig = getPetSimulationConfig();
        const currentPet = catchup(get().pet, nowMs, simulationConfig);
        const nextPet = applyAction(currentPet, action, nowMs, simulationConfig);

        set({
          ...createPetSnapshot(nextPet),
          draftName: nextPet.name,
          status: 'ready',
          saveMessage: null,
          errorMessage: null,
        });

        await persistPetSnapshot(nextPet);
      });
    },
    markSaveCompleted(operationId, savedAt) {
      set((state) => resolveSaveCompletedState(state, operationId, savedAt) ?? state);
    },
    markSaveFailed(operationId, message) {
      set((state) => resolveSaveFailedState(state, operationId, message) ?? state);
    },
    clearSaveMessage() {
      set({ saveMessage: null });
    },
  };
});
