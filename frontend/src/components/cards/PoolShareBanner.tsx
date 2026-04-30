import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { useTheme } from '../../context/ThemeProvider';
import { api } from '../../config/api';

interface RangeData {
  lower: number;
  upper: number;
  current: number;
}

interface PoolShareBannerProps {
  token0Symbol: string;
  token1Symbol: string;
  token0Logo?: string;
  token1Logo?: string;
  protocolName?: string;
  protocolLogo?: string;
  chain?: string;
  chainIcon?: string;
  apr?: number;
  createdAt?: number;
  inRange?: boolean;
  totalValue?: number;
  totalFees?: number;
  rangeData?: RangeData;
  tierPercent?: number;
  onClose: () => void;
}

const DARK = {
  bannerBg: 'linear-gradient(135deg, #0d1117 0%, #161b27 60%, #0d1117 100%)',
  glow1: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
  glow2: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
  textPrimary: '#f8fafc',
  textSecondary: '#e2e8f0',
  textMuted: '#64748b',
  tokenBorder: '#2d3748',
  tokenBg: '#1e293b',
  rangeTrack: '#1e293b',
  sectionBg: 'rgba(255,255,255,0.04)',
  dialogBg: '#0f172a',
  dialogBorder: '#1e293b',
  protocolText: '#e2e8f0',
  chainText: '#94a3b8',
};

const LIGHT = {
  bannerBg: 'linear-gradient(135deg, #f0f4f8 0%, #e2eaf4 60%, #f0f4f8 100%)',
  glow1: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)',
  glow2: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)',
  textPrimary: '#0f172a',
  textSecondary: '#1e293b',
  textMuted: '#64748b',
  tokenBorder: '#cbd5e1',
  tokenBg: '#f1f5f9',
  rangeTrack: '#e2e8f0',
  sectionBg: 'rgba(0,0,0,0.04)',
  dialogBg: '#ffffff',
  dialogBorder: '#e2e8f0',
  protocolText: '#1e293b',
  chainText: '#475569',
};

const BannerLogo: React.FC = () => {
  const { mode } = useTheme();
  const src = mode === 'light' ? '/logo_extended_light.svg' : '/logo_extended.svg';
  return <img src={src} alt="DeFi10" style={{ height: 28 }} />;
};

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function rasterizeSvg(svgDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 200;
      const h = img.naturalHeight || 200;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(svgDataUrl);
      }
    };
    img.onerror = () => resolve(svgDataUrl);
    img.src = svgDataUrl;
  });
}

