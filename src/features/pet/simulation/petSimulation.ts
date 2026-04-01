import {
  createDefaultPetState,
  createLivePetState,
  parseIsoTimestamp,
  toIsoTimestamp,
  type PetAgeStage,
  type PetAdultMilestone,
  type PetAdultOutcome,
  type PetState,
} from '../model';

export type PetAction =
  | 'hatch'
  | 'feed'
  | 'play'
  | 'clean'
  | 'sleep'
  | 'heal'
  | 'restart';
export type PetMood =
  | 'egg'
  | 'dead'
  | 'sleeping'
  | 'sick'
  | 'hungry'
  | 'dirty'
  | 'sleepy'
  | 'happy'
  | 'content'
  | 'sad';
export type PetAlertCode =
  | 'dead'
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
const ADULT_MILESTONE_TARGETS: Record<PetAdultMilestone, number> = {
  'steady-routine': 6,
  showtime: 4,
  'spring-clean': 3,
  'recovery-run': 2,
};

export const ADULT_MILESTONE_DETAILS: Record<
  PetAdultMilestone,
  {
    title: string;
    description: string;
    reward: string;
  }
> = {
  'steady-routine': {
    title: 'Steady Routine',
    description: 'Keep an adult pet in strong overall condition over time.',
    reward: 'Care actions restore a small amount of health.',
  },
  showtime: {
    title: 'Showtime',
    description: 'Keep an adult playful pet entertained with repeated play.',
    reward: 'Play grants extra fun.',
  },
  'spring-clean': {
    title: 'Spring Clean',
    description: 'Turn a messy adult into a pet that can stay clean.',
    reward: 'Clean removes more waste and restores more cleanliness.',
  },
  'recovery-run': {
    title: 'Recovery Run',
    description: 'Bring an adult resilient pet back from dangerous condition.',
    reward: 'Heal restores extra health.',
  },
};

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function applyStatDelta(value: number, delta: number): number {
  return clampStat(value + delta);
}

function clampCounter(value: number): number {
  return Math.max(0, Math.round(value));
}

function isDead(state: Pick<PetState, 'health'>): boolean {
  return state.health <= 0;
}

function isEgg(state: Pick<PetState, 'lifeState'>): boolean {
  return state.lifeState === 'egg';
}

