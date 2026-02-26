"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { logoutAndRedirect } from "@/lib/client/logout";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
];

export function SessionInactivityGuard() {
  const { status } = useSession();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loggingOutRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (!timeoutRef.current) {
      return;
    }

    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const runInactivityLogout = useCallback(async () => {
    if (loggingOutRef.current) {
      return;
    }

    loggingOutRef.current = true;
    await logoutAndRedirect("inactive");
  }, []);

  const resetTimer = useCallback(() => {
    if (status !== "authenticated" || loggingOutRef.current) {
      clearTimer();
      return;
    }

    clearTimer();
    timeoutRef.current = setTimeout(() => {
      void runInactivityLogout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [clearTimer, runInactivityLogout, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      clearTimer();
      loggingOutRef.current = false;
      return;
    }

    resetTimer();

    const onActivity = () => {
      resetTimer();
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resetTimer();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearTimer();
    };
  }, [clearTimer, resetTimer, status]);

  return null;
}
