/**
 * Exemplos de Uso do Sistema de Notificações TypeScript - Phase 3 Expansion
 * Demonstra como usar o sistema completo de notificações em diferentes cenários
 */

import React from 'react';
import {
  useNotifications,
  useToast,
  useTransactionNotifications,
  useWalletNotifications,
  useRebalanceNotifications
} from '../hooks/useNotifications';
import {
  NotificationType,
  NotificationPosition,
  NotificationAction,
  NOTIFICATION_TEMPLATES
} from '../types/notifications';

// Exemplo básico de uso de notificações
export const BasicNotificationExamples: React.FC = () => {
  const { showNotification } = useNotifications();
  const toast = useToast();

  const showBasicSuccess = () => {
    toast.success('Operation Successful', 'Your transaction has been completed successfully.');
  };

  const showBasicError = () => {
    toast.error('Operation Failed', 'Something went wrong. Please try again.');
  };

  const showCustomNotification = () => {
    showNotification({
      type: NotificationType.INFO,
      title: 'Custom Notification',
      message: 'This is a custom notification with multiple buttons',
      duration: 0,
      position: NotificationPosition.TOP_CENTER,
      buttons: [
        {
          label: 'Action 1',
          action: NotificationAction.CONFIRM,
          handler: () => console.log('Action 1 clicked'),
          variant: 'primary'
        },
        {
          label: 'Action 2',
          action: NotificationAction.VIEW_DETAILS,
          handler: async () => {
            // Simulate async operation
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success('Action completed!');
          },
          variant: 'secondary'
        }
      ]
    });
  };

  const showProgressNotification = () => {
    const id = showNotification({
      type: NotificationType.LOADING,
      title: 'Processing...',
      message: 'Please wait while we process your request',
      progress: true,
      dismissible: false
    });

    // Simulate progress updates
    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      // Note: In real implementation, you would update notification progress
      // This is just for demonstration
      if (progress >= 100) {
        clearInterval(interval);
        toast.success('Process completed!');
      }
    }, 1000);
  };

  return (
    <div className="notification-examples">
      <h3>Basic Notification Examples</h3>
      <div className="button-group">
        <button onClick={showBasicSuccess}>Show Success</button>
        <button onClick={showBasicError}>Show Error</button>
        <button onClick={showCustomNotification}>Custom Notification</button>
        <button onClick={showProgressNotification}>Progress Notification</button>
      </div>
    </div>
  );
};

// Exemplo de notificações de transação
export const TransactionNotificationExamples: React.FC = () => {
  const txNotifications = useTransactionNotifications();
  const toast = useToast();

  const simulateTransaction = async () => {
    // Show pending notification
    const txHash = '0x1234567890abcdef1234567890abcdef12345678';
    const pendingId = txNotifications.showPending(txHash);

    try {
      // Simulate transaction processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulate random success/failure
      const success = Math.random() > 0.3;
      
      if (success) {
        txNotifications.showConfirmed(txHash, '1.5', 'ETH');
      } else {
        txNotifications.showFailed('Transaction reverted due to insufficient gas');
      }
    } catch (error) {
      txNotifications.showFailed('Network error occurred');
    }
  };

  const simulateTransactionWithProgress = async () => {
    const txHash = '0xabcdef1234567890abcdef1234567890abcdef12';
    const pendingId = txNotifications.showPending(txHash);

    // Simulate confirmation progress
    for (let confirmations = 0; confirmations <= 12; confirmations++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const progress = txNotifications.updateProgress(pendingId, confirmations, 12);
      
      if (confirmations === 12) {
        toast.success('Transaction fully confirmed!');
      }
    }
  };

  return (
    <div className="transaction-examples">
      <h3>Transaction Notification Examples</h3>
      <div className="button-group">
        <button onClick={simulateTransaction}>Simulate Transaction</button>
        <button onClick={simulateTransactionWithProgress}>Transaction with Progress</button>
      </div>
    </div>
  );
};

// Exemplo de notificações de wallet
export const WalletNotificationExamples: React.FC = () => {
  const walletNotifications = useWalletNotifications();

  const simulateWalletConnection = async () => {
    const connectingId = walletNotifications.showConnecting('MetaMask');
    
    try {
      // Simulate connection process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate random success/failure
      const success = Math.random() > 0.2;
      
      if (success) {
        walletNotifications.showConnected('MetaMask');
      } else {
        walletNotifications.showConnectionFailed('User rejected the request');
      }
    } catch (error) {
      walletNotifications.showConnectionFailed('Connection timeout');
    }
  };

  return (
    <div className="wallet-examples">
      <h3>Wallet Notification Examples</h3>
      <div className="button-group">
        <button onClick={simulateWalletConnection}>Connect Wallet</button>
      </div>
    </div>
  );
};

