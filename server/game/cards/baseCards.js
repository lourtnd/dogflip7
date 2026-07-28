const CARD_TYPES = require("./cardTypes");

function createBaseCards() {
  const cards = [];

  for (let value = 0; value <= 12; value++) {
    cards.push({
      id: `number-${value}`,
      type: CARD_TYPES.NUMBER,
      value,
      image: `${value}.jpeg`,
    });
  }

  return cards;
}

module.exports = {
  createBaseCards,
};