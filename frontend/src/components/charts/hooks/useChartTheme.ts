// src/components/charts/hooks/useChartTheme.ts
import { useMemo } from 'react';
import { useTheme } from '../../../context/ThemeProvider';

export const useChartTheme = () => {
  const { theme } = useTheme();

  const chartColors = useMemo(() => ({
    // Portfolio Categories
    wallet: '#3b82f6',
    liquidity: '#10b981',
    lending: '#8b5cf6',
    staking: '#f59e0b',
    
    // Extended palette for multiple items
    palette: [
      '#3b82f6', // Blue
      '#10b981', // Green
      '#8b5cf6', // Purple
      '#f59e0b', // Orange
      '#ec4899', // Pink
      '#14b8a6', // Teal
      '#f43f5e', // Rose
      '#8b5cf6', // Violet
      '#06b6d4', // Cyan
      '#84cc16', // Lime
    ],
    
    // Chart elements
    grid: 'rgba(255, 255, 255, 0.05)',
    axis: theme.textSecondary,
    tooltip: {
      bg: 'rgba(0, 0, 0, 0.95)',
      border: 'rgba(255, 255, 255, 0.1)'
    }
  }), [theme]);

  return { theme, chartColors };
};
