"use client";
import { useEffect } from "react";

/** Registra o service worker do painel (arquivo `/sw.js` chega na Task 15; falhas são ignoradas). */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
