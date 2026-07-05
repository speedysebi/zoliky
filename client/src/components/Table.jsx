import { useState, useMemo } from 'react';
import Hand from './Hand.jsx';
import MeldsStrip from './MeldsStrip.jsx';
import { cardLabel, cardColor } from '../cardUtils.js';

export default function Table({ state, send }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [staged, setStaged] = useState([]); // [{ids, cards, hidden?}]
  const [goOut, setGoOut] = useState(false);
  const [goOutAdditions, setGoOutAdditions] = useState([]);

  const you = state.players.find(p => p.id === state.youId);
  const isYourTurn = state.currentPlayerId === state.youId;
  const opponents = useMemo(() => {
    const idx = state.players.findIndex(p => p.id === state.youId);
    return [...state.players.slice(idx + 1), ...state.players.slice(0, idx)];
  }, [state.players, state.youId]);

  const stagedIds = staged.flatMap(m => m.ids);
  // while going out, the closing card is playable as part of the plan
  const playableCards = goOut && state.closingCard
    ? [...state.hand, state.closingCard]
    : state.hand;
  const handCards = playableCards.filter(c => !stagedIds.includes(c.id));

  const toggle = id =>
    setSelectedIds(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]));

  const reset = () => { setSelectedIds([]); setStaged([]); setGoOut(false); setGoOutAdditions([]); };

  const stageMeld = () => {
    if (selectedIds.length < 3) return;
    const cards = selectedIds.map(id => playableCards.find(c => c.id === id));
    setStaged(s => [...s, { ids: selectedIds, cards }]);
    setSelectedIds([]);
  };

  const layMelds = () => {
    send('meld', { melds: staged.filter(m => !m.hidden).map(m => m.ids) });
    setStaged(s => s.filter(m => m.hidden));
  };

  const addToMeld = (meldId, where) => {
    if (selectedIds.length === 0) return;
    if (goOut) {
      // buffer the addition locally until the go-out plan is confirmed
      setGoOutAdditions(a => [...a, { meldId, cardIds: selectedIds, where }]);
      setStaged(s => [...s, { ids: selectedIds, cards: [], hidden: true }]);
    } else {
      send('addToMeld', { meldId, cardIds: selectedIds, where });
    }
    setSelectedIds([]);
  };

  const discard = () => {
    if (selectedIds.length !== 1) return;
    if (goOut) {
      send('draw', {
        source: 'closing',
        plan: {
          melds: staged.filter(m => !m.hidden).map(m => m.ids),
          additions: goOutAdditions,
          discardId: selectedIds[0]
        }
      });
      reset();
    } else {
      send('discard', { cardId: selectedIds[0] });
      setSelectedIds([]);
    }
  };

  const seatClass = i => {
    if (opponents.length === 1) return 'seat-top';
    if (opponents.length === 2) return ['seat-left', 'seat-right'][i];
    const map = {
      3: ['seat-left', 'seat-top', 'seat-right'],
      4: ['seat-left', 'seat-top-left', 'seat-top-right', 'seat-right'],
      5: ['seat-left', 'seat-top-left', 'seat-top', 'seat-top-right', 'seat-right']
    };
    return map[opponents.length][i];
  };

  let prompt;
  if (!isYourTurn) {
    prompt = `${state.players.find(p => p.id === state.currentPlayerId)?.name}'s turn`;
  } else if (goOut) {
    prompt = 'GO OUT: stage all your melds, then select the final discard and confirm';
  } else if (!state.hasDrawn) {
    prompt = 'Your turn — draw a card';
  } else {
    prompt = state.canMeldNow
      ? 'Meld if you like, then discard'
      : `Discard a card (melds unlock on turn ${state.config.meldDelayTurn})`;
  }

  return (
    <div className="table-screen">
      <div className="status-bar">
        <span>Round {state.roundNumber} · Turn {state.lap}</span>
        <span className={isYourTurn ? 'active-prompt' : ''}>{prompt}</span>
      </div>

      <div className="table-square">
        {opponents.map((p, i) => (
          <div key={p.id} className={`seat ${seatClass(i)} ${p.isCurrent ? 'current' : ''}`}>
            <div className="name">
              {p.name} · {p.handCount}
              {p.isDealer ? ' 🂠' : ''}{!p.connected ? ' ⚠' : ''}
            </div>
            <div className="mini-hand">
              {Array.from({ length: Math.min(p.handCount, 7) }).map((_, k) => (
                <div key={k} className="mini-card" />
              ))}
            </div>
          </div>
        ))}

        <div className="center-area">
          <div className="deck-stack"
            onClick={() => isYourTurn && !state.hasDrawn && send('draw', { source: 'deck' })}>
            {state.closingCard && (
              <div className={`peek ${cardColor(state.closingCard)}`}
                onClick={e => {
                  e.stopPropagation();
                  if (isYourTurn && !state.hasDrawn) setGoOut(true);
                }}>
                {cardLabel(state.closingCard)}
              </div>
            )}
            <div className="top">DECK<br />{state.drawCount}</div>
          </div>
          <div className={`discard-card ${state.discardTop ? cardColor(state.discardTop) : 'empty'}`}
            onClick={() => isYourTurn && !state.hasDrawn && state.discardTop && send('draw', { source: 'discard' })}>
            {state.discardTop ? cardLabel(state.discardTop) : '—'}
          </div>
        </div>
      </div>

      {goOut && (
        <div className="go-out-banner">
          Going out with the closing card {cardLabel(state.closingCard)}.
          <button onClick={reset}>Cancel</button>
        </div>
      )}

      <div className="label">Melds on the table</div>
      <MeldsStrip
        melds={state.melds}
        canAdd={isYourTurn && (state.hasDrawn || goOut) && selectedIds.length > 0 && state.canMeldNow}
        onAdd={addToMeld}
      />

      {staged.filter(m => !m.hidden).length > 0 && (
        <div className="staged">
          <div className="label">Staged melds (not laid yet)</div>
          {staged.filter(m => !m.hidden).map((m, i) => (
            <div key={i} className="meld-cards">
              {m.cards.map(c => (
                <div key={c.id} className={`mc ${cardColor(c)}`}>{cardLabel(c)}</div>
              ))}
            </div>
          ))}
          {!goOut && <button onClick={layMelds}>Lay staged melds</button>}
          <button onClick={() => setStaged(s => s.filter(m => m.hidden))}>Clear</button>
        </div>
      )}

      <div className="label">Your hand ({handCards.length}){you?.melded ? ' · opened' : ''}</div>
      <Hand cards={handCards} selectedIds={selectedIds} onToggle={toggle} />

      <div className="actions">
        <button
          disabled={!isYourTurn || !(state.hasDrawn || goOut) || selectedIds.length < 3 || !state.canMeldNow}
          onClick={stageMeld}
        >Stage meld ({selectedIds.length})</button>
        <button
          className="primary-inline"
          disabled={!isYourTurn || !(state.hasDrawn || goOut) || selectedIds.length !== 1}
          onClick={discard}
        >{goOut ? 'Confirm go out' : 'Discard'}</button>
      </div>
    </div>
  );
}
