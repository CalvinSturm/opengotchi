import {
  parseIsoTimestamp,
  toIsoTimestamp,
  type PetAgeStage,
  type PetAdultOutcome,
  type PetState,
} from '../model';

export type PetAction = 'feed' | 'play' | 'clean' | 'sleep' | 'heal';
export type PetMood =
  | 'sleeping'
  | 'sick'
  | 'hungry'
  | 'dirty'
  | 'sleepy'
  | 'happy'
  | 'content'
  | 'sad';
export type PetAlertCode =
  | 'sick'
  | 'hungry'
  | 'dirty'
  | 'needs-cleanup'
  | 'sleepy';
export type PetAlertSeverity = 'warning' | 'critical';
export type PetAlert = {
  code: PetAlertCode;
  severity: PetAlertSeverity;
  label: string;
  message: string;
};

const DECAY_STEP_MS = 60_000;
const LOW_NEED_THRESHOLD = 20;
const GOOD_NEED_THRESHOLD = 60;
const GOOD_HEALTH_THRESHOLD = 70;
const DIRTY_THRESHOLD = 20;
const CLEANUP_ALERT_THRESHOLD = 70;
const HIGH_WASTE_THRESHOLD = 80;
const SICKNESS_THRESHOLD = 90;
const LOW_HEALTH_THRESHOLD = 35;
const LOW_WASTE_THRESHOLD = 35;
const HOUR_MS = 60 * 60 * 1_000;
const CHILD_STAGE_MS = HOUR_MS;
const TEEN_STAGE_MS = 6 * HOUR_MS;
const ADULT_STAGE_MS = 24 * HOUR_MS;

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function applyStatDelta(value: number, delta: number): number {
  return clampStat(value + delta);
}

function clampCounter(value: number): number {
  return Math.max(0, Math.round(value));
}

function getOutcomeModifier(state: Pick<PetState, 'adultOutcome'>): PetAdultOutcome | null {
  return state.adultOutcome;
}

function applyOutcomeHealthPenaltyModifier(
  state: Pick<PetState, 'adultOutcome'>,
  healthPenalty: number,
  elapsedSteps: number,
): number {
  if (getOutcomeModifier(state) === 'resilient') {
    return Math.max(0, healthPenalty - elapsedSteps);
  }

  return healthPenalty;
}

function applyOutcomeWasteDecayModifier(
  state: Pick<PetState, 'adultOutcome'>,
  wasteDelta: number,
): number {
  if (getOutcomeModifier(state) === 'messy') {
    return wasteDelta + 1;
  }

  return wasteDelta;
}

function applyOutcomeActionStatModifier(
  state: Pick<PetState, 'adultOutcome'>,
  action: PetAction,
  stat: 'fun' | 'energy' | 'cleanliness' | 'waste' | 'health',
  delta: number,
): number {
  const outcome = getOutcomeModifier(state);

  if (outcome === 'playful' && action === 'play') {
    if (stat === 'fun') {
      return delta + 6;
    }

    if (stat === 'energy') {
      return delta + 3;
    }
  }

  if (outcome === 'messy' && action === 'clean') {
    if (stat === 'cleanliness') {
      return delta - 8;
    }

    if (stat === 'waste') {
      return delta + 10;
    }
  }

  if (outcome === 'resilient' && action === 'heal' && stat === 'health') {
    return delta + 6;
  }

  return delta;
}

export function deriveAgeStage(startedAt: string, nowMs: number): PetAgeStage {
  const elapsedLifetimeMs = Math.max(0, nowMs - parseIsoTimestamp(startedAt));

  if (elapsedLifetimeMs >= ADULT_STAGE_MS) {
    return 'adult';
  }

  if (elapsedLifetimeMs >= TEEN_STAGE_MS) {
    return 'teen';
  }

  if (elapsedLifetimeMs >= CHILD_STAGE_MS) {
    return 'child';
  }

  return 'baby';
}

export function deriveAdultOutcome(state: Pick<
  PetState,
  | 'careScore'
  | 'careMistakes'
  | 'fun'
  | 'health'
  | 'cleanliness'
  | 'waste'
  | 'isSick'
>): PetAdultOutcome {
  if (state.careMistakes >= 18 || state.waste >= 60 || state.cleanliness <= 40) {
    return 'messy';
  }

  if (state.careScore >= 30 && state.fun >= 65 && state.careMistakes <= 10) {
    return 'playful';
  }

  if (state.careMistakes >= 8 && state.careScore >= 18 && state.health >= 55 && !state.isSick) {
    return 'resilient';
  }

  return 'balanced';
}

function countHealthRisks(state: PetState): number {
  let riskCount = 0;

  if (state.satiety <= LOW_NEED_THRESHOLD) {
    riskCount += 1;
  }

  if (state.cleanliness <= DIRTY_THRESHOLD) {
    riskCount += 1;
  }

  if (state.waste >= HIGH_WASTE_THRESHOLD) {
    riskCount += 1;
  }

  if (!state.isSleeping && state.energy <= LOW_NEED_THRESHOLD) {
    riskCount += 1;
  }

  if (state.isSick) {
    riskCount += 2;
  }

  return riskCount;
}

