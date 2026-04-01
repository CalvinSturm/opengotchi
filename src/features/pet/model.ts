import { z } from 'zod';

export const PET_SAVE_VERSION = 1 as const;

const petStatSchema = z.number().int().min(0).max(100);
const careCounterSchema = z.number().int().min(0);
const isoTimestampSchema = z.string().datetime({ offset: true });
const petAgeStageSchema = z.enum(['baby', 'child', 'teen', 'adult']);
const petLifeStateSchema = z.enum(['egg', 'alive', 'dead']);
const petAdultMilestoneSchema = z.enum([
  'steady-routine',
  'showtime',
  'spring-clean',
  'recovery-run',
]);
const petAdultOutcomeSchema = z.enum([
  'balanced',
  'playful',
  'messy',
  'resilient',
]);

export const petStateDtoSchema = z.object({
  version: z.literal(PET_SAVE_VERSION),
  name: z.string().min(1).max(32),
  satiety: petStatSchema,
  fun: petStatSchema,
  cleanliness: petStatSchema,
  energy: petStatSchema,
  health: petStatSchema,
  waste: petStatSchema,
  lifeState: petLifeStateSchema,
  isSick: z.boolean(),
  isSleeping: z.boolean(),
  startedAt: isoTimestampSchema,
  lastUpdatedAt: isoTimestampSchema,
  ageStage: petAgeStageSchema,
  careScore: careCounterSchema,
  careMistakes: careCounterSchema,
  adultOutcome: petAdultOutcomeSchema.nullable(),
  adultMilestone: petAdultMilestoneSchema.nullable(),
  adultMilestoneProgress: careCounterSchema,
  adultMilestoneCompletedAt: isoTimestampSchema.nullable(),
});

export type PetStateDTO = z.infer<typeof petStateDtoSchema>;
export type PetState = PetStateDTO;
export type PetAgeStage = z.infer<typeof petAgeStageSchema>;
export type PetLifeState = z.infer<typeof petLifeStateSchema>;
export type PetAdultMilestone = z.infer<typeof petAdultMilestoneSchema>;
export type PetAdultOutcome = z.infer<typeof petAdultOutcomeSchema>;

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

export function createEggPetState(
  now: number | Date = Date.now(),
  name = 'Byte',
): PetStateDTO {
  return {
    version: PET_SAVE_VERSION,
    name,
    satiety: 78,
    fun: 72,
    cleanliness: 80,
    energy: 68,
    health: 84,
    waste: 12,
    lifeState: 'egg',
    isSick: false,
    isSleeping: false,
    startedAt: toIsoTimestamp(now),
    lastUpdatedAt: toIsoTimestamp(now),
    ageStage: 'baby',
    careScore: 0,
    careMistakes: 0,
    adultOutcome: null,
    adultMilestone: null,
    adultMilestoneProgress: 0,
    adultMilestoneCompletedAt: null,
  };
}

export function createLivePetState(
  now: number | Date = Date.now(),
  name = 'Byte',
): PetStateDTO {
  return {
    ...createEggPetState(now, name),
    lifeState: 'alive',
  };
}

export function createDefaultPetState(
  now: number | Date = Date.now(),
  name = 'Byte',
): PetStateDTO {
  return createEggPetState(now, name);
}
