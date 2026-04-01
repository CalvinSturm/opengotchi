import { describe, expect, it } from 'vitest';

import { createEggPetState, createLivePetState } from '../model';
import {
  getDeviceCareBits,
  getDeviceMenuActions,
  getHeartMeterCount,
} from './deviceUi';

describe('device ui helpers', () => {
  it('maps life state to the simplified device menu', () => {
    expect(getDeviceMenuActions('egg').map((item) => item.id)).toEqual([
      'status',
      'hatch',
    ]);
    expect(getDeviceMenuActions('alive').map((item) => item.id)).toEqual([
      'status',
      'feed',
      'play',
      'heal',
      'clean',
      'sleep',
      'restart',
    ]);
    expect(getDeviceMenuActions('dead').map((item) => item.id)).toEqual([
      'status',
      'restart',
    ]);
  });

  it('derives heart meters and care bits for the lcd status screen', () => {
    expect(getHeartMeterCount(90)).toBe(4);
    expect(getHeartMeterCount(68)).toBe(3);
    expect(getHeartMeterCount(42)).toBe(2);
    expect(getHeartMeterCount(12)).toBe(1);
    expect(getHeartMeterCount(0)).toBe(0);

    const eggBits = getDeviceCareBits(createEggPetState(0));
    const liveBits = getDeviceCareBits({
      ...createLivePetState(0),
      satiety: 10,
      energy: 18,
      waste: 84,
      isSick: true,
    });

    expect(eggBits.every((bit) => bit.active === false)).toBe(true);
    expect(liveBits.filter((bit) => bit.active).map((bit) => bit.label)).toEqual([
      'MED',
      'WC',
      'CALL',
    ]);
  });
});
