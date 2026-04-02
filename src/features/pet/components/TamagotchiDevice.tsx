import { useEffect, useMemo, useState } from 'react';

import shellPhoto from '../../../assets/tamagotchi-shell-photo.jpg';
import type { PetState } from '../model';
import { deriveStatusInsightWithConfig } from '../simulation/petSimulation';
import { usePetSimulationConfigStore } from '../simulation/petSimulationConfig';
import { usePetStore } from '../store/petStore';
import {
  getDeviceCareBits,
  getDeviceMenuActions,
  getHeartMeterCount,
  type DeviceMenuActionId,
} from './deviceUi';

type TamagotchiDeviceProps = {
  disabled: boolean;
};

type DeviceView = 'pet' | 'status';

type PixelTone = 'primary' | 'accent';
type PixelSprite = Record<string, PixelTone>;

const STATUS_COPY: Record<DeviceMenuActionId, string> = {
  status: 'Status check.',
  hatch: 'Crack the egg and start raising the pet.',
  feed: 'Meal time.',
  play: 'Play time.',
  heal: 'Medicine.',
  clean: 'Toilet and cleanup.',
  sleep: 'Lights off.',
  restart: 'Start a new egg.',
};

const SPRITES: Record<string, PixelSprite> = {
  egg: spriteFromRows([
    '................',
    '......++++......',
    '....++####++....',
    '...+##++++##+...',
    '..+##+....+##+..',
    '..##+......+##..',
    '.+#+..+##+..+#+.',
    '.##..######..##.',
    '.##..##++##..##.',
    '.##..##++##..##.',
    '.+#+..####..+#+.',
    '..##+......+##..',
    '..+##+....+##+..',
    '...+##++++##+...',
    '....++####++....',
    '......++++......',
  ]),
  hatch: spriteFromRows([
    '................',
    '......++++......',
    '....++####++....',
    '...+##+..+##+...',
    '..+##......##+..',
    '..##..+##+..##..',
    '.+#+.+####+.+#+.',
    '.##..##++##..##.',
    '.##..##++##..##.',
    '.##..######..##.',
    '.+#+..####..+#+.',
    '..##+......+##..',
    '..+##+.+..+##+..',
    '...+##++++##+...',
    '....++....++....',
    '......+##+......',
  ]),
  idle: spriteFromRows([
    '................',
    '................',
    '......####......',
    '.....######.....',
    '....##+##+##....',
    '....########....',
    '....##.##.##....',
    '....########....',
    '.....######.....',
    '....##.##.##....',
    '...##..##..##...',
    '...##..##..##...',
    '....+##..##+....',
    '.....##..##.....',
    '....##....##....',
    '................',
  ]),
  eat: spriteFromRows([
    '................',
    '................',
    '......####......',
    '.....######.....',
    '....##+##+##....',
    '....########....',
    '....##.##.##....',
    '....########....',
    '.....######.....',
    '....##.##.##....',
    '...##..##..##...',
    '...##..##..##...',
    '....+##..##+....',
    '.....##..##.....',
    '..++++....##....',
    '..####+++.......',
  ]),
  play: spriteFromRows([
    '................',
    '.......++.......',
    '......####......',
    '.....######.....',
    '....##+##+##....',
    '....########....',
    '....##.##.##....',
    '....########....',
    '.....######.....',
    '...###.##.###...',
    '..##..####..##..',
    '..##...##...##..',
    '....+##..##+....',
    '.....##..##.....',
    '....##....##....',
    '........++......',
  ]),
  medicine: spriteFromRows([
    '................',
    '................',
    '......####......',
    '.....######.....',
    '....##+##+##....',
    '....########....',
    '....##.##.##....',
    '....########....',
    '.....######.....',
    '....##.##.##....',
    '...##..##..##...',
    '...##..##..##...',
    '....+##..##+....',
    '.....##..##.....',
    '......##........',
    '.....######.....',
  ]),
  clean: spriteFromRows([
    '................',
    '........++......',
    '......####......',
    '.....######.....',
    '....##+##+##....',
    '....########....',
    '....##.##.##....',
    '....########....',
    '.....######.....',
    '....##.##.##....',
    '...##..##..##...',
    '...##..##..##...',
    '....+##..##+....',
    '.....##..##.....',
    '....++....++....',
    '...++++..++++...',
  ]),
  sleep: spriteFromRows([
    '................',
    '............++..',
    '......####..##..',
    '.....######.....',
    '....##+##+##....',
    '....########....',
    '....##....##....',
    '....##.##.##....',
    '.....######.....',
    '....##.##.##....',
    '...##..##..##...',
    '...##..##..##...',
    '....+##..##+....',
    '.....##..##.....',
    '....########....',
    '................',
  ]),
  sick: spriteFromRows([
    '................',
    '................',
    '......####......',
    '.....######.....',
    '....##+##+##....',
    '....########....',
    '....##+..+##....',
    '....########....',
    '.....######.....',
    '....##.##.##....',
    '...##..##..##...',
    '...##..##..##...',
    '....+##..##+....',
    '.....##..##.....',
    '....##....##....',
    '................',
  ]),
  dead: spriteFromRows([
    '................',
    '................',
    '......####......',
    '.....######.....',
    '....##+##+##....',
    '....########....',
    '....##+..+##....',
    '....########....',
    '.....######.....',
    '....##++++##....',
    '...##..##..##...',
    '...##..##..##...',
    '....+##..##+....',
    '.....##..##.....',
    '....##....##....',
    '................',
  ]),
};

