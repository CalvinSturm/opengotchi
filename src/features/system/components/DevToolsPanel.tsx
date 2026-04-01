import {
  PET_SIMULATION_CONFIG_FIELDS,
  usePetSimulationConfigStore,
} from '../../pet/simulation/petSimulationConfig';

type DevToolsPanelProps = {
  open: boolean;
};

export function DevToolsPanel({ open }: DevToolsPanelProps) {
  const config = usePetSimulationConfigStore((state) => state.config);
  const reset = usePetSimulationConfigStore((state) => state.reset);
  const setField = usePetSimulationConfigStore((state) => state.setField);

  if (!open) {
    return null;
  }

  return (
    <section className="panel dev-panel">
      <div className="panel-header">
        <h2>Dev Tools</h2>
        <span className="status-chip">`</span>
      </div>

      <p className="panel-copy">
        Runtime tuning for simulation constants. Changes apply immediately to
        tick timing, alerts, and future actions.
      </p>

      <div className="dev-grid">
        {PET_SIMULATION_CONFIG_FIELDS.map((field) => (
          <label className="dev-field" key={field.key}>
            <span>{field.label}</span>
            <input
              className="text-input dev-input"
              min={field.min}
              onChange={(event) => {
                setField(field.key, Number(event.target.value));
              }}
              step={field.step}
              type="number"
              value={config[field.key]}
            />
          </label>
        ))}
      </div>

      <div className="control-grid compact-grid">
        <button
          className="control-button"
          onClick={() => {
            reset();
          }}
          type="button"
        >
          Reset Constants
        </button>
      </div>
    </section>
  );
}
