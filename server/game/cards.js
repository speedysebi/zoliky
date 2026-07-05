export const SUITS = ['S', 'H', 'D', 'C'];

export function createDeck() {
  const deck = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ id: `${suit}${rank}-${copy}`, suit, rank, joker: false });
      }
    }
  }
  for (let i = 0; i < 6; i++) {
    deck.push({ id: `JOKER-${i}`, suit: null, rank: null, joker: true });
  }
  return deck;
}

export function shuffle(deck, rand = Math.random) {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function cut(deck, index) {
  return [...deck.slice(index), ...deck.slice(0, index)];
}

export function cardPoints(card) {
  if (card.joker) return 50;
  if (card.rank === 1 || card.rank >= 10) return 10;
  return card.rank;
}
