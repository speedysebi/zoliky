const SUIT_SYMBOLS = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_LABELS = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

export function cardLabel(card) {
  if (!card) return '';
  if (card.joker) return '★';
  return `${RANK_LABELS[card.rank] || card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function cardColor(card) {
  if (!card) return 'black';
  if (card.joker) return 'joker';
  return card.suit === 'H' || card.suit === 'D' ? 'red' : 'black';
}
