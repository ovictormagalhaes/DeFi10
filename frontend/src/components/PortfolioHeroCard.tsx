interface Breakdown {
  totalNet: number;
  liquidityValue: number;
  lendingNet: number;
  lendingBorrowed: number;
  stakingValue: number;
  lockingValue: number;
  walletValue: number;
}

interface Counts {
  pools: number;
  lending: number;
  staking: number;
  locking: number;
  wallet: number;
}

interface PortfolioHeroCardProps {
  breakdown: Breakdown;
  counts: Counts;
  maskValue: (v: string) => string;
  formatPrice: (v: number) => string;
}

const PortfolioHeroCard: React.FC<PortfolioHeroCardProps> = ({
  breakdown,
  counts,
  maskValue,
  formatPrice,
}) => {
  const { totalNet, liquidityValue, lendingNet, lendingBorrowed, stakingValue, lockingValue, walletValue } = breakdown;

  if (totalNet <= 0) return null;

  const categories = [
    {
      label: 'Pools',
      value: liquidityValue,
      sub: counts.pools === 1 ? '1 position' : `${counts.pools} positions`,
      color: '#9945ff',
      subColor: undefined as string | undefined,
      show: liquidityValue > 0,
    },
    {
      label: 'Lending',
      value: lendingNet,
      sub: lendingBorrowed > 0 ? `−${formatPrice(lendingBorrowed)} borrowed` : `${counts.lending} position${counts.lending !== 1 ? 's' : ''}`,
      color: '#45b773',
      subColor: lendingBorrowed > 0 ? '#ff5f56' : undefined,
      show: lendingNet > 0 || lendingBorrowed > 0,
    },
    {
      label: 'Staking',
      value: stakingValue,
      sub: counts.staking === 1 ? '1 position' : `${counts.staking} positions`,
      color: '#35f7a5',
      subColor: undefined as string | undefined,
      show: stakingValue > 0,
    },
    {
      label: 'Locking',
      value: lockingValue,
      sub: counts.locking === 1 ? '1 position' : `${counts.locking} positions`,
      color: '#d99738',
      subColor: undefined as string | undefined,
      show: lockingValue > 0,
    },
    {
      label: 'Tokens',
      value: walletValue,
      sub: counts.wallet === 1 ? '1 asset' : `${counts.wallet} assets`,
      color: '#a2a9b5',
      subColor: undefined as string | undefined,
      show: walletValue > 0,
    },
  ].filter((c) => c.show);

  return (
    <div
      style={{
        background: 'linear-gradient(160deg, #0d1117 0%, #161b27 55%, #0d1117 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20,
        padding: '28px 32px',
        marginBottom: 24,
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 400,
          height: 200,
          background:
            'radial-gradient(ellipse, rgba(53,247,165,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 12,
            color: '#6d757f',
            fontWeight: 500,
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Total Portfolio Value
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            color: '#f4f4f4',
            letterSpacing: '-1px',
            lineHeight: 1,
          }}
        >
          {maskValue(formatPrice(totalNet))}
        </div>
      </div>

      <div
        style={{
          height: 1,
          background:
            'linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)',
          marginBottom: 20,
        }}
      />

      <div style={{ display: 'flex', gap: 0 }}>
        {categories.map((cat, i) => (
          <div
            key={cat.label}
            style={{
              flex: 1,
              paddingLeft: i === 0 ? 0 : 20,
              paddingRight: i === categories.length - 1 ? 0 : 20,
              borderRight:
                i < categories.length - 1
                  ? '1px solid rgba(255,255,255,0.06)'
                  : 'none',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#6d757f',
                fontWeight: 500,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: cat.color,
                  marginRight: 5,
                  verticalAlign: 'middle',
                }}
              />
              {cat.label}
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#f4f4f4',
                marginBottom: 3,
              }}
            >
              {maskValue(formatPrice(cat.value))}
            </div>
            <div style={{ fontSize: 11, color: cat.subColor ?? '#6d757f' }}>
              {cat.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PortfolioHeroCard;
