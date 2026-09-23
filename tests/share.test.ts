import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRecipe } from "../src/lib/recipe";
import {
  absoluteShareUrl,
  makeShareToken,
  shareIdFromToken,
  validShareToken,
} from "../src/lib/share-token";

process.env.NEXTAUTH_SECRET = "test-recipi-sharing-secret";
process.env.NEXTAUTH_URL = "http://localhost:3000";

test("share tokens are bound to a recipe and household", () => {
  const shareId = crypto.randomUUID();
  const recipeId = crypto.randomUUID();
  const token = makeShareToken(shareId, recipeId, "home");
  assert.equal(shareIdFromToken(token), shareId);
  assert.equal(validShareToken(token, recipeId, "home"), true);
  assert.equal(validShareToken(token, crypto.randomUUID(), "home"), false);
  assert.equal(validShareToken(token, recipeId, "other"), false);
  assert.equal(
    validShareToken(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"), recipeId, "home"),
    false,
  );
  assert.equal(shareIdFromToken("nonsense"), null);
  assert.equal(absoluteShareUrl(token), `http://localhost:3000/share/${token}`);
});

test("public link omits notes and can be revoked", async () => {
  const {
    saveRecipe,
    getRecipe,
    getRecipeShare,
    createRecipeShare,
    revokeRecipeShare,
    getSharedRecipe,
    deleteRecipe,
  } = await import("../src/lib/db");
  const household = `household:test-${crypto.randomUUID()}`;
  const other = `household:test-${crypto.randomUUID()}`;
  const input = parseRecipe({
    title: "Shared soup",
    description: "Warm and good",
    imageUrl: "https://example.com/soup.jpg",
    ingredients: ["1 onion"],
    steps: ["Simmer"],
    notes: "Family secret",
    favorite: true,
  });
  const recipe = await saveRecipe(household, input);
  assert.ok(recipe);
  try {
    assert.equal(await getRecipeShare(household, recipe.id), null);
    assert.equal(await createRecipeShare(other, recipe.id), null);
    const token = await createRecipeShare(household, recipe.id);
    assert.ok(token);
    assert.equal(await createRecipeShare(household, recipe.id), token);
    assert.equal(await getRecipeShare(other, recipe.id), null);
    const shared = await getSharedRecipe(token);
    assert.equal(shared?.recipe.title, "Shared soup");
    assert.deepEqual(shared?.recipe.ingredients, ["1 onion"]);
    assert.equal(shared?.recipe.notes, "");
    assert.equal(shared?.recipe.favorite, false);
    assert.equal((await getRecipe(household, recipe.id))?.notes, "Family secret");
    await revokeRecipeShare(other, recipe.id);
    assert.ok(await getSharedRecipe(token));
    await revokeRecipeShare(household, recipe.id);
    assert.equal(await getSharedRecipe(token), null);
    const replacement = await createRecipeShare(household, recipe.id);
    assert.ok(replacement);
    assert.notEqual(replacement, token);
    assert.equal(await getSharedRecipe(token), null);
    assert.ok(await getSharedRecipe(replacement));
  } finally {
    await deleteRecipe(household, recipe.id);
  }
});
