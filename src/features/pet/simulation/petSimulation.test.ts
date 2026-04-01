import { describe, expect, it } from 'vitest';

import { createDefaultPetState, parseIsoTimestamp } from '../model';
import {
  applyAction,
  applyDecay,
  buildAlertNotification,
  catchup,
  deriveAgeStage,
  deriveAlerts,
  deriveAdultOutcome,
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
    expect(next.health).toBe(84);
    expect(next.waste).toBe(18);
    expect(next.careScore).toBe(0);
    expect(next.careMistakes).toBe(0);
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
    expect(next.waste).toBe(14);
    expect(next.health).toBe(84);
    expect(next.careScore).toBe(4);
  });

  it('derives life stage from lifetime elapsed since startedAt', () => {
    expect(deriveAgeStage('2026-04-01T00:00:00.000Z', Date.parse('2026-04-01T00:30:00.000Z'))).toBe('baby');
    expect(deriveAgeStage('2026-04-01T00:00:00.000Z', Date.parse('2026-04-01T02:00:00.000Z'))).toBe('child');
    expect(deriveAgeStage('2026-04-01T00:00:00.000Z', Date.parse('2026-04-01T08:00:00.000Z'))).toBe('teen');
    expect(deriveAgeStage('2026-04-01T00:00:00.000Z', Date.parse('2026-04-02T01:00:00.000Z'))).toBe('adult');
  });

  it('derives adult outcome from accumulated care quality', () => {
    expect(
      deriveAdultOutcome({
        ...createDefaultPetState(0),
        careScore: 36,
        careMistakes: 4,
        fun: 80,
      }),
    ).toBe('playful');

    expect(
      deriveAdultOutcome({
        ...createDefaultPetState(0),
        careScore: 20,
        careMistakes: 10,
        health: 76,
      }),
    ).toBe('resilient');

    expect(
      deriveAdultOutcome({
        ...createDefaultPetState(0),
        careScore: 8,
        careMistakes: 22,
        waste: 72,
      }),
    ).toBe('messy');
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
        isSick: true,
      }),
    ).toBe('sick');

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
        health: 94,
        waste: 6,
      }),
    ).toBe('happy');
  });

  it('derives ordered attention alerts from the current pet state', () => {
    const alerts = deriveAlerts({
      ...createDefaultPetState(0),
      satiety: 18,
      cleanliness: 14,
      energy: 16,
      health: 30,
      waste: 82,
      isSick: true,
    });

    expect(alerts.map((alert) => alert.code)).toEqual([
      'sick',
      'needs-cleanup',
      'dirty',
      'hungry',
      'sleepy',
    ]);
    expect(alerts[0]?.severity).toBe('critical');
  });

  it('formats alert notifications from derived gameplay alerts', () => {
    const [alert] = deriveAlerts({
      ...createDefaultPetState(0),
      satiety: 10,
    });

    const notification = buildAlertNotification('Byte', alert!);

    expect(notification.title).toBe('Byte needs attention');
    expect(notification.body).toContain('Feeding is overdue');
  });

  it('damages health and can trigger sickness under neglect', () => {
    const pet = {
      ...createDefaultPetState(0),
      satiety: 20,
      cleanliness: 10,
      energy: 15,
      health: 50,
      waste: 80,
    };

    const next = applyDecay(pet, 60_000);

    expect(next.health).toBe(46);
    expect(next.isSick).toBe(true);
    expect(next.waste).toBe(82);
    expect(next.careMistakes).toBe(6);
  });

  it('applies the playful adult modifier to play actions', () => {
    const pet = {
      ...createDefaultPetState(0),
      ageStage: 'adult' as const,
      adultOutcome: 'playful' as const,
      fun: 40,
      energy: 50,
    };

    const next = applyAction(pet, 'play', 100);

    expect(next.fun).toBe(70);
    expect(next.energy).toBe(43);
  });

  it('applies the messy adult modifier to cleanup and waste decay', () => {
    const pet = {
      ...createDefaultPetState(0),
      ageStage: 'adult' as const,
      adultOutcome: 'messy' as const,
      cleanliness: 40,
      waste: 50,
    };

    const cleaned = applyAction(pet, 'clean', 100);
    const decayed = applyDecay(pet, 60_000);

    expect(cleaned.cleanliness).toBe(60);
    expect(cleaned.waste).toBe(24);
    expect(decayed.waste).toBe(53);
  });

  it('applies the resilient adult modifier to healing and health decay', () => {
    const pet = {
      ...createDefaultPetState(0),
      ageStage: 'adult' as const,
      adultOutcome: 'resilient' as const,
      satiety: 10,
      cleanliness: 10,
      energy: 10,
      health: 40,
      waste: 80,
      isSick: true,
    };

    const healed = applyAction(pet, 'heal', 100);
    const decayed = applyDecay(pet, 60_000);

    expect(healed.health).toBe(64);
    expect(decayed.health).toBe(35);
  });

  it('applies actions without breaking stat bounds', () => {
    const pet = {
      ...createDefaultPetState(0),
      satiety: 95,
      cleanliness: 3,
      energy: 5,
      health: 20,
      waste: 92,
      isSick: true,
    };

    const fed = applyAction(pet, 'feed', 50);
    const cleaned = applyAction(fed, 'clean', 100);
    const played = applyAction(cleaned, 'play', 150);
    const healed = applyAction(played, 'heal', 200);

    expect(fed.satiety).toBe(100);
    expect(fed.waste).toBe(100);
    expect(cleaned.cleanliness).toBe(28);
    expect(cleaned.waste).toBe(64);
    expect(played.energy).toBe(0);
    expect(healed.health).toBe(42);
    expect(healed.isSick).toBe(false);
    expect(healed.careScore).toBe(11);
    expect(parseIsoTimestamp(healed.lastUpdatedAt)).toBe(200);
  });

  it('catches up from the last saved timestamp', () => {
    const pet = {
      ...createDefaultPetState(10_000),
      cleanliness: 12,
      health: 40,
      waste: 88,
      startedAt: '1970-01-01T00:00:00.000Z',
    };
    const next = catchup(pet, 70_000);

    expect(parseIsoTimestamp(next.lastUpdatedAt)).toBe(70_000);
    expect(next.energy).toBe(65);
    expect(next.satiety).toBe(76);
    expect(next.health).toBe(38);
    expect(next.isSick).toBe(true);
    expect(next.ageStage).toBe('baby');
    expect(next.careMistakes).toBe(4);
  });

  it('advances life stage during offline catchup', () => {
    const pet = {
      ...createDefaultPetState(Date.parse('2026-04-01T00:00:00.000Z')),
      lastUpdatedAt: '2026-04-01T05:00:00.000Z',
    };

    const next = catchup(pet, Date.parse('2026-04-01T08:00:00.000Z'));

    expect(next.ageStage).toBe('teen');
    expect(next.startedAt).toBe('2026-04-01T00:00:00.000Z');
  });

  it('assigns an adult outcome once when the pet reaches adulthood', () => {
    const pet = {
      ...createDefaultPetState(Date.parse('2026-04-01T00:00:00.000Z')),
      ageStage: 'teen' as const,
      careScore: 34,
      careMistakes: 6,
      fun: 82,
      lastUpdatedAt: '2026-04-02T01:00:00.000Z',
    };

    const next = catchup(pet, Date.parse('2026-04-02T01:00:00.000Z'));

    expect(next.ageStage).toBe('adult');
    expect(next.adultOutcome).toBe('playful');
  });

  it('keeps an assigned adult outcome stable after adulthood', () => {
    const pet = {
      ...createDefaultPetState(Date.parse('2026-04-01T00:00:00.000Z')),
      ageStage: 'adult' as const,
      adultOutcome: 'balanced' as const,
      careScore: 12,
      careMistakes: 4,
      lastUpdatedAt: '2026-04-02T02:00:00.000Z',
    };

    const next = catchup(pet, Date.parse('2026-04-02T05:00:00.000Z'));

    expect(next.ageStage).toBe('adult');
    expect(next.adultOutcome).toBe('balanced');
  });
});
