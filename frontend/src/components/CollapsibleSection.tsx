import { useState, useRef, useEffect } from 'react';

import { useTheme } from '../context/ThemeProvider';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = true,
}) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [height, setHeight] = useState<number | 'auto'>(defaultExpanded ? 'auto' : 0);
  const contentRef = useRef<HTMLDivElement>(null);
  const isInitial = useRef(true);

  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }
    if (expanded) {
      const h = contentRef.current?.scrollHeight || 0;
      setHeight(h);
      const t = setTimeout(() => setHeight('auto'), 250);
      return () => clearTimeout(t);
    } else {
      const h = contentRef.current?.scrollHeight || 0;
      setHeight(h);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0));
      });
    }
  }, [expanded]);

  return (
    <div
      style={{
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: theme.bgPanel,
          border: 'none',
          cursor: 'pointer',
          color: theme.textPrimary,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600 }}>{title}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s ease',
            color: theme.textSecondary,
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        ref={contentRef}
        style={{
          height: height === 'auto' ? 'auto' : height,
          overflow: 'hidden',
          transition: height === 'auto' ? 'none' : 'height 0.25s ease',
        }}
      >
        <div style={{ padding: '0 20px 20px' }}>{children}</div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
