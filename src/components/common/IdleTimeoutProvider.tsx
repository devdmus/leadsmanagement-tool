import { useCallback, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Clock } from 'lucide-react';

export function IdleTimeoutProvider({ children }: { children: ReactNode }) {
  const { profile, isSuperAdmin, signOut } = useAuth();

  const handleIdle = useCallback(async () => {
    await signOut();
    window.location.href = '/login?reason=idle';
  }, [signOut]);

  const handleWarning = useCallback(() => {
    // Warning state is managed by the hook's isWarning flag
  }, []);

  const handleActive = useCallback(() => {
    // User activity dismissed the warning
  }, []);

  const { isWarning, remainingSeconds, resetTimers } = useIdleTimeout({
    onIdle: handleIdle,
    onWarning: handleWarning,
    onActive: handleActive,
    enabled: !!profile && !isSuperAdmin, // Only for non-super_admin authenticated users
  });

  const handleStayLoggedIn = () => {
    resetTimers();
  };

  const handleLogoutNow = async () => {
    await signOut();
    window.location.href = '/login?reason=idle';
  };

  return (
    <>
      {children}
      <AlertDialog open={isWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-destructive" />
              <AlertDialogTitle>Session Expiring</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              You have been inactive. Your session will expire in{' '}
              <span className="font-bold text-destructive">{remainingSeconds}</span>{' '}
              seconds. Click &quot;Stay Logged In&quot; to continue your session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleLogoutNow}>Log Out Now</AlertDialogCancel>
            <AlertDialogAction onClick={handleStayLoggedIn}>Stay Logged In</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
