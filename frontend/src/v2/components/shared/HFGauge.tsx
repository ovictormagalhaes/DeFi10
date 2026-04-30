import React from 'react';

interface HFGaugeProps {
  value: number;
  liquidationPrice?: string;
  assetSymbol?: string;
  assetCurrentPrice?: string;
}

export const HFGauge: React.FC<HFGaugeProps> = ({
  value,
  liquidationPrice,
  assetSymbol,
  assetCurrentPrice,
}) => {
  const pct = Math.min((value - 1) / (3 - 1), 1);
  const color =
    value < 1.2 ? 'var(--v2-red)' : value < 1.6 ? 'var(--v2-yellow)' : 'var(--v2-green)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '8px 10px',
        background: 'var(--v2-bg-hover)',
        borderRadius: 7,
        marginBottom: 10,
      }}
    >
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1, minWidth: 42 }}>
          {value.toFixed(2)}
        </div>
        <div style={{ fontSize: 10, color: 'var(--v2-muted)', marginTop: 1 }}>Health Factor</div>
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            height: 5,
            background: 'var(--v2-bg-hover)',
            borderRadius: 3,
            overflow: 'visible',
            position: 'relative',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 3,
              background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 35%, #22c55e 75%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -4,
              left: `${pct * 100}%`,
              transform: 'translateX(-50%)',
              width: 3,
              height: 13,
              background: 'var(--v2-text)',
              borderRadius: 2,
              boxShadow: '0 0 4px rgba(255,255,255,0.25)',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 9.5,
            color: 'var(--v2-dim)',
            marginTop: 4,
          }}
        >
          <span>Liquidation 1.0</span>
          <span>Safe 3.0+</span>
        </div>
        {liquidationPrice && assetSymbol && assetCurrentPrice && (
          <div style={{ fontSize: 11, color: 'var(--v2-muted)', marginTop: 3 }}>
            Liq. price {assetSymbol}:{' '}
            <span style={{ color: 'var(--v2-red)', fontWeight: 600 }}>{liquidationPrice}</span>
            {' '}(now {assetCurrentPrice})
          </div>
        )}
      </div>
    </div>
  );
};

export default HFGauge;
