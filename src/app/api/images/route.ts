import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/api-access";
import { checkWriteOrigin } from "@/lib/request";
import { imageContentType, MAX_IMAGE_BYTES } from "@/lib/image-policy";
import { uploadImage } from "@/lib/images";

export const runtime = "nodejs";

class UploadTooLarge extends Error {}

async function limitedFormData(request: NextRequest): Promise<FormData> {
  if (!request.body) throw new Error("Missing upload body");
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data;")) throw new Error("Invalid upload type");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_BYTES + 64 * 1024) {
      await reader.cancel();
      throw new UploadTooLarge();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: body.buffer,
  }).formData();
}

export async function POST(request: NextRequest) {
  const access = await authorizeApiRequest(request, "write");
  if (access instanceof NextResponse) return access;
  const rejected = checkWriteOrigin(request);
  if (rejected) return rejected;

  const contentLength = Number(request.headers.get("content-length"));
  if (contentLength > MAX_IMAGE_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "Choose an image under 5 MB" }, { status: 413 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await limitedFormData(request)).get("image");
  } catch (error) {
    if (error instanceof UploadTooLarge) {
      return NextResponse.json({ error: "Choose an image under 5 MB" }, { status: 413 });
    }
    return NextResponse.json({ error: "Could not read the image upload" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image to upload" }, { status: 400 });
  }
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Choose an image under 5 MB" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = imageContentType(bytes);
  if (!contentType) {
    return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image" }, { status: 415 });
  }

  const url = await uploadImage(access.householdId, bytes, contentType);
  return NextResponse.json({ url }, { status: 201 });
}
