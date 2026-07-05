export default function HouseRulesPanel({ config, isHost, send }) {
  const set = partial => send('configure', partial);
  return (
    <div className="house-rules">
      <h3>House rules</h3>
      <div className="rule-row">
        <span>Opening threshold</span>
        <div className="segmented">
          {[42, 51].map(v => (
            <button
              key={v}
              className={config.openingThreshold === v ? 'active' : ''}
              disabled={!isHost}
              onClick={() => set({ openingThreshold: v })}
            >{v}</button>
          ))}
        </div>
      </div>
      <div className="rule-row">
        <span>Meld delay</span>
        <div className="segmented">
          <button
            className={config.meldDelayEnabled ? 'active' : ''}
            disabled={!isHost}
            onClick={() => set({ meldDelayEnabled: true })}
          >On</button>
          <button
            className={!config.meldDelayEnabled ? 'active' : ''}
            disabled={!isHost}
            onClick={() => set({ meldDelayEnabled: false })}
          >Off</button>
        </div>
      </div>
      {config.meldDelayEnabled && (
        <div className="rule-row">
          <span>Melds allowed from turn</span>
          <input
            type="number" min="1" max="10"
            value={config.meldDelayTurn}
            disabled={!isHost}
            onChange={e => {
              const v = parseInt(e.target.value, 10);
              if (Number.isInteger(v) && v >= 1) set({ meldDelayTurn: v });
            }}
          />
        </div>
      )}
      {!isHost && <p className="hint">Only the host can change house rules.</p>}
    </div>
  );
}
