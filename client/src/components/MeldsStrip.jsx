import { cardLabel, cardColor } from '../cardUtils.js';

export default function MeldsStrip({ melds, canAdd, onAdd }) {
  if (melds.length === 0) {
    return <div className="melds-strip empty">No melds on the table yet</div>;
  }
  return (
    <div className="melds-strip">
      {melds.map(meld => (
        <div className="meld-group" key={meld.id}>
          <div className="who">{meld.ownerName}</div>
          <div className="meld-cards">
            {canAdd && <button className="add-btn" onClick={() => onAdd(meld.id, 'start')}>+</button>}
            {meld.cards.map(c => (
              <div key={c.id} className={`mc ${cardColor(c)}`}>{cardLabel(c)}</div>
            ))}
            {canAdd && <button className="add-btn" onClick={() => onAdd(meld.id, 'end')}>+</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
