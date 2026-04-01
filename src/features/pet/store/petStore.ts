import { create } from 'zustand';

import { createDefaultPetState, type PetState } from '../model';
import type { PetAction } from '../simulation/petSimulation';
import { applyAction, catchup } from '../simulation/petSimulation';
import {
  loadPet as loadPetCommand,
  savePet as savePetCommand,
} from '../../../lib/tauri/petCommands';

type PetStoreStatus = 'idle' | 'loading' | 'ready' | 'error';

type PetStoreState = {
  status: PetStoreStatus;
  pet: PetState;
  errorMessage: string | null;
  loadPet: () => Promise<void>;
  refresh: () => void;
  applyPetAction: (action: PetAction) => Promise<void>;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown pet persistence error.';
}

export const usePetStore = create<PetStoreState>((set, get) => ({
  status: 'idle',
  pet: createDefaultPetState(),
  errorMessage: null,
  async loadPet() {
    set({ status: 'loading', errorMessage: null });

    try {
      const pet = catchup(await loadPetCommand(), Date.now());

      set({
        pet,
        status: 'ready',
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
    set((state) => ({
      pet: catchup(state.pet, Date.now()),
    }));
  },
  async applyPetAction(action) {
    const nowMs = Date.now();
    const currentPet = catchup(get().pet, nowMs);
    const nextPet = applyAction(currentPet, action, nowMs);

    set({
      pet: nextPet,
      status: 'ready',
      errorMessage: null,
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
}));
