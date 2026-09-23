import { createHash, randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function objectKey(householdId: string, imageId: string): string {
  const household = createHash("sha256").update(householdId).digest("hex");
  return `households/${household}/${imageId}`;
}

let client: S3Client | undefined;

function storage() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is required for image storage");
  client ??= new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE
      ? process.env.S3_FORCE_PATH_STYLE === "true"
      : Boolean(process.env.S3_ENDPOINT),
  });
  return { client, bucket };
}

export async function uploadImage(
  householdId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const imageId = randomUUID();
  const { client, bucket } = storage();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey(householdId, imageId),
      Body: bytes,
      ContentType: contentType,
    }),
  );
  return `/api/images/${imageId}`;
}

export async function loadImage(householdId: string, imageId: string) {
  const { client, bucket } = storage();
  try {
    return await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: objectKey(householdId, imageId) }),
    );
  } catch (error) {
    if (error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound"))
      return null;
    throw error;
  }
}

export async function deleteImage(householdId: string, imageId: string): Promise<void> {
  const { client, bucket } = storage();
  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: objectKey(householdId, imageId) }),
  );
}