export function TamagotchiDevice({ disabled }: TamagotchiDeviceProps) {
  const applyPetAction = usePetStore((state) => state.applyPetAction);
  const draftName = usePetStore((state) => state.draftName);
  const hatchPet = usePetStore((state) => state.hatchPet);
  const pet = usePetStore((state) => state.pet);
  const saveState = usePetStore((state) => state.saveState);
  const setDraftName = usePetStore((state) => state.setDraftName);
  const simulationConfig = usePetSimulationConfigStore((state) => state.config);

  const [selectedActionId, setSelectedActionId] = useState<DeviceMenuActionId>('status');
  const [deviceView, setDeviceView] = useState<DeviceView>('pet');
  const [recentActionId, setRecentActionId] = useState<DeviceMenuActionId | null>(null);

  const menuActions = useMemo(
    () => getDeviceMenuActions(pet.lifeState),
    [pet.lifeState],
  );
  const selectedIndex = Math.max(
    0,
    menuActions.findIndex((action) => action.id === selectedActionId),
  );
  const selectedAction = menuActions[selectedIndex] ?? menuActions[0];
  const statusInsight = deriveStatusInsightWithConfig(pet, simulationConfig);
  const careBits = getDeviceCareBits(pet, simulationConfig);
  const attentionCount = careBits.filter((bit) => bit.active).length;
  const saveStateLabel = saveState === 'saving'
    ? 'SAVE'
    : saveState === 'dirty'
      ? 'UNSVD'
      : attentionCount > 0
        ? `CALL ${attentionCount}`
        : 'OK';
  const saveNotice = saveState === 'saving'
    ? 'Saving the latest pet state to disk.'
    : saveState === 'dirty'
      ? 'Unsaved changes: the app will retry and your latest state is still only in memory.'
      : null;

  useEffect(() => {
    if (!menuActions.some((action) => action.id === selectedActionId)) {
      setSelectedActionId(menuActions[0]?.id ?? 'status');
    }
  }, [menuActions, selectedActionId]);

  useEffect(() => {
    if (!recentActionId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRecentActionId(null);
    }, 1_200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [recentActionId]);

  const spriteKey = resolveSpriteKey(pet, deviceView, recentActionId);
  const lcdMessage = deviceView === 'status'
    ? 'STAT'
    : recentActionId
      ? `>${selectedAction?.label ?? 'ACT'}`
      : statusInsight.headline.toUpperCase();

  const handleCycle = () => {
    if (disabled || menuActions.length === 0) {
      return;
    }

    const nextIndex = (selectedIndex + 1) % menuActions.length;

    setSelectedActionId(menuActions[nextIndex]!.id);
    setDeviceView('pet');
    setRecentActionId(null);
  };

  const handleCancel = () => {
    setDeviceView('pet');
    setRecentActionId(null);
  };

  const handleConfirm = async () => {
    if (disabled || !selectedAction) {
      return;
    }

    if (selectedAction.id === 'status') {
      setDeviceView((currentView) => (currentView === 'status' ? 'pet' : 'status'));
      setRecentActionId(null);
      return;
    }

    if (selectedAction.id === 'hatch') {
      await hatchPet();
      setDeviceView('pet');
      setRecentActionId('hatch');
      return;
    }

    const petAction = mapToPetAction(selectedAction.id);

    if (!petAction) {
      return;
    }

    await applyPetAction(petAction);
    setDeviceView('pet');
    setRecentActionId(selectedAction.id);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isEditableTarget || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'a':
          event.preventDefault();
          handleCycle();
          break;
        case 'b':
          event.preventDefault();
          void handleConfirm();
          break;
        case 'c':
          event.preventDefault();
          handleCancel();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleCancel, handleConfirm, handleCycle]);

  return (
    <section className="device-stage">
      <div className="device-caption">
        <p className="eyebrow">Original Gen 2 Direction</p>
        <h1>OpenGotchi</h1>
        <p className="hero-copy">
          Three-button device flow: `A` cycles icons, `B` confirms, `C` backs
          out. The current sim maps into `STAT`, `MEAL`, `GAME`, `MED`, `WC`,
          `LITE`, and `RST`.
        </p>
      </div>

      <div className="device-shell" role="group" aria-label="Tamagotchi device">
        <div className="device-photo-frame">
          <img
            alt=""
            aria-hidden="true"
            className="device-photo"
            src={shellPhoto}
          />

          <div className="device-screen-window">
            <div className="lcd-screen">
              <div className="lcd-pattern-band lcd-pattern-band-top" aria-hidden="true" />

              {deviceView === 'status' ? (
                <DeviceStatusView pet={pet} />
              ) : (
                <div className="lcd-pet-view">
                  <div className="lcd-callouts" aria-hidden="true">
                    {careBits
                      .filter((bit) => bit.active)
                      .slice(0, 2)
                      .map((bit) => (
                        <span key={bit.label}>{bit.label}</span>
                      ))}
                  </div>
                  <PixelSpriteView sprite={SPRITES[spriteKey]} />
                </div>
              )}

              <div className="lcd-pattern-band lcd-pattern-band-bottom" aria-hidden="true" />
            </div>

            <div className="lcd-overlay-meta">
              <span>{pet.name}</span>
              <span>{pet.lifeState === 'alive' ? pet.ageStage : pet.lifeState}</span>
            </div>

            <div className="lcd-overlay-footer">
              <span>{lcdMessage}</span>
              <span>{saveStateLabel}</span>
            </div>

            <div className="lcd-menu-strip" aria-label="Current menu icons">
              {menuActions.map((action) => (
                <span
                  key={action.id}
                  className={`lcd-menu-item ${selectedAction?.id === action.id ? 'lcd-menu-item-active' : ''}`}
                >
                  {action.label}
                </span>
              ))}
            </div>
          </div>

          <div className="device-button-hitzones" aria-label="Three hardware buttons">
            <button
              className="device-button-hitzone device-button-left"
              disabled={disabled}
              onClick={handleCycle}
              type="button"
              aria-label="A button: cycle menu"
            />
            <button
              className="device-button-hitzone device-button-middle"
              disabled={disabled}
              onClick={() => {
                void handleConfirm();
              }}
              type="button"
              aria-label="B button: confirm"
            />
            <button
              className="device-button-hitzone device-button-right"
              onClick={handleCancel}
              type="button"
              aria-label="C button: cancel"
            />
          </div>
        </div>

        <p className="device-help">
          {deviceView === 'status'
            ? 'Press C to return to the pet screen.'
            : selectedAction
              ? STATUS_COPY[selectedAction.id]
              : statusInsight.detail}
        </p>

        {saveNotice ? (
          <p
            className={`device-save-notice ${
              saveState === 'dirty' ? 'device-save-notice-dirty' : 'device-save-notice-saving'
            }`}
          >
            {saveNotice}
          </p>
        ) : null}

        {pet.lifeState === 'egg' ? (
          <label className="device-nameplate">
            <span>NAME</span>
            <input
              className="device-name-input"
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
        ) : (
          <p className="device-note">{statusInsight.detail}</p>
        )}
      </div>
    </section>
  );
}

