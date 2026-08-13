"use client";

import { useEffect } from "react";

export function LandingSessionGuard() {
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { authenticated?: boolean };
      if (data.authenticated) {
        window.location.replace("/dashboard");
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
