import assert from "node:assert/strict";
import { test } from "node:test";
import { imageContentType, imageIdFromUrl, MAX_IMAGE_BYTES } from "../src/lib/image-policy";
import { parseRecipe, ValidationError } from "../src/lib/recipe";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==",
  "base64",
);

test("accepts private image URLs and recognized image bytes", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(imageIdFromUrl(`/api/images/${id}`), id);
  assert.equal(imageIdFromUrl(`/api/images/${id}/extra`), null);
  assert.equal(imageContentType(png), "image/png");
  assert.equal(imageContentType(new Uint8Array([0x3c, 0x73, 0x76, 0x67])), null);
  assert.equal(MAX_IMAGE_BYTES, 5 * 1024 * 1024);
  assert.equal(
    parseRecipe({ title: "Soup", imageUrl: `/api/images/${id}` }).imageUrl,
    `/api/images/${id}`,
  );
  assert.throws(
    () => parseRecipe({ title: "Soup", imageUrl: "/api/images/not-a-uuid" }),
    ValidationError,
  );
});

test("image objects are scoped to a household", async () => {
  const { uploadImage, loadImage, deleteImage } = await import("../src/lib/images");
  const household = `household:test-${crypto.randomUUID()}`;
  const url = await uploadImage(household, png, "image/png");
  const id = imageIdFromUrl(url);
  assert.ok(id);
  try {
    const ownImage = await loadImage(household, id);
    assert.equal(ownImage?.ContentType, "image/png");
    assert.deepEqual(Buffer.from(await ownImage!.Body!.transformToByteArray()), png);
    assert.equal(await loadImage("household:another", id), null);
  } finally {
    await deleteImage(household, id);
  }
});
