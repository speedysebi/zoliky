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

export function CardSVG({ card, width = 46, height = 64 }) {
  if (!card) return null;
  const ratio = height / 64;
  const isRed = card.suit === 'H' || card.suit === 'D';
  const color = isRed ? '#c0392b' : '#222';

  if (card.joker) {
    return (
      <svg viewBox="0 0 46 64" width={width} height={height} style={{ display: 'block' }}>
        <rect width="46" height="64" fill="#f4f0e4" stroke="#ccc" strokeWidth="1" rx="4" />
        <circle cx="23" cy="32" r="18" fill={color} opacity="0.1" />
        <text x="23" y="36" fontSize="28" fontWeight="bold" textAnchor="middle" fill={color}>★</text>
      </svg>
    );
  }

  const rank = RANK_LABELS[card.rank] || card.rank;
  return (
    <svg viewBox="0 0 46 64" width={width} height={height} style={{ display: 'block' }}>
      <rect width="46" height="64" fill="#f4f0e4" stroke="#ccc" strokeWidth="1" rx="4" />
      <text x="4" y="12" fontSize="10" fontWeight="bold" fill={color}>{rank}</text>
      <text x="4" y="24" fontSize="14" fill={color}>{SUIT_SYMBOLS[card.suit]}</text>
      <text x="42" y="12" fontSize="10" fontWeight="bold" fill={color} textAnchor="end">{rank}</text>
      <text x="42" y="24" fontSize="14" fill={color} textAnchor="end">{SUIT_SYMBOLS[card.suit]}</text>
    </svg>
  );
}
