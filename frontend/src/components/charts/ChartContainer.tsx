// src/components/charts/ChartContainer.tsx
import React, { ReactNode } from 'react';
import { useTheme } from '../../context/ThemeProvider';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  height?: number | string;
  className?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  icon,
  controls,
  children,
  height = 'auto',
  className = ''
}) => {
  const { theme } = useTheme();

  return (
    <>
      <style>{`
        /* Remove outline and visual feedback from chart elements */
        .recharts-sector,
        .recharts-rectangle,
        .recharts-radial-bar-sector,
        .recharts-treemap-depth-1,
        .recharts-bar-rectangle {
          outline: none !important;
        }
        .recharts-sector:focus,
        .recharts-rectangle:focus,
        .recharts-radial-bar-sector:focus,
        .recharts-treemap-depth-1:focus,
        .recharts-bar-rectangle:focus {
          outline: none !important;
        }
        /* Keep pointer cursor only for elements with tooltips */
        .recharts-sector,
        .recharts-rectangle,
        .recharts-bar-rectangle {
          cursor: pointer;
        }
        .recharts-radial-bar-sector,
        .recharts-treemap-depth-1 {
          cursor: default !important;
        }
        
        /* Mobile responsiveness improvements */
        @media (max-width: 768px) {
          .recharts-text {
            font-size: 10px !important;
          }
          .recharts-legend-item-text {
            font-size: 11px !important;
          }
        }
        
        @media (max-width: 480px) {
          .recharts-text {
            font-size: 9px !important;
          }
          .recharts-legend-item-text {
            font-size: 10px !important;
          }
        }
      `}</style>
      <div 
        className={`panel-alt panel ${className}`}
        style={{
          background: theme.bgPanel,
          borderRadius: 12,
          padding: '16px',
          border: `1px solid ${theme.border}`,
          transition: 'all 0.3s ease',
          position: 'relative',
          minHeight: height === 'auto' ? undefined : height
        }}
      >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        gap: 12,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 auto' }}>
          {icon && (
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {icon}
            </div>
          )}
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <h4 style={{
              fontSize: 14,
              fontWeight: 600,
              color: theme.textPrimary,
              margin: 0,
              marginBottom: subtitle ? 4 : 0,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {title}
            </h4>
            {subtitle && (
              <p style={{
                fontSize: 12,
                color: theme.textSecondary,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {controls && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, width: controls.props?.style?.width || 'auto' }}>
            {controls}
          </div>
        )}
      </div>

      {/* Chart Content */}
      <div style={{ position: 'relative' }}>
        {children}
      </div>
    </div>
    </>
  );
};
