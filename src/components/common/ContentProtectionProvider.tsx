import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function ContentProtectionProvider({ children }: { children: ReactNode }) {
  const { isSuperAdmin, profile } = useAuth();

  useEffect(() => {
    // Super admin is exempt from all content protection
    if (!profile || isSuperAdmin) return;

    // Add CSS protection class to body
    document.body.classList.add('content-protected');

    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable copy
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    // Disable cut
    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    // Disable text selection via JS event
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    // Block screenshot-related keys and print
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        // Clear clipboard to prevent screenshot capture
        navigator.clipboard.writeText('').catch(() => {});
      }

      // Block Ctrl+P / Cmd+P (Print)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
      }

      // Block Ctrl+Shift+S / Cmd+Shift+S (Save As)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
      }

      // Block Ctrl+S / Cmd+S (Save)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault();
      }

      // Block Ctrl+U / Cmd+U (View Source)
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
      }

      // Block Ctrl+C / Cmd+C (Copy) as extra layer
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
      }

      // Block Ctrl+A / Cmd+A (Select All)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
      }
    };

    // Attach all listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      // Clean up
      document.body.classList.remove('content-protected');
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSuperAdmin, profile]);

  return <>{children}</>;
}
