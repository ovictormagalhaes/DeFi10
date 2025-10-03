/**
 * Componente de Notificações TypeScript - Phase 3 Expansion
 * Interface visual completa para sistema de notificações
 */

import React, { useState, useEffect } from 'react';
import {
  Notification,
  NotificationType,
  NotificationPosition,
  NotificationAction
} from '../types/notifications';
import { useNotifications } from '../hooks/useNotifications';

// Notification Item Component
interface NotificationItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onButtonClick: (action: NotificationAction, handler: () => void | Promise<void>) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onDismiss,
  onButtonClick
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(notification.id), 300);
  };

  const getTypeIcon = (type: NotificationType): string => {
    switch (type) {
      case NotificationType.SUCCESS:
        return '✅';
      case NotificationType.ERROR:
        return '❌';
      case NotificationType.WARNING:
        return '⚠️';
      case NotificationType.INFO:
        return 'ℹ️';
      case NotificationType.LOADING:
        return '⏳';
      default:
        return '📢';
    }
  };

  const getTypeClass = (type: NotificationType): string => {
    const baseClass = 'notification-item';
    switch (type) {
      case NotificationType.SUCCESS:
        return `${baseClass} notification-success`;
      case NotificationType.ERROR:
        return `${baseClass} notification-error`;
      case NotificationType.WARNING:
        return `${baseClass} notification-warning`;
      case NotificationType.INFO:
        return `${baseClass} notification-info`;
      case NotificationType.LOADING:
        return `${baseClass} notification-loading`;
      default:
        return baseClass;
    }
  };

  const progressPercentage = notification.timeRemaining && notification.duration
    ? ((notification.duration - notification.timeRemaining) / notification.duration) * 100
    : notification.progressValue || 0;

  return (
    <div
      className={`${getTypeClass(notification.type)} ${isVisible ? 'visible' : ''} ${
        notification.className || ''
      }`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.3s ease-in-out'
      }}
    >
      {/* Icon */}
      <div className="notification-icon">
        {notification.icon || getTypeIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        {notification.message && (
          <div className="notification-message">{notification.message}</div>
        )}

        {/* Progress Bar */}
        {notification.progress && (
          <div className="notification-progress">
            <div
              className="notification-progress-bar"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}

        {/* Time Remaining */}
        {notification.timeRemaining && notification.timeRemaining > 0 && (
          <div className="notification-time">
            {Math.ceil(notification.timeRemaining / 1000)}s
          </div>
        )}
      </div>

      {/* Buttons */}
      {notification.buttons && notification.buttons.length > 0 && (
        <div className="notification-buttons">
          {notification.buttons.map((button, index) => (
            <button
              key={index}
              className={`notification-button ${button.variant || 'secondary'}`}
              onClick={() => onButtonClick(button.action, button.handler)}
              disabled={button.loading}
            >
              {button.loading ? '...' : button.label}
            </button>
          ))}
        </div>
      )}

      {/* Close Button */}
      {(notification.dismissible !== false || notification.showCloseButton) && (
        <button
          className="notification-close"
          onClick={handleDismiss}
          aria-label="Close notification"
        >
          ×
        </button>
      )}

      {/* Auto-dismiss progress */}
      {notification.duration && notification.duration > 0 && !isPaused && (
        <div
          className="notification-autodismiss"
          style={{
            width: `${100 - progressPercentage}%`,
            transition: 'width 0.1s linear'
          }}
        />
      )}
    </div>
  );
};

// Notification Container Component
interface NotificationContainerProps {
  position?: NotificationPosition;
  maxVisible?: number;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  position = NotificationPosition.TOP_RIGHT,
  maxVisible = 5
}) => {
  const { state, dismissNotification } = useNotifications();
  const [loadingButtons, setLoadingButtons] = useState<Set<string>>(new Set());

  const handleButtonClick = async (
    action: NotificationAction,
    handler: () => void | Promise<void>
  ) => {
    const buttonId = `${action}_${Date.now()}`;
    
    try {
      setLoadingButtons(prev => new Set(prev).add(buttonId));
      await handler();
    } catch (error) {
      console.error('Notification button action failed:', error);
    } finally {
      setLoadingButtons(prev => {
        const newSet = new Set(prev);
        newSet.delete(buttonId);
        return newSet;
      });
    }
  };

  const getContainerClass = (pos: NotificationPosition): string => {
    const baseClass = 'notification-container';
    switch (pos) {
      case NotificationPosition.TOP_RIGHT:
        return `${baseClass} top-right`;
      case NotificationPosition.TOP_LEFT:
        return `${baseClass} top-left`;
      case NotificationPosition.TOP_CENTER:
        return `${baseClass} top-center`;
      case NotificationPosition.BOTTOM_RIGHT:
        return `${baseClass} bottom-right`;
      case NotificationPosition.BOTTOM_LEFT:
        return `${baseClass} bottom-left`;
      case NotificationPosition.BOTTOM_CENTER:
        return `${baseClass} bottom-center`;
      default:
        return `${baseClass} top-right`;
    }
  };

  const visibleNotifications = state.notifications
    .filter(n => n.isVisible)
    .slice(-maxVisible);

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className={getContainerClass(position)}>
      {visibleNotifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={dismissNotification}
          onButtonClick={handleButtonClick}
        />
      ))}
    </div>
  );
};