// Exemplo de notificações de rebalanceamento
export const RebalanceNotificationExamples: React.FC = () => {
  const rebalanceNotifications = useRebalanceNotifications();
  const toast = useToast();

  const simulateRebalancing = async () => {
    const calculatingId = rebalanceNotifications.showCalculating();
    
    try {
      // Simulate calculation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Show high slippage warning
      const slippageWarning = rebalanceNotifications.showHighSlippage(5.2);
      
      // Wait for user decision (simplified for demo)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate successful rebalancing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      rebalanceNotifications.showCompleted('$125,430.50');
    } catch (error) {
      toast.error('Rebalancing Failed', 'An error occurred during portfolio rebalancing');
    }
  };

  const showInsufficientBalance = () => {
    rebalanceNotifications.showInsufficientBalance('ETH', '2.5', '1.2');
  };

  return (
    <div className="rebalance-examples">
      <h3>Rebalance Notification Examples</h3>
      <div className="button-group">
        <button onClick={simulateRebalancing}>Simulate Rebalancing</button>
        <button onClick={showInsufficientBalance}>Insufficient Balance</button>
      </div>
    </div>
  );
};

// Exemplo de notificações avançadas
export const AdvancedNotificationExamples: React.FC = () => {
  const { showNotification, dismissAll, state } = useNotifications();

  const showPriceAlert = () => {
    const config = NOTIFICATION_TEMPLATES.INFO.PRICE_ALERT('BTC', '45,000', 'above');
    showNotification(config);
  };

  const showHighGasFee = () => {
    const config = NOTIFICATION_TEMPLATES.WARNING.HIGH_GAS_FEE('150');
    showNotification({
      ...config,
      buttons: [
        {
          label: 'Proceed Anyway',
          action: NotificationAction.CONFIRM,
          handler: () => {
            showNotification({
              type: NotificationType.SUCCESS,
              title: 'Transaction Submitted',
              message: 'Your transaction has been submitted with high gas fees',
              duration: 5000
            });
          },
          variant: 'danger'
        },
        {
          label: 'Wait for Lower Fees',
          action: NotificationAction.CANCEL,
          handler: () => {
            showNotification({
              type: NotificationType.INFO,
              title: 'Transaction Cancelled',
              message: 'We\'ll notify you when gas fees are lower',
              duration: 3000
            });
          }
        }
      ]
    });
  };

  const showMultiplePositions = () => {
    // Show notifications in different positions
    const positions = [
      NotificationPosition.TOP_LEFT,
      NotificationPosition.TOP_RIGHT,
      NotificationPosition.BOTTOM_LEFT,
      NotificationPosition.BOTTOM_RIGHT
    ];

    positions.forEach((position, index) => {
      setTimeout(() => {
        showNotification({
          type: NotificationType.INFO,
          title: `Notification ${index + 1}`,
          message: `This notification appears in ${position}`,
          position,
          duration: 5000
        });
      }, index * 500);
    });
  };

  const showUndoNotification = () => {
    showNotification({
      type: NotificationType.SUCCESS,
      title: 'Token Removed',
      message: 'USDC has been removed from your watchlist',
      duration: 10000,
      buttons: [
        {
          label: 'Undo',
          action: NotificationAction.UNDO,
          handler: () => {
            showNotification({
              type: NotificationType.INFO,
              title: 'Token Restored',
              message: 'USDC has been added back to your watchlist',
              duration: 3000
            });
          },
          variant: 'primary'
        }
      ]
    });
  };

  return (
    <div className="advanced-examples">
      <h3>Advanced Notification Examples</h3>
      <div className="button-group">
        <button onClick={showPriceAlert}>Price Alert</button>
        <button onClick={showHighGasFee}>High Gas Fee Warning</button>
        <button onClick={showMultiplePositions}>Multiple Positions</button>
        <button onClick={showUndoNotification}>Undo Notification</button>
        <button onClick={dismissAll}>Dismiss All ({state.notifications.length})</button>
      </div>
    </div>
  );
};

// Componente principal que demonstra todos os exemplos
export const NotificationExamplesDemo: React.FC = () => {
  return (
    <div className="notification-examples-demo">
      <h2>Notification System Demo - Phase 3 TypeScript</h2>
      
      <div className="examples-grid">
        <BasicNotificationExamples />
        <TransactionNotificationExamples />
        <WalletNotificationExamples />
        <RebalanceNotificationExamples />
        <AdvancedNotificationExamples />
      </div>

      <style>{`
        .notification-examples-demo {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .examples-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        
        .notification-examples-demo > div {
          padding: 20px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #f9fafb;
        }
        
        .notification-examples-demo h3 {
          margin: 0 0 15px 0;
          color: #111827;
          font-size: 18px;
        }
        
        .button-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .button-group button {
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: white;
          color: #374151;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        
        .button-group button:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }
        
        .button-group button:active {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
};

export default NotificationExamplesDemo;