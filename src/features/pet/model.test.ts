import { describe, expect, it } from 'vitest';

import { petStateDtoSchema } from './model';

describe('pet dto mapping', () => {
  it('parses the documented IPC shape', () => {
    const dto = petStateDtoSchema.parse({
      version: 1,
      name: 'Byte',
      satiety: 78,
      fun: 72,
      cleanliness: 80,
      energy: 68,
      health: 84,
      waste: 12,
      isSick: false,
      isSleeping: false,
      startedAt: '2026-04-01T12:00:00.000Z',
      lastUpdatedAt: '2026-04-01T17:00:00.000Z',
      ageStage: 'child',
      careScore: 14,
      careMistakes: 2,
      adultOutcome: null,
    });

    expect(dto.health).toBe(84);
    expect(dto.waste).toBe(12);
    expect(dto.isSick).toBe(false);
    expect(dto.isSleeping).toBe(false);
    expect(dto.startedAt).toBe('2026-04-01T12:00:00.000Z');
    expect(dto.lastUpdatedAt).toBe('2026-04-01T17:00:00.000Z');
    expect(dto.ageStage).toBe('child');
    expect(dto.careScore).toBe(14);
    expect(dto.careMistakes).toBe(2);
    expect(dto.adultOutcome).toBeNull();
  });
});