// Global Notification Manager (to be placed in App root)
export const NotificationManager: React.FC = () => {
  const { state } = useNotifications();
  
  // Get unique positions of active notifications
  const activePositions = Array.from(
    new Set(
      state.notifications
        .filter(n => n.isVisible)
        .map(n => n.position || NotificationPosition.TOP_RIGHT)
    )
  );

  return (
    <>
      {activePositions.map(position => (
        <NotificationContainer
          key={position}
          position={position}
          maxVisible={5}
        />
      ))}
    </>
  );
};

// Styled Components CSS (to be added to global styles)
export const notificationStyles = `
.notification-container {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 400px;
  width: 100%;
  padding: 20px;
}

.notification-container.top-right {
  top: 0;
  right: 0;
}

.notification-container.top-left {
  top: 0;
  left: 0;
}

.notification-container.top-center {
  top: 0;
  left: 50%;
  transform: translateX(-50%);
}

.notification-container.bottom-right {
  bottom: 0;
  right: 0;
  flex-direction: column-reverse;
}

.notification-container.bottom-left {
  bottom: 0;
  left: 0;
  flex-direction: column-reverse;
}

.notification-container.bottom-center {
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  flex-direction: column-reverse;
}

.notification-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-left: 4px solid #ccc;
  pointer-events: all;
  min-width: 300px;
  max-width: 400px;
  overflow: hidden;
}

.notification-success {
  border-left-color: #10b981;
  background: #f0fdf4;
}

.notification-error {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.notification-warning {
  border-left-color: #f59e0b;
  background: #fffbeb;
}

.notification-info {
  border-left-color: #3b82f6;
  background: #eff6ff;
}

.notification-loading {
  border-left-color: #6366f1;
  background: #f8fafc;
}

.notification-icon {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 600;
  font-size: 14px;
  color: #111827;
  margin-bottom: 4px;
}

.notification-message {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.4;
}

.notification-progress {
  margin-top: 8px;
  width: 100%;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.notification-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  transition: width 0.3s ease;
}

.notification-time {
  position: absolute;
  top: 8px;
  right: 32px;
  font-size: 11px;
  color: #9ca3af;
  font-weight: 500;
}

.notification-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.notification-button {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.notification-button.primary {
  background: #3b82f6;
  color: white;
}

.notification-button.primary:hover {
  background: #2563eb;
}

.notification-button.secondary {
  background: #f3f4f6;
  color: #374151;
}

.notification-button.secondary:hover {
  background: #e5e7eb;
}

.notification-button.danger {
  background: #ef4444;
  color: white;
}

.notification-button.danger:hover {
  background: #dc2626;
}

.notification-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.notification-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  font-size: 18px;
  line-height: 1;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  transition: all 0.2s ease;
}

.notification-close:hover {
  color: #374151;
  background: #f3f4f6;
}

.notification-autodismiss {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: rgba(59, 130, 246, 0.3);
  transition: width 0.1s linear;
}

@media (max-width: 640px) {
  .notification-container {
    left: 0 !important;
    right: 0 !important;
    top: 0 !important;
    transform: none !important;
    padding: 12px;
    max-width: none;
  }
  
  .notification-item {
    min-width: auto;
    max-width: none;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .notification-item {
    background: #1f2937;
    color: #f9fafb;
  }
  
  .notification-title {
    color: #f9fafb;
  }
  
  .notification-message {
    color: #d1d5db;
  }
  
  .notification-close:hover {
    background: #374151;
  }
  
  .notification-button.secondary {
    background: #374151;
    color: #d1d5db;
  }
  
  .notification-button.secondary:hover {
    background: #4b5563;
  }
}
`;

export default NotificationManager;