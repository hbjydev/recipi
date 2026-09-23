import { createHmac, timingSafeEqual } from "node:crypto";

const sharePattern =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

function signature(shareId: string, recipeId: string, householdId: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for recipe sharing");
  return createHmac("sha256", secret)
    .update(`recipi-share-v1\0${shareId}\0${recipeId}\0${householdId}`)
    .digest("base64url");
}

export function makeShareToken(shareId: string, recipeId: string, householdId: string): string {
  return `${shareId}.${signature(shareId, recipeId, householdId)}`;
}

export function shareIdFromToken(token: string): string | null {
  return sharePattern.exec(token)?.[1] ?? null;
}

export function validShareToken(token: string, recipeId: string, householdId: string): boolean {
  const match = sharePattern.exec(token);
  if (!match) return false;
  const expected = Buffer.from(signature(match[1], recipeId, householdId));
  const actual = Buffer.from(match[2]);
  return timingSafeEqual(expected, actual);
}

export function absoluteShareUrl(token: string): string {
  if (!process.env.NEXTAUTH_URL) throw new Error("NEXTAUTH_URL is required for recipe sharing");
  return new URL(`/share/${token}`, process.env.NEXTAUTH_URL).href;
}
