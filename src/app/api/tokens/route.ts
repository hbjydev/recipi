import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/auth";
import { createApiToken, listApiTokens, type TokenPermission } from "@/lib/api-tokens";
import { checkWriteOrigin } from "@/lib/request";

export const runtime = "nodejs";

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function GET() {
  const member = await currentMember();
  if (!member) return reply({ error: "Sign in to continue" }, 401);
  return reply(await listApiTokens(member.householdId, member.userId));
}

export async function POST(request: NextRequest) {
  const member = await currentMember();
  if (!member) return reply({ error: "Sign in to continue" }, 401);
  const rejected = checkWriteOrigin(request);
  if (rejected) return rejected;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return reply({ error: "Invalid token details" }, 400);
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    return reply({ error: "Invalid token details" }, 400);
  const details = input as Record<string, unknown>;
  const label = typeof details.label === "string" ? details.label.trim() : "";
  const permission = details.permission;
  const days = details.days;
  if (
    !label ||
    label.length > 80 ||
    (permission !== "read" && permission !== "write") ||
    (days !== 30 && days !== 90 && days !== 365)
  ) {
    return reply({ error: "Choose a name, permission, and expiry" }, 400);
  }
  try {
    return reply(
      await createApiToken(
        member.householdId,
        member.userId,
        label,
        permission as TokenPermission,
        days as 30 | 90 | 365,
      ),
      201,
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Revoke an existing token"))
      return reply({ error: error.message }, 409);
    throw error;
  }
}