function shouldBecomeSick(state: PetState): boolean {
  return (
    state.isSick ||
    state.health <= LOW_HEALTH_THRESHOLD ||
    state.cleanliness <= 10 ||
    state.waste >= SICKNESS_THRESHOLD
  );
}

function applyHealthRules(state: PetState, elapsedSteps: number): PetState {
  const healthPenalty = applyOutcomeHealthPenaltyModifier(
    state,
    countHealthRisks(state) * elapsedSteps,
    elapsedSteps,
  );
  const health = applyStatDelta(state.health, -healthPenalty);

  return {
    ...state,
    health,
    isSick: shouldBecomeSick({
      ...state,
      health,
    }),
  };
}

function applyCareTracking(state: PetState, elapsedSteps: number): PetState {
  let careScoreDelta = 0;
  let careMistakesDelta = 0;

  if (
    state.satiety >= GOOD_NEED_THRESHOLD &&
    state.fun >= GOOD_NEED_THRESHOLD &&
    state.cleanliness >= GOOD_NEED_THRESHOLD &&
    (state.energy >= GOOD_NEED_THRESHOLD || state.isSleeping) &&
    state.health >= GOOD_HEALTH_THRESHOLD &&
    state.waste <= LOW_WASTE_THRESHOLD &&
    !state.isSick
  ) {
    careScoreDelta += elapsedSteps * 2;
  }

  if (state.isSick) {
    careMistakesDelta += elapsedSteps * 2;
  }

  if (state.satiety <= LOW_NEED_THRESHOLD) {
    careMistakesDelta += elapsedSteps;
  }

  if (state.cleanliness <= DIRTY_THRESHOLD) {
    careMistakesDelta += elapsedSteps;
  }

  if (!state.isSleeping && state.energy <= LOW_NEED_THRESHOLD) {
    careMistakesDelta += elapsedSteps;
  }

  if (state.waste >= CLEANUP_ALERT_THRESHOLD) {
    careMistakesDelta += elapsedSteps;
  }

  if (state.health <= LOW_HEALTH_THRESHOLD) {
    careMistakesDelta += elapsedSteps;
  }

  return {
    ...state,
    careScore: clampCounter(state.careScore + careScoreDelta),
    careMistakes: clampCounter(state.careMistakes + careMistakesDelta),
  };
}

function withProgression(
  state: PetState,
  nowMs: number,
  adjustment?: {
    careScoreDelta?: number;
    careMistakesDelta?: number;
  },
): PetState {
  const nextAgeStage = deriveAgeStage(state.startedAt, nowMs);
  const careScore = clampCounter(state.careScore + (adjustment?.careScoreDelta ?? 0));
  const careMistakes = clampCounter(
    state.careMistakes + (adjustment?.careMistakesDelta ?? 0),
  );
  const adultOutcome =
    state.adultOutcome ??
    (nextAgeStage === 'adult'
      ? deriveAdultOutcome({
          ...state,
          careScore,
          careMistakes,
        })
      : null);

  return {
    ...state,
    careScore,
    careMistakes,
    ageStage: nextAgeStage,
    adultOutcome,
  };
}

export function deriveAlerts(state: PetState): PetAlert[] {
  const alerts: PetAlert[] = [];

  if (state.isSick || state.health <= LOW_HEALTH_THRESHOLD) {
    alerts.push({
      code: 'sick',
      severity: 'critical',
      label: 'Needs medicine',
      message: state.isSick
        ? 'Your pet feels sick and needs treatment.'
        : 'Health is dangerously low and needs care.',
    });
  }

  if (state.waste >= CLEANUP_ALERT_THRESHOLD) {
    alerts.push({
      code: 'needs-cleanup',
      severity: state.waste >= HIGH_WASTE_THRESHOLD ? 'critical' : 'warning',
      label: 'Cleanup needed',
      message: 'Waste has built up. Cleaning is overdue.',
    });
  }

  if (state.cleanliness <= DIRTY_THRESHOLD) {
    alerts.push({
      code: 'dirty',
      severity: 'warning',
      label: 'Dirty',
      message: 'Cleanliness is low and the pet needs washing.',
    });
  }

  if (state.satiety <= LOW_NEED_THRESHOLD) {
    alerts.push({
      code: 'hungry',
      severity: 'warning',
      label: 'Hungry',
      message: 'Satiety is low. Feeding is overdue.',
    });
  }

  if (!state.isSleeping && state.energy <= LOW_NEED_THRESHOLD) {
    alerts.push({
      code: 'sleepy',
      severity: 'warning',
      label: 'Sleepy',
      message: 'Energy is low. Time to rest soon.',
    });
  }

  return alerts;
}

export function buildAlertNotification(
  petName: string,
  alert: PetAlert,
): { title: string; body: string } {
  return {
    title: `${petName} ${alert.code === 'sick' ? 'needs care' : 'needs attention'}`,
    body: alert.message,
  };
}

