import { create } from 'zustand';

import { createDefaultPetState, type PetState } from '../model';
import {
  applyAction,
  catchup,
  deriveAlerts,
  type PetAction,
  type PetAlert,
} from '../simulation/petSimulation';
import {
  loadPet as loadPetCommand,
  savePet as savePetCommand,
} from '../../../lib/tauri/petCommands';

type PetStoreStatus = 'idle' | 'loading' | 'ready' | 'error';

type PetStoreState = {
  status: PetStoreStatus;
  pet: PetState;
  alerts: PetAlert[];
  draftName: string;
  errorMessage: string | null;
  saveMessage: string | null;
  loadPet: () => Promise<void>;
  refresh: () => void;
  setDraftName: (name: string) => void;
  hatchPet: () => Promise<void>;
  applyPetAction: (action: PetAction) => Promise<void>;
  markSaveCompleted: (savedAt: string) => void;
  markSaveFailed: (message: string) => void;
  clearSaveMessage: () => void;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown pet persistence error.';
}

function createPetSnapshot(pet: PetState): Pick<PetStoreState, 'pet' | 'alerts'> {
  return {
    pet,
    alerts: deriveAlerts(pet),
  };
}

export const usePetStore = create<PetStoreState>((set, get) => ({
  status: 'idle',
  ...createPetSnapshot(createDefaultPetState()),
  draftName: createDefaultPetState().name,
  errorMessage: null,
  saveMessage: null,
  async loadPet() {
    set({ status: 'loading', errorMessage: null });

    try {
      const pet = catchup(await loadPetCommand(), Date.now());

      set({
        ...createPetSnapshot(pet),
        draftName: pet.name,
        status: 'ready',
        saveMessage: null,
      });

      await savePetCommand(pet);
    } catch (error) {
      set({
        status: 'error',
        errorMessage: toErrorMessage(error),
      });
    }
  },
  refresh() {
    set((state) => createPetSnapshot(catchup(state.pet, Date.now())));
  },
  setDraftName(name) {
    set({
      draftName: name,
      errorMessage: null,
    });
  },
  async hatchPet() {
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
      errorMessage: null,
      saveMessage: null,
    });

    try {
      await savePetCommand(nextPet);
    } catch (error) {
      set({
        status: 'error',
        errorMessage: toErrorMessage(error),
      });
    }
  },
  async applyPetAction(action) {
    const nowMs = Date.now();
    const currentPet = catchup(get().pet, nowMs);
    const nextPet = applyAction(currentPet, action, nowMs);

    set({
      ...createPetSnapshot(nextPet),
      draftName: nextPet.name,
      status: 'ready',
      errorMessage: null,
      saveMessage: null,
    });

    try {
      await savePetCommand(nextPet);
    } catch (error) {
      set({
        status: 'error',
        errorMessage: toErrorMessage(error),
      });
    }
  },
  markSaveCompleted(savedAt) {
    set({
      saveMessage: `Saved at ${new Date(savedAt).toLocaleTimeString()}`,
      errorMessage: null,
    });
  },
  markSaveFailed(message) {
    set({
      status: 'error',
      errorMessage: message,
      saveMessage: null,
    });
  },
  clearSaveMessage() {
    set({ saveMessage: null });
  },
}));
