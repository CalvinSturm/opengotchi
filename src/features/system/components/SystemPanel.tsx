import { useSettingsStore } from '../../settings/store/settingsStore';

export function SystemPanel() {
  const errorMessage = useSettingsStore((state) => state.errorMessage);
  const notificationsEnabled = useSettingsStore(
    (state) => state.settings.notificationsEnabled,
  );
  const alwaysOnTop = useSettingsStore((state) => state.settings.alwaysOnTop);
  const revealSaveFolder = useSettingsStore((state) => state.revealSaveFolder);
  const sendTestNotification = useSettingsStore(
    (state) => state.sendTestNotification,
  );
  const quitApp = useSettingsStore((state) => state.quitApp);
  const setAlwaysOnTopEnabled = useSettingsStore(
    (state) => state.setAlwaysOnTopEnabled,
  );
  const setNotificationsEnabled = useSettingsStore(
    (state) => state.setNotificationsEnabled,
  );
  const status = useSettingsStore((state) => state.status);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>System</h2>
        <span className="status-chip">
          {status === 'loading' ? 'syncing' : 'desktop'}
        </span>
      </div>

      <div className="settings-list">
        <label className="toggle-row">
          <span>Always On Top</span>
          <input
            checked={alwaysOnTop}
            onChange={(event) => {
              void setAlwaysOnTopEnabled(event.target.checked);
            }}
            type="checkbox"
          />
        </label>

        <label className="toggle-row">
          <span>Notifications</span>
          <input
            checked={notificationsEnabled}
            onChange={(event) => {
              void setNotificationsEnabled(event.target.checked);
            }}
            type="checkbox"
          />
        </label>
      </div>

      <div className="control-grid compact-grid">
        <button
          className="control-button"
          onClick={() => {
            void revealSaveFolder();
          }}
          type="button"
        >
          Reveal Saves
        </button>
        <button
          className="control-button"
          onClick={() => {
            void sendTestNotification();
          }}
          type="button"
        >
          Test Notice
        </button>
        <button
          className="control-button control-button-danger"
          onClick={() => {
            void quitApp();
          }}
          type="button"
        >
          Quit App
        </button>
      </div>

      {errorMessage ? <p className="inline-error">{errorMessage}</p> : null}
    </section>
  );
}
