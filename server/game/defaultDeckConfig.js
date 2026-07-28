const DEFAULT_DECK_CONFIG = {
  actions: {
    discard: 1,
    swap: 1,
    "flip-3": 1,
    "unflip-3": 1,
    "one-more": 1,
    "second-chance": 1,
    freeze: 1,
    steal: 1,
  },

  modifiers: {
    "plus-10": 1,
    "plus-6": 1,
    "plus-2": 1,
    "minus-10": 1,
    "minus-6": 1,
    "minus-2": 1,
    "divide-2": 1,
    "multiply-3": 0,
  },
};

module.exports = {
  DEFAULT_DECK_CONFIG,
};