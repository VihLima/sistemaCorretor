import QRCode from "qrcode";
import { getAppUrl } from "@/lib/app-url";
import { getCurrentUser } from "@/server/auth/current";
import { NotFoundError } from "@/server/errors";
import { getProperty } from "@/server/services/properties";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const { id } = await params;
  try {
    const property = await getProperty(user, id);
    const url = `${await getAppUrl()}/imovel/${property.slug}?utm_source=qrcode&utm_medium=offline`;
    const png = await QRCode.toBuffer(url, { width: 1024, margin: 2, errorCorrectionLevel: "M" });
    const download = new URL(request.url).searchParams.has("download");
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        ...(download ? { "Content-Disposition": `attachment; filename="qrcode-${property.slug}.png"` } : {}),
      },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return new Response(null, { status: 404 });
    throw e;
  }
}
