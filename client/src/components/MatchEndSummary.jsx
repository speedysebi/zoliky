export default function MatchEndSummary({ state }) {
  const scoreboard = [...state.players].sort((a, b) => a.score - b.score);
  return (
    <div className="summary-screen">
      <h1>Match over</h1>
      <p className="winner">🏆 {scoreboard[0]?.name} wins with {scoreboard[0]?.score} points</p>
      <table className="score-table">
        <thead><tr><th>#</th><th>Player</th><th>Total penalty</th></tr></thead>
        <tbody>
          {scoreboard.map((p, i) => (
            <tr key={p.id} className={p.id === state.youId ? 'you-row' : ''}>
              <td>{i + 1}</td><td>{p.name}</td><td>{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Lowest total wins. Restart the server for a new lobby.</p>
    </div>
  );
}
