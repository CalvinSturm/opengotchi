import { parseIsoTimestamp, toIsoTimestamp, type PetState } from '../model';

export type PetAction = 'feed' | 'play' | 'clean' | 'sleep';
export type PetMood =
  | 'sleeping'
  | 'hungry'
  | 'dirty'
  | 'sleepy'
  | 'happy'
  | 'content'
  | 'sad';

const DECAY_STEP_MS = 60_000;

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function applyStatDelta(value: number, delta: number): number {
  return clampStat(value + delta);
}

export function applyDecay(state: PetState, elapsedMs: number): PetState {
  const elapsedSteps = Math.max(0, Math.floor(elapsedMs / DECAY_STEP_MS));

  if (elapsedSteps === 0) {
    return state;
  }

  if (state.isSleeping) {
    return {
      ...state,
      satiety: applyStatDelta(state.satiety, -elapsedSteps),
      fun: applyStatDelta(state.fun, -elapsedSteps),
      cleanliness: applyStatDelta(state.cleanliness, -elapsedSteps),
      energy: applyStatDelta(state.energy, elapsedSteps * 4),
    };
  }

  return {
    ...state,
    satiety: applyStatDelta(state.satiety, -elapsedSteps * 2),
    fun: applyStatDelta(state.fun, -elapsedSteps * 2),
    cleanliness: applyStatDelta(state.cleanliness, -elapsedSteps),
    energy: applyStatDelta(state.energy, -elapsedSteps * 3),
  };
}

export function deriveMood(state: PetState): PetMood {
  if (state.isSleeping) {
    return 'sleeping';
  }

  if (state.satiety <= 20) {
    return 'hungry';
  }

  if (state.cleanliness <= 20) {
    return 'dirty';
  }

  if (state.energy <= 20) {
    return 'sleepy';
  }

  const averageNeed =
    (state.satiety + state.fun + state.cleanliness + state.energy) / 4;

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
      return {
        ...state,
        satiety: applyStatDelta(state.satiety, 22),
        cleanliness: applyStatDelta(state.cleanliness, -4),
        isSleeping: false,
        lastUpdatedAt: toIsoTimestamp(appliedAtMs),
      };
    case 'play':
      return {
        ...state,
        fun: applyStatDelta(state.fun, 24),
        satiety: applyStatDelta(state.satiety, -4),
        cleanliness: applyStatDelta(state.cleanliness, -5),
        energy: applyStatDelta(state.energy, -10),
        isSleeping: false,
        lastUpdatedAt: toIsoTimestamp(appliedAtMs),
      };
    case 'clean':
      return {
        ...state,
        cleanliness: applyStatDelta(state.cleanliness, 28),
        isSleeping: false,
        lastUpdatedAt: toIsoTimestamp(appliedAtMs),
      };
    case 'sleep':
      return {
        ...state,
        isSleeping: !state.isSleeping,
        lastUpdatedAt: toIsoTimestamp(appliedAtMs),
      };
    default:
      return state;
  }
}

export function catchup(state: PetState, nowMs: number): PetState {
  const elapsedMs = nowMs - parseIsoTimestamp(state.lastUpdatedAt);

  if (elapsedMs <= 0) {
    return state;
  }

  return {
    ...applyDecay(state, elapsedMs),
    lastUpdatedAt: toIsoTimestamp(nowMs),
  };
}
