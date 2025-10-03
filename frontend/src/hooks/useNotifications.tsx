/**
 * Hook de Notificações TypeScript - Phase 3 Expansion
 * Sistema completo de gerenciamento de notificações com React Context
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import {
  Notification,
  NotificationConfig,
  NotificationState,
  NotificationContextValue,
  NotificationType,
  NotificationPosition,
  NotificationSettings,
  NOTIFICATION_TEMPLATES
} from '../types/notifications';

// Initial state
const initialState: NotificationState = {
  notifications: [],
  maxNotifications: 5,
  defaultDuration: 4000,
  defaultPosition: NotificationPosition.TOP_RIGHT,
  soundEnabled: true,
  animationsEnabled: true
};

// Action types for reducer
type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'UPDATE_NOTIFICATION'; payload: { id: string; updates: Partial<NotificationConfig> } }
  | { type: 'SET_VISIBILITY'; payload: { id: string; isVisible: boolean } }
  | { type: 'UPDATE_PROGRESS'; payload: { id: string; progress: number } }
  | { type: 'UPDATE_TIME_REMAINING'; payload: { id: string; timeRemaining: number } };

// Notification reducer
function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'ADD_NOTIFICATION': {
      const newNotifications = [...state.notifications, action.payload];
      
      // Remove oldest notifications if exceeding max
      if (newNotifications.length > state.maxNotifications) {
        const excess = newNotifications.length - state.maxNotifications;
        newNotifications.splice(0, excess);
      }
      
      return {
        ...state,
        notifications: newNotifications
      };
    }
    
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };
    
    case 'CLEAR_ALL':
      return {
        ...state,
        notifications: []
      };
    
    case 'UPDATE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload.id
            ? { ...notification, ...action.payload.updates }
            : notification
        )
      };
    
    case 'SET_VISIBILITY':
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload.id
            ? { ...notification, isVisible: action.payload.isVisible }
            : notification
        )
      };
    
    case 'UPDATE_PROGRESS':
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload.id
            ? { ...notification, progressValue: action.payload.progress }
            : notification
        )
      };
    
    case 'UPDATE_TIME_REMAINING':
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload.id
            ? { ...notification, timeRemaining: action.payload.timeRemaining }
            : notification
        )
      };
    
    default:
      return state;
  }
}

// Context
const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// Provider Props
interface NotificationProviderProps {
  children: React.ReactNode;
  settings?: Partial<NotificationSettings>;
}

// Generate unique ID
function generateId(): string {
  return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Play notification sound
function playNotificationSound(type: NotificationType, soundEnabled: boolean): void {
  if (!soundEnabled) return;
  
  try {
    const audio = new Audio();
    switch (type) {
      case NotificationType.SUCCESS:
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEF';
        break;
      case NotificationType.ERROR:
        audio.src = 'data:audio/wav;base64,UklGRt4DAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YboDAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEF';
        break;
      default:
        audio.src = 'data:audio/wav;base64,UklGRr4BAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YZoBAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjeH1PLWeDEF';
    }
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Ignore audio play errors (user interaction required)
    });
  } catch (error) {
    // Ignore audio errors
  }
}

// Provider Component
export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  settings = {}
}) => {
  const [state, dispatch] = useReducer(notificationReducer, {
    ...initialState,
    ...settings
  });
  
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Update time remaining for notifications with duration
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      state.notifications.forEach(notification => {
        if (notification.duration && notification.duration > 0 && notification.timeRemaining !== undefined) {
          const newTimeRemaining = notification.timeRemaining - 100;
          if (newTimeRemaining <= 0) {
            dismissNotification(notification.id);
          } else {
            dispatch({
              type: 'UPDATE_TIME_REMAINING',
              payload: { id: notification.id, timeRemaining: newTimeRemaining }
            });
          }
        }
      });
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.notifications]);

  const showNotification = useCallback((config: NotificationConfig): string => {
    const id = generateId();
    const duration = config.duration ?? state.defaultDuration;
    
    const notification: Notification = {
      ...config,
      id,
      timestamp: Date.now(),
      isVisible: true,
      timeRemaining: duration > 0 ? duration : undefined,
      position: config.position ?? state.defaultPosition
    };

    // Play sound
    playNotificationSound(config.type, state.soundEnabled);

    // Add notification
    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });

    // Call onShow callback
    if (config.onShow) {
      config.onShow();
    }

    // Auto-dismiss if duration is set
    if (duration > 0) {
      const timer = setTimeout(() => {
        dismissNotification(id);
        if (config.onExpire) {
          config.onExpire();
        }
      }, duration);
      
      timersRef.current.set(id, timer);
    }

    return id;
  }, [state.defaultDuration, state.defaultPosition, state.soundEnabled]);

  const dismissNotification = useCallback((id: string) => {
    const notification = state.notifications.find(n => n.id === id);
    
    // Clear timer if exists
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    // Call onDismiss callback
    if (notification?.onDismiss) {
      notification.onDismiss();
    }

    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, [state.notifications]);

  const dismissAll = useCallback(() => {
    // Clear all timers
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();

    // Call onDismiss for all notifications
    state.notifications.forEach(notification => {
      if (notification.onDismiss) {
        notification.onDismiss();
      }
    });

    dispatch({ type: 'CLEAR_ALL' });
  }, [state.notifications]);

  const updateNotification = useCallback((id: string, updates: Partial<NotificationConfig>) => {
    dispatch({
      type: 'UPDATE_NOTIFICATION',
      payload: { id, updates }
    });
  }, []);

  const getNotification = useCallback((id: string): Notification | undefined => {
    return state.notifications.find(n => n.id === id);
  }, [state.notifications]);

  const contextValue: NotificationContextValue = {
    state,
    showNotification,
    dismissNotification,
    dismissAll,
    updateNotification,
    getNotification
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

// Hook para usar notificações
export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Hook conveniente para tipos específicos de notificação
export const useToast = () => {
  const { showNotification } = useNotifications();

  return {
    success: (title: string, message?: string, duration?: number) =>
      showNotification({
        type: NotificationType.SUCCESS,
        title,
        message,
        duration
      }),
    
    error: (title: string, message?: string) =>
      showNotification({
        type: NotificationType.ERROR,
        title,
        message,
        duration: 0
      }),
    
    warning: (title: string, message?: string) =>
      showNotification({
        type: NotificationType.WARNING,
        title,
        message,
        duration: 0
      }),
    
    info: (title: string, message?: string, duration?: number) =>
      showNotification({
        type: NotificationType.INFO,
        title,
        message,
        duration
      }),
    
    loading: (title: string, message?: string) =>
      showNotification({
        type: NotificationType.LOADING,
        title,
        message,
        dismissible: false
      })
  };
};

// Hook para notificações de transação
export const useTransactionNotifications = () => {
  const { showNotification, updateNotification, dismissNotification } = useNotifications();

  return {
    showPending: (hash: string) => {
      const config = NOTIFICATION_TEMPLATES.LOADING.TRANSACTION_PENDING(hash);
      return showNotification(config);
    },
    
    showConfirmed: (hash: string, amount: string, token: string) => {
      const config = NOTIFICATION_TEMPLATES.SUCCESS.TRANSACTION_CONFIRMED(hash, amount, token);
      return showNotification(config);
    },
    
    showFailed: (reason?: string) => {
      const config = NOTIFICATION_TEMPLATES.ERROR.TRANSACTION_FAILED(reason);
      return showNotification(config);
    },
    
    updateProgress: (id: string, confirmations: number, required: number) => {
      const progress = Math.min((confirmations / required) * 100, 100);
      updateNotification(id, {
        message: `Confirmations: ${confirmations}/${required}`,
        progress: true
      });
      
      // Update progress value separately
      return progress;
    }
  };
};

// Hook para notificações de wallet
export const useWalletNotifications = () => {
  const { showNotification } = useNotifications();

  return {
    showConnected: (walletType: string) => {
      const config = NOTIFICATION_TEMPLATES.SUCCESS.WALLET_CONNECTED(walletType);
      return showNotification(config);
    },
    
    showConnectionFailed: (error: string) => {
      const config = NOTIFICATION_TEMPLATES.ERROR.WALLET_CONNECTION_FAILED(error);
      return showNotification(config);
    },
    
    showConnecting: (walletType: string) => {
      const config = NOTIFICATION_TEMPLATES.LOADING.WALLET_CONNECTING(walletType);
      return showNotification(config);
    }
  };
};

// Hook para notificações de rebalanceamento
export const useRebalanceNotifications = () => {
  const { showNotification } = useNotifications();

  return {
    showCalculating: () => {
      const config = NOTIFICATION_TEMPLATES.LOADING.REBALANCE_CALCULATING();
      return showNotification(config);
    },
    
    showCompleted: (portfolioValue: string) => {
      const config = NOTIFICATION_TEMPLATES.SUCCESS.REBALANCE_COMPLETED(portfolioValue);
      return showNotification(config);
    },
    
    showHighSlippage: (slippage: number) => {
      const config = NOTIFICATION_TEMPLATES.WARNING.SLIPPAGE_HIGH(slippage);
      return showNotification(config);
    },
    
    showInsufficientBalance: (token: string, required: string, available: string) => {
      const config = NOTIFICATION_TEMPLATES.ERROR.INSUFFICIENT_BALANCE(token, required, available);
      return showNotification(config);
    }
  };
};

// Export do context para uso avançado
export { NotificationContext };