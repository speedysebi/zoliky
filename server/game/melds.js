const INVALID = { valid: false, type: null, points: 0, pure: false };

function pointsForValue(v) {
  // v is a sequence position value 1..14 (1 = ace-low, 14 = ace-high) or a set rank 1..13
  if (v === 1 || v >= 10) return 10;
  return v;
}

function validateSequence(cards) {
  const nonJokers = cards.filter(c => !c.joker);
  if (nonJokers.length === 0) return INVALID;
  const suit = nonJokers[0].suit;
  if (!nonJokers.every(c => c.suit === suit)) return INVALID;
  for (let i = 1; i < cards.length; i++) {
    if (cards[i].joker && cards[i - 1].joker) return INVALID;
  }
  for (const aceValue of [1, 14]) {
    const val = c => (c.rank === 1 ? aceValue : c.rank);
    const anchorIdx = cards.findIndex(c => !c.joker);
    const base = val(cards[anchorIdx]) - anchorIdx;
    const maxValue = aceValue === 14 ? 14 : 13;
    if (base < 1 || base + cards.length - 1 > maxValue) continue;
    let ok = true;
    for (let i = 0; i < cards.length; i++) {
      if (!cards[i].joker && val(cards[i]) !== base + i) { ok = false; break; }
    }
    if (!ok) continue;
    let points = 0;
    for (let i = 0; i < cards.length; i++) points += pointsForValue(base + i);
    return { valid: true, type: 'sequence', points, pure: nonJokers.length === cards.length };
  }
  return INVALID;
}

function validateSet(cards) {
  if (cards.length > 4) return INVALID;
  const nonJokers = cards.filter(c => !c.joker);
  if (nonJokers.length === 0) return INVALID;
  const rank = nonJokers[0].rank;
  if (!nonJokers.every(c => c.rank === rank)) return INVALID;
  const suits = new Set(nonJokers.map(c => c.suit));
  if (suits.size !== nonJokers.length) return INVALID;
  return {
    valid: true,
    type: 'set',
    points: pointsForValue(rank) * cards.length,
    pure: nonJokers.length === cards.length
  };
}

export function validateMeld(cards) {
  if (!Array.isArray(cards) || cards.length < 3) return INVALID;
  const asSet = validateSet(cards);
  if (asSet.valid) return asSet;
  return validateSequence(cards);
}
