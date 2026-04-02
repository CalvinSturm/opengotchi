import { invoke } from '@tauri-apps/api/core';

import {
  createDefaultPetState,
  petStateDtoSchema,
  type PetStateDTO,
} from '../../features/pet/model';

function hasTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return '__TAURI_INTERNALS__' in window;
}

export async function loadPet(): Promise<PetStateDTO> {
  if (!hasTauriRuntime()) {
    return createDefaultPetState();
  }

  const result = await invoke<unknown>('load_pet');
  return petStateDtoSchema.parse(result);
}

export async function savePet(input: {
  operationId: string;
  pet: PetStateDTO;
}): Promise<void> {
  const { operationId, pet } = input;
  const parsedPet = petStateDtoSchema.parse(pet);

  if (!hasTauriRuntime()) {
    return;
  }

  await invoke<void>('save_pet', {
    operationId,
    payload: parsedPet,
  });
}
