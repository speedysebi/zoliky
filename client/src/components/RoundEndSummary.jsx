export default function RoundEndSummary({ state, send }) {
  const you = state.players.find(p => p.id === state.youId);
  const scoreboard = [...state.players].sort((a, b) => a.score - b.score);
  return (
    <div className="summary-screen">
      <h1>Round {state.roundNumber} over</h1>
      <p className="winner">🏆 {state.roundResult?.winnerName} melded out!</p>
      <table className="score-table">
        <thead><tr><th>Player</th><th>Penalty</th><th>Total</th></tr></thead>
        <tbody>
          {scoreboard.map(p => {
            const pen = state.roundResult?.penalties.find(x => x.id === p.id);
            return (
              <tr key={p.id} className={p.id === state.youId ? 'you-row' : ''}>
                <td>{p.name}{p.carryJokers > 0 ? ` (★×${p.carryJokers})` : ''}</td>
                <td>{pen ? `+${pen.points}` : '—'}</td>
                <td>{p.score}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {state.carryover && (
        <p className="hint">★ Jokers left in hands carry into the next deal — the dealer will review them.</p>
      )}
      {you?.isHost ? (
        <div className="summary-actions">
          <button className="primary" onClick={() => send('nextRound')}>Next round</button>
          <button onClick={() => send('endMatch')}>End match</button>
        </div>
      ) : (
        <p className="hint">Waiting for the host…</p>
      )}
    </div>
  );
}
