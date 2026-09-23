import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/api-access";
import { deleteRecipe, getRecipe, saveRecipe } from "@/lib/db";
import { parseRecipe, ValidationError } from "@/lib/recipe";
import { checkWriteOrigin } from "@/lib/request";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function validId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function GET(request: NextRequest, context: Context) {
  const access = await authorizeApiRequest(request, "read");
  if (access instanceof NextResponse) return access;
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  const recipe = await getRecipe(access.householdId, id);
  return recipe
    ? NextResponse.json(recipe)
    : NextResponse.json({ error: "Recipe not found" }, { status: 404 });
}

export async function PUT(request: NextRequest, context: Context) {
  const access = await authorizeApiRequest(request, "write");
  if (access instanceof NextResponse) return access;
  const rejected = checkWriteOrigin(request);
  if (rejected) return rejected;
  const { id } = await context.params;
  if (!validId(id) || !(await getRecipe(access.householdId, id)))
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  try {
    const recipe = await saveRecipe(access.householdId, parseRecipe(await request.json()), id);
    return NextResponse.json(recipe);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof SyntaxError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const access = await authorizeApiRequest(request, "write");
  if (access instanceof NextResponse) return access;
  const rejected = checkWriteOrigin(request);
  if (rejected) return rejected;
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  const deleted = await deleteRecipe(access.householdId, id);
  return deleted
    ? NextResponse.json({ deleted: true })
    : NextResponse.json({ error: "Recipe not found" }, { status: 404 });
}
