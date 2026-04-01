import type { PetState } from '../model';
import { deriveMood } from '../simulation/petSimulation';

type PetStatusPanelProps = {
  pet: PetState;
  status: 'idle' | 'loading' | 'ready' | 'error';
};

type PetStatKey = 'satiety' | 'fun' | 'cleanliness' | 'energy';

const STAT_LABELS: Array<[label: string, valueKey: PetStatKey]> = [
  ['Satiety', 'satiety'],
  ['Fun', 'fun'],
  ['Cleanliness', 'cleanliness'],
  ['Energy', 'energy'],
];

export function PetStatusPanel({ pet, status }: PetStatusPanelProps) {
  const mood = deriveMood(pet);

  return (
    <section className="panel" aria-live="polite">
      <div className="panel-header">
        <h2>Status</h2>
        <span className="status-chip">
          {status === 'loading' ? 'syncing' : mood}
        </span>
      </div>

      <div className="pet-card">
        <div className="pet-avatar" aria-hidden="true">
          {pet.isSleeping ? 'Zz' : '◕◡◕'}
        </div>

        <div className="pet-summary">
          <h3>{pet.name}</h3>
          <p>
            Mood: <strong>{mood}</strong>
          </p>
          <p>{pet.isSleeping ? 'Resting quietly.' : 'Ready for the next action.'}</p>
        </div>
      </div>

      <div className="stat-list">
        {STAT_LABELS.map(([label, valueKey]) => {
          const value = pet[valueKey];

          return (
            <div className="stat-row" key={valueKey}>
              <div className="stat-meta">
                <span>{label}</span>
                <span>{value}/100</span>
              </div>
              <div className="stat-track">
                <div
                  className="stat-fill"
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
