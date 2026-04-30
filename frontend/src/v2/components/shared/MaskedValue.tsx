import React from 'react';
import { useV2 } from '../../context/V2Context';

interface MaskedValueProps {
  value: string;
  className?: string;
  style?: React.CSSProperties;
}

export const MaskedValue: React.FC<MaskedValueProps> = ({ value, className, style }) => {
  const { maskValues } = useV2();
  return (
    <span className={className} style={style}>
      {maskValues ? '••••••' : value}
    </span>
  );
};

export default MaskedValue;
