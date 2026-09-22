import { type NextRequest, NextResponse } from "next/server";

/** Barreira leve: sem cookie de sessão não entra no painel. A validação real acontece no servidor (requireUser). */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("sc_session")) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/painel/:path*"] };
