import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { database } from "./db";
import { apiTokens } from "./schema";

export type TokenPermission = "read" | "write";
export type TokenSummary = {
  id: string;
  label: string;
  permission: TokenPermission;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  expired: boolean;
};

const tokenPattern =
  /^rpi_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_([A-Za-z0-9_-]{43})$/;

type TokenRow = typeof apiTokens.$inferSelect;

function summary(row: TokenRow): TokenSummary {
  return {
    id: row.id,
    label: row.label,
    permission: row.permission,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expired: row.expiresAt ? row.expiresAt <= new Date() : false,
  };
}

function hash(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

export async function listApiTokens(householdId: string, userId: string): Promise<TokenSummary[]> {
  const db = await database();
  const rows = await db
    .select()
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.householdId, householdId),
        eq(apiTokens.userId, userId),
        isNull(apiTokens.revokedAt),
      ),
    )
    .orderBy(desc(apiTokens.createdAt));
  return rows.map(summary);
}

export async function createApiToken(
  householdId: string,
  userId: string,
  label: string,
  permission: TokenPermission,
  days: 30 | 90 | 365,
): Promise<{ token: string; summary: TokenSummary }> {
  const db = await database();
  const id = randomUUID();
  const token = `rpi_${id}_${randomBytes(32).toString("base64url")}`;
  const row = await db.transaction(async (tx) => {
    // Serialize token creation for this user so the 20-token limit stays atomic.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${householdId} || ':' || ${userId}, 0))`,
    );
    const [active] = await tx
      .select({ count: sql<number>`count(*)::integer` })
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.householdId, householdId),
          eq(apiTokens.userId, userId),
          isNull(apiTokens.revokedAt),
          gt(apiTokens.expiresAt, sql`now()`),
        ),
      );
    if (active.count >= 20) return null;
    const [created] = await tx
      .insert(apiTokens)
      .values({
        id,
        householdId,
        userId,
        label,
        tokenHash: hash(token).toString("hex"),
        permission,
        expiresAt: sql`now() + ${days} * interval '1 day'`,
      })
      .returning();
    return created;
  });
  if (!row)
    throw new Error("Revoke an existing token before creating another (maximum 20 active tokens).");
  return { token, summary: summary(row) };
}

export async function revokeApiToken(
  householdId: string,
  userId: string,
  id: string,
): Promise<boolean> {
  const db = await database();
  const rows = await db
    .update(apiTokens)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(apiTokens.id, id),
        eq(apiTokens.householdId, householdId),
        eq(apiTokens.userId, userId),
        isNull(apiTokens.revokedAt),
      ),
    )
    .returning({ id: apiTokens.id });
  return rows.length > 0;
}

export async function verifyApiToken(
  token: string,
): Promise<{ householdId: string; userId: string; permission: TokenPermission } | null> {
  const match = tokenPattern.exec(token);
  if (!match) return null;
  const db = await database();
  const [row] = await db
    .select()
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.id, match[1]),
        isNull(apiTokens.revokedAt),
        or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, sql`now()`)),
      ),
    )
    .limit(1);
  if (!row || !timingSafeEqual(hash(token), Buffer.from(row.tokenHash, "hex"))) return null;
  await db
    .update(apiTokens)
    .set({ lastUsedAt: sql`now()` })
    .where(
      and(
        eq(apiTokens.id, match[1]),
        or(isNull(apiTokens.lastUsedAt), lt(apiTokens.lastUsedAt, sql`now() - interval '1 hour'`)),
      ),
    );
  return { householdId: row.householdId, userId: row.userId, permission: row.permission };
}
