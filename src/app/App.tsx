import { useEffect } from 'react';

import { PetControls } from '../features/pet/components/PetControls';
import { PetStatusPanel } from '../features/pet/components/PetStatusPanel';
import { usePetStore } from '../features/pet/store/petStore';

export function App() {
  const errorMessage = usePetStore((state) => state.errorMessage);
  const loadPet = usePetStore((state) => state.loadPet);
  const pet = usePetStore((state) => state.pet);
  const refresh = usePetStore((state) => state.refresh);
  const status = usePetStore((state) => state.status);

  useEffect(() => {
    void loadPet();

    const intervalId = window.setInterval(() => {
      refresh();
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadPet, refresh]);

  return (
    <main className="shell">
      <section className="hero-card">
        <p className="eyebrow">Desktop Pet Bootstrap</p>
        <h1>OpenGotchi</h1>
        <p className="hero-copy">
          A minimal Tauri desktop pet with a TypeScript simulation core and a
          narrow Rust persistence edge.
        </p>
      </section>

      <PetStatusPanel pet={pet} status={status} />
      <PetControls disabled={status === 'loading'} />

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </main>
  );
}
