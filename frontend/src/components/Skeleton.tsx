interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  circle?: boolean;
  inline?: boolean;
  className?: string;
}

/**
 * Generic Skeleton block.
 * Props:
 *  - width / height: explicit dimensions (fallback to CSS class variants)
 *  - circle: renders as a circle (uses min of width/height)
 *  - inline: inline-block instead of block
 */
export function Skeleton({
  width,
  height,
  circle = false,
  inline = false,
  className = '',
}: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? width + 'px' : width;
  if (height) style.height = typeof height === 'number' ? height + 'px' : height;
  if (circle) style.borderRadius = '50%';
  const base = ['skeleton', inline ? 'inline' : '', className].filter(Boolean).join(' ');
  return <span className={base} style={style} aria-hidden="true" />;
}

interface TextSkeletonProps {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  className?: string;
}

export function TextSkeleton({
  lines = 1,
  lineHeight = 13,
  gap = 6,
  className = '',
}: TextSkeletonProps) {
  const arr = Array.from({ length: lines });
  return (
    <span
      className={['skeleton-text-stack', className].filter(Boolean).join(' ')}
      style={{ display: 'flex', flexDirection: 'column', gap }}
    >
      {arr.map((_, i) => (
        <Skeleton key={i} height={lineHeight} className="text" />
      ))}
    </span>
  );
}

export default Skeleton;
