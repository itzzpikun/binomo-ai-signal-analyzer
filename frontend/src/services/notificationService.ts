// ============================================================
// src/services/notificationService.ts
// Browser system desktop notification service
// ============================================================

class NotificationService {
  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    }
    return false;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public isPermissionGranted(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  }

  public sendNotification(
    title: string,
    body: string,
    onClick?: () => void
  ): void {
    if (!this.isPermissionGranted()) return;

    try {
      const notif = new Notification(title, {
        body,
        icon: '/vite.svg',
        badge: '/vite.svg',
        tag: 'binomo-signal-alert',
      });

      notif.onclick = () => {
        window.focus();
        if (onClick) onClick();
        notif.close();
      };

      // Auto close after 7 seconds
      setTimeout(() => {
        try {
          notif.close();
        } catch {
          // ignore
        }
      }, 7000);
    } catch (e) {
      console.warn('[NotificationService] Desktop notification warning:', e);
    }
  }
}

export const notificationService = new NotificationService();
