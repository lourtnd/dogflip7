const CARD_TYPES = require("./cardTypes");

const actionDefinitions = [
  {
    key: "discard",
    label: "Discard",
    effect: "DISCARD",
    image: "discard.jpeg",
  },
  {
    key: "swap",
    label: "Swap",
    effect: "SWAP",
    image: "swap.jpeg",
  },
  {
    key: "flip-3",
    label: "Flip 3",
    effect: "FLIP_3",
    image: "flip-3.jpeg",
  },
  {
    key: "unflip-3",
    label: "Unflip 3",
    effect: "UNFLIP_3",
    image: "unflip-3.jpeg",
  },
  {
    key: "one-more",
    label: "One More",
    effect: "ONE_MORE",
    image: "one-more.jpeg",
  },
  {
    key: "second-chance",
    label: "Second Chance",
    effect: "SECOND_CHANCE",
    image: "second-chance.jpeg",
  },
  {
    key: "freeze",
    label: "Freeze",
    effect: "FREEZE",
    image: "freeze.jpeg",
  },
  {
    key: "steal",
    label: "Steal",
    effect: "STEAL",
    image: "steal.jpeg",
  },
];

function createActionCards(config = {}) {
  const cards = [];

  actionDefinitions.forEach((action) => {
    const quantity = Number(config[action.key] ?? 0);

    for (let i = 1; i <= quantity; i++) {
      cards.push({
        id: `action-${action.key}-${i}`,
        type: CARD_TYPES.ACTION,
        ...action,
      });
    }
  });

  return cards;
}

module.exports = {
  createActionCards,
  actionDefinitions,
};