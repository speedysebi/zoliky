import { cardLabel, cardColor } from '../cardUtils.js';

export default function Hand({ cards, selectedIds, onToggle }) {
  return (
    <div className="your-hand">
      {cards.map(card => {
        const idx = selectedIds.indexOf(card.id);
        return (
          <button
            key={card.id}
            className={`card ${cardColor(card)} ${idx >= 0 ? 'selected' : ''}`}
            onClick={() => onToggle(card.id)}
          >
            {cardLabel(card)}
            {idx >= 0 && <span className="sel-order">{idx + 1}</span>}
          </button>
        );
      })}
    </div>
  );
}
