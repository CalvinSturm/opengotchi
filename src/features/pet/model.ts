import { z } from 'zod';

export const PET_SAVE_VERSION = 1 as const;

const petStatSchema = z.number().int().min(0).max(100);
const isoTimestampSchema = z.string().datetime({ offset: true });

export const petStateDtoSchema = z.object({
  version: z.literal(PET_SAVE_VERSION),
  name: z.string().min(1).max(32),
  satiety: petStatSchema,
  fun: petStatSchema,
  cleanliness: petStatSchema,
  energy: petStatSchema,
  isSleeping: z.boolean(),
  lastUpdatedAt: isoTimestampSchema,
});

export type PetStateDTO = z.infer<typeof petStateDtoSchema>;
export type PetState = PetStateDTO;

export function toIsoTimestamp(value: number | Date = Date.now()): string {
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  return value.toISOString();
}

export function parseIsoTimestamp(timestamp: string): number {
  const parsed = Date.parse(timestamp);

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid pet timestamp: ${timestamp}`);
  }

  return parsed;
}

export function createDefaultPetState(
  now: number | Date = Date.now(),
): PetStateDTO {
  return {
    version: PET_SAVE_VERSION,
    name: 'Byte',
    satiety: 78,
    fun: 72,
    cleanliness: 80,
    energy: 68,
    isSleeping: false,
    lastUpdatedAt: toIsoTimestamp(now),
  };
}
