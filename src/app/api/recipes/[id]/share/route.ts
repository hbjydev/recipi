import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/api-access";
import { createRecipeShare, getRecipe, getRecipeShare, revokeRecipeShare } from "@/lib/db";
import { isRecipeId } from "@/lib/recipe-url";
import { checkWriteOrigin } from "@/lib/request";
import { absoluteShareUrl } from "@/lib/share-token";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

async function permittedRecipe(context: Context, householdId: string) {
  const { id } = await context.params;
  if (!isRecipeId(id) || !(await getRecipe(householdId, id))) return null;
  return { householdId, id };
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest, context: Context) {
  const access = await authorizeApiRequest(request, "read");
  if (access instanceof NextResponse) return access;
  const recipe = await permittedRecipe(context, access.householdId);
  if (!recipe) return noStore({ error: "Recipe not found" }, 404);
  const token = await getRecipeShare(recipe.householdId, recipe.id);
  return noStore({ url: token ? absoluteShareUrl(token) : null });
}

export async function POST(request: NextRequest, context: Context) {
  const access = await authorizeApiRequest(request, "write");
  if (access instanceof NextResponse) return access;
  const rejected = checkWriteOrigin(request);
  if (rejected) return rejected;
  const recipe = await permittedRecipe(context, access.householdId);
  if (!recipe) return noStore({ error: "Recipe not found" }, 404);
  const token = await createRecipeShare(recipe.householdId, recipe.id);
  return token
    ? noStore({ url: absoluteShareUrl(token) })
    : noStore({ error: "Recipe not found" }, 404);
}

export async function DELETE(request: NextRequest, context: Context) {
  const access = await authorizeApiRequest(request, "write");
  if (access instanceof NextResponse) return access;
  const rejected = checkWriteOrigin(request);
  if (rejected) return rejected;
  const recipe = await permittedRecipe(context, access.householdId);
  if (!recipe) return noStore({ error: "Recipe not found" }, 404);
  await revokeRecipeShare(recipe.householdId, recipe.id);
  return noStore({ revoked: true });
}
