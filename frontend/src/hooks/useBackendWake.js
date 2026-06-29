import { useState, useEffect, useRef, useCallback } from "react";
import { checkHealth } from "../api.js";

const RETRY_DELAYS = [1, 2, 3, 5, 5, 5, 5, 5, 5, 5]; // Delays in seconds between retries
const MAX_ATTEMPTS = 10;

export default function useBackendWake() {
  const [status, setStatus] = useState("waking"); // 'waking' | 'ready' | 'error'
  const [attempt, setAttempt] = useState(1);
  const [elapsedTime, setElapsedTime] = useState(0);

  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);
  const runCheckRef = useRef(null);

  // Helper to clear all scheduled timers
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Polling function that executes health checks and schedules retries
  const runCheck = useCallback(async (currentAttempt) => {
    if (!isMountedRef.current) return;

    try {
      await checkHealth();
      if (isMountedRef.current) {
        setStatus("ready");
        cleanup();
      }
    } catch {
      if (!isMountedRef.current) return;

      if (currentAttempt >= MAX_ATTEMPTS) {
        setStatus("error");
        cleanup();
      } else {
        const delay = RETRY_DELAYS[currentAttempt - 1] || 5;
        timeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && runCheckRef.current) {
            setAttempt(currentAttempt + 1);
            runCheckRef.current(currentAttempt + 1);
          }
        }, delay * 1000);
      }
    }
  }, [cleanup]);

  // Keep runCheckRef populated with the latest callback
  useEffect(() => {
    runCheckRef.current = runCheck;
  }, [runCheck]);

  // Starts (or restarts) the wake/polling cycle
  const startWaking = useCallback(() => {
    cleanup();
    setStatus("waking");
    setAttempt(1);
    setElapsedTime(0);

    // Track elapsed time with a live counter
    intervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        setElapsedTime((prev) => prev + 1);
      }
    }, 1000);

    // Start first attempt immediately
    runCheck(1);
  }, [cleanup, runCheck]);

  // Initial trigger on mount and cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    // Defer startWaking to avoid calling setState synchronously in effect
    const startTimer = setTimeout(() => {
      startWaking();
    }, 0);

    return () => {
      isMountedRef.current = false;
      clearTimeout(startTimer);
      cleanup();
    };
  }, [startWaking, cleanup]);

  // Manually restart the polling flow
  const retry = useCallback(() => {
    startWaking();
  }, [startWaking]);

  return {
    status,
    elapsedTime,
    attempt,
    retry,
  };
}
