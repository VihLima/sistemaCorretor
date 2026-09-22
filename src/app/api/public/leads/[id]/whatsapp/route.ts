import { errorResponse, readJson } from "@/server/http";
import { registerWhatsappClick } from "@/server/services/public-leads";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await readJson(request)) as { token?: unknown };
    await registerWhatsappClick(id, String(body?.token ?? ""));
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
