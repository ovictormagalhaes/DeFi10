import { useEffect, useState } from 'react';

interface FadeTransitionProps {
  children: React.ReactNode;
  transitionKey: string;
  duration?: number;
}

export default function FadeTransition({ children, transitionKey, duration = 200 }: FadeTransitionProps) {
  const [visible, setVisible] = useState(false);
  const [currentKey, setCurrentKey] = useState(transitionKey);
  const [content, setContent] = useState(children);

  useEffect(() => {
    if (transitionKey !== currentKey) {
      setVisible(false);
      const t = setTimeout(() => {
        setContent(children);
        setCurrentKey(transitionKey);
        setVisible(true);
      }, duration / 2);
      return () => clearTimeout(t);
    } else {
      setContent(children);
      setVisible(true);
    }
  }, [transitionKey, children]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: `opacity ${duration / 2}ms ease, transform ${duration / 2}ms ease`,
      }}
    >
      {content}
    </div>
  );
}
