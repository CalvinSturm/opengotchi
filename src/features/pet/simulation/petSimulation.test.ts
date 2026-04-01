import { describe, expect, it } from 'vitest';

import { createDefaultPetState, parseIsoTimestamp } from '../model';
import {
  applyAction,
  applyDecay,
  catchup,
  deriveMood,
} from './petSimulation';

describe('pet simulation', () => {
  it('applies awake decay in full-minute steps', () => {
    const pet = createDefaultPetState(0);
    const next = applyDecay(pet, 180_000);

    expect(next.satiety).toBe(72);
    expect(next.fun).toBe(66);
    expect(next.cleanliness).toBe(77);
    expect(next.energy).toBe(59);
  });

  it('restores energy while sleeping', () => {
    const pet = {
      ...createDefaultPetState(0),
      energy: 20,
      isSleeping: true,
    };

    const next = applyDecay(pet, 120_000);

    expect(next.energy).toBe(28);
    expect(next.satiety).toBe(76);
  });

  it('derives mood from the current needs', () => {
    expect(
      deriveMood({
        ...createDefaultPetState(0),
        isSleeping: true,
      }),
    ).toBe('sleeping');

    expect(
      deriveMood({
        ...createDefaultPetState(0),
        satiety: 12,
      }),
    ).toBe('hungry');

    expect(
      deriveMood({
        ...createDefaultPetState(0),
        satiety: 84,
        fun: 88,
        cleanliness: 90,
        energy: 82,
      }),
    ).toBe('happy');
  });

  it('applies actions without breaking stat bounds', () => {
    const pet = {
      ...createDefaultPetState(0),
      satiety: 95,
      cleanliness: 3,
      energy: 5,
    };

    const fed = applyAction(pet, 'feed', 50);
    const cleaned = applyAction(fed, 'clean', 100);
    const played = applyAction(cleaned, 'play', 150);

    expect(fed.satiety).toBe(100);
    expect(cleaned.cleanliness).toBe(28);
    expect(played.energy).toBe(0);
    expect(parseIsoTimestamp(played.lastUpdatedAt)).toBe(150);
  });

  it('catches up from the last saved timestamp', () => {
    const pet = createDefaultPetState(10_000);
    const next = catchup(pet, 70_000);

    expect(parseIsoTimestamp(next.lastUpdatedAt)).toBe(70_000);
    expect(next.energy).toBe(65);
    expect(next.satiety).toBe(76);
  });
});
