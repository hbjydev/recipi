import { and, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { join } from "node:path";
import pg from "pg";
import type { Recipe, RecipeInput, RecipeSummary } from "./recipe";
import { ingredients, recipeShares, recipes, steps, tags } from "./schema";
import { makeShareToken, shareIdFromToken, validShareToken } from "./share-token";

const { Pool } = pg;
const globalDb = globalThis as unknown as {
  recipiPool?: pg.Pool;
  recipiDb?: ReturnType<typeof drizzle>;
  recipiReady?: Promise<void>;
};

function pool(): pg.Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return (globalDb.recipiPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }));
}

function connection() {
  return (globalDb.recipiDb ??= drizzle({ client: pool() }));
}

async function ready(): Promise<void> {
  globalDb.recipiReady ??= migrate(connection(), {
    migrationsFolder: join(process.cwd(), "drizzle"),
  }).catch((error) => {
    globalDb.recipiReady = undefined;
    throw error;
  });
  return globalDb.recipiReady;
}

export async function database() {
  await ready();
  return connection();
}

type RecipeRow = typeof recipes.$inferSelect;

function fromRow(row: RecipeRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sourceUrl: row.sourceUrl,
    imageUrl: row.imageUrl,
    servings: row.servings,
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    notes: row.notes,
    favorite: row.favorite,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listRecipes(
  householdId: string,
  search = "",
  tag = "",
  favorites = false,
): Promise<RecipeSummary[]> {
  const db = await database();
  const filters = [eq(recipes.ownerId, householdId)];
  if (search) {
    const term = `%${search}%`;
    filters.push(
      or(
        ilike(recipes.title, term),
        ilike(recipes.description, term),
        exists(
          db
            .select({ one: sql`1` })
            .from(ingredients)
            .where(and(eq(ingredients.recipeId, recipes.id), ilike(ingredients.text, term))),
        ),
        exists(
          db
            .select({ one: sql`1` })
            .from(tags)
            .where(and(eq(tags.recipeId, recipes.id), ilike(tags.tag, term))),
        ),
      )!,
    );
  }
  if (tag)
    filters.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(tags)
          .where(and(eq(tags.recipeId, recipes.id), sql`lower(${tags.tag}) = lower(${tag})`)),
      ),
    );
  if (favorites) filters.push(eq(recipes.favorite, true));
  const rows = await db
    .select()
    .from(recipes)
    .where(and(...filters))
    .orderBy(desc(recipes.updatedAt), desc(recipes.id));
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [tagRows, counts] = await Promise.all([
    db
      .select({ recipeId: tags.recipeId, tag: tags.tag })
      .from(tags)
      .where(inArray(tags.recipeId, ids))
      .orderBy(sql`lower(${tags.tag})`),
    db
      .select({ recipeId: ingredients.recipeId, count: sql<number>`count(*)::integer` })
      .from(ingredients)
      .where(inArray(ingredients.recipeId, ids))
      .groupBy(ingredients.recipeId),
  ]);
  const tagsByRecipe = new Map<string, string[]>();
  for (const item of tagRows)
    tagsByRecipe.set(item.recipeId, [...(tagsByRecipe.get(item.recipeId) ?? []), item.tag]);
  const countByRecipe = new Map(counts.map((item) => [item.recipeId, item.count]));
  return rows.map((row) => ({
    ...fromRow(row),
    tags: tagsByRecipe.get(row.id) ?? [],
    ingredientCount: countByRecipe.get(row.id) ?? 0,
  }));
}

export async function listTags(
  householdId: string,
): Promise<{ tag: string; recipeCount: number }[]> {
  const db = await database();
  const rows = await db
    .select({
      tag: sql<string>`min(${tags.tag})`,
      recipeCount: sql<number>`count(distinct ${tags.recipeId})::integer`,
    })
    .from(tags)
    .innerJoin(recipes, eq(tags.recipeId, recipes.id))
    .where(eq(recipes.ownerId, householdId))
    .groupBy(sql`lower(${tags.tag})`)
    .orderBy(sql`lower(${tags.tag})`);
  return rows;
}

export async function getRecipe(householdId: string, id: string): Promise<Recipe | null> {
  const db = await database();
  const [row] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.ownerId, householdId), eq(recipes.id, id)))
    .limit(1);
  if (!row) return null;
  const [ingredientRows, stepRows, tagRows] = await Promise.all([
    db
      .select({ text: ingredients.text })
      .from(ingredients)
      .where(eq(ingredients.recipeId, id))
      .orderBy(ingredients.position),
    db
      .select({ text: steps.text })
      .from(steps)
      .where(eq(steps.recipeId, id))
      .orderBy(steps.position),
    db
      .select({ tag: tags.tag })
      .from(tags)
      .where(eq(tags.recipeId, id))
      .orderBy(sql`lower(${tags.tag})`),
  ]);
  return {
    ...fromRow(row),
    ingredients: ingredientRows.map((item) => item.text),
    steps: stepRows.map((item) => item.text),
    tags: tagRows.map((item) => item.tag),
  };
}

