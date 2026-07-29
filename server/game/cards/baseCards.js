const CARD_TYPES = require("./cardTypes");

function createBaseCards() {
  const cards = [];

  for (let value = 0; value <= 12; value++) {
    const count = value === 0 ? 1 : value;

    for (let i = 1; i <= count; i++) {
      cards.push({
        id: `number-${value}-${i}`,
        type: CARD_TYPES.NUMBER,
        value,
        image: `${value}.jpeg`,
      });
    }
  }

  return cards;
}

module.exports = {
  createBaseCards,
};