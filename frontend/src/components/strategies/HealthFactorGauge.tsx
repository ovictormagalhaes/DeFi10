/**
 * Health Factor Gauge
 * Visual gauge showing health factor with color-coded zones
 */

import React from 'react';
import { useTheme } from '../../context/ThemeProvider';

interface HealthFactorGaugeProps {
  current: number;
  target: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  size?: number;
}

export const HealthFactorGauge: React.FC<HealthFactorGaugeProps> = ({
  current,
  target,
  warningThreshold = 1.8,
  criticalThreshold = 1.5,
  size = 180
}) => {
  const { theme } = useTheme();

  // Calculate gauge parameters
  const min = 1.0;
  const max = 3.0;
  const range = max - min;
  
  // Normalize values to 0-1
  const normalizedCurrent = Math.max(0, Math.min(1, (current - min) / range));
  const normalizedTarget = Math.max(0, Math.min(1, (target - min) / range));
  const normalizedWarning = Math.max(0, Math.min(1, (warningThreshold - min) / range));
  const normalizedCritical = Math.max(0, Math.min(1, (criticalThreshold - min) / range));

  // SVG parameters
  const centerX = size / 2;
  const centerY = size / 2 + 10; // Adjusted to fit semicircle in viewBox
  const radius = size / 2 - 20;
  const strokeWidth = 24;

  // Arc angles (bottom half circle: 180 degrees, from 180° to 0°)
  const startAngle = 180;
  const endAngle = 0;
  const totalAngle = startAngle - endAngle;

  // Calculate arc path
  const polarToCartesian = (angle: number) => {
    const angleInRadians = ((angle - 90) * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    };
  };

  const describeArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(startAngle);
    const end = polarToCartesian(endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };

  // Zone paths
  const criticalZone = describeArc(startAngle, startAngle - (totalAngle * normalizedCritical));
  const warningZone = describeArc(startAngle - (totalAngle * normalizedCritical), startAngle - (totalAngle * normalizedWarning));
  const cautionZone = describeArc(startAngle - (totalAngle * normalizedWarning), startAngle - (totalAngle * normalizedTarget));
  const safeZone = describeArc(startAngle - (totalAngle * normalizedTarget), endAngle);

  // Current value needle angle
  const needleAngle = startAngle - (totalAngle * normalizedCurrent);
  const needleEnd = polarToCartesian(needleAngle);

  // Status color
  let statusColor = theme.success;
  let statusText = 'Safe';
  let statusIcon = '✅';

  if (current < criticalThreshold) {
    statusColor = '#dc2626'; // Red
    statusText = 'Danger';
    statusIcon = '🚨';
  } else if (current < warningThreshold) {
    statusColor = '#f97316'; // Orange
    statusText = 'Critical';
    statusIcon = '🔴';
  } else if (current < target) {
    statusColor = '#fbbf24'; // Yellow
    statusText = 'Warning';
    statusIcon = '⚠️';
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '16px',
      padding: '16px'
    }}>
      <svg width={size} height={size * 0.7} style={{ overflow: 'visible' }}>
        {/* Background zones */}
        <path
          d={criticalZone}
          fill="none"
          stroke="#dc2626"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.3}
        />
        <path
          d={warningZone}
          fill="none"
          stroke="#f97316"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.3}
        />
        <path
          d={cautionZone}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.3}
        />
        <path
          d={safeZone}
          fill="none"
          stroke={theme.success}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.3}
        />

        {/* Target marker */}
        <circle
          cx={polarToCartesian(startAngle - (totalAngle * normalizedTarget)).x}
          cy={polarToCartesian(startAngle - (totalAngle * normalizedTarget)).y}
          r={8}
          fill={theme.accent}
          stroke={theme.bgPanel}
          strokeWidth={2}
        />

        {/* Current value needle */}
        <line
          x1={centerX}
          y1={centerY}
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke={statusColor}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <circle
          cx={centerX}
          cy={centerY}
          r={6}
          fill={statusColor}
        />
      </svg>

      {/* Value display */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        marginTop: '-40px'
      }}>
        <div style={{
          fontSize: '36px',
          fontWeight: 'bold',
          color: statusColor
        }}>
          {current.toFixed(2)}
        </div>
        <div style={{
          fontSize: '14px',
          color: theme.textSecondary,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span>{statusIcon}</span>
          <span style={{ color: statusColor, fontWeight: 600 }}>{statusText}</span>
        </div>
        <div style={{
          fontSize: '12px',
          color: theme.textSecondary
        }}>
          Target: {target.toFixed(1)}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: '16px',
        fontSize: '11px',
        color: theme.textSecondary,
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '3px', background: '#dc2626', borderRadius: '2px' }} />
          <span>Danger</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '3px', background: '#f97316', borderRadius: '2px' }} />
          <span>Critical</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '3px', background: '#fbbf24', borderRadius: '2px' }} />
          <span>Warning</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '3px', background: theme.success, borderRadius: '2px' }} />
          <span>Safe</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '8px', height: '8px', background: theme.accent, borderRadius: '50%' }} />
          <span>Target</span>
        </div>
      </div>
    </div>
  );
};
