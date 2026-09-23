import { NextRequest, NextResponse } from "next/server";

export function checkWriteOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const expected = new URL(process.env.NEXTAUTH_URL || request.nextUrl.origin);
    if (new URL(origin).origin === expected.origin) return null;
  } catch {
    /* Invalid origin is rejected below. */
  }
  return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
}
