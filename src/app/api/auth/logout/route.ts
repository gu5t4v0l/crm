import { NextRequest, NextResponse } from "next/server";
import { urlApp } from "@/lib/env";
import { cookieBase, SESSION_COOKIE } from "@/lib/session";

/** POST (via form) para não deslogar por link/prefetch. 303 transforma o POST em GET no /login. */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(urlApp("/login", request.nextUrl.origin), 303);
  response.cookies.delete({ name: SESSION_COOKIE, path: cookieBase.path });
  return response;
}
