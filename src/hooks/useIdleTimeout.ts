import { useEffect, useRef, useCallback, useState } from 'react';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000; // Show warning 2 min before logout
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

interface UseIdleTimeoutOptions {
  onIdle: () => void;
  onWarning: () => void;
  onActive: () => void;
  enabled: boolean;
  timeoutMs?: number;
  warningBeforeMs?: number;
}

export function useIdleTimeout({
  onIdle,
  onWarning,
  onActive,
  enabled,
  timeoutMs = IDLE_TIMEOUT_MS,
  warningBeforeMs = WARNING_BEFORE_MS,
}: UseIdleTimeoutOptions) {
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isWarningRef = useRef(false);
  const [isWarning, setIsWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const onIdleRef = useRef(onIdle);
  const onWarningRef = useRef(onWarning);
  const onActiveRef = useRef(onActive);

  useEffect(() => {
    onIdleRef.current = onIdle;
    onWarningRef.current = onWarning;
    onActiveRef.current = onActive;
  }, [onIdle, onWarning, onActive]);

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    idleTimerRef.current = null;
    warningTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    if (!enabled) return;

    if (isWarningRef.current) {
      isWarningRef.current = false;
      setIsWarning(false);
      setRemainingSeconds(0);
      onActiveRef.current();
    }

    // Set warning timer
    warningTimerRef.current = setTimeout(() => {
      isWarningRef.current = true;
      setIsWarning(true);
      const countdownSecs = Math.floor(warningBeforeMs / 1000);
      setRemainingSeconds(countdownSecs);
      onWarningRef.current();

      // Start countdown
      countdownRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, timeoutMs - warningBeforeMs);

    // Set idle timer (actual logout)
    idleTimerRef.current = setTimeout(() => {
      onIdleRef.current();
    }, timeoutMs);
  }, [enabled, timeoutMs, warningBeforeMs, clearTimers]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      setIsWarning(false);
      isWarningRef.current = false;
      return;
    }

    const handleActivity = () => {
      // Only reset if NOT in warning state (user must click "Stay Logged In" during warning)
      if (!isWarningRef.current) {
        resetTimers();
      }
    };

    ACTIVITY_EVENTS.forEach((event) =>
      document.addEventListener(event, handleActivity, { passive: true })
    );

    resetTimers(); // Start initial timer

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        document.removeEventListener(event, handleActivity)
      );
      clearTimers();
    };
  }, [enabled, resetTimers, clearTimers]);

  return { isWarning, remainingSeconds, resetTimers };
}
