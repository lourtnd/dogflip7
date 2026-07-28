import { useState } from "react";
import socket from "../services/socket";

const DEFAULT_ACTIONS = {
  discard: 1,
  swap: 1,
  "flip-3": 1,
  "unflip-3": 1,
  "one-more": 1,
  "second-chance": 1,
  freeze: 1,
  steal: 1,
};

const DEFAULT_MODIFIERS = {
  "plus-10": 1,
  "plus-6": 1,
  "plus-2": 1,
  "minus-10": 1,
  "minus-6": 1,
  "minus-2": 1,
  "divide-2": 1,
  "multiply-3": 1,
};

function GameSettings({
  roomCode,
  initialDeckConfig,
  onClose,
}) {
  const [deckConfig, setDeckConfig] = useState(() => ({
    actions: {
      ...DEFAULT_ACTIONS,
      ...(initialDeckConfig?.actions ?? {}),
    },

    modifiers: {
      ...DEFAULT_MODIFIERS,
      ...(initialDeckConfig?.modifiers ?? {}),
    },
  }));

  function updateQuantity(category, key, value) {
    const parsedValue = Number(value);

    const quantity = Number.isNaN(parsedValue)
      ? 0
      : Math.max(0, Math.min(10, parsedValue));

    setDeckConfig((current) => ({
      ...current,

      [category]: {
        ...current[category],
        [key]: quantity,
      },
    }));
  }

  function saveSettings() {
    console.log("Configuration envoyée :", deckConfig);

    socket.emit("updateDeckConfig", {
      roomCode,
      deckConfig,
    });

    onClose();
  }

  return (
    <div className="game-settings-overlay">
      <div className="game-settings-modal">
        <h2>Paramètres du paquet</h2>

        <h3>Cartes Action</h3>

        {Object.entries(deckConfig.actions).map(
          ([key, quantity]) => (
            <div key={key} className="setting-row">
              <span>{key}</span>

              <button
                type="button"
                onClick={() =>
                  updateQuantity(
                    "actions",
                    key,
                    quantity - 1
                  )
                }
              >
                -
              </button>

              <input
                type="number"
                min="0"
                max="10"
                value={quantity}
                onChange={(event) =>
                  updateQuantity(
                    "actions",
                    key,
                    event.target.value
                  )
                }
              />

              <button
                type="button"
                onClick={() =>
                  updateQuantity(
                    "actions",
                    key,
                    quantity + 1
                  )
                }
              >
                +
              </button>
            </div>
          )
        )}

        <h3>Cartes Modificateur</h3>

        {Object.entries(deckConfig.modifiers).map(
          ([key, quantity]) => (
            <div key={key} className="setting-row">
              <span>{key}</span>

              <button
                type="button"
                onClick={() =>
                  updateQuantity(
                    "modifiers",
                    key,
                    quantity - 1
                  )
                }
              >
                -
              </button>

              <input
                type="number"
                min="0"
                max="10"
                value={quantity}
                onChange={(event) =>
                  updateQuantity(
                    "modifiers",
                    key,
                    event.target.value
                  )
                }
              />

              <button
                type="button"
                onClick={() =>
                  updateQuantity(
                    "modifiers",
                    key,
                    quantity + 1
                  )
                }
              >
                +
              </button>
            </div>
          )
        )}

        <div className="settings-buttons">
          <button type="button" onClick={saveSettings}>
            Enregistrer
          </button>

          <button type="button" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameSettings;