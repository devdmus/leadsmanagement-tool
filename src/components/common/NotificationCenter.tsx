import { useEffect, useState } from 'react';
import { Bell, Check, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { useSite } from '@/contexts/SiteContext';
// Supabase removed
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  action_type: string;
  resource_type: string | null;
  resource_id: string | null;
  is_read: boolean;
  created_at: string;
};

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const { profile, userType } = useAuth();
  const { currentSite } = useSite();

  useEffect(() => {
    if (profile) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000); // Poll every 30s
      return () => clearInterval(interval);
    }
  }, [profile, currentSite?.id]);

  const loadNotifications = async () => {
    try {
      if (!profile) return;

      const userId = userType === 'super_admin' ? profile.id.toString() : profile.id;
      const isSuperAdmin = userType === 'super_admin';

      const data = await import('@/db/api').then(m => m.notificationsApi.getAll(
        userId,
        currentSite?.id,
        isSuperAdmin,
        userType || '' // Pass string to avoid lint error
      ));

      const normalizedData = (data || []).map((n: any) => ({
        ...n,
        id: n.id.toString(), // Normalize to string so markAsRead comparison works reliably
        is_read: n.is_read === true || n.is_read === 1 || n.is_read === '1'
      }));

      // Deduplicate by ID (safety net for any old duplicate rows in the DB)
      const seen = new Set<string>();
      const deduplicated = normalizedData.filter((n: any) => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      });

      setNotifications(deduplicated);
      setUnreadCount(deduplicated.filter((n: any) => !n.is_read).length);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  // Namespace the ID to prevent collisions between SA and WP users (both often use ID 1)
  const getUserId = () => {
    if (!profile) return '';
    const prefix = userType === 'super_admin' ? 'sa_' : 'wp_';
    return `${prefix}${profile.id}`;
  };
  const getIsSuperAdmin = () => userType === 'super_admin';

  const markAsRead = async (notificationId: string) => {
    try {
      const userId = getUserId();
      await import('@/db/api').then(m => m.notificationsApi.markAsRead(notificationId, userId));
      // Only update local state after server confirms success
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
      // Re-fetch to keep UI in sync with actual server state
      loadNotifications();
    }
  };

  const markAllAsRead = async () => {
    try {
      const userId = getUserId();
      const isSuperAdmin = getIsSuperAdmin();
      await import('@/db/api').then(m => (m.notificationsApi as any).markAllAsRead(userId, isSuperAdmin));
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      loadNotifications();
    }
  };

  const clearNotifications = async () => {
    try {
      const userId = getUserId();
      const isSuperAdmin = getIsSuperAdmin();
      await import('@/db/api').then(m => (m.notificationsApi as any).clearAll(userId, isSuperAdmin, userType));
      // Remove all from local state immediately
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      loadNotifications();
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const userId = getUserId();
      await import('@/db/api').then(m => m.notificationsApi.delete?.(notificationId, userId));
      setNotifications(notifications.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* changed css */}
        <Button variant="ghost" size="icon" className="relative hover:bg-muted/30">
          {/* css changed  */}
          <Bell className="h-5 w-5 text-white " />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                <Check className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && unreadCount === 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={clearNotifications}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mb-2 opacity-50" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-4 hover:bg-muted/50 transition-colors',
                    !notification.is_read && 'bg-muted/30'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('w-2 h-2 rounded-full mt-2', getTypeColor(notification.type))} />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{notification.title}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => deleteNotification(notification.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => markAsRead(notification.id)}
                          >
                            Mark read
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
