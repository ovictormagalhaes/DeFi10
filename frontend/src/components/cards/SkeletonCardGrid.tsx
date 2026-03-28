import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../context/ThemeProvider';
import { Skeleton } from '../Skeleton';

interface SkeletonCardGridProps {
  itemCount: number;
  minCardWidth: number;
  gap?: number;
}

function SkeletonCardPlaceholder() {
  const { theme } = useTheme();
  return (
    <div
      style={{
        backgroundColor: theme.bgPanel,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        opacity: 0.5,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width={36} height={36} circle />
        <Skeleton width={60} height={14} />
      </div>
      <div>
        <Skeleton width={100} height={16} />
        <div style={{ marginTop: 4 }}>
          <Skeleton width={50} height={13} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton width={40} height={13} />
          <Skeleton width={70} height={14} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton width={50} height={13} />
          <Skeleton width={90} height={14} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton width={35} height={13} />
          <Skeleton width={65} height={14} />
        </div>
      </div>
    </div>
  );
}

function useGridColumns(minCardWidth: number, gap: number) {
  const probeRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(3);

  const measure = useCallback(() => {
    const el = probeRef.current?.parentElement;
    if (!el) return;
    const w = el.offsetWidth;
    if (w > 0) {
      setCols(Math.max(1, Math.floor((w + gap) / (minCardWidth + gap))));
    }
  }, [minCardWidth, gap]);

  useEffect(() => {
    measure();
    const el = probeRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { probeRef, cols };
}

const SkeletonCardGrid: React.FC<SkeletonCardGridProps> = ({ itemCount, minCardWidth, gap = 20 }) => {
  const { probeRef, cols } = useGridColumns(minCardWidth, gap);

  const remainder = itemCount % cols;
  const skeletonCount = remainder === 0 ? cols : cols - remainder;

  return (
    <>
      <div ref={probeRef} style={{ display: 'none' }} />
      {Array.from({ length: skeletonCount }, (_, i) => (
        <SkeletonCardPlaceholder key={`skel-${i}`} />
      ))}
    </>
  );
};

export default SkeletonCardGrid;
