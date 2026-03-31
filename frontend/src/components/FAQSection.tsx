import { useState } from 'react';

import { useTheme } from '../context/ThemeProvider';

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

interface FAQSectionProps {
  title?: string;
  subtitle?: string;
  faqs?: FAQItem[];
  style?: React.CSSProperties;
}

const FAQSection = ({
  title = 'FAQS',
  subtitle = 'Here you can find all the frequently asked questions!',
  faqs = [],
  style = {},
}: FAQSectionProps): React.ReactElement => {
  const { theme } = useTheme();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleFAQ = (id: number): void => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 20px',
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 40,
        }}
      >
        <h1
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: theme.textPrimary,
            margin: 0,
            marginBottom: 12,
            letterSpacing: '2px',
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: theme.textSecondary,
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      </div>

      {/* FAQ Items */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {faqs.map((faq, index) => {
          const isExpanded = expandedIds.has(index);

          return (
            <div
              key={index}
              style={{
                background: theme.bgPanel,
                border: `1px solid ${theme.border}`,
                borderRadius: 12,
                overflow: 'hidden',
                transition: 'all 0.3s ease',
              }}
            >
              {/* Question Button */}
              <button
                onClick={() => toggleFAQ(index)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px 24px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.background = theme.bgHover || 'rgba(255, 255, 255, 0.03)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    color: theme.textPrimary,
                    flex: 1,
                  }}
                >
                  {faq.question}
                </span>

                {/* Toggle Icon */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: isExpanded ? theme.accent : 'rgba(255, 255, 255, 0.1)',
                    flexShrink: 0,
                    marginLeft: 16,
                    transition: 'all 0.3s ease',
                  }}
                >
                  {isExpanded ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={theme.textSecondary}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Answer Content */}
              {isExpanded && (
                <div
                  style={{
                    padding: '0 24px 20px 24px',
                    color: theme.textSecondary,
                    fontSize: 15,
                    lineHeight: '1.6',
                    animation: 'fadeIn 0.3s ease',
                  }}
                >
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default FAQSection;
