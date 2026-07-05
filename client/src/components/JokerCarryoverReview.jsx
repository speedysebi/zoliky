import { useState } from 'react';

export default function JokerCarryoverReview({ state, send }) {
  const editable = state.carryover?.editable;
  const [assignment, setAssignment] = useState(() => {
    const base = {};
    for (const p of state.players) base[p.id] = state.carryover?.assignment[p.id] || 0;
    return base;
  });
  const total = state.carryover?.total ?? 0;
  const assigned = Object.values(assignment).reduce((a, b) => a + b, 0);
  const bump = (id, delta) =>
    setAssignment(a => ({ ...a, [id]: Math.max(0, (a[id] || 0) + delta) }));

  if (!editable) {
    const dealer = state.players.find(p => p.isDealer);
    return (
      <div className="summary-screen">
        <h1>Joker carryover</h1>
        <p className="hint">{dealer?.name} is reviewing who keeps the leftover joker(s)…</p>
      </div>
    );
  }
  return (
    <div className="summary-screen">
      <h1>Joker carryover</h1>
      <p>You deal next. Assign the {total} leftover joker(s) into next round's hands:</p>
      <ul className="carry-list">
        {state.players.map(p => (
          <li key={p.id}>
            <span>{p.name}</span>
            <span className="stepper">
              <button onClick={() => bump(p.id, -1)}>−</button>
              <b>{assignment[p.id]}</b>
              <button onClick={() => bump(p.id, +1)}>+</button>
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">{assigned}/{total} assigned</p>
      <button
        className="primary"
        disabled={assigned !== total}
        onClick={() => {
          send('adjustCarryover', { assignment });
          send('confirmCarryover');
        }}
      >Confirm and deal</button>
    </div>
  );
}
