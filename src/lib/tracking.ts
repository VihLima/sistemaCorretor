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

/** UUID v4. `crypto.randomUUID` só existe em contexto seguro (https/localhost); em http na rede local usa getRandomValues. */
export function randomId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (typeof c?.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      /* contexto não seguro */
    }
  }
  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getVisitorId(): string {
  return safe(() => {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }, "anon");
}

/**
 * Origem da visita na sessão:
 * - campanha/clique na URL (utm_*, gclid, fbclid) sempre sobrescreve;
 * - referrer externo sozinho só grava quando ainda não há nada salvo (ao navegar para /interesse
 *   com <Link>, document.referrer continua sendo o site externo e não pode apagar as UTMs);
 * - caso contrário mantém o que já existe.
 */
export function captureAttribution(): AttributionPayload {
  const params = new URLSearchParams(window.location.search);
  const get = (k: string) => params.get(k) ?? undefined;
  const referrer =
    document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : undefined;
  const fromUrl: AttributionPayload = {
    utmSource: get("utm_source"), utmMedium: get("utm_medium"), utmCampaign: get("utm_campaign"),
    utmContent: get("utm_content"), utmTerm: get("utm_term"), gclid: get("gclid"), fbclid: get("fbclid"), referrer,
  };
  const hasCampaign = Boolean(
    fromUrl.utmSource || fromUrl.utmMedium || fromUrl.utmCampaign || fromUrl.utmContent || fromUrl.utmTerm ||
      fromUrl.gclid || fromUrl.fbclid,
  );
  const stored = safe(() => sessionStorage.getItem(ATTR_KEY), null);
  if (hasCampaign || stored === null) {
    safe(() => sessionStorage.setItem(ATTR_KEY, JSON.stringify(fromUrl)), undefined);
    return fromUrl;
  }
  return getAttribution();
}

export function getAttribution(): AttributionPayload {
  return safe(() => JSON.parse(sessionStorage.getItem(ATTR_KEY) ?? "{}") as AttributionPayload, {});
}

/** Envia o evento apenas uma vez por imóvel na sessão do navegador (ex.: QUESTIONNAIRE_START). */
export function sendEventOncePerSession(propertyId: string, type: "PAGE_VIEW" | "QUESTIONNAIRE_START") {
  const key = `sc_ev_${type}_${propertyId}`;
  if (safe(() => sessionStorage.getItem(key), null) !== null) return;
  safe(() => sessionStorage.setItem(key, "1"), undefined);
  sendEvent(propertyId, type);
}

export function sendEvent(propertyId: string, type: "PAGE_VIEW" | "QUESTIONNAIRE_START") {
  const body = JSON.stringify({ propertyId, type, visitorId: getVisitorId(), attribution: getAttribution() });
  fetch("/api/public/events", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
}
