const { createBaseCards } = require("../cards/baseCards");
const { createModifierCards } = require("../cards/modifierCards");
const { createActionCards } = require("../cards/actionCards");
const {
  DEFAULT_DECK_CONFIG,
} = require("../defaultDeckConfig");

function shuffle(cards) {
  const shuffled = [...cards];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(
      Math.random() * (i + 1)
    );

    [shuffled[i], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[i],
    ];
  }

  return shuffled;
}

function createDeck({
  modes = [],
  deckConfig = DEFAULT_DECK_CONFIG,
} = {}) {
  const baseCards = createBaseCards();

  const modifierCards = createModifierCards(
    deckConfig.modifiers
  );

  const actionCards = createActionCards(
    deckConfig.actions
  );

  console.log("CONFIG :", deckConfig);
  console.log("Base :", baseCards.length);
  console.log("Modificateurs :", modifierCards.length);
  console.log("Actions :", actionCards.length);
  console.log(
    "Total :",
    baseCards.length +
      modifierCards.length +
      actionCards.length
  );

  let cards = [
    ...baseCards,
    ...modifierCards,
    ...actionCards,
  ];

  for (const mode of modes) {
    if (mode.cards) {
      cards = [...cards, ...mode.cards];
    }
  }

  return shuffle(cards);
}

module.exports = {
  createDeck,
  shuffle,
};