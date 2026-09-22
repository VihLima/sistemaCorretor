export type AttributionPayload = {
  utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string; utmTerm?: string;
  referrer?: string; gclid?: string; fbclid?: string;
};

const VISITOR_KEY = "sc_vid";
const ATTR_KEY = "sc_attr";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function getVisitorId(): string {
  return safe(() => {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }, "anon");
}

/** Primeiro toque da sessão: campanha/clique na URL ou referrer externo sobrescrevem; senão mantém o que já existe. */
export function captureAttribution(): AttributionPayload {
  const params = new URLSearchParams(window.location.search);
  const get = (k: string) => params.get(k) ?? undefined;
  const referrer =
    document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : undefined;
  const fromUrl: AttributionPayload = {
    utmSource: get("utm_source"), utmMedium: get("utm_medium"), utmCampaign: get("utm_campaign"),
    utmContent: get("utm_content"), utmTerm: get("utm_term"), gclid: get("gclid"), fbclid: get("fbclid"), referrer,
  };
  const hasSignal = Boolean(fromUrl.utmSource || fromUrl.gclid || fromUrl.fbclid || referrer);
  const stored = safe(() => sessionStorage.getItem(ATTR_KEY), null);
  if (hasSignal || stored === null) {
    safe(() => sessionStorage.setItem(ATTR_KEY, JSON.stringify(fromUrl)), undefined);
    return fromUrl;
  }
  return getAttribution();
}

export function getAttribution(): AttributionPayload {
  return safe(() => JSON.parse(sessionStorage.getItem(ATTR_KEY) ?? "{}") as AttributionPayload, {});
}

export function sendEvent(propertyId: string, type: "PAGE_VIEW" | "QUESTIONNAIRE_START") {
  const body = JSON.stringify({ propertyId, type, visitorId: getVisitorId(), attribution: getAttribution() });
  fetch("/api/public/events", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
}
