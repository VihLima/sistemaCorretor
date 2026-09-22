import type { Channel } from "./types";

export interface AttributionInput {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referrer?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  ownHost?: string | null;
}

export interface Attribution {
  channel: Channel;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
}

const clean = (v: string | null | undefined, max = 200) => {
  const t = v?.trim();
  return t ? t.slice(0, max) : null;
};

function channelFromSource(source: string): Channel {
  const s = source.toLowerCase();
  if (s.includes("qr")) return "QR_CODE";
  if (s === "ig" || s.includes("instagram")) return "INSTAGRAM";
  if (s === "fb" || s === "meta" || s.includes("facebook")) return "FACEBOOK";
  if (s === "adwords" || s.includes("google")) return "GOOGLE";
  return "OTHER";
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function channelFromHost(host: string): Channel | null {
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "INSTAGRAM";
  if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com" || host.endsWith(".fb.com")) return "FACEBOOK";
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return "GOOGLE";
  return null;
}

export function resolveAttribution(input: AttributionInput): Attribution {
  const utmSource = clean(input.utmSource);
  const referrer = clean(input.referrer, 500);
  const refHost = referrer ? hostOf(referrer) : null;
  const ownHost = input.ownHost?.toLowerCase().split(":")[0] ?? null;
  const externalHost = refHost && refHost !== ownHost ? refHost : null;

  let channel: Channel;
  if (utmSource) channel = channelFromSource(utmSource);
  else if (clean(input.gclid)) channel = "GOOGLE";
  else if (clean(input.fbclid))
    channel = externalHost && channelFromHost(externalHost) === "INSTAGRAM" ? "INSTAGRAM" : "FACEBOOK";
  else if (externalHost) channel = channelFromHost(externalHost) ?? "OTHER";
  else channel = "DIRECT";

  return {
    channel,
    utmSource,
    utmMedium: clean(input.utmMedium),
    utmCampaign: clean(input.utmCampaign),
    utmContent: clean(input.utmContent),
    utmTerm: clean(input.utmTerm),
    referrer: externalHost ? referrer : null,
  };
}
