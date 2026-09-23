import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRecipe, ValidationError } from "../src/lib/recipe";

test("normalizes editable recipe fields", () => {
  const recipe = parseRecipe({
    title: "  Lemon pasta  ",
    sourceUrl: "https://example.com/pasta",
    ingredients: [" 2 lemons ", "", " pasta "],
    steps: [" Boil pasta. "],
    tags: ["Dinner", "dinner", "Quick"],
    prepMinutes: 10,
  });
  assert.equal(recipe.title, "Lemon pasta");
  assert.deepEqual(recipe.ingredients, ["2 lemons", "pasta"]);
  assert.deepEqual(recipe.tags, ["dinner", "Quick"]);
  assert.equal(recipe.sourceUrl, "https://example.com/pasta");
  assert.equal(recipe.cookMinutes, null);
});

test("rejects unsafe URLs and invalid time values", () => {
  assert.throws(
    () => parseRecipe({ title: "Soup", sourceUrl: "javascript:alert(1)" }),
    ValidationError,
  );
  assert.throws(() => parseRecipe({ title: "Soup", prepMinutes: -1 }), ValidationError);
  assert.throws(() => parseRecipe({ title: "   " }), ValidationError);
});
