import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "./auth";
import { verifyApiToken, type TokenPermission } from "./api-tokens";

export type ApiAccess = {
  householdId: string;
  userId: string;
  permission: TokenPermission;
  viaToken: boolean;
};

function error(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 401 ? { "WWW-Authenticate": "Bearer" } : {}),
      },
    },
  );
}

export async function authorizeApiRequest(
  request: NextRequest,
  required: TokenPermission,
): Promise<ApiAccess | NextResponse> {
  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    const match = /^Bearer (\S{1,200})$/i.exec(authorization);
    if (!match) return error("Invalid bearer token", 401);
    const token = await verifyApiToken(match[1]);
    if (!token) return error("Invalid or expired bearer token", 401);
    if (required === "write" && token.permission !== "write")
      return error("This token is read-only", 403);
    return { ...token, viaToken: true };
  }

  const member = await currentMember();
  if (!member) return error("Sign in to continue", 401);
  return { ...member, permission: "write", viaToken: false };
}
