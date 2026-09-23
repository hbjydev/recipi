import { imageIdFromUrl } from "./image-policy";

export type RecipeInput = {
  title: string;
  description: string;
  sourceUrl: string;
  imageUrl: string;
  servings: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  notes: string;
  favorite: boolean;
  ingredients: string[];
  steps: string[];
  tags: string[];
};

export type Recipe = RecipeInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type RecipeSummary = Pick<
  Recipe,
  | "id"
  | "title"
  | "description"
  | "imageUrl"
  | "servings"
  | "prepMinutes"
  | "cookMinutes"
  | "favorite"
  | "tags"
  | "createdAt"
  | "updatedAt"
> & { ingredientCount: number };

export function recipeInputFrom(recipe: Recipe): RecipeInput {
  return {
    title: recipe.title,
    description: recipe.description,
    sourceUrl: recipe.sourceUrl,
    imageUrl: recipe.imageUrl,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    notes: recipe.notes,
    favorite: recipe.favorite,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    tags: recipe.tags,
  };
}

export class ValidationError extends Error {}

function field(value: unknown, name: string, max: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max)
    throw new ValidationError(`${name} is too long or invalid`);
  return value.trim();
}

function url(value: unknown, name: string): string {
  const raw = field(value, name, 2000);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
    return parsed.href;
  } catch {
    throw new ValidationError(`${name} must be a web URL`);
  }
}

function imageUrl(value: unknown): string {
  const raw = field(value, "Image URL", 2000);
  if (imageIdFromUrl(raw)) return raw;
  return url(raw, "Image URL");
}

function minutes(value: unknown, name: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100000) {
    throw new ValidationError(`${name} must be a positive number of minutes`);
  }
  return value as number;
}

function items(value: unknown, name: string, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems)
    throw new ValidationError(`Invalid ${name}`);
  return value.map((item) => field(item, name, maxLength)).filter(Boolean);
}

export function parseRecipe(value: unknown): RecipeInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ValidationError("Invalid recipe");
  const raw = value as Record<string, unknown>;
  const title = field(raw.title, "Title", 180);
  if (!title) throw new ValidationError("Give this recipe a title");
  const tags = [
    ...new Map(
      items(raw.tags ?? [], "tags", 20, 40).map((tag) => [tag.toLowerCase(), tag]),
    ).values(),
  ];
  return {
    title,
    description: field(raw.description, "Description", 1000),
    sourceUrl: url(raw.sourceUrl, "Source URL"),
    imageUrl: imageUrl(raw.imageUrl),
    servings: field(raw.servings, "Servings", 80),
    prepMinutes: minutes(raw.prepMinutes, "Prep time"),
    cookMinutes: minutes(raw.cookMinutes, "Cook time"),
    notes: field(raw.notes, "Notes", 5000),
    favorite: raw.favorite === true,
    ingredients: items(raw.ingredients ?? [], "ingredients", 100, 300),
    steps: items(raw.steps ?? [], "steps", 100, 2000),
    tags,
  };
}
