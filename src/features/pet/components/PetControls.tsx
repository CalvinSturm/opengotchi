import { usePetStore } from '../store/petStore';
import {
  deriveRecommendedActions,
  type PetAction,
} from '../simulation/petSimulation';

type PetControlsProps = {
  disabled: boolean;
};

const ACTIONS = [
  {
    label: 'Feed',
    action: 'feed' as const,
    helper: 'Restore satiety.',
  },
  {
    label: 'Play',
    action: 'play' as const,
    helper: 'Raise fun and mood.',
  },
  {
    label: 'Clean',
    action: 'clean' as const,
    helper: 'Reduce waste buildup.',
  },
  {
    label: 'Heal',
    action: 'heal' as const,
    helper: 'Treat sickness.',
  },
  {
    label: 'Sleep',
    action: 'sleep' as const,
    helper: 'Recover energy.',
  },
  {
    label: 'Restart',
    action: 'restart' as const,
    helper: 'Begin a fresh run.',
  },
];

export function PetControls({ disabled }: PetControlsProps) {
  const applyPetAction = usePetStore((state) => state.applyPetAction);
  const pet = usePetStore((state) => state.pet);
  const lifeState = pet.lifeState;
  const recommendations = deriveRecommendedActions(pet).reduce<
    Partial<Record<PetAction, { priority: 'primary' | 'secondary'; reason: string }>>
  >((map, recommendation) => {
    map[recommendation.action] = {
      priority: recommendation.priority,
      reason: recommendation.reason,
    };

    return map;
  }, {});

  return (
    <section className="controls">
      <h2>Actions</h2>
      <div className="control-grid">
        {ACTIONS.map(({ label, action, helper }) => {
          const recommendation = recommendations[action];
          const isRestart = action === 'restart';

          return (
            <button
              key={action}
              className={[
                'control-button',
                isRestart ? 'control-button-danger' : '',
                recommendation?.priority === 'primary'
                  ? 'control-button-primary'
                  : recommendation?.priority === 'secondary'
                    ? 'control-button-secondary'
                    : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={
                disabled ||
                lifeState === 'egg' ||
                (lifeState === 'dead' && action !== 'restart') ||
                (lifeState === 'alive' && action === 'restart')
              }
              onClick={() => {
                void applyPetAction(action);
              }}
              type="button"
            >
              <span className="control-button-head">
                <span>{label}</span>
                {recommendation ? (
                  <span className="control-button-badge">
                    {recommendation.priority === 'primary' ? 'Now' : 'Soon'}
                  </span>
                ) : null}
              </span>
              <span className="control-button-copy">
                {recommendation?.reason ?? helper}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
