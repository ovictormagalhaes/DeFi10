import { useTheme } from '../context/ThemeProvider';
import { Skeleton } from './Skeleton';

interface SkeletonDashboardProps {
  progress?: number;
  message?: string;
}

function SkeletonCard() {
  const { theme } = useTheme();
  return (
    <div
      style={{
        background: theme.bgPanel,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Skeleton width={32} height={32} circle />
        <Skeleton width={120} height={16} />
        <div style={{ flex: 1 }} />
        <Skeleton width={60} height={14} />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <Skeleton width="45%" height={12} />
        <Skeleton width="30%" height={12} />
      </div>
      <Skeleton width="100%" height={1} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton width={80} height={12} />
        <Skeleton width={60} height={16} />
      </div>
    </div>
  );
}

function SkeletonMetric() {
  const { theme } = useTheme();
  return (
    <div
      style={{
        background: theme.bgPanel,
        border: `1px solid ${theme.border}`,
        borderRadius: 14,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <Skeleton width={90} height={11} />
      <Skeleton width={130} height={22} />
    </div>
  );
}

function SkeletonSectionHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <Skeleton width={24} height={24} circle />
      <Skeleton width={160} height={18} />
    </div>
  );
}

export default function SkeletonDashboard({ progress, message }: SkeletonDashboardProps) {
  const { theme } = useTheme();

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '16px 20px',
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            border: `3px solid ${theme.bgInteractive || 'rgba(255,255,255,0.1)'}`,
            borderTop: `3px solid ${theme.accent || theme.primary}`,
            borderRadius: '50%',
            animation: 'spin 0.85s linear infinite',
          }}
        />
        <span style={{ fontSize: 13, color: theme.textSecondary }}>
          {message || 'Loading your portfolio...'}
        </span>
        {progress != null && progress > 0 && progress < 1 && (
          <div
            style={{
              width: 80,
              height: 4,
              borderRadius: 2,
              background: theme.bgInteractive,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.round(progress * 100)}%`,
                height: '100%',
                background: theme.accent || theme.primary,
                borderRadius: 2,
                transition: 'width 0.3s',
              }}
            />
          </div>
        )}
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        <SkeletonMetric />
        <SkeletonMetric />
        <SkeletonMetric />
        <SkeletonMetric />
      </div>

      <SkeletonSectionHeader />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: 20, marginBottom: 32 }}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <SkeletonSectionHeader />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: 20 }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
