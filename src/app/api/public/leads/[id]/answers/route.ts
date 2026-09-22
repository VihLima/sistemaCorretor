import { getAppUrl } from "@/lib/app-url";
import { errorResponse, enforceRateLimit, readJson } from "@/server/http";
import { submitAnswers } from "@/server/services/public-leads";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceRateLimit(request, "answers", 20, 10 * 60 * 1000);
    const { id } = await params;
    const body = (await readJson(request)) as { token?: unknown; answers?: unknown };
    const handoff = await submitAnswers(id, String(body?.token ?? ""), { answers: body?.answers }, { appUrl: await getAppUrl() });
    return Response.json(handoff);
  } catch (e) {
    return errorResponse(e);
  }
}
