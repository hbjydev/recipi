import type { GetObjectCommandOutput } from "@aws-sdk/client-s3";

export function imageResponse(image: GetObjectCommandOutput): Response {
  if (!image.Body) return new Response(null, { status: 404 });
  const headers = new Headers({
    "Content-Type": image.ContentType || "application/octet-stream",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (image.ContentLength !== undefined) headers.set("Content-Length", String(image.ContentLength));
  return new Response(image.Body.transformToWebStream(), { headers });
}
