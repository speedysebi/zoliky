import HouseRulesPanel from './HouseRulesPanel.jsx';

export default function Lobby({ state, send }) {
  const you = state.players.find(p => p.id === state.youId);
  const isHost = you?.isHost;
  return (
    <div className="lobby">
      <h1>Žolíky — Lobby</h1>
      <ul className="player-list">
        {state.players.map(p => (
          <li key={p.id} className={p.connected ? '' : 'disconnected'}>
            {p.name}
            {p.isHost && <span className="tag">host</span>}
            {p.id === state.youId && <span className="tag you">you</span>}
            {!p.connected && <span className="tag">offline</span>}
          </li>
        ))}
      </ul>
      <HouseRulesPanel config={state.config} isHost={isHost} send={send} />
      {isHost ? (
        <button
          className="primary"
          disabled={state.players.length < 2}
          onClick={() => send('startMatch')}
        >
          Start game ({state.players.length}/6 players)
        </button>
      ) : (
        <p className="hint">Waiting for the host to start the game…</p>
      )}
    </div>
  );
}