function isAdultAlive(state: Pick<PetState, 'lifeState' | 'ageStage'>): boolean {
  return state.lifeState === 'alive' && state.ageStage === 'adult';
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

function deriveAdultMilestone(outcome: PetAdultOutcome): PetAdultMilestone {
  switch (outcome) {
    case 'balanced':
      return 'steady-routine';
    case 'playful':
      return 'showtime';
    case 'messy':
      return 'spring-clean';
    case 'resilient':
      return 'recovery-run';
    default:
      return 'steady-routine';
  }
}

function getAdultMilestoneTarget(milestone: PetAdultMilestone): number {
  return ADULT_MILESTONE_TARGETS[milestone];
}

function isHealthyRoutineStep(state: PetState): boolean {
  return (
    state.satiety >= 60 &&
    state.fun >= 60 &&
    state.cleanliness >= 60 &&
    state.energy >= 50 &&
    state.health >= 75 &&
    state.waste <= 30 &&
    !state.isSick
  );
}

function getAdultMilestoneActionProgressDelta(
  previousState: PetState,
  nextState: PetState,
  action: PetAction,
): number {
  if (!isAdultAlive(nextState) || !nextState.adultOutcome || nextState.adultMilestoneCompletedAt) {
    return 0;
  }

  const milestone = nextState.adultMilestone ?? deriveAdultMilestone(nextState.adultOutcome);

  switch (milestone) {
    case 'showtime':
      return action === 'play' ? 1 : 0;
    case 'spring-clean':
      return action === 'clean' && nextState.waste <= 28 ? 1 : 0;
    case 'recovery-run':
      return action === 'heal' &&
        previousState.isSick &&
        !nextState.isSick &&
        nextState.health >= 55
        ? 1
        : 0;
    case 'steady-routine':
      return 0;
    default:
      return 0;
  }
}

function getAdultMilestoneStepProgressDelta(state: PetState, elapsedSteps: number): number {
  if (
    !isAdultAlive(state) ||
    !state.adultOutcome ||
    state.adultMilestoneCompletedAt ||
    (state.adultMilestone ?? deriveAdultMilestone(state.adultOutcome)) !== 'steady-routine'
  ) {
    return 0;
  }

  return isHealthyRoutineStep(state) ? elapsedSteps : 0;
}

function applyAdultMilestoneReward(
  state: PetState,
  action: PetAction,
  previousState: PetState,
): PetState {
  if (!state.adultMilestoneCompletedAt || !state.adultMilestone) {
    return state;
  }

  switch (state.adultMilestone) {
    case 'steady-routine':
      if (action === 'feed' || action === 'clean' || action === 'sleep') {
        return {
          ...state,
          health: applyStatDelta(state.health, 2),
        };
      }

      return state;
    case 'showtime':
      if (action === 'play') {
        return {
          ...state,
          fun: applyStatDelta(state.fun, 4),
        };
      }

      return state;
    case 'spring-clean':
      if (action === 'clean') {
        return {
          ...state,
          cleanliness: applyStatDelta(state.cleanliness, 8),
          waste: applyStatDelta(state.waste, -8),
        };
      }

      return state;
    case 'recovery-run':
      if (action === 'heal' && previousState.isSick) {
        return {
          ...state,
          health: applyStatDelta(state.health, 8),
        };
      }

      return state;
    default:
      return state;
  }
}

function withAdultMilestoneProgress(
  state: PetState,
  nowMs: number,
  progressDelta: number,
): PetState {
  if (!isAdultAlive(state) || !state.adultOutcome) {
    return {
      ...state,
      adultMilestone: null,
      adultMilestoneProgress: 0,
      adultMilestoneCompletedAt: null,
    };
  }

  const adultMilestone = state.adultMilestone ?? deriveAdultMilestone(state.adultOutcome);

  if (state.adultMilestoneCompletedAt) {
    return {
      ...state,
      adultMilestone,
      adultMilestoneProgress: getAdultMilestoneTarget(adultMilestone),
    };
  }

  const target = getAdultMilestoneTarget(adultMilestone);
  const nextProgress = Math.min(target, clampCounter(state.adultMilestoneProgress + progressDelta));
  const adultMilestoneCompletedAt =
    nextProgress >= target ? toIsoTimestamp(nowMs) : null;

  return {
    ...state,
    adultMilestone,
    adultMilestoneProgress: nextProgress,
    adultMilestoneCompletedAt,
  };
}

export function getAdultMilestonePresentation(state: PetState): {
  title: string;
  description: string;
  reward: string;
  progress: number;
  target: number;
  completed: boolean;
} | null {
  if (!state.adultMilestone) {
    return null;
  }

  const details = ADULT_MILESTONE_DETAILS[state.adultMilestone];

  return {
    ...details,
    progress: state.adultMilestoneProgress,
    target: getAdultMilestoneTarget(state.adultMilestone),
    completed: state.adultMilestoneCompletedAt !== null,
  };
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

function applyStatusRules(state: PetState): PetState {
  if (isEgg(state)) {
    return {
      ...state,
      lifeState: 'egg',
      isSick: false,
      isSleeping: false,
      ageStage: 'baby',
      adultOutcome: null,
      adultMilestone: null,
      adultMilestoneProgress: 0,
      adultMilestoneCompletedAt: null,
    };
  }

  const lifeState = isDead(state) ? 'dead' : 'alive';
  const isSick = lifeState === 'dead'
    ? true
    : shouldBecomeSick({
        ...state,
        isSick: false,
      });

  return {
    ...state,
    lifeState,
    isSick,
    isSleeping: lifeState === 'dead' ? false : state.isSleeping,
    adultMilestone: lifeState === 'dead' ? state.adultMilestone : state.adultMilestone,
  };
}

function applyHealthRules(state: PetState, elapsedSteps: number): PetState {
  const healthPenalty = applyOutcomeHealthPenaltyModifier(
    state,
    countHealthRisks(state) * elapsedSteps,
    elapsedSteps,
  );
  return applyStatusRules({
    ...state,
    health: applyStatDelta(state.health, -healthPenalty),
  });
}

function applyCareTracking(state: PetState, elapsedSteps: number): PetState {
  if (state.lifeState === 'dead') {
    return state;
  }

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
  if (state.lifeState === 'egg') {
    return state;
  }

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

  if (state.lifeState === 'egg') {
    return alerts;
  }

  if (state.lifeState === 'dead') {
    alerts.push({
      code: 'dead',
      severity: 'critical',
      label: 'Pet passed on',
      message: 'This run has ended. Start over to hatch a new pet.',
    });

    return alerts;
  }

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
    title:
      alert.code === 'dead'
        ? `${petName} needs a new start`
        : `${petName} ${alert.code === 'sick' ? 'needs care' : 'needs attention'}`,
    body: alert.message,
  };
}

export function applyDecay(state: PetState, elapsedMs: number): PetState {
  if (state.lifeState === 'egg' || state.lifeState === 'dead') {
    return state;
  }

  const elapsedSteps = Math.max(0, Math.floor(elapsedMs / DECAY_STEP_MS));

  if (elapsedSteps === 0) {
    return state;
  }

  if (state.isSleeping) {
    const nextState = applyCareTracking(
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

    return withAdultMilestoneProgress(
      nextState,
      parseIsoTimestamp(state.lastUpdatedAt) + elapsedSteps * DECAY_STEP_MS,
      getAdultMilestoneStepProgressDelta(nextState, elapsedSteps),
    );
  }

  const nextState = applyCareTracking(
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

  return withAdultMilestoneProgress(
    nextState,
    parseIsoTimestamp(state.lastUpdatedAt) + elapsedSteps * DECAY_STEP_MS,
    getAdultMilestoneStepProgressDelta(nextState, elapsedSteps),
  );
}

export function deriveMood(state: PetState): PetMood {
  if (state.lifeState === 'egg') {
    return 'egg';
  }

  if (state.lifeState === 'dead') {
    return 'dead';
  }

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
  const normalizedState = applyStatusRules(state);

  if (action === 'hatch') {
    return createLivePetState(appliedAtMs, state.name);
  }

  if (action === 'restart') {
    return createDefaultPetState(appliedAtMs, state.name);
  }

  if (normalizedState.lifeState === 'egg') {
    return normalizedState;
  }

  if (normalizedState.lifeState === 'dead') {
    return normalizedState;
  }

  const finalizeAction = (candidateState: PetState): PetState => {
    const progressedState = withProgression(candidateState, appliedAtMs);
    const rewardedState = applyAdultMilestoneReward(
      progressedState,
      action,
      normalizedState,
    );

    return withAdultMilestoneProgress(
      applyStatusRules(rewardedState),
      appliedAtMs,
      getAdultMilestoneActionProgressDelta(normalizedState, progressedState, action),
    );
  };

  switch (action) {
    case 'feed':
      return finalizeAction(
        applyStatusRules({
          ...normalizedState,
          satiety: applyStatDelta(normalizedState.satiety, 22),
          cleanliness: applyStatDelta(normalizedState.cleanliness, -4),
          waste: applyStatDelta(
            normalizedState.waste,
            applyOutcomeActionStatModifier(normalizedState, 'feed', 'waste', 8),
          ),
          isSleeping: false,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
          careScore: clampCounter(normalizedState.careScore + 2),
        }),
      );
    case 'play':
      return finalizeAction(
        applyStatusRules({
          ...normalizedState,
          fun: applyStatDelta(
            normalizedState.fun,
            applyOutcomeActionStatModifier(normalizedState, 'play', 'fun', 24),
          ),
          satiety: applyStatDelta(normalizedState.satiety, -4),
          cleanliness: applyStatDelta(normalizedState.cleanliness, -5),
          energy: applyStatDelta(
            normalizedState.energy,
            applyOutcomeActionStatModifier(normalizedState, 'play', 'energy', -10),
          ),
          waste: applyStatDelta(normalizedState.waste, 4),
          isSleeping: false,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
          careScore: clampCounter(normalizedState.careScore + 2),
        }),
      );
    case 'clean':
      return finalizeAction(
        applyStatusRules({
          ...normalizedState,
          cleanliness: applyStatDelta(
            normalizedState.cleanliness,
            applyOutcomeActionStatModifier(normalizedState, 'clean', 'cleanliness', 28),
          ),
          waste: applyStatDelta(
            normalizedState.waste,
            applyOutcomeActionStatModifier(normalizedState, 'clean', 'waste', -36),
          ),
          health: applyStatDelta(normalizedState.health, 4),
          isSleeping: false,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
          careScore: clampCounter(normalizedState.careScore + 3),
        }),
      );
    case 'sleep':
      return finalizeAction(
        applyStatusRules({
          ...normalizedState,
          isSleeping: !normalizedState.isSleeping,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
          careScore: clampCounter(
            normalizedState.careScore +
              (normalizedState.energy <= LOW_NEED_THRESHOLD ? 2 : 1),
          ),
        }),
      );
    case 'heal':
      return finalizeAction(
        applyStatusRules({
          ...normalizedState,
          health: applyStatDelta(
            normalizedState.health,
            applyOutcomeActionStatModifier(normalizedState, 'heal', 'health', 18),
          ),
          fun: applyStatDelta(normalizedState.fun, -4),
          isSick: false,
          isSleeping: false,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
          careScore: clampCounter(
            normalizedState.careScore +
              (normalizedState.isSick || normalizedState.health <= LOW_HEALTH_THRESHOLD
                ? 4
                : 1),
          ),
        }),
      );
    default:
      return state;
  }
}

export function catchup(state: PetState, nowMs: number): PetState {
  const normalizedState = applyStatusRules(state);

  if (normalizedState.lifeState === 'egg' || normalizedState.lifeState === 'dead') {
    return normalizedState;
  }

  const elapsedMs = nowMs - parseIsoTimestamp(normalizedState.lastUpdatedAt);

  if (elapsedMs <= 0) {
    return withProgression(normalizedState, nowMs);
  }

  return withProgression(
    {
      ...applyDecay(normalizedState, elapsedMs),
      lastUpdatedAt: toIsoTimestamp(nowMs),
    },
    nowMs,
  );
}
