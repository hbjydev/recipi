import { NextRequest } from "next/server";
import { authorizeApiRequest } from "@/lib/api-access";
import { imageIdFromUrl } from "@/lib/image-policy";
import { loadImage } from "@/lib/images";
import { imageResponse } from "@/lib/image-response";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const access = await authorizeApiRequest(request, "read");
  if (access instanceof Response) return access;

  const { id } = await context.params;
  if (!imageIdFromUrl(`/api/images/${id}`)) return new Response(null, { status: 404 });
  const image = await loadImage(access.householdId, id);
  return image ? imageResponse(image) : new Response(null, { status: 404 });
}