export async function saveRecipe(
  householdId: string,
  input: RecipeInput,
  id = crypto.randomUUID(),
): Promise<Recipe | null> {
  const db = await database();
  const saved = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(recipes)
      .values({
        id,
        ownerId: householdId,
        title: input.title,
        description: input.description,
        sourceUrl: input.sourceUrl,
        imageUrl: input.imageUrl,
        servings: input.servings,
        prepMinutes: input.prepMinutes,
        cookMinutes: input.cookMinutes,
        notes: input.notes,
        favorite: input.favorite,
      })
      .onConflictDoUpdate({
        target: recipes.id,
        set: {
          title: input.title,
          description: input.description,
          sourceUrl: input.sourceUrl,
          imageUrl: input.imageUrl,
          servings: input.servings,
          prepMinutes: input.prepMinutes,
          cookMinutes: input.cookMinutes,
          notes: input.notes,
          favorite: input.favorite,
          updatedAt: sql`now()`,
        },
        setWhere: eq(recipes.ownerId, householdId),
      })
      .returning({ id: recipes.id });
    if (!row) return false;
    await tx.delete(ingredients).where(eq(ingredients.recipeId, id));
    await tx.delete(steps).where(eq(steps.recipeId, id));
    await tx.delete(tags).where(eq(tags.recipeId, id));
    if (input.ingredients.length)
      await tx
        .insert(ingredients)
        .values(input.ingredients.map((text, position) => ({ recipeId: id, position, text })));
    if (input.steps.length)
      await tx
        .insert(steps)
        .values(input.steps.map((text, position) => ({ recipeId: id, position, text })));
    if (input.tags.length)
      await tx.insert(tags).values(input.tags.map((tag) => ({ recipeId: id, tag })));
    return true;
  });
  return saved ? getRecipe(householdId, id) : null;
}

export async function deleteRecipe(householdId: string, id: string): Promise<boolean> {
  const db = await database();
  const rows = await db
    .delete(recipes)
    .where(and(eq(recipes.ownerId, householdId), eq(recipes.id, id)))
    .returning({ id: recipes.id });
  return rows.length > 0;
}

export async function getRecipeShare(
  householdId: string,
  recipeId: string,
): Promise<string | null> {
  const db = await database();
  const [row] = await db
    .select({ shareId: recipeShares.shareId })
    .from(recipeShares)
    .innerJoin(recipes, eq(recipeShares.recipeId, recipes.id))
    .where(and(eq(recipes.id, recipeId), eq(recipes.ownerId, householdId)))
    .limit(1);
  return row ? makeShareToken(row.shareId, recipeId, householdId) : null;
}

export async function createRecipeShare(
  householdId: string,
  recipeId: string,
): Promise<string | null> {
  const db = await database();
  await db
    .insert(recipeShares)
    .select(
      db
        .select({
          recipeId: recipes.id,
          shareId: sql<string>`${crypto.randomUUID()}::uuid`.as("share_id"),
          createdAt: sql<Date>`now()`.as("created_at"),
        })
        .from(recipes)
        .where(and(eq(recipes.id, recipeId), eq(recipes.ownerId, householdId))),
    )
    .onConflictDoNothing({ target: recipeShares.recipeId });
  return getRecipeShare(householdId, recipeId);
}

export async function revokeRecipeShare(householdId: string, recipeId: string): Promise<void> {
  const db = await database();
  await db.delete(recipeShares).where(
    and(
      eq(recipeShares.recipeId, recipeId),
      exists(
        db
          .select({ one: sql`1` })
          .from(recipes)
          .where(and(eq(recipes.id, recipeShares.recipeId), eq(recipes.ownerId, householdId))),
      ),
    ),
  );
}

export async function getSharedRecipe(
  token: string,
): Promise<{ recipe: Recipe; householdId: string } | null> {
  const shareId = shareIdFromToken(token);
  if (!shareId) return null;
  const db = await database();
  const [row] = await db
    .select({ recipeId: recipeShares.recipeId, ownerId: recipes.ownerId })
    .from(recipeShares)
    .innerJoin(recipes, eq(recipeShares.recipeId, recipes.id))
    .where(eq(recipeShares.shareId, shareId))
    .limit(1);
  if (!row || !validShareToken(token, row.recipeId, row.ownerId)) return null;
  const recipe = await getRecipe(row.ownerId, row.recipeId);
  return recipe
    ? { recipe: { ...recipe, notes: "", favorite: false }, householdId: row.ownerId }
    : null;
}
