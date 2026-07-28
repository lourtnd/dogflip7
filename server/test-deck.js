const { createDeck } = require("./game/core/deck");

const deck = createDeck();

console.log("Nombre de cartes :", deck.length);
console.log(deck.slice(0, 10));