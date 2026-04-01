import { create } from 'zustand';

export type PetSimulationConfig = {
  decayStepMs: number;
  lowNeedThreshold: number;
  goodNeedThreshold: number;
  goodHealthThreshold: number;
  dirtyThreshold: number;
  cleanupAlertThreshold: number;
  highWasteThreshold: number;
  sicknessThreshold: number;
  lowHealthThreshold: number;
  lowWasteThreshold: number;
  childStageMs: number;
  teenStageMs: number;
  adultStageMs: number;
  awakeSatietyDecay: number;
  awakeFunDecay: number;
  awakeCleanlinessDecay: number;
  awakeEnergyDecay: number;
  awakeWasteDecay: number;
  sleepSatietyDecay: number;
  sleepFunDecay: number;
  sleepCleanlinessDecay: number;
  sleepEnergyRecovery: number;
  sleepWasteDecay: number;
  feedSatietyGain: number;
  feedCleanlinessCost: number;
  feedWasteGain: number;
  playFunGain: number;
  playSatietyCost: number;
  playCleanlinessCost: number;
  playEnergyCost: number;
  playWasteGain: number;
  cleanCleanlinessGain: number;
  cleanWasteReduction: number;
  cleanHealthGain: number;
  healHealthGain: number;
  healFunCost: number;
};

export type PetSimulationConfigKey = keyof PetSimulationConfig;

export const DEFAULT_PET_SIMULATION_CONFIG: PetSimulationConfig = {
  decayStepMs: 60_000,
  lowNeedThreshold: 20,
  goodNeedThreshold: 60,
  goodHealthThreshold: 70,
  dirtyThreshold: 20,
  cleanupAlertThreshold: 70,
  highWasteThreshold: 80,
  sicknessThreshold: 90,
  lowHealthThreshold: 35,
  lowWasteThreshold: 35,
  childStageMs: 60 * 60 * 1_000,
  teenStageMs: 6 * 60 * 60 * 1_000,
  adultStageMs: 24 * 60 * 60 * 1_000,
  awakeSatietyDecay: 2,
  awakeFunDecay: 2,
  awakeCleanlinessDecay: 1,
  awakeEnergyDecay: 3,
  awakeWasteDecay: 2,
  sleepSatietyDecay: 1,
  sleepFunDecay: 1,
  sleepCleanlinessDecay: 1,
  sleepEnergyRecovery: 4,
  sleepWasteDecay: 1,
  feedSatietyGain: 22,
  feedCleanlinessCost: 4,
  feedWasteGain: 8,
  playFunGain: 24,
  playSatietyCost: 4,
  playCleanlinessCost: 5,
  playEnergyCost: 10,
  playWasteGain: 4,
  cleanCleanlinessGain: 28,
  cleanWasteReduction: 36,
  cleanHealthGain: 4,
  healHealthGain: 18,
  healFunCost: 4,
};

export const PET_SIMULATION_CONFIG_FIELDS: Array<{
  key: PetSimulationConfigKey;
  label: string;
  step: number;
  min: number;
}> = [
  { key: 'decayStepMs', label: 'Tick ms', step: 1_000, min: 1_000 },
  { key: 'lowNeedThreshold', label: 'Low need', step: 1, min: 0 },
  { key: 'dirtyThreshold', label: 'Dirty', step: 1, min: 0 },
  { key: 'cleanupAlertThreshold', label: 'Cleanup alert', step: 1, min: 0 },
  { key: 'highWasteThreshold', label: 'High waste', step: 1, min: 0 },
  { key: 'sicknessThreshold', label: 'Sickness waste', step: 1, min: 0 },
  { key: 'lowHealthThreshold', label: 'Low health', step: 1, min: 0 },
  { key: 'awakeSatietyDecay', label: 'Awake satiety', step: 1, min: 0 },
  { key: 'awakeFunDecay', label: 'Awake fun', step: 1, min: 0 },
  { key: 'awakeEnergyDecay', label: 'Awake energy', step: 1, min: 0 },
  { key: 'awakeWasteDecay', label: 'Awake waste', step: 1, min: 0 },
  { key: 'sleepEnergyRecovery', label: 'Sleep energy', step: 1, min: 0 },
  { key: 'feedSatietyGain', label: 'Feed satiety', step: 1, min: 0 },
  { key: 'playFunGain', label: 'Play fun', step: 1, min: 0 },
  { key: 'cleanWasteReduction', label: 'Clean waste', step: 1, min: 0 },
  { key: 'healHealthGain', label: 'Heal health', step: 1, min: 0 },
  { key: 'childStageMs', label: 'Baby to child ms', step: 60_000, min: 60_000 },
  { key: 'teenStageMs', label: 'Child to teen ms', step: 60_000, min: 60_000 },
  { key: 'adultStageMs', label: 'Teen to adult ms', step: 60_000, min: 60_000 },
];

type PetSimulationConfigState = {
  config: PetSimulationConfig;
  setField: (key: PetSimulationConfigKey, value: number) => void;
  reset: () => void;
};

function clampConfigValue(key: PetSimulationConfigKey, value: number): number {
  const field = PET_SIMULATION_CONFIG_FIELDS.find((item) => item.key === key);
  const min = field?.min ?? 0;

  if (!Number.isFinite(value)) {
    return DEFAULT_PET_SIMULATION_CONFIG[key];
  }

  return Math.max(min, Math.round(value));
}

export const usePetSimulationConfigStore = create<PetSimulationConfigState>((set) => ({
  config: DEFAULT_PET_SIMULATION_CONFIG,
  setField(key, value) {
    set((state) => ({
      config: {
        ...state.config,
        [key]: clampConfigValue(key, value),
      },
    }));
  },
  reset() {
    set({
      config: DEFAULT_PET_SIMULATION_CONFIG,
    });
  },
}));

export function getPetSimulationConfig(): PetSimulationConfig {
  return usePetSimulationConfigStore.getState().config;
}
