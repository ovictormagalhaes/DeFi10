/**
 * Sistema de Notificações TypeScript - Phase 3 Expansion
 * Tipos e interfaces para sistema completo de notificações, alerts e toasts
 */

export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  LOADING = 'loading'
}

export enum NotificationPosition {
  TOP_RIGHT = 'top-right',
  TOP_LEFT = 'top-left',
  TOP_CENTER = 'top-center',
  BOTTOM_RIGHT = 'bottom-right',
  BOTTOM_LEFT = 'bottom-left',
  BOTTOM_CENTER = 'bottom-center'
}

export enum NotificationAction {
  DISMISS = 'dismiss',
  RETRY = 'retry',
  CONFIRM = 'confirm',
  CANCEL = 'cancel',
  VIEW_DETAILS = 'view_details',
  UNDO = 'undo'
}

export interface NotificationButton {
  label: string;
  action: NotificationAction;
  handler: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export interface NotificationConfig {
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // milliseconds, 0 for persistent
  position?: NotificationPosition;
  dismissible?: boolean;
  showCloseButton?: boolean;
  buttons?: NotificationButton[];
  icon?: string;
  progress?: boolean;
  sound?: boolean;
  className?: string;
  onShow?: () => void;
  onDismiss?: () => void;
  onExpire?: () => void;
}

export interface Notification extends NotificationConfig {
  id: string;
  timestamp: number;
  isVisible: boolean;
  timeRemaining?: number;
  progressValue?: number; // Renamed to avoid conflict with boolean progress
}

export interface NotificationState {
  notifications: Notification[];
  maxNotifications: number;
  defaultDuration: number;
  defaultPosition: NotificationPosition;
  soundEnabled: boolean;
  animationsEnabled: boolean;
}

export interface NotificationContextValue {
  state: NotificationState;
  showNotification: (config: NotificationConfig) => string;
  dismissNotification: (id: string) => void;
  dismissAll: () => void;
  updateNotification: (id: string, updates: Partial<NotificationConfig>) => void;
  getNotification: (id: string) => Notification | undefined;
}

// Specialized notification types for common use cases
export interface ToastConfig extends Omit<NotificationConfig, 'type'> {
  type?: NotificationType.SUCCESS | NotificationType.ERROR | NotificationType.WARNING | NotificationType.INFO;
}

export interface AlertConfig extends Omit<NotificationConfig, 'type' | 'duration'> {
  type: NotificationType.WARNING | NotificationType.ERROR;
  duration?: 0; // Alerts are typically persistent
}

export interface LoadingConfig extends Omit<NotificationConfig, 'type' | 'dismissible'> {
  type: NotificationType.LOADING;
  dismissible: false;
  operationId?: string;
}

export interface ProgressConfig extends LoadingConfig {
  progress: true;
  currentStep?: number;
  totalSteps?: number;
  stepLabel?: string;
}

// Transaction-specific notifications
export interface TransactionNotificationConfig extends NotificationConfig {
  transactionHash?: string;
  chainId?: number;
  amount?: string;
  token?: string;
  from?: string;
  to?: string;
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  REJECTED = 'rejected'
}

export interface TransactionNotification extends TransactionNotificationConfig {
  id: string;
  status: TransactionStatus;
  confirmations?: number;
  requiredConfirmations?: number;
  gasUsed?: string;
  effectiveGasPrice?: string;
  blockNumber?: number;
  blockHash?: string;
}

// Wallet operation notifications
export interface WalletOperationConfig extends NotificationConfig {
  operationType: 'connect' | 'disconnect' | 'switch_chain' | 'add_token' | 'sign_message';
  walletType?: string;
  chainId?: number;
}

// Rebalancing notifications
export interface RebalanceNotificationConfig extends NotificationConfig {
  rebalanceId?: string;
  portfolioValue?: string;
  targetAllocations?: Array<{
    token: string;
    targetPercentage: number;
    currentPercentage: number;
  }>;
  estimatedGas?: string;
  slippage?: number;
}

// System notifications
export interface SystemNotificationConfig extends NotificationConfig {
  systemType: 'maintenance' | 'update' | 'network_issue' | 'rate_limit' | 'backup';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedFeatures?: string[];
  estimatedResolution?: string;
  updateUrl?: string;
}

// Notification templates for common scenarios
export const NOTIFICATION_TEMPLATES = {
  SUCCESS: {
    TRANSACTION_CONFIRMED: (hash: string, amount: string, token: string): NotificationConfig => ({
      type: NotificationType.SUCCESS,
      title: 'Transaction Confirmed',
      message: `Successfully sent ${amount} ${token}`,
      duration: 5000,
      buttons: [{
        label: 'View on Explorer',
        action: NotificationAction.VIEW_DETAILS,
        handler: () => { window.open(`https://etherscan.io/tx/${hash}`, '_blank'); }
      }]
    }),
    
    WALLET_CONNECTED: (walletType: string): NotificationConfig => ({
      type: NotificationType.SUCCESS,
      title: 'Wallet Connected',
      message: `Successfully connected to ${walletType}`,
      duration: 3000
    }),
    
    REBALANCE_COMPLETED: (portfolioValue: string): NotificationConfig => ({
      type: NotificationType.SUCCESS,
      title: 'Portfolio Rebalanced',
      message: `Successfully rebalanced portfolio worth $${portfolioValue}`,
      duration: 5000
    })
  },
  
  ERROR: {
    TRANSACTION_FAILED: (reason?: string): NotificationConfig => ({
      type: NotificationType.ERROR,
      title: 'Transaction Failed',
      message: reason || 'Transaction was rejected or failed to execute',
      duration: 0,
      buttons: [{
        label: 'Retry',
        action: NotificationAction.RETRY,
        handler: () => {} // To be implemented by caller
      }]
    }),
    
    WALLET_CONNECTION_FAILED: (error: string): NotificationConfig => ({
      type: NotificationType.ERROR,
      title: 'Connection Failed',
      message: `Could not connect to wallet: ${error}`,
      duration: 0
    }),
    
    INSUFFICIENT_BALANCE: (token: string, required: string, available: string): NotificationConfig => ({
      type: NotificationType.ERROR,
      title: 'Insufficient Balance',
      message: `Need ${required} ${token}, but only ${available} available`,
      duration: 0
    })
  },
  
  WARNING: {
    HIGH_GAS_FEE: (gasPrice: string): NotificationConfig => ({
      type: NotificationType.WARNING,
      title: 'High Gas Fees',
      message: `Current gas price is ${gasPrice} gwei. Consider waiting for lower fees.`,
      duration: 0,
      buttons: [
        {
          label: 'Proceed Anyway',
          action: NotificationAction.CONFIRM,
          handler: () => {},
          variant: 'danger'
        },
        {
          label: 'Wait',
          action: NotificationAction.CANCEL,
          handler: () => {}
        }
      ]
    }),
    
    SLIPPAGE_HIGH: (slippage: number): NotificationConfig => ({
      type: NotificationType.WARNING,
      title: 'High Slippage Warning',
      message: `Slippage tolerance is set to ${slippage}%. You may receive fewer tokens than expected.`,
      duration: 0
    })
  },
  
  INFO: {
    PRICE_ALERT: (token: string, price: string, direction: 'above' | 'below'): NotificationConfig => ({
      type: NotificationType.INFO,
      title: 'Price Alert',
      message: `${token} is now ${direction} $${price}`,
      duration: 0,
      buttons: [{
        label: 'View Chart',
        action: NotificationAction.VIEW_DETAILS,
        handler: () => {}
      }]
    }),
    
    PORTFOLIO_UPDATE: (change: string, period: string): NotificationConfig => ({
      type: NotificationType.INFO,
      title: 'Portfolio Update',
      message: `Your portfolio ${change > '0' ? 'gained' : 'lost'} ${Math.abs(parseFloat(change))}% in the last ${period}`,
      duration: 8000
    })
  },
  
  LOADING: {
    TRANSACTION_PENDING: (hash: string): LoadingConfig => ({
      type: NotificationType.LOADING,
      title: 'Transaction Pending',
      message: 'Waiting for blockchain confirmation...',
      dismissible: false,
      progress: true,
      buttons: [{
        label: 'View on Explorer',
        action: NotificationAction.VIEW_DETAILS,
        handler: () => { window.open(`https://etherscan.io/tx/${hash}`, '_blank'); }
      }]
    }),
    
    WALLET_CONNECTING: (walletType: string): LoadingConfig => ({
      type: NotificationType.LOADING,
      title: 'Connecting Wallet',
      message: `Connecting to ${walletType}...`,
      dismissible: false
    }),
    
    REBALANCE_CALCULATING: (): ProgressConfig => ({
      type: NotificationType.LOADING,
      title: 'Calculating Rebalance',
      message: 'Analyzing your portfolio and calculating optimal trades...',
      dismissible: false,
      progress: true,
      currentStep: 1,
      totalSteps: 3,
      stepLabel: 'Fetching current prices'
    })
  }
} as const;

// Notification queue management
export interface NotificationQueue {
  pending: Notification[];
  active: Notification[];
  dismissed: Notification[];
  maxActive: number;
  maxPending: number;
}

// Notification persistence
export interface NotificationStorage {
  storageKey: string;
  persistDismissed: boolean;
  maxStoredNotifications: number;
  ttl: number; // Time to live in storage (milliseconds)
}

// Notification settings
export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  position: NotificationPosition;
  maxNotifications: number;
  defaultDuration: number;
  animationsEnabled: boolean;
  groupSimilar: boolean;
  pauseOnHover: boolean;
  rtl: boolean;
}