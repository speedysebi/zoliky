import { useState } from 'react';
import { CardSVG } from '../cardUtils.jsx';

export default function Hand({ cards, selectedIds, onToggle, onReorder }) {
  const [draggedId, setDraggedId] = useState(null);

  const handleDragStart = e => {
    setDraggedId(e.currentTarget.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = e => {
    e.preventDefault();
    const targetId = e.currentTarget.dataset.id;
    if (draggedId && draggedId !== targetId && onReorder) {
      onReorder(draggedId, targetId);
    }
    setDraggedId(null);
  };

  const handleDragEnd = () => setDraggedId(null);

  return (
    <div className="your-hand">
      {cards.map(card => {
        const idx = selectedIds.indexOf(card.id);
        return (
          <button
            key={card.id}
            data-id={card.id}
            className={`card-btn ${idx >= 0 ? 'selected' : ''} ${draggedId === card.id ? 'dragging' : ''}`}
            onClick={() => onToggle(card.id)}
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          >
            <CardSVG card={card} width={46} height={64} />
            {idx >= 0 && <span className="sel-order">{idx + 1}</span>}
          </button>
        );
      })}
    </div>
  );
}
