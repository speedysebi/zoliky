import { useState } from 'react';

export default function CutScreen({ state, send }) {
  const cutter = state.players.find(p => p.isCutter);
  const isYou = cutter?.id === state.youId;
  const max = Math.max(2, state.deckSize - 1);
  const [index, setIndex] = useState(Math.floor(max / 2));
  return (
    <div className="cut-screen">
      <h1>Round {state.roundNumber}</h1>
      {isYou ? (
        <>
          <p>You cut the deck. Pick a depth:</p>
          <input type="range" min="1" max={max} value={index}
            onChange={e => setIndex(Number(e.target.value))} />
          <p className="hint">{index} cards from the top</p>
          <button className="primary" onClick={() => send('cut', { index })}>Cut here</button>
        </>
      ) : (
        <p className="hint">Waiting for {cutter?.name} to cut the deck…</p>
      )}
    </div>
  );
}
