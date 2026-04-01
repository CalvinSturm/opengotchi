import { usePetStore } from '../store/petStore';

type PetNurseryPanelProps = {
  disabled: boolean;
};

export function PetNurseryPanel({ disabled }: PetNurseryPanelProps) {
  const draftName = usePetStore((state) => state.draftName);
  const hatchPet = usePetStore((state) => state.hatchPet);
  const lifeState = usePetStore((state) => state.pet.lifeState);
  const setDraftName = usePetStore((state) => state.setDraftName);

  if (lifeState !== 'egg') {
    return null;
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Nursery</h2>
        <span className="status-chip">egg</span>
      </div>

      <p className="panel-copy">
        Name the egg, then hatch it to begin the run. Offline decay does not
        start until the pet is alive.
      </p>

      <label className="field-stack">
        <span>Pet Name</span>
        <input
          className="text-input"
          disabled={disabled}
          maxLength={32}
          onChange={(event) => {
            setDraftName(event.target.value);
          }}
          placeholder="Byte"
          type="text"
          value={draftName}
        />
      </label>

      <button
        className="control-button nursery-button"
        disabled={disabled}
        onClick={() => {
          void hatchPet();
        }}
        type="button"
      >
        Hatch Pet
      </button>
    </section>
  );
}
