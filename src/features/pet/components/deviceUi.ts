import type { PetLifeState, PetState } from '../model';

export type DeviceMenuActionId =
  | 'status'
  | 'hatch'
  | 'feed'
  | 'play'
  | 'heal'
  | 'clean'
  | 'sleep'
  | 'restart';

export type DeviceMenuAction = {
  id: DeviceMenuActionId;
  label: string;
  hint: string;
};

const EGG_MENU: DeviceMenuAction[] = [
  {
    id: 'status',
    label: 'STAT',
    hint: 'Check the shell and readiness.',
  },
  {
    id: 'hatch',
    label: 'HATCH',
    hint: 'Crack the shell and begin.',
  },
];

const ALIVE_MENU: DeviceMenuAction[] = [
  {
    id: 'status',
    label: 'STAT',
    hint: 'Check hunger and happiness.',
  },
  {
    id: 'feed',
    label: 'MEAL',
    hint: 'Serve a meal.',
  },
  {
    id: 'play',
    label: 'GAME',
    hint: 'Play the number game stand-in.',
  },
  {
    id: 'heal',
    label: 'MED',
    hint: 'Give medicine.',
  },
  {
    id: 'clean',
    label: 'WC',
    hint: 'Flush and clean up.',
  },
  {
    id: 'sleep',
    label: 'LITE',
    hint: 'Toggle rest mode.',
  },
  {
    id: 'restart',
    label: 'RST',
    hint: 'Start a new egg.',
  },
];

const DEAD_MENU: DeviceMenuAction[] = [
  {
    id: 'status',
    label: 'STAT',
    hint: 'Review the final condition.',
  },
  {
    id: 'restart',
    label: 'RST',
    hint: 'Start a new egg.',
  },
];

export function getDeviceMenuActions(
  lifeState: PetLifeState,
): DeviceMenuAction[] {
  switch (lifeState) {
    case 'egg':
      return EGG_MENU;
    case 'dead':
      return DEAD_MENU;
    default:
      return ALIVE_MENU;
  }
}

export function getHeartMeterCount(value: number): number {
  if (value >= 85) {
    return 4;
  }

  if (value >= 60) {
    return 3;
  }

  if (value >= 35) {
    return 2;
  }

  if (value >= 10) {
    return 1;
  }

  return 0;
}

export function getDeviceCareBits(state: PetState): Array<{
  label: string;
  active: boolean;
}> {
  return [
    {
      label: 'MED',
      active: state.isSick,
    },
    {
      label: 'WC',
      active: state.waste >= 70 || state.cleanliness <= 20,
    },
    {
      label: 'ZZ',
      active: state.isSleeping,
    },
    {
      label: 'CALL',
      active:
        state.lifeState === 'alive' &&
        (state.satiety <= 20 || state.fun <= 20 || state.energy <= 20),
    },
  ];
}