function DeviceStatusView({ pet }: { pet: PetState }) {
  const hungryHearts = getHeartMeterCount(pet.satiety);
  const happyHearts = getHeartMeterCount(pet.fun);
  const simulationConfig = usePetSimulationConfigStore((state) => state.config);
  const careBits = getDeviceCareBits(pet, simulationConfig);

  return (
    <div className="lcd-status-view">
      <StatusRow label="HUNGRY" value={hungryHearts} />
      <StatusRow label="HAPPY" value={happyHearts} />

      <div className="lcd-bits">
        {careBits.map((bit) => (
          <span
            key={bit.label}
            className={`lcd-bit ${bit.active ? 'lcd-bit-active' : ''}`}
          >
            {bit.label}
          </span>
        ))}
      </div>

      <div className="lcd-mini-stats">
        <span>VIT {Math.round(pet.health / 10)}</span>
        <span>ENG {Math.round(pet.energy / 10)}</span>
        <span>CARE {pet.careScore}</span>
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="lcd-status-row">
      <span>{label}</span>
      <div className="lcd-heart-row" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={`${label}-${index}`}
            className={`lcd-heart ${index < value ? 'lcd-heart-filled' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

function PixelSpriteView({ sprite }: { sprite: PixelSprite }) {
  return (
    <svg
      aria-hidden="true"
      className="pixel-sprite"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      {Object.entries(sprite).map(([key, tone]) => {
        const [x, y] = key.split(':').map(Number);

        return (
          <rect
            key={key}
            fill={tone === 'accent' ? '#3e5d4b' : '#182f26'}
            height="1"
            width="1"
            x={x}
            y={y}
          />
        );
      })}
    </svg>
  );
}

function resolveSpriteKey(
  pet: PetState,
  deviceView: DeviceView,
  recentActionId: DeviceMenuActionId | null,
): keyof typeof SPRITES {
  if (deviceView === 'status') {
    return pet.lifeState === 'egg' ? 'egg' : 'idle';
  }

  if (pet.lifeState === 'dead') {
    return 'dead';
  }

  if (pet.lifeState === 'egg') {
    return recentActionId === 'hatch' ? 'hatch' : 'egg';
  }

  if (recentActionId === 'feed') {
    return 'eat';
  }

  if (recentActionId === 'play') {
    return 'play';
  }

  if (recentActionId === 'heal') {
    return 'medicine';
  }

  if (recentActionId === 'clean') {
    return 'clean';
  }

  if (recentActionId === 'sleep' || pet.isSleeping) {
    return 'sleep';
  }

  if (pet.isSick) {
    return 'sick';
  }

  return 'idle';
}

function mapToPetAction(
  actionId: DeviceMenuActionId,
): 'feed' | 'play' | 'heal' | 'clean' | 'sleep' | 'restart' | null {
  switch (actionId) {
    case 'feed':
    case 'play':
    case 'heal':
    case 'clean':
    case 'sleep':
    case 'restart':
      return actionId;
    default:
      return null;
  }
}

function spriteFromRows(rows: string[]): PixelSprite {
  return rows.reduce<PixelSprite>((pixels, row, y) => {
    row.split('').forEach((cell, x) => {
      if (cell === '#') {
        pixels[`${x}:${y}`] = 'primary';
      }

      if (cell === '+') {
        pixels[`${x}:${y}`] = 'accent';
      }
    });

    return pixels;
  }, {});
}
