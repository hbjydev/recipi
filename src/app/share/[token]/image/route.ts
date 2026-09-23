import { NextRequest } from "next/server";
import { getSharedRecipe } from "@/lib/db";
import { imageIdFromUrl } from "@/lib/image-policy";
import { imageResponse } from "@/lib/image-response";
import { loadImage } from "@/lib/images";

export const runtime = "nodejs";
type Context = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { token } = await context.params;
  const shared = await getSharedRecipe(token);
  if (!shared) return new Response(null, { status: 404 });
  const imageId = imageIdFromUrl(shared.recipe.imageUrl);
  if (!imageId) return new Response(null, { status: 404 });
  const image = await loadImage(shared.householdId, imageId);
  return image ? imageResponse(image) : new Response(null, { status: 404 });
}
