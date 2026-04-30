import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../../../context/ThemeProvider';
import { useV2 } from '../../context/V2Context';
import s from './V2Header.module.css';

const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
    <path
      d="M1 9s3-5.5 8-5.5S17 9 17 9s-3 5.5-8 5.5S1 9 1 9Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const IconEyeOff = () => (
  <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
    <path
      d="M2 2l14 14M7.5 7.7A2.5 2.5 0 0 0 11.3 11M4.4 4.5C2.9 5.7 1.7 7.3 1 9c1.6 3.6 5 6 8 6 1.5 0 3-.5 4.2-1.3M8 3.1C8.3 3 8.7 3 9 3c3 0 6.4 2.4 8 6a13 13 0 0 1-1.9 3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
const IconMoon = () => (
  <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
    <path
      d="M15 10.5a6 6 0 1 1-7.5-7.5A7 7 0 1 0 15 10.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);
const IconSun = () => (
  <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="4" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M9 1v2M9 15v2M1 9h2M15 9h2M3.2 3.2l1.4 1.4M13.4 13.4l1.4 1.4M14.8 3.2l-1.4 1.4M4.6 13.4l-1.4 1.4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
const IconWallet = () => (
  <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
    <path
      d="M3 5h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M1 8h16M13 11.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconInfo = () => (
  <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 8v4M9 6h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

interface V2HeaderProps {
  onOpenWalletGroups?: () => void;
}

export const V2Header: React.FC<V2HeaderProps> = ({ onOpenWalletGroups }) => {
  const { mode, toggleTheme } = useTheme();
  const { maskValues, toggleMaskValues, account, selectedWalletGroupId } = useV2();
  const navigate = useNavigate();

  const shortAddress = account
    ? `${account.slice(0, 4)}…${account.slice(-4)}`
    : selectedWalletGroupId
      ? 'Group'
      : null;

  const logoSrc = mode === 'light' ? '/logo_extended_light.svg' : '/logo_extended.svg';

  return (
    <header className={s.header}>
      <div className={s.logo} onClick={() => navigate('/')}>
        <img src={logoSrc} alt="DeFi10" className={s.logoImg} />
      </div>

      <nav className={s.nav}>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${s.navLink} ${isActive ? s.navLinkActive : ''}`}
        >
          <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
            <rect
              x="2"
              y="2"
              width="6"
              height="6"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect
              x="10"
              y="2"
              width="6"
              height="6"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect
              x="2"
              y="10"
              width="6"
              height="6"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect
              x="10"
              y="10"
              width="6"
              height="6"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          Dashboard
        </NavLink>
        <NavLink
          to="/strategies"
          className={({ isActive }) => `${s.navLink} ${isActive ? s.navLinkActive : ''}`}
        >
          <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M9 3V6M9 12V15M3 9H6M12 9H15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Strategies
        </NavLink>
      </nav>

      <div className={s.right}>
        <button className={s.iconBtn} title="Protocol status">
          <IconInfo />
        </button>
        <button className={s.iconBtn} onClick={toggleTheme} title="Toggle theme">
          {mode === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <button
          className={`${s.iconBtn} ${maskValues ? s.iconBtnOn : ''}`}
          onClick={toggleMaskValues}
          title={maskValues ? 'Show values' : 'Hide values'}
        >
          {maskValues ? <IconEyeOff /> : <IconEye />}
        </button>
        <button className={s.iconBtn} onClick={onOpenWalletGroups} title="Wallet groups">
          <IconWallet />
        </button>
        {shortAddress && (
          <div className={s.walletChip}>
            <div className={s.walletDot} />
            {shortAddress}
          </div>
        )}
      </div>
    </header>
  );
};

export default V2Header;
