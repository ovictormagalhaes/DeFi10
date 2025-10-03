import React from 'react';
import InfoIconWithTooltip from './InfoIconWithTooltip';

/**
 * MiniMetric
 * Pequeno bloco métrico reutilizável.
 * Props:
 *  - label: string (opcional)
 *  - value: ReactNode
 *  - custom: ReactNode (componente customizado que substitui o value)
 *  - tooltip: string | ReactNode (conteúdo do tooltip)
 *  - icon: ReactNode (prefix icon pequeno opcional)
 *  - accent: boolean (aplica cor de destaque)
 *  - condensed: boolean (aplica estilo "pill" compacto, usado para percent badges)
 *  - strong: boolean (peso maior)
 *  - align: 'left' | 'right' | 'center' (alinhamento do value)
 *  - mono: boolean (font mono no value)
 *  - size: 'xs' | 'sm' | 'md' | 'lg'
 *  - className: string adicional
 *  - style: inline override mínimo (evitar usar amplamente)
 */
export default function MiniMetric({
  label,
  value,
  custom = null,
  tooltip = '',
  icon = null,
  accent = false,
  condensed = false,
  strong = false,
  align = 'center',
  mono = true,
  size = 'sm',
  className = '',
  style = {},
}) {
  const sizeMap = {
    xs: 10,
    sm: 12,
    md: 13,
    lg: 16,
  };
  const fontSize = sizeMap[size] || 12;

  const baseCls = [
    'mini-metric',
    condensed ? 'mini-metric-condensed' : '',
    accent ? 'accent' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const valueCls = [
    'mini-metric-value',
    accent ? 'accent' : '',
    mono ? 'mono' : '',
    strong ? 'strong' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={baseCls} style={style}>
      {label && <span className="mini-metric-label">{label}</span>}
      <div className="mini-metric-row" style={{ justifyContent: align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end' }}>
        {icon && <span className="mini-metric-icon">{icon}</span>}
        {custom ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'inherit' }}>
            {custom}
          </div>
        ) : (
          <span className={valueCls} style={{ fontSize }}>{value}</span>
        )}
        {tooltip && (
          <InfoIconWithTooltip
            content={tooltip}
            align="center"
            maxWidth={240}
          />
        )}
      </div>
    </div>
  );
}
