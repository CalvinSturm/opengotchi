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
import {
  DEFAULT_PET_SIMULATION_CONFIG,
  type PetSimulationConfig,
} from './petSimulationConfig';

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
export type PetActionRecommendation = {
  action: PetAction;
  priority: 'primary' | 'secondary';
  reason: string;
};
export type PetStatusInsight = {
  headline: string;
  detail: string;
};
export type PetTickResult = {
  pet: PetState;
  consumedTicks: number;
};

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

function isHealthyRoutineStep(
  state: PetState,
  simulationConfig: PetSimulationConfig,
): boolean {
  return (
    state.satiety >= simulationConfig.goodNeedThreshold &&
    state.fun >= simulationConfig.goodNeedThreshold &&
    state.cleanliness >= simulationConfig.goodNeedThreshold &&
    state.energy >= 50 &&
    state.health >= simulationConfig.goodHealthThreshold + 5 &&
    state.waste <= simulationConfig.lowWasteThreshold - 5 &&
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

function getAdultMilestoneStepProgressDelta(
  state: PetState,
  elapsedSteps: number,
  simulationConfig: PetSimulationConfig,
): number {
  if (
    !isAdultAlive(state) ||
    !state.adultOutcome ||
    state.adultMilestoneCompletedAt ||
    (state.adultMilestone ?? deriveAdultMilestone(state.adultOutcome)) !== 'steady-routine'
  ) {
    return 0;
  }

  return isHealthyRoutineStep(state, simulationConfig) ? elapsedSteps : 0;
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

function pushRecommendation(
  recommendations: PetActionRecommendation[],
  recommendation: PetActionRecommendation,
): void {
  if (recommendations.some((item) => item.action === recommendation.action)) {
    return;
  }

  recommendations.push(recommendation);
}

export function deriveRecommendedActions(
  state: PetState,
  simulationConfig: PetSimulationConfig = DEFAULT_PET_SIMULATION_CONFIG,
): PetActionRecommendation[] {
  const recommendations: PetActionRecommendation[] = [];

  if (state.lifeState === 'egg') {
    return [
      {
        action: 'hatch',
        priority: 'primary',
        reason: 'Begin the run from the nursery.',
      },
    ];
  }

  if (state.lifeState === 'dead') {
    return [
      {
        action: 'restart',
        priority: 'primary',
        reason: 'Start a new run from a fresh egg.',
      },
    ];
  }

  if (state.isSick) {
    pushRecommendation(recommendations, {
      action: 'heal',
      priority: 'primary',
      reason: 'Condition is sick and needs treatment first.',
    });
  }

  if (
    state.waste >= simulationConfig.cleanupAlertThreshold ||
    state.cleanliness <= simulationConfig.dirtyThreshold
  ) {
    pushRecommendation(recommendations, {
      action: 'clean',
      priority: recommendations.length === 0 ? 'primary' : 'secondary',
      reason:
        state.waste >= simulationConfig.cleanupAlertThreshold
          ? 'Waste buildup is driving the current risk.'
          : 'Cleanliness is too low and needs attention.',
    });
  }

  if (!state.isSleeping && state.energy <= simulationConfig.lowNeedThreshold) {
    pushRecommendation(recommendations, {
      action: 'sleep',
      priority: recommendations.length === 0 ? 'primary' : 'secondary',
      reason: 'Energy is nearly depleted.',
    });
  }

  if (state.satiety <= simulationConfig.lowNeedThreshold) {
    pushRecommendation(recommendations, {
      action: 'feed',
      priority: recommendations.length === 0 ? 'primary' : 'secondary',
      reason: 'Satiety is overdue.',
    });
  }

  if (recommendations.length > 0) {
    return recommendations;
  }

  if (
    state.lifeState === 'alive' &&
    state.ageStage === 'adult' &&
    state.adultMilestone &&
    !state.adultMilestoneCompletedAt
  ) {
    switch (state.adultMilestone) {
      case 'showtime':
        pushRecommendation(recommendations, {
          action: 'play',
          priority: 'primary',
          reason: 'Play advances the current adult milestone.',
        });
        break;
      case 'spring-clean':
        pushRecommendation(recommendations, {
          action: 'clean',
          priority: 'primary',
          reason: 'Cleaning advances the current adult milestone.',
        });
        break;
      case 'recovery-run':
        pushRecommendation(recommendations, {
          action: 'heal',
          priority: 'primary',
          reason: 'Recovery progress comes from successful healing.',
        });
        break;
      case 'steady-routine':
        pushRecommendation(recommendations, {
          action: 'feed',
          priority: 'primary',
          reason: 'Consistent care keeps the routine milestone moving.',
        });
        break;
      default:
        break;
    }
  }

  if (recommendations.length === 0 && state.fun <= 35) {
    pushRecommendation(recommendations, {
      action: 'play',
      priority: 'secondary',
      reason: 'Fun is falling behind.',
    });
  }

  return recommendations;
}

export function deriveStatusInsight(state: PetState): PetStatusInsight {
  return deriveStatusInsightWithConfig(state, DEFAULT_PET_SIMULATION_CONFIG);
}

export function deriveStatusInsightWithConfig(
  state: PetState,
  simulationConfig: PetSimulationConfig,
): PetStatusInsight {
  if (state.lifeState === 'egg') {
    return {
      headline: 'Nursery phase',
      detail: 'Name the egg and hatch it to begin the run. Decay is paused until then.',
    };
  }

  if (state.lifeState === 'dead') {
    return {
      headline: 'Run ended',
      detail: 'This pet has passed on. Restart to begin a new run from a fresh egg.',
    };
  }

  const recommendations = deriveRecommendedActions(state, simulationConfig);
  const primaryRecommendation = recommendations.find(
    (recommendation) => recommendation.priority === 'primary',
  );

  if (state.isSick) {
    if (state.waste >= simulationConfig.cleanupAlertThreshold) {
      return {
        headline: 'Condition: sick',
        detail: 'Waste buildup made the pet sick. Heal first, then clean before the condition spirals again.',
      };
    }

    if (state.cleanliness <= simulationConfig.dirtyThreshold) {
      return {
        headline: 'Condition: sick',
        detail: 'Poor hygiene pushed the pet into a sick condition. Heal now and clean soon after.',
      };
    }

    return {
      headline: 'Condition: sick',
      detail: 'The pet needs treatment now. Stabilize the condition before spending time on lower-priority actions.',
    };
  }

  if (state.waste >= simulationConfig.cleanupAlertThreshold) {
    return {
      headline: 'Cleanup is overdue',
      detail: 'Waste is the biggest current risk. Clean now to reduce the chance of sickness.',
    };
  }

  if (!state.isSleeping && state.energy <= simulationConfig.lowNeedThreshold) {
    return {
      headline: 'Energy is critical',
      detail: 'Sleep should come next. Low energy is contributing to the current risk stack.',
    };
  }

  if (state.satiety <= simulationConfig.lowNeedThreshold) {
    return {
      headline: 'Satiety is low',
      detail: 'Feed the pet soon before neglect starts converting into bigger condition problems.',
    };
  }

  if (
    state.lifeState === 'alive' &&
    state.ageStage === 'adult' &&
    state.adultMilestone &&
    !state.adultMilestoneCompletedAt &&
    primaryRecommendation
  ) {
    return {
      headline: 'Adult goal in progress',
      detail: primaryRecommendation.reason,
    };
  }

  if (state.isSleeping) {
    return {
      headline: 'Resting',
      detail: 'Sleep is restoring energy and slowing decay. Wake the pet when you are ready to act again.',
    };
  }

  return {
    headline: 'Condition: stable',
    detail: primaryRecommendation?.reason ??
      'No urgent problems right now. Keep the routine balanced to avoid avoidable condition swings.',
  };
}

export function deriveAgeStage(
  startedAt: string,
  nowMs: number,
  simulationConfig: PetSimulationConfig = DEFAULT_PET_SIMULATION_CONFIG,
): PetAgeStage {
  const elapsedLifetimeMs = Math.max(0, nowMs - parseIsoTimestamp(startedAt));

  if (elapsedLifetimeMs >= simulationConfig.adultStageMs) {
    return 'adult';
  }

  if (elapsedLifetimeMs >= simulationConfig.teenStageMs) {
    return 'teen';
  }

  if (elapsedLifetimeMs >= simulationConfig.childStageMs) {
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
  return countHealthRisksWithConfig(state, DEFAULT_PET_SIMULATION_CONFIG);
}

function countHealthRisksWithConfig(
  state: PetState,
  simulationConfig: PetSimulationConfig,
): number {
  let riskCount = 0;

  if (state.satiety <= simulationConfig.lowNeedThreshold) {
    riskCount += 1;
  }

  if (state.cleanliness <= simulationConfig.dirtyThreshold) {
    riskCount += 1;
  }

  if (state.waste >= simulationConfig.highWasteThreshold) {
    riskCount += 1;
  }

  if (!state.isSleeping && state.energy <= simulationConfig.lowNeedThreshold) {
    riskCount += 1;
  }

  if (state.isSick) {
    riskCount += 2;
  }

  return riskCount;
}

function shouldBecomeSick(
  state: PetState,
  simulationConfig: PetSimulationConfig,
): boolean {
  return (
    state.isSick ||
    state.health <= simulationConfig.lowHealthThreshold ||
    state.cleanliness <= 10 ||
    state.waste >= simulationConfig.sicknessThreshold
  );
}

function applyStatusRules(
  state: PetState,
  simulationConfig: PetSimulationConfig,
): PetState {
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
      }, simulationConfig);

  return {
    ...state,
    lifeState,
    isSick,
    isSleeping: lifeState === 'dead' ? false : state.isSleeping,
    adultMilestone: lifeState === 'dead' ? state.adultMilestone : state.adultMilestone,
  };
}

function applyHealthRules(
  state: PetState,
  elapsedSteps: number,
  simulationConfig: PetSimulationConfig,
): PetState {
  const healthPenalty = applyOutcomeHealthPenaltyModifier(
    state,
    countHealthRisksWithConfig(state, simulationConfig) * elapsedSteps,
    elapsedSteps,
  );
  return applyStatusRules({
    ...state,
    health: applyStatDelta(state.health, -healthPenalty),
  }, simulationConfig);
}

function applyCareTracking(
  state: PetState,
  elapsedSteps: number,
  simulationConfig: PetSimulationConfig,
): PetState {
  if (state.lifeState === 'dead') {
    return state;
  }

  let careScoreDelta = 0;
  let careMistakesDelta = 0;

  if (
    state.satiety >= simulationConfig.goodNeedThreshold &&
    state.fun >= simulationConfig.goodNeedThreshold &&
    state.cleanliness >= simulationConfig.goodNeedThreshold &&
    (state.energy >= simulationConfig.goodNeedThreshold || state.isSleeping) &&
    state.health >= simulationConfig.goodHealthThreshold &&
    state.waste <= simulationConfig.lowWasteThreshold &&
    !state.isSick
  ) {
    careScoreDelta += elapsedSteps * 2;
  }

  if (state.isSick) {
    careMistakesDelta += elapsedSteps * 2;
  }

  if (state.satiety <= simulationConfig.lowNeedThreshold) {
    careMistakesDelta += elapsedSteps;
  }

  if (state.cleanliness <= simulationConfig.dirtyThreshold) {
    careMistakesDelta += elapsedSteps;
  }

  if (!state.isSleeping && state.energy <= simulationConfig.lowNeedThreshold) {
    careMistakesDelta += elapsedSteps;
  }

  if (state.waste >= simulationConfig.cleanupAlertThreshold) {
    careMistakesDelta += elapsedSteps;
  }

  if (state.health <= simulationConfig.lowHealthThreshold) {
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
  simulationConfig: PetSimulationConfig,
  adjustment?: {
    careScoreDelta?: number;
    careMistakesDelta?: number;
  },
): PetState {
  if (state.lifeState === 'egg') {
    return state;
  }

  const nextAgeStage = deriveAgeStage(state.startedAt, nowMs, simulationConfig);
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
  return deriveAlertsWithConfig(state, DEFAULT_PET_SIMULATION_CONFIG);
}

export function deriveAlertsWithConfig(
  state: PetState,
  simulationConfig: PetSimulationConfig,
): PetAlert[] {
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

  if (state.isSick || state.health <= simulationConfig.lowHealthThreshold) {
    alerts.push({
      code: 'sick',
      severity: 'critical',
      label: 'Needs medicine',
      message: state.isSick
        ? 'Your pet feels sick and needs treatment.'
        : 'Health is dangerously low and needs care.',
    });
  }

  if (state.waste >= simulationConfig.cleanupAlertThreshold) {
    alerts.push({
      code: 'needs-cleanup',
      severity: state.waste >= simulationConfig.highWasteThreshold ? 'critical' : 'warning',
      label: 'Cleanup needed',
      message: 'Waste has built up. Cleaning is overdue.',
    });
  }

  if (state.cleanliness <= simulationConfig.dirtyThreshold) {
    alerts.push({
      code: 'dirty',
      severity: 'warning',
      label: 'Dirty',
      message: 'Cleanliness is low and the pet needs washing.',
    });
  }

  if (state.satiety <= simulationConfig.lowNeedThreshold) {
    alerts.push({
      code: 'hungry',
      severity: 'warning',
      label: 'Hungry',
      message: 'Satiety is low. Feeding is overdue.',
    });
  }

  if (!state.isSleeping && state.energy <= simulationConfig.lowNeedThreshold) {
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

export function applyDecay(
  state: PetState,
  elapsedMs: number,
  simulationConfig: PetSimulationConfig = DEFAULT_PET_SIMULATION_CONFIG,
): PetState {
  if (state.lifeState === 'egg' || state.lifeState === 'dead') {
    return state;
  }

  const elapsedSteps = Math.max(0, Math.floor(elapsedMs / simulationConfig.decayStepMs));

  if (elapsedSteps === 0) {
    return state;
  }

  if (state.isSleeping) {
    const nextState = applyCareTracking(
      applyHealthRules(
        {
          ...state,
          satiety: applyStatDelta(state.satiety, -elapsedSteps * simulationConfig.sleepSatietyDecay),
          fun: applyStatDelta(state.fun, -elapsedSteps * simulationConfig.sleepFunDecay),
          cleanliness: applyStatDelta(
            state.cleanliness,
            -elapsedSteps * simulationConfig.sleepCleanlinessDecay,
          ),
          energy: applyStatDelta(
            state.energy,
            elapsedSteps * simulationConfig.sleepEnergyRecovery,
          ),
          waste: applyStatDelta(
            state.waste,
            applyOutcomeWasteDecayModifier(
              state,
              elapsedSteps * simulationConfig.sleepWasteDecay,
            ),
          ),
        },
        elapsedSteps,
        simulationConfig,
      ),
      elapsedSteps,
      simulationConfig,
    );

    return withAdultMilestoneProgress(
      nextState,
      parseIsoTimestamp(state.lastUpdatedAt) + elapsedSteps * simulationConfig.decayStepMs,
      getAdultMilestoneStepProgressDelta(nextState, elapsedSteps, simulationConfig),
    );
  }

  const nextState = applyCareTracking(
    applyHealthRules(
      {
        ...state,
        satiety: applyStatDelta(
          state.satiety,
          -elapsedSteps * simulationConfig.awakeSatietyDecay,
        ),
        fun: applyStatDelta(state.fun, -elapsedSteps * simulationConfig.awakeFunDecay),
        cleanliness: applyStatDelta(
          state.cleanliness,
          -elapsedSteps * simulationConfig.awakeCleanlinessDecay,
        ),
        energy: applyStatDelta(
          state.energy,
          -elapsedSteps * simulationConfig.awakeEnergyDecay,
        ),
        waste: applyStatDelta(
          state.waste,
          applyOutcomeWasteDecayModifier(
            state,
            elapsedSteps * simulationConfig.awakeWasteDecay,
          ),
        ),
      },
      elapsedSteps,
      simulationConfig,
    ),
    elapsedSteps,
    simulationConfig,
  );

  return withAdultMilestoneProgress(
    nextState,
    parseIsoTimestamp(state.lastUpdatedAt) + elapsedSteps * simulationConfig.decayStepMs,
    getAdultMilestoneStepProgressDelta(nextState, elapsedSteps, simulationConfig),
  );
}

export function deriveMood(
  state: PetState,
  simulationConfig: PetSimulationConfig = DEFAULT_PET_SIMULATION_CONFIG,
): PetMood {
  if (state.lifeState === 'egg') {
    return 'egg';
  }

  if (state.lifeState === 'dead') {
    return 'dead';
  }

  if (state.isSleeping) {
    return 'sleeping';
  }

  if (state.isSick || state.health <= simulationConfig.lowHealthThreshold) {
    return 'sick';
  }

  if (state.satiety <= simulationConfig.lowNeedThreshold) {
    return 'hungry';
  }

  if (
    state.cleanliness <= simulationConfig.dirtyThreshold ||
    state.waste >= simulationConfig.highWasteThreshold
  ) {
    return 'dirty';
  }

  if (state.energy <= simulationConfig.lowNeedThreshold) {
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
  simulationConfig: PetSimulationConfig = DEFAULT_PET_SIMULATION_CONFIG,
): PetState {
  const normalizedState = applyStatusRules(state, simulationConfig);

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
    const progressedState = withProgression(candidateState, appliedAtMs, simulationConfig);
    const rewardedState = applyAdultMilestoneReward(
      progressedState,
      action,
      normalizedState,
    );

    return withAdultMilestoneProgress(
      applyStatusRules(rewardedState, simulationConfig),
      appliedAtMs,
      getAdultMilestoneActionProgressDelta(normalizedState, progressedState, action),
    );
  };

  switch (action) {
    case 'feed':
      return finalizeAction(
        applyStatusRules({
          ...normalizedState,
          satiety: applyStatDelta(normalizedState.satiety, simulationConfig.feedSatietyGain),
          cleanliness: applyStatDelta(
            normalizedState.cleanliness,
            -simulationConfig.feedCleanlinessCost,
          ),
          waste: applyStatDelta(
            normalizedState.waste,
            applyOutcomeActionStatModifier(
              normalizedState,
              'feed',
              'waste',
              simulationConfig.feedWasteGain,
            ),
          ),
          isSleeping: false,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
          careScore: clampCounter(normalizedState.careScore + 2),
        }, simulationConfig),
      );
    case 'play':
      return finalizeAction(
        applyStatusRules({
          ...normalizedState,
          fun: applyStatDelta(
            normalizedState.fun,
            applyOutcomeActionStatModifier(
              normalizedState,
              'play',
              'fun',
              simulationConfig.playFunGain,
            ),
          ),
          satiety: applyStatDelta(normalizedState.satiety, -simulationConfig.playSatietyCost),
          cleanliness: applyStatDelta(
            normalizedState.cleanliness,
            -simulationConfig.playCleanlinessCost,
          ),
          energy: applyStatDelta(
            normalizedState.energy,
            applyOutcomeActionStatModifier(
              normalizedState,
              'play',
              'energy',
              -simulationConfig.playEnergyCost,
            ),
          ),
          waste: applyStatDelta(normalizedState.waste, simulationConfig.playWasteGain),
          isSleeping: false,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
          careScore: clampCounter(normalizedState.careScore + 2),
        }, simulationConfig),
      );
    case 'clean':
      return finalizeAction(
        applyStatusRules({
          ...normalizedState,
          cleanliness: applyStatDelta(
            normalizedState.cleanliness,
            applyOutcomeActionStatModifier(
              normalizedState,
              'clean',
              'cleanliness',
              simulationConfig.cleanCleanlinessGain,
            ),
          ),
          waste: applyStatDelta(
            normalizedState.waste,
            applyOutcomeActionStatModifier(
              normalizedState,
              'clean',
              'waste',
              -simulationConfig.cleanWasteReduction,
            ),
          ),
          health: applyStatDelta(normalizedState.health, simulationConfig.cleanHealthGain),
          isSleeping: false,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
          careScore: clampCounter(normalizedState.careScore + 3),
        }, simulationConfig),
      );
    case 'sleep':
      return finalizeAction(
        applyStatusRules({
          ...normalizedState,
          isSleeping: !normalizedState.isSleeping,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
          careScore: clampCounter(
            normalizedState.careScore +
              (normalizedState.energy <= simulationConfig.lowNeedThreshold ? 2 : 1),
          ),
        }, simulationConfig),
      );
    case 'heal':
      return finalizeAction(
        applyStatusRules({
          ...normalizedState,
          health: applyStatDelta(
            normalizedState.health,
            applyOutcomeActionStatModifier(
              normalizedState,
              'heal',
              'health',
              simulationConfig.healHealthGain,
            ),
          ),
          fun: applyStatDelta(normalizedState.fun, -simulationConfig.healFunCost),
          isSick: false,
          isSleeping: false,
          lastUpdatedAt: toIsoTimestamp(appliedAtMs),
          careScore: clampCounter(
            normalizedState.careScore +
              (normalizedState.isSick ||
              normalizedState.health <= simulationConfig.lowHealthThreshold
                ? 4
                : 1),
          ),
        }, simulationConfig),
      );
    default:
      return state;
  }
}

export function catchup(
  state: PetState,
  nowMs: number,
  simulationConfig: PetSimulationConfig = DEFAULT_PET_SIMULATION_CONFIG,
): PetState {
  return tickPet(state, nowMs, simulationConfig).pet;
}

export function tickPet(
  state: PetState,
  nowMs: number,
  simulationConfig: PetSimulationConfig = DEFAULT_PET_SIMULATION_CONFIG,
): PetTickResult {
  const normalizedState = applyStatusRules(state, simulationConfig);

  if (normalizedState.lifeState === 'egg' || normalizedState.lifeState === 'dead') {
    return {
      pet: normalizedState,
      consumedTicks: 0,
    };
  }

  const elapsedMs = nowMs - parseIsoTimestamp(normalizedState.lastUpdatedAt);

  if (elapsedMs <= 0) {
    return {
      pet: withProgression(normalizedState, nowMs, simulationConfig),
      consumedTicks: 0,
    };
  }

  const consumedTicks = Math.floor(elapsedMs / simulationConfig.decayStepMs);

  if (consumedTicks === 0) {
    return {
      pet: withProgression(normalizedState, nowMs, simulationConfig),
      consumedTicks: 0,
    };
  }

  const consumedElapsedMs = consumedTicks * simulationConfig.decayStepMs;

  return {
    pet: withProgression(
      {
        ...applyDecay(normalizedState, consumedElapsedMs, simulationConfig),
        lastUpdatedAt: toIsoTimestamp(
          parseIsoTimestamp(normalizedState.lastUpdatedAt) + consumedElapsedMs,
        ),
      },
      nowMs,
      simulationConfig,
    ),
    consumedTicks,
  };
}

function getNextAgeStageTransitionAt(
  state: Pick<PetState, 'startedAt' | 'ageStage'>,
  simulationConfig: PetSimulationConfig,
): number | null {
  const startedAtMs = parseIsoTimestamp(state.startedAt);

  switch (state.ageStage) {
    case 'baby':
      return startedAtMs + simulationConfig.childStageMs;
    case 'child':
      return startedAtMs + simulationConfig.teenStageMs;
    case 'teen':
      return startedAtMs + simulationConfig.adultStageMs;
    case 'adult':
      return null;
    default:
      return null;
  }
}

export function getNextSimulationWakeDelayMs(
  state: Pick<PetState, 'lifeState' | 'lastUpdatedAt' | 'startedAt' | 'ageStage'>,
  nowMs: number,
  simulationConfig: PetSimulationConfig = DEFAULT_PET_SIMULATION_CONFIG,
): number | null {
  if (state.lifeState === 'egg' || state.lifeState === 'dead') {
    return null;
  }

  const nextDecayAt =
    parseIsoTimestamp(state.lastUpdatedAt) + simulationConfig.decayStepMs;
  const nextAgeStageTransitionAt = getNextAgeStageTransitionAt(state, simulationConfig);
  const candidates = [nextDecayAt, nextAgeStageTransitionAt].filter(
    (value): value is number => value !== null,
  );

  if (candidates.length === 0) {
    return null;
  }

  return Math.max(0, Math.min(...candidates) - nowMs);
}
