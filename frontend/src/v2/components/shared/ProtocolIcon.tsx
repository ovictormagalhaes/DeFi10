import React from 'react';
import { getProtocolConfig } from '../../../constants/protocols';
import SafeImage from '../../../components/SafeImage';

interface ProtocolIconProps {
  name: string;
  size?: number;
  className?: string;
}

export const ProtocolIcon: React.FC<ProtocolIconProps> = ({ name, size = 30, className }) => {
  const config = getProtocolConfig(name);
  const initial = (name || '?')[0].toUpperCase();

  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    background: 'var(--v2-bg-hover)',
    border: '1px solid var(--v2-border)',
  };

  if (config.logo) {
    return (
      <div style={style} className={className}>
        <SafeImage
          src={config.logo}
          alt={config.name}
          style={{ width: size * 0.75, height: size * 0.75, objectFit: 'contain' }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...style,
        fontSize: size * 0.42,
        fontWeight: 800,
        color: 'var(--v2-muted)',
      }}
      className={className}
    >
      {initial}
    </div>
  );
};

export default ProtocolIcon;