export function applyDecay(state: PetState, elapsedMs: number): PetState {
  const elapsedSteps = Math.max(0, Math.floor(elapsedMs / DECAY_STEP_MS));

  if (elapsedSteps === 0) {
    return state;
  }

  if (state.isSleeping) {
    return applyCareTracking(
      applyHealthRules(
        {
          ...state,
          satiety: applyStatDelta(state.satiety, -elapsedSteps),
          fun: applyStatDelta(state.fun, -elapsedSteps),
          cleanliness: applyStatDelta(state.cleanliness, -elapsedSteps),
          energy: applyStatDelta(state.energy, elapsedSteps * 4),
          waste: applyStatDelta(
            state.waste,
            applyOutcomeWasteDecayModifier(state, elapsedSteps),
          ),
        },
        elapsedSteps,
      ),
      elapsedSteps,
    );
  }

  return applyCareTracking(
    applyHealthRules(
      {
        ...state,
        satiety: applyStatDelta(state.satiety, -elapsedSteps * 2),
        fun: applyStatDelta(state.fun, -elapsedSteps * 2),
        cleanliness: applyStatDelta(state.cleanliness, -elapsedSteps),
        energy: applyStatDelta(state.energy, -elapsedSteps * 3),
        waste: applyStatDelta(
          state.waste,
          applyOutcomeWasteDecayModifier(state, elapsedSteps * 2),
        ),
      },
      elapsedSteps,
    ),
    elapsedSteps,
  );
}

export function deriveMood(state: PetState): PetMood {
  if (state.isSleeping) {
    return 'sleeping';
  }

  if (state.isSick || state.health <= LOW_HEALTH_THRESHOLD) {
    return 'sick';
  }

  if (state.satiety <= LOW_NEED_THRESHOLD) {
    return 'hungry';
  }

  if (state.cleanliness <= DIRTY_THRESHOLD || state.waste >= HIGH_WASTE_THRESHOLD) {
    return 'dirty';
  }

  if (state.energy <= LOW_NEED_THRESHOLD) {
    return 'sleepy';
  }

  const averageNeed =
    (state.satiety + state.fun + state.cleanliness + state.energy + state.health) /
    5;

  if (averageNeed >= 75 && state.fun >= 60) {
    return 'happy';
  }

  if (averageNeed >= 50) {
    return 'content';
  }

  return 'sad';
}

export function applyAction(
  state: PetState,
  action: PetAction,
  appliedAtMs: number,
): PetState {
  switch (action) {
    case 'feed':
      return withProgression(
        {
          ...state,
          satiety: applyStatDelta(state.satiety, 22),
          cleanliness: applyStatDelta(state.cleanliness, -4),
          waste: applyStatDelta(
            state.waste,
            applyOutcomeActionStatModifier(state, 'feed', 'waste', 8),
          ),
          isSleeping: false,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
        },
        appliedAtMs,
        {
          careScoreDelta: 2,
        },
      );
    case 'play':
      return withProgression(
        {
          ...state,
          fun: applyStatDelta(
            state.fun,
            applyOutcomeActionStatModifier(state, 'play', 'fun', 24),
          ),
          satiety: applyStatDelta(state.satiety, -4),
          cleanliness: applyStatDelta(state.cleanliness, -5),
          energy: applyStatDelta(
            state.energy,
            applyOutcomeActionStatModifier(state, 'play', 'energy', -10),
          ),
          waste: applyStatDelta(state.waste, 4),
          isSleeping: false,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
        },
        appliedAtMs,
        {
          careScoreDelta: 2,
        },
      );
    case 'clean':
      return withProgression(
        {
          ...state,
          cleanliness: applyStatDelta(
            state.cleanliness,
            applyOutcomeActionStatModifier(state, 'clean', 'cleanliness', 28),
          ),
          waste: applyStatDelta(
            state.waste,
            applyOutcomeActionStatModifier(state, 'clean', 'waste', -36),
          ),
          health: applyStatDelta(state.health, 4),
          isSleeping: false,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
        },
        appliedAtMs,
        {
          careScoreDelta: 3,
        },
      );
    case 'sleep':
      return withProgression(
        {
          ...state,
          isSleeping: !state.isSleeping,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
        },
        appliedAtMs,
        {
          careScoreDelta: state.energy <= LOW_NEED_THRESHOLD ? 2 : 1,
        },
      );
    case 'heal':
      return withProgression(
        {
          ...state,
          health: applyStatDelta(
            state.health,
            applyOutcomeActionStatModifier(state, 'heal', 'health', 18),
          ),
          fun: applyStatDelta(state.fun, -4),
          isSick: false,
          isSleeping: false,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
        },
        appliedAtMs,
        {
          careScoreDelta: state.isSick || state.health <= LOW_HEALTH_THRESHOLD ? 4 : 1,
        },
      );
    default:
      return state;
  }
}

export function catchup(state: PetState, nowMs: number): PetState {
  const elapsedMs = nowMs - parseIsoTimestamp(state.lastUpdatedAt);

  if (elapsedMs <= 0) {
    return withProgression(state, nowMs);
  }

  return withProgression(
    {
      ...applyDecay(state, elapsedMs),
      lastUpdatedAt: toIsoTimestamp(nowMs),
    },
    nowMs,
  );
}
