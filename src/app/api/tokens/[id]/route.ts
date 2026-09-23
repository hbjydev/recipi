import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/auth";
import { revokeApiToken } from "@/lib/api-tokens";
import { isRecipeId } from "@/lib/recipe-url";
import { checkWriteOrigin } from "@/lib/request";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const member = await currentMember();
  if (!member) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const rejected = checkWriteOrigin(request);
  if (rejected) return rejected;
  const { id } = await params;
  if (!isRecipeId(id) || !(await revokeApiToken(member.householdId, member.userId, id))) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
  return NextResponse.json({ revoked: true }, { headers: { "Cache-Control": "no-store" } });
}
