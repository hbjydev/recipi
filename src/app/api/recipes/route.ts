import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/api-access";
import { listRecipes, saveRecipe } from "@/lib/db";
import { parseRecipe, ValidationError } from "@/lib/recipe";
import { checkWriteOrigin } from "@/lib/request";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const access = await authorizeApiRequest(request, "read");
  if (access instanceof NextResponse) return access;
  const search = (request.nextUrl.searchParams.get("search") ?? "").slice(0, 150);
  const tag = (request.nextUrl.searchParams.get("tag") ?? "").slice(0, 40);
  const favorites = request.nextUrl.searchParams.get("favorites") === "true";
  return NextResponse.json(await listRecipes(access.householdId, search, tag, favorites));
}

export async function POST(request: NextRequest) {
  const access = await authorizeApiRequest(request, "write");
  if (access instanceof NextResponse) return access;
  const rejected = checkWriteOrigin(request);
  if (rejected) return rejected;
  try {
    const input = parseRecipe(await request.json());
    return NextResponse.json(await saveRecipe(access.householdId, input), { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof SyntaxError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
