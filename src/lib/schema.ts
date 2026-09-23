import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const recipes = pgTable(
  "recipes",
  {
    id: uuid().primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text().notNull(),
    description: text().notNull().default(""),
    sourceUrl: text("source_url").notNull().default(""),
    imageUrl: text("image_url").notNull().default(""),
    servings: text().notNull().default(""),
    prepMinutes: integer("prep_minutes"),
    cookMinutes: integer("cook_minutes"),
    notes: text().notNull().default(""),
    favorite: boolean().notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("recipes_owner_updated").on(table.ownerId, table.updatedAt.desc())],
);

export const ingredients = pgTable(
  "ingredients",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    text: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.position] })],
);

export const steps = pgTable(
  "steps",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    text: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.position] })],
);

export const tags = pgTable(
  "tags",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tag: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.recipeId, table.tag] }),
    index("tags_tag").on(sql`lower(${table.tag})`),
  ],
);

export const recipeShares = pgTable(
  "recipe_shares",
  {
    recipeId: uuid("recipe_id")
      .primaryKey()
      .references(() => recipes.id, { onDelete: "cascade" }),
    shareId: uuid("share_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.shareId)],
);

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid().primaryKey(),
    householdId: text("household_id").notNull(),
    userId: text("user_id").notNull(),
    label: text().notNull(),
    tokenHash: text("token_hash").notNull(),
    permission: text().$type<"read" | "write">().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    unique().on(table.tokenHash),
    check("api_tokens_permission_check", sql`${table.permission} IN ('read', 'write')`),
    index("api_tokens_owner_created").on(table.householdId, table.userId, table.createdAt.desc()),
  ],
);