function makePlaceholder(symbol?: string): string {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  if (symbol) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `bold ${Math.round(size * 0.4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol[0].toUpperCase(), size / 2, size / 2);
  }
  return canvas.toDataURL();
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtNum(n: number): string {
  if (n === 0) return '0';
  if (Math.abs(n) >= 1_000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, disabled }) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      fontSize: 13,
      color: '#94a3b8',
      userSelect: 'none',
    }}
  >
    <div
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        backgroundColor: checked ? '#6366f1' : '#334155',
        position: 'relative',
        transition: 'background-color 0.2s',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: '#fff',
          transition: 'left 0.2s',
        }}
      />
    </div>
    {label}
  </label>
);

const PoolShareBanner: React.FC<PoolShareBannerProps> = ({
  token0Symbol,
  token1Symbol,
  token0Logo,
  token1Logo,
  protocolName,
  protocolLogo,
  chain,
  chainIcon,
  apr,
  createdAt,
  inRange,
  totalValue,
  totalFees,
  rangeData,
  tierPercent,
  onClose,
}) => {
  const { mode } = useTheme();
  const t = mode === 'light' ? LIGHT : DARK;

  const bannerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);

  const [showRange, setShowRange] = useState(true);
  const [showValue, setShowValue] = useState(true);
  const [showFees, setShowFees] = useState(true);
  const [showTier, setShowTier] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleCopy = async () => {
    if (!bannerRef.current || copying) return;
    setCopying(true);

    const swapped: [HTMLImageElement, string][] = [];
    await Promise.all(
      Array.from(bannerRef.current.querySelectorAll<HTMLImageElement>('img')).map(async (img) => {
        const orig = img.src;
        if (orig.startsWith('data:')) return;

        const isSameOrigin = (() => {
          try {
            return new URL(orig).origin === window.location.origin;
          } catch {
            return false;
          }
        })();

        let dataUrl: string | null = isSameOrigin
          ? await fetchAsDataUrl(orig)
          : await fetchAsDataUrl(api.getProxyImage(orig));

        if (dataUrl?.startsWith('data:image/svg+xml')) {
          dataUrl = await rasterizeSvg(dataUrl);
        }

        swapped.push([img, orig]);
        img.src = dataUrl ?? makePlaceholder(img.alt);
      })
    );

    await Promise.all(
      swapped.map(([img]) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.onload = () => res();
              img.onerror = () => res();
            })
      )
    );

    try {
      const canvas = await html2canvas(bannerRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        onclone: (_doc, element) => {
          (element as HTMLElement).style.borderRadius = '0';
          let parent = element.parentElement;
          while (parent) {
            parent.style.background = 'transparent';
            parent.style.backgroundColor = 'transparent';
            parent = parent.parentElement;
          }
        },
      });

      const inset = 2 * 2;
      const cropped = document.createElement('canvas');
      cropped.width = canvas.width - inset * 2;
      cropped.height = canvas.height - inset * 2;
      const cctx = cropped.getContext('2d');
      if (cctx) {
        cctx.drawImage(
          canvas,
          inset,
          inset,
          cropped.width,
          cropped.height,
          0,
          0,
          cropped.width,
          cropped.height
        );
      }

      swapped.forEach(([img, src]) => { img.src = src; });
      cropped.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = `${token0Symbol}-${token1Symbol}-pool.png`;
          a.click();
          URL.revokeObjectURL(objectUrl);
        } finally {
          setCopying(false);
        }
      }, 'image/png');
    } catch {
      swapped.forEach(([img, src]) => { img.src = src; });
      setCopying(false);
    }
  };

  const displayToken0Symbol = isFlipped ? token1Symbol : token0Symbol;
  const displayToken1Symbol = isFlipped ? token0Symbol : token1Symbol;
  const displayToken0Url = isFlipped ? token1Logo : token0Logo;
  const displayToken1Url = isFlipped ? token0Logo : token1Logo;

  const effectiveRange: RangeData | undefined =
    rangeData && isFlipped
      ? {
          lower: 1 / rangeData.upper,
          upper: 1 / rangeData.lower,
          current: 1 / rangeData.current,
        }
      : rangeData;

  const rangePct =
    effectiveRange && effectiveRange.upper !== effectiveRange.lower
      ? Math.min(
          100,
          Math.max(
            0,
            ((effectiveRange.current - effectiveRange.lower) /
              (effectiveRange.upper - effectiveRange.lower)) *
              100
          )
        )
      : 50;

  const rangeSize =
    rangeData && Number(rangeData.lower) > 0
      ? ((Number(rangeData.upper) / Number(rangeData.lower)) - 1) * 100
      : null;

  const tierDisplay =
    tierPercent != null ? `${(tierPercent * 100).toFixed(2)}%` : null;

  const ageDisplay = (() => {
    if (!createdAt) return null;
    const diffMs = Date.now() - createdAt * 1000;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 1) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      return diffHours <= 1 ? '<1 day' : `${diffHours}h`;
    }
    return diffDays === 1 ? '1 day' : `${diffDays} days`;
  })();

  const metricFontSize = 22;
  const metricGap = 24;

  const content = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          backgroundColor: t.dialogBg,
          borderRadius: 20,
          padding: 24,
          border: `1px solid ${t.dialogBorder}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner (captured area) */}
        <div
          ref={bannerRef}
          style={{
            width: 680,
            background: t.bannerBg,
            borderRadius: 16,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxSizing: 'border-box',
            transition: 'opacity 0.2s',
          }}
        >
          {/* Background glows */}
          <div
            style={{
              position: 'absolute',
              top: -80,
              right: -80,
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: t.glow1,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -60,
              left: -60,
              width: 250,
              height: 250,
              borderRadius: '50%',
              background: t.glow2,
              pointerEvents: 'none',
            }}
          />
          {inRange != null && (
            <div
              style={{
                position: 'absolute',
                bottom: -60,
                right: -60,
                width: 250,
                height: 250,
                borderRadius: '50%',
                background: inRange
                  ? 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Top row: Logo + Protocol/Chain */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <BannerLogo />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              {protocolName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {protocolLogo && (
                    <img src={protocolLogo} alt={protocolName} style={{ width: 18, height: 18, borderRadius: '50%' }} />
                  )}
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.protocolText }}>{protocolName}</span>
                </div>
              )}
              {chain && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {chainIcon && (
                    <img src={chainIcon} alt={chain} style={{ width: 14, height: 14, borderRadius: '50%' }} />
                  )}
                  <span style={{ fontSize: 12, color: t.chainText }}>{chain}</span>
                </div>
              )}
            </div>
          </div>

          {/* Center: Token pair */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {displayToken0Url && (
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    border: '3px solid transparent',
                    backgroundColor: 'transparent',
                    overflow: 'hidden',
                    flexShrink: 0,
                    zIndex: 2,
                    position: 'relative',
                  }}
                >
                  <img src={displayToken0Url} alt={displayToken0Symbol} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              {displayToken1Url && (
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    border: '3px solid transparent',
                    backgroundColor: 'transparent',
                    overflow: 'hidden',
                    flexShrink: 0,
                    marginLeft: -14,
                    zIndex: 1,
                    position: 'relative',
                  }}
                >
                  <img src={displayToken1Url} alt={displayToken1Symbol} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: t.textPrimary, letterSpacing: -0.5 }}>
              {displayToken0Symbol} / {displayToken1Symbol}
            </div>
          </div>

          {/* Optional: Range section */}
          {showRange && effectiveRange && (
            <div style={{ backgroundColor: t.sectionBg, borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>PRICE RANGE</div>
                {rangeSize != null && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary }}>
                    <span style={{ fontSize: 10, fontWeight: 500, color: t.textMuted, marginRight: 4 }}>Size</span>
                    {rangeSize.toFixed(2)}%
                  </div>
                )}
              </div>
              <div style={{ position: 'relative', height: 6, backgroundColor: t.rangeTrack, borderRadius: 3, marginBottom: 8 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${rangePct}%`,
                    backgroundColor: inRange ? '#10b981' : '#ef4444',
                    borderRadius: 3,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: `${rangePct}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: inRange ? '#10b981' : '#ef4444',
                    border: `2px solid ${t.tokenBg}`,
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: t.textMuted }}>{fmtNum(effectiveRange.lower)}</span>
                <span style={{ fontSize: 12, color: inRange ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  ▲ {fmtNum(effectiveRange.current)}
                </span>
                <span style={{ fontSize: 12, color: t.textMuted }}>{fmtNum(effectiveRange.upper)}</span>
              </div>
            </div>
          )}

          {/* Bottom row: metrics + status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: metricGap, flexWrap: 'wrap' }}>
              {apr != null && apr > 0 && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 2, fontWeight: 500 }}>APR</div>
                  <div style={{ fontSize: metricFontSize, fontWeight: 700, color: '#10b981' }}>{apr.toFixed(2)}%</div>
                </div>
              )}
              {showTier && tierDisplay && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 2, fontWeight: 500 }}>Tier</div>
                  <div style={{ fontSize: metricFontSize, fontWeight: 700, color: t.textSecondary }}>{tierDisplay}</div>
                </div>
              )}
              {ageDisplay && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 2, fontWeight: 500 }}>Age</div>
                  <div style={{ fontSize: metricFontSize, fontWeight: 700, color: t.textSecondary }}>{ageDisplay}</div>
                </div>
              )}
              {showValue && totalValue != null && totalValue > 0 && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 2, fontWeight: 500 }}>Value</div>
                  <div style={{ fontSize: metricFontSize, fontWeight: 700, color: t.textSecondary }}>{fmtUsd(totalValue)}</div>
                </div>
              )}
              {showFees && totalFees != null && totalFees > 0 && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 2, fontWeight: 500 }}>Earned</div>
                  <div style={{ fontSize: metricFontSize, fontWeight: 700, color: '#10b981' }}>{fmtUsd(totalFees)}</div>
                </div>
              )}
            </div>
            {inRange != null && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 12px',
                  borderRadius: 6,
                  backgroundColor: inRange ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                  color: inRange ? '#10b981' : '#ef4444',
                  flexShrink: 0,
                }}
              >
                {inRange ? 'In Range' : 'Out of Range'}
              </div>
            )}
          </div>
        </div>

        {/* Controls (outside captured area) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '12px 20px',
            backgroundColor: mode === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
            borderRadius: 10,
            border: `1px solid ${t.dialogBorder}`,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', flex: 1 }}>
            <Toggle label="Range" checked={showRange} onChange={setShowRange} disabled={!rangeData} />
            <Toggle label="Tier" checked={showTier} onChange={setShowTier} disabled={!tierDisplay} />
            <Toggle label="Value" checked={showValue} onChange={setShowValue} disabled={!totalValue} />
            <Toggle label="Total Earned" checked={showFees} onChange={setShowFees} disabled={!totalFees || totalFees <= 0} />
          </div>

          {/* Flip button */}
          <button
            onClick={() => setIsFlipped((v) => !v)}
            title="Invert pair"
            style={{
              background: isFlipped
                ? 'rgba(99,102,241,0.15)'
                : mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
              border: `1px solid ${isFlipped ? '#6366f1' : t.dialogBorder}`,
              borderRadius: 8,
              cursor: 'pointer',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: isFlipped ? '#6366f1' : '#94a3b8',
              fontSize: 13,
              fontWeight: 500,
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              style={{ transform: isFlipped ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <path
                d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Invert Pair
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleCopy}
            disabled={copying}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              cursor: copying ? 'not-allowed' : 'pointer',
              backgroundColor: copied ? '#10b981' : '#6366f1',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              transition: 'background-color 0.2s',
              opacity: copying ? 0.6 : 1,
            }}
          >
            {copying ? 'Copying...' : copied ? 'Copied!' : 'Copy Image'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: `1px solid ${t.dialogBorder}`,
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: '#94a3b8',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default PoolShareBanner;
