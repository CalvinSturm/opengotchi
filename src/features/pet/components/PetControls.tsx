import { usePetStore } from '../store/petStore';

type PetControlsProps = {
  disabled: boolean;
};

const ACTIONS = [
  { label: 'Feed', action: 'feed' as const },
  { label: 'Play', action: 'play' as const },
  { label: 'Clean', action: 'clean' as const },
  { label: 'Heal', action: 'heal' as const },
  { label: 'Sleep', action: 'sleep' as const },
  { label: 'Restart', action: 'restart' as const },
];

export function PetControls({ disabled }: PetControlsProps) {
  const applyPetAction = usePetStore((state) => state.applyPetAction);
  const lifeState = usePetStore((state) => state.pet.lifeState);

  return (
    <section className="controls">
      <h2>Actions</h2>
      <div className="control-grid">
        {ACTIONS.map(({ label, action }) => (
          <button
            key={action}
            className="control-button"
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
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
