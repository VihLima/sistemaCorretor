import { errorResponse, enforceRateLimit, readJson } from "@/server/http";
import { recordPublicEvent } from "@/server/services/public-leads";

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "events", 60, 60 * 1000);
    await recordPublicEvent(await readJson(request), { ownHost: new URL(request.url).host });
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
