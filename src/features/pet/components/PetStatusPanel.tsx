import type { PetAdultOutcome, PetState } from '../model';
import {
  deriveRecommendedActions,
  deriveStatusInsight,
  deriveMood,
  getAdultMilestonePresentation,
  type PetAlert,
} from '../simulation/petSimulation';

type PetStatusPanelProps = {
  pet: PetState;
  alerts: PetAlert[];
  status: 'idle' | 'loading' | 'ready' | 'error';
};

type PetStatKey =
  | 'health'
  | 'energy'
  | 'satiety'
  | 'cleanliness'
  | 'fun'
  | 'waste';

const STAT_LABELS: Array<{
  label: string;
  valueKey: PetStatKey;
  tone?: 'default' | 'danger';
}> = [
  { label: 'Vitality', valueKey: 'health' },
  { label: 'Energy', valueKey: 'energy' },
  { label: 'Satiety', valueKey: 'satiety' },
  { label: 'Cleanliness', valueKey: 'cleanliness' },
  { label: 'Fun', valueKey: 'fun' },
  { label: 'Waste', valueKey: 'waste', tone: 'danger' },
];

const OUTCOME_PRESENTATION: Record<
  PetAdultOutcome,
  {
    badge: string;
    title: string;
    description: string;
    toneClassName: string;
  }
> = {
  balanced: {
    badge: '◇',
    title: 'Balanced Adult',
    description: 'Steady care produced a calm, even-tempered companion.',
    toneClassName: 'evolution-card-balanced',
  },
  playful: {
    badge: '✦',
    title: 'Playful Adult',
    description: 'High spirits and strong care shaped a bright, energetic adult.',
    toneClassName: 'evolution-card-playful',
  },
  messy: {
    badge: '☄',
    title: 'Messy Adult',
    description: 'Neglect around cleanup left a scrappy, chaotic adult personality.',
    toneClassName: 'evolution-card-messy',
  },
  resilient: {
    badge: '⬢',
    title: 'Resilient Adult',
    description: 'Rough patches were overcome, leaving a tougher adult pet.',
    toneClassName: 'evolution-card-resilient',
  },
};

export function PetStatusPanel({ pet, alerts, status }: PetStatusPanelProps) {
  const mood = deriveMood(pet);
  const statusInsight = deriveStatusInsight(pet);
  const recommendedActions = deriveRecommendedActions(pet)
    .filter((recommendation) => recommendation.action !== 'hatch');
  const recommendationSummary = recommendedActions.length === 0
    ? 'No urgent action right now.'
    : recommendedActions
      .map((recommendation) => {
        const label = recommendation.action.charAt(0).toUpperCase() +
          recommendation.action.slice(1);

        return `${label}${recommendation.priority === 'primary' ? ' now' : ' soon'}`;
      })
      .join(' then ');
  const evolutionText = pet.lifeState === 'egg'
    ? 'Adult outcome unlocks after the run begins.'
    : pet.lifeState === 'dead'
      ? 'This run has ended.'
      : pet.adultOutcome
        ? `Adult outcome: ${pet.adultOutcome}.`
        : pet.ageStage === 'adult'
          ? 'Adult outcome is about to lock in.'
          : 'Adult outcome not locked in yet.';
  const outcomePresentation = pet.adultOutcome
    ? OUTCOME_PRESENTATION[pet.adultOutcome]
    : null;
  const milestonePresentation = getAdultMilestonePresentation(pet);
  const conditionLabel = pet.lifeState === 'dead'
    ? 'Ended'
    : pet.lifeState === 'egg'
      ? 'Nursery'
      : pet.isSick
        ? 'Sick'
        : pet.isSleeping
          ? 'Sleeping'
          : 'Stable';

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
          {pet.lifeState === 'dead'
            ? 'x_x'
            : pet.lifeState === 'egg'
              ? 'o_o'
            : pet.isSleeping
              ? 'Zz'
              : pet.isSick
                ? '×﹏×'
                : '◕◡◕'}
        </div>

        <div className="pet-summary">
          <h3>{pet.name}</h3>
          <p>
            Stage: <strong>{pet.ageStage}</strong>
          </p>
          <div className="condition-strip" aria-label="Current condition summary">
            <div>
              <span className="condition-label">Condition</span>
              <strong>{conditionLabel}</strong>
            </div>
            <div>
              <span className="condition-label">Mood</span>
              <strong>{mood}</strong>
            </div>
            <div>
              <span className="condition-label">Next up</span>
              <strong>{recommendationSummary}</strong>
            </div>
          </div>
          <section className="status-insight" aria-label="Current care guidance">
            <p className="status-insight-kicker">{statusInsight.headline}</p>
            <p>{statusInsight.detail}</p>
          </section>
          <p>{evolutionText}</p>
          <div className="pet-flags">
            <span className="pet-flag">{pet.ageStage}</span>
            <span
              className={`pet-flag ${pet.lifeState === 'dead' ? 'pet-flag-danger' : ''}`}
            >
              {pet.lifeState}
            </span>
            <span className="pet-flag">
              Care {pet.careScore} / Mistakes {pet.careMistakes}
            </span>
            <span className={`pet-flag ${pet.waste >= 70 ? 'pet-flag-danger' : ''}`}>
              Waste {pet.waste >= 70 ? 'High' : 'Okay'}
            </span>
            {pet.adultOutcome ? (
              <span className="pet-flag">{pet.adultOutcome}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="stat-list">
        {STAT_LABELS.map(({ label, valueKey, tone = 'default' }) => {
          const value = pet[valueKey];

          return (
            <div className="stat-row" key={valueKey}>
              <div className="stat-meta">
                <span>{label}</span>
                <span>{value}/100</span>
              </div>
              <div className="stat-track">
                <div
                  className={`stat-fill ${tone === 'danger' ? 'stat-fill-danger' : ''}`}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {outcomePresentation ? (
        <section
          className={`evolution-card ${outcomePresentation.toneClassName}`}
          aria-label="Adult evolution outcome"
        >
          <div className="evolution-badge" aria-hidden="true">
            {outcomePresentation.badge}
          </div>
          <div className="evolution-copy">
            <p className="evolution-kicker">Evolution Outcome</p>
            <h4>{outcomePresentation.title}</h4>
            <p>{outcomePresentation.description}</p>
          </div>
        </section>
      ) : null}

      {milestonePresentation ? (
        <section className="milestone-card" aria-label="Adult milestone progress">
          <div className="milestone-header">
            <div>
              <p className="evolution-kicker">Adult Milestone</p>
              <h4>{milestonePresentation.title}</h4>
            </div>
            <span className="pet-flag">
              {milestonePresentation.completed
                ? 'Completed'
                : `${milestonePresentation.progress}/${milestonePresentation.target}`}
            </span>
          </div>
          <p>{milestonePresentation.description}</p>
          <p className="milestone-reward">
            Reward: {milestonePresentation.reward}
          </p>
        </section>
      ) : null}

      <div className="alert-list">
        {alerts.length === 0 ? (
          <p className="alert-empty">No attention alerts.</p>
        ) : (
          alerts.map((alert) => (
            <p
              key={alert.code}
              className={`attention-alert attention-alert-${alert.severity}`}
            >
              <strong>{alert.label}:</strong> {alert.message}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
