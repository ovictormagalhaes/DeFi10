import { useTheme } from '../../context/ThemeProvider';

interface EmptyStateCardProps {
  label: string;
}

const EmptyStateCard: React.FC<EmptyStateCardProps> = ({ label }) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '40px 20px',
        color: theme.textSecondary,
        fontSize: 14,
      }}
    >
      No {label} found
    </div>
  );
};

export default EmptyStateCard;
