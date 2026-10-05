"use client";

import { useEffect } from "react";
import { getNextCaliforniaLogout } from "@/lib/california-logout";

export default function DailyLogout() {
  useEffect(() => {
    let timeoutId;
    let cancelled = false;

    async function logOutAtCutoff() {
      try {
        const response = await fetch("/api/logout", { method: "POST" });

        if (!response.ok && response.status !== 401) {
          const data = await response.json();
          throw new Error(data?.message || "Automatic logout failed");
        }

        localStorage.removeItem("crm_login_time");
        window.location.replace("/login");
      } catch (error) {
        console.error("Daily automatic logout failed:", error);
        window.alert(
          "Automatic logout could not be recorded. Please sign in again."
        );
        window.location.replace("/login");
      }
    }

    async function scheduleLogout() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (!response.ok || cancelled) {
          return;
        }

        const delay = Math.max(0, getNextCaliforniaLogout() - Date.now());
        timeoutId = window.setTimeout(logOutAtCutoff, delay);
      } catch (error) {
        console.error("Could not schedule the daily logout:", error);
      }
    }

    scheduleLogout();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
