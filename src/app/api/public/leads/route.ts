import { errorResponse, enforceRateLimit, readJson } from "@/server/http";
import { startLead } from "@/server/services/public-leads";

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "lead", 5, 10 * 60 * 1000);
    const result = await startLead(await readJson(request), { ownHost: new URL(request.url).host });
    return Response.json(result, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
