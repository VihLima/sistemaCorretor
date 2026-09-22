"use client";
import { useEffect, useRef } from "react";
import { captureAttribution, sendEvent } from "@/lib/tracking";

/** Registra a visualização da página (uma vez por montagem) e guarda a origem da visita na sessão. */
export function TrackPageView({ propertyId }: { propertyId: string }) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (sent.current === propertyId) return; // StrictMode monta duas vezes em desenvolvimento
    sent.current = propertyId;
    captureAttribution();
    sendEvent(propertyId, "PAGE_VIEW");
  }, [propertyId]);
  return null;
}
