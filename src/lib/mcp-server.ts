import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import {
  createRecipeShare,
  deleteRecipe,
  getRecipe,
  getRecipeShare,
  listRecipes,
  listTags,
  revokeRecipeShare,
  saveRecipe,
} from "./db";
import { parseRecipe, recipeInputFrom, ValidationError } from "./recipe";
import { absoluteShareUrl } from "./share-token";

const recipeFields = z.object({
  title: z.string().min(1).max(180),
  description: z.string().max(1000).optional(),
  sourceUrl: z.union([z.url(), z.literal("")]).optional(),
  imageUrl: z.string().max(2000).optional(),
  servings: z.string().max(80).optional(),
  prepMinutes: z.number().int().min(0).nullable().optional(),
  cookMinutes: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(5000).optional(),
  favorite: z.boolean().optional(),
  ingredients: z.array(z.string().max(300)).max(100).optional(),
  steps: z.array(z.string().max(2000)).max(100).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

function result(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function failure(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export const mcpHandler = createMcpHandler(({ authInfo }) => {
  if (!authInfo?.clientId) throw new Error("MCP authentication is required");
  const householdId = authInfo.clientId;
  const canWrite = authInfo.scopes.includes("recipes:write");
  const server = new McpServer(
    { name: "recipi", version: "0.1.0" },
    {
      instructions:
        "Recipes belong to one household. Use list_tags and list_recipes_by_tag to browse categories, or list_recipes to search. Use get_recipe for full ingredients, method, and household notes. Share tools create revocable public links that omit household notes. Write tools are available only for read/write tokens.",
    },
  );

  server.registerTool(
    "list_recipes",
    {
      title: "Find recipes",
      description:
        "Search the household cookbook by title, description, ingredient, or tag. Results include summaries but not private notes.",
      inputSchema: z.object({
        search: z.string().max(150).optional(),
        tag: z.string().max(40).optional(),
        favorites: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ search, tag, favorites, limit = 50, offset = 0 }) => {
      const recipes = await listRecipes(householdId, search ?? "", tag ?? "", favorites ?? false);
      return result({
        recipes: recipes.slice(offset, offset + limit),
        total: recipes.length,
        offset,
        limit,
      });
    },
  );

  server.registerTool(
    "list_tags",
    {
      title: "Browse tags",
      description:
        "List tags in this household's cookbook with the number of recipes in each. Tags are grouped without regard to letter case.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => result({ tags: await listTags(householdId) }),
  );

  server.registerTool(
    "list_recipes_by_tag",
    {
      title: "Browse recipes by tag",
      description:
        "List household recipes with a given tag. Matching ignores letter case; use get_recipe to read a result in full.",
      inputSchema: z.object({
        tag: z.string().trim().min(1).max(40),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ tag, limit = 50, offset = 0 }) => {
      const recipes = await listRecipes(householdId, "", tag);
      return result({
        tag,
        recipes: recipes.slice(offset, offset + limit),
        total: recipes.length,
        offset,
        limit,
      });
    },
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Read recipe",
      description:
        "Get a recipe with its ingredients, method, timing, source, image URL, and household notes.",
      inputSchema: z.object({ id: z.uuid() }),
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const recipe = await getRecipe(householdId, id);
      return recipe ? result({ recipe }) : failure("Recipe not found");
    },
  );

  server.registerTool(
    "get_recipe_share",
    {
      title: "View public link",
      description:
        "Get the active public link for a recipe, if one exists. The public page is read-only and omits household notes.",
      inputSchema: z.object({ id: z.uuid() }),
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      if (!(await getRecipe(householdId, id))) return failure("Recipe not found");
      const token = await getRecipeShare(householdId, id);
      return result({ url: token ? absoluteShareUrl(token) : null });
    },
  );

  if (canWrite) {
    server.registerTool(
      "create_recipe",
      {
        title: "Add recipe",
        description:
          "Add a recipe to the household cookbook. Fields other than title are optional.",
        inputSchema: recipeFields,
      },
      async (input) => {
        try {
          const recipe = await saveRecipe(householdId, parseRecipe(input));
          return result({ recipe });
        } catch (error) {
          if (error instanceof ValidationError) return failure(error.message);
          throw error;
        }
      },
    );

    server.registerTool(
      "update_recipe",
      {
        title: "Edit recipe",
        description:
          "Update selected fields of a household recipe. Omitted fields keep their current values.",
        inputSchema: z.object({ id: z.uuid(), changes: recipeFields.partial() }),
      },
      async ({ id, changes }) => {
        const existing = await getRecipe(householdId, id);
        if (!existing) return failure("Recipe not found");
        try {
          const recipe = await saveRecipe(
            householdId,
            parseRecipe({ ...recipeInputFrom(existing), ...changes }),
            id,
          );
          return recipe ? result({ recipe }) : failure("Recipe not found");
        } catch (error) {
          if (error instanceof ValidationError) return failure(error.message);
          throw error;
        }
      },
    );

    server.registerTool(
      "delete_recipe",
      {
        title: "Delete recipe",
        description: "Permanently remove a recipe from the household cookbook.",
        inputSchema: z.object({ id: z.uuid() }),
        annotations: { destructiveHint: true },
      },
      async ({ id }) => {
        const deleted = await deleteRecipe(householdId, id);
        return deleted ? result({ deleted: true }) : failure("Recipe not found");
      },
    );

    server.registerTool(
      "share_recipe",
      {
        title: "Create public recipe link",
        description:
          "Create or retrieve a revocable, unauthenticated read-only link for a recipe. Anyone with the link can view recipe details, but household notes are omitted.",
        inputSchema: z.object({ id: z.uuid() }),
      },
      async ({ id }) => {
        const token = await createRecipeShare(householdId, id);
        return token ? result({ url: absoluteShareUrl(token) }) : failure("Recipe not found");
      },
    );

    server.registerTool(
      "revoke_recipe_share",
      {
        title: "Revoke public recipe link",
        description:
          "Disable the current public link for a recipe. A later share creates a different link.",
        inputSchema: z.object({ id: z.uuid() }),
        annotations: { destructiveHint: true },
      },
      async ({ id }) => {
        if (!(await getRecipe(householdId, id))) return failure("Recipe not found");
        const existing = await getRecipeShare(householdId, id);
        if (existing) await revokeRecipeShare(householdId, id);
        return result({ revoked: Boolean(existing) });
      },
    );
  }

  return server;
});
