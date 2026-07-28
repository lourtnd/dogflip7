const CARD_TYPES = require("./cardTypes");

const modifierDefinitions = [
  {
    key: "plus-10",
    label: "+10",
    operation: "ADD",
    value: 10,
    image: "plus-10.jpeg",
  },
  {
    key: "plus-6",
    label: "+6",
    operation: "ADD",
    value: 6,
    image: "plus-6.jpeg",
  },
  {
    key: "plus-2",
    label: "+2",
    operation: "ADD",
    value: 2,
    image: "plus-2.jpeg",
  },
  {
    key: "minus-10",
    label: "-10",
    operation: "ADD",
    value: -10,
    image: "minus-10.jpeg",
  },
  {
    key: "minus-6",
    label: "-6",
    operation: "ADD",
    value: -6,
    image: "minus-6.jpeg",
  },
  {
    key: "minus-2",
    label: "-2",
    operation: "ADD",
    value: -2,
    image: "minus-2.jpeg",
  },
  {
    key: "divide-2",
    label: "/2",
    operation: "DIVIDE",
    value: 2,
    image: "divide-2.jpeg",
  },
  {
    key: "multiply-3",
    label: "x3",
    operation: "MULTIPLY",
    value: 3,
    image: "multiply-3.jpeg",
  },
];

function createModifierCards(config = {}) {
  const cards = [];

  modifierDefinitions.forEach((modifier) => {
    const quantity = Number(config[modifier.key] ?? 0);

    for (let i = 1; i <= quantity; i++) {
      cards.push({
        id: `modifier-${modifier.key}-${i}`,
        type: CARD_TYPES.MODIFIER,
        ...modifier,
      });
    }
  });

  return cards;
}

module.exports = {
  createModifierCards,
  modifierDefinitions,
};