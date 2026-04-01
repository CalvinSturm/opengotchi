import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_PET_SIMULATION_CONFIG,
  usePetSimulationConfigStore,
} from './petSimulationConfig';

describe('pet simulation config store', () => {
  beforeEach(() => {
    usePetSimulationConfigStore.setState({
      config: DEFAULT_PET_SIMULATION_CONFIG,
    });
  });

  it('updates and resets runtime constants', () => {
    usePetSimulationConfigStore.getState().setField('decayStepMs', 15_000);
    usePetSimulationConfigStore.getState().setField('feedSatietyGain', 40);

    expect(usePetSimulationConfigStore.getState().config.decayStepMs).toBe(15_000);
    expect(usePetSimulationConfigStore.getState().config.feedSatietyGain).toBe(40);

    usePetSimulationConfigStore.getState().reset();

    expect(usePetSimulationConfigStore.getState().config).toEqual(
      DEFAULT_PET_SIMULATION_CONFIG,
    );
  });
});
