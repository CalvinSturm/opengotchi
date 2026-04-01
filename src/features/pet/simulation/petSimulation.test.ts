import { describe, expect, it } from 'vitest';

import {
  createDefaultPetState,
  createEggPetState,
  createLivePetState,
  parseIsoTimestamp,
} from '../model';
import { DEFAULT_PET_SIMULATION_CONFIG } from './petSimulationConfig';
import {
  applyAction,
  applyDecay,
  buildAlertNotification,
  catchup,
  deriveAgeStage,
  deriveAlerts,
  deriveAdultOutcome,
  getNextSimulationWakeDelayMs,
  deriveRecommendedActions,
  deriveStatusInsight,
  deriveMood,
  tickPet,
} from './petSimulation';

describe('pet simulation', () => {
  it('applies awake decay in full-minute steps', () => {
    const pet = createLivePetState(0);
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
      ...createLivePetState(0),
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

  it('keeps egg pets frozen until hatch and starts the run on hatch', () => {
    const eggPet = createEggPetState(0, 'Nova');

    const decayedEgg = applyDecay(eggPet, 300_000);
    const hatchedPet = applyAction(eggPet, 'hatch', 120_000);

    expect(decayedEgg.lifeState).toBe('egg');
    expect(decayedEgg.lastUpdatedAt).toBe(eggPet.lastUpdatedAt);
    expect(deriveMood(eggPet)).toBe('egg');
    expect(hatchedPet.lifeState).toBe('alive');
    expect(hatchedPet.name).toBe('Nova');
    expect(hatchedPet.startedAt).toBe('1970-01-01T00:02:00.000Z');
    expect(hatchedPet.lastUpdatedAt).toBe('1970-01-01T00:02:00.000Z');
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
        ...createLivePetState(0),
        careScore: 36,
        careMistakes: 4,
        fun: 80,
      }),
    ).toBe('playful');

    expect(
      deriveAdultOutcome({
        ...createLivePetState(0),
        careScore: 20,
        careMistakes: 10,
        health: 76,
      }),
    ).toBe('resilient');

    expect(
      deriveAdultOutcome({
        ...createLivePetState(0),
        careScore: 8,
        careMistakes: 22,
        waste: 72,
      }),
    ).toBe('messy');
  });

  it('derives mood from the current needs', () => {
    expect(
      deriveMood({
        ...createLivePetState(0),
        isSleeping: true,
      }),
    ).toBe('sleeping');

    expect(
      deriveMood({
        ...createLivePetState(0),
        isSick: true,
      }),
    ).toBe('sick');

    expect(
      deriveMood({
        ...createLivePetState(0),
        satiety: 12,
      }),
    ).toBe('hungry');

    expect(
      deriveMood({
        ...createLivePetState(0),
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
      ...createLivePetState(0),
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
      ...createLivePetState(0),
      satiety: 10,
    });

    const notification = buildAlertNotification('Byte', alert!);

    expect(notification.title).toBe('Byte needs attention');
    expect(notification.body).toContain('Feeding is overdue');
  });

  it('derives prioritized recommended actions from current risks', () => {
    const recommendations = deriveRecommendedActions({
      ...createLivePetState(0),
      cleanliness: 8,
      waste: 94,
      isSick: true,
    });

    expect(recommendations).toEqual([
      {
        action: 'heal',
        priority: 'primary',
        reason: 'Condition is sick and needs treatment first.',
      },
      {
        action: 'clean',
        priority: 'secondary',
        reason: 'Waste buildup is driving the current risk.',
      },
    ]);
  });

  it('describes the current condition with cause and next-step guidance', () => {
    const insight = deriveStatusInsight({
      ...createLivePetState(0),
      cleanliness: 12,
      waste: 90,
      isSick: true,
    });

    expect(insight.headline).toBe('Condition: sick');
    expect(insight.detail).toContain('Waste buildup made the pet sick');
    expect(insight.detail).toContain('Heal first, then clean');
  });

  it('damages health and can trigger sickness under neglect', () => {
    const pet = {
      ...createLivePetState(0),
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
      ...createLivePetState(0),
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
      ...createLivePetState(0),
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
      ...createLivePetState(0),
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
      ...createLivePetState(0),
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

  it('recomputes sickness immediately after healing', () => {
    const pet = {
      ...createLivePetState(0),
      health: 20,
      cleanliness: 8,
      waste: 95,
      isSick: true,
    };

    const healed = applyAction(pet, 'heal', 100);

    expect(healed.health).toBe(38);
    expect(healed.isSick).toBe(true);
    expect(healed.lifeState).toBe('alive');
  });

  it('catches up from the last saved timestamp', () => {
    const pet = {
      ...createLivePetState(10_000),
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

  it('preserves partial-minute elapsed time between ticks', () => {
    const pet = {
      ...createLivePetState(0),
      lastUpdatedAt: '1970-01-01T00:00:00.000Z',
    };

    const next = catchup(pet, 30_000);

    expect(next.satiety).toBe(pet.satiety);
    expect(next.energy).toBe(pet.energy);
    expect(next.lastUpdatedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('reports consumed ticks and advances only the consumed decay window', () => {
    const pet = {
      ...createLivePetState(0),
      lastUpdatedAt: '1970-01-01T00:00:00.000Z',
    };

    const result = tickPet(pet, 70_000);

    expect(result.consumedTicks).toBe(1);
    expect(result.pet.lastUpdatedAt).toBe('1970-01-01T00:01:00.000Z');
    expect(result.pet.satiety).toBe(76);
    expect(result.pet.energy).toBe(65);
  });

  it('uses custom runtime constants for tick consumption', () => {
    const pet = {
      ...createLivePetState(0),
      lastUpdatedAt: '1970-01-01T00:00:00.000Z',
    };
    const config = {
      ...DEFAULT_PET_SIMULATION_CONFIG,
      decayStepMs: 10_000,
      awakeSatietyDecay: 1,
      awakeEnergyDecay: 1,
    };

    const result = tickPet(pet, 25_000, config);

    expect(result.consumedTicks).toBe(2);
    expect(result.pet.lastUpdatedAt).toBe('1970-01-01T00:00:20.000Z');
    expect(result.pet.satiety).toBe(76);
    expect(result.pet.energy).toBe(66);
  });

  it('schedules the next simulation wake for the earliest decay or age transition', () => {
    const pet = {
      ...createLivePetState(0),
      ageStage: 'baby' as const,
      startedAt: '1970-01-01T00:00:00.000Z',
      lastUpdatedAt: '1970-01-01T00:59:30.000Z',
    };

    expect(getNextSimulationWakeDelayMs(pet, 3_590_000)).toBe(10_000);
  });

  it('does not schedule wakes for egg or dead pets', () => {
    expect(getNextSimulationWakeDelayMs(createEggPetState(0), 0)).toBeNull();
    expect(
      getNextSimulationWakeDelayMs(
        {
          ...createLivePetState(0),
          lifeState: 'dead' as const,
        },
        0,
      ),
    ).toBeNull();
  });

  it('advances life stage during offline catchup', () => {
    const pet = {
      ...createLivePetState(Date.parse('2026-04-01T00:00:00.000Z')),
      lastUpdatedAt: '2026-04-01T05:00:00.000Z',
    };

    const next = catchup(pet, Date.parse('2026-04-01T08:00:00.000Z'));

    expect(next.ageStage).toBe('teen');
    expect(next.startedAt).toBe('2026-04-01T00:00:00.000Z');
  });

  it('assigns an adult outcome once when the pet reaches adulthood', () => {
    const pet = {
      ...createLivePetState(Date.parse('2026-04-01T00:00:00.000Z')),
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
      ...createLivePetState(Date.parse('2026-04-01T00:00:00.000Z')),
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

  it('marks the pet dead when health reaches zero and exposes a restart path', () => {
    const pet = {
      ...createLivePetState(0),
      name: 'Byte',
      satiety: 0,
      cleanliness: 0,
      energy: 0,
      health: 2,
      waste: 100,
    };

    const deadPet = applyDecay(pet, 60_000);
    const restartedPet = applyAction(deadPet, 'restart', 120_000);

    expect(deadPet.health).toBe(0);
    expect(deadPet.lifeState).toBe('dead');
    expect(deadPet.isSick).toBe(true);
    expect(deriveAlerts(deadPet).map((alert) => alert.code)).toEqual(['dead']);
    expect(deriveMood(deadPet)).toBe('dead');
    expect(restartedPet.lifeState).toBe('egg');
    expect(restartedPet.name).toBe('Byte');
    expect(restartedPet.health).toBe(84);
    expect(restartedPet.ageStage).toBe('baby');
  });

  it('tracks and completes adult milestones for adult pets', () => {
    const balancedAdult = {
      ...createLivePetState(Date.parse('2026-04-01T00:00:00.000Z')),
      ageStage: 'adult' as const,
      adultOutcome: 'balanced' as const,
      satiety: 82,
      fun: 80,
      cleanliness: 84,
      energy: 80,
      health: 88,
      waste: 12,
      lastUpdatedAt: '2026-04-02T00:00:00.000Z',
    };
    const playfulAdult = {
      ...createLivePetState(Date.parse('2026-04-01T00:00:00.000Z')),
      ageStage: 'adult' as const,
      adultOutcome: 'playful' as const,
      lastUpdatedAt: '2026-04-02T00:00:00.000Z',
    };

    const progressedBalanced = catchup(
      balancedAdult,
      Date.parse('2026-04-02T00:06:00.000Z'),
    );
    const showtime1 = applyAction(playfulAdult, 'play', Date.parse('2026-04-02T00:01:00.000Z'));
    const showtime2 = applyAction(showtime1, 'play', Date.parse('2026-04-02T00:02:00.000Z'));
    const showtime3 = applyAction(showtime2, 'play', Date.parse('2026-04-02T00:03:00.000Z'));
    const completedShowtime = applyAction(showtime3, 'play', Date.parse('2026-04-02T00:04:00.000Z'));
    const rewardedPlay = applyAction(completedShowtime, 'play', Date.parse('2026-04-02T00:05:00.000Z'));

    expect(progressedBalanced.adultMilestone).toBe('steady-routine');
    expect(progressedBalanced.adultMilestoneCompletedAt).toBe('2026-04-02T00:06:00.000Z');
    expect(progressedBalanced.adultMilestoneProgress).toBe(6);
    expect(completedShowtime.adultMilestone).toBe('showtime');
    expect(completedShowtime.adultMilestoneProgress).toBe(4);
    expect(completedShowtime.adultMilestoneCompletedAt).toBe('2026-04-02T00:04:00.000Z');
    expect(rewardedPlay.fun).toBe(100);
  });
});
