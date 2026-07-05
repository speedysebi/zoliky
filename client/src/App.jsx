import { useEffect, useState, useCallback } from 'react';
import { socket } from './socket.js';
import Lobby from './components/Lobby.jsx';

const storage = {
  get(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* storage unavailable */ }
  }
};

export default function App() {
  const [state, setState] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [name, setName] = useState(() => storage.get('zoliky-name') || '');

  const send = useCallback((event, payload = {}) => {
    socket.emit(event, payload);
  }, []);

  const join = useCallback(joinName => {
    const trimmed = joinName.trim();
    if (!trimmed) return;
    storage.set('zoliky-name', trimmed);
    setName(trimmed);
    setJoining(true);
    if (!socket.connected) socket.connect();
    socket.emit('join', { name: trimmed }, res => {
      setJoining(false);
      if (res.ok) { setPlayerId(res.playerId); setError(null); }
      else setError(res.error);
    });
  }, []);

  useEffect(() => {
    const onState = s => setState(s);
    const onError = e => setError(e.message);
    const onConnect = () => {
      const saved = storage.get('zoliky-name');
      if (saved && playerId) {
        socket.emit('join', { name: saved }, res => {
          if (res.ok) setPlayerId(res.playerId);
        });
      }
    };
    socket.on('state', onState);
    socket.on('gameError', onError);
    socket.on('connect', onConnect);
    return () => {
      socket.off('state', onState);
      socket.off('gameError', onError);
      socket.off('connect', onConnect);
    };
  }, [playerId]);

  let screen;
  if (!playerId || !state) {
    screen = <JoinScreen name={name} joining={joining} onJoin={join} />;
  } else if (state.phase === 'lobby') {
    screen = <Lobby state={state} send={send} />;
  } else if (state.phase === 'cutting') {
    screen = <div>Cut screen (coming soon)</div>;
  } else if (state.phase === 'playing') {
    screen = <div>Table (coming soon)</div>;
  } else if (state.phase === 'roundEnd') {
    screen = <div>Round end (coming soon)</div>;
  } else if (state.phase === 'carryover') {
    screen = <div>Carryover (coming soon)</div>;
  } else if (state.phase === 'matchEnd') {
    screen = <div>Match end (coming soon)</div>;
  }

  return (
    <div className="app">
      {error && (
        <div className="toast" onClick={() => setError(null)}>
          {error} <span className="dismiss">✕</span>
        </div>
      )}
      {screen}
    </div>
  );
}

function JoinScreen({ name, joining, onJoin }) {
  const [value, setValue] = useState(name);
  return (
    <div className="join-screen">
      <h1>Žolíky</h1>
      <form onSubmit={e => { e.preventDefault(); onJoin(value); }}>
        <input
          placeholder="Your name"
          value={value}
          onChange={e => setValue(e.target.value)}
          maxLength={20}
          autoFocus
        />
        <button type="submit" disabled={joining || !value.trim()}>
          {joining ? 'Joining…' : 'Join table'}
        </button>
      </form>
    </div>
  );
}
