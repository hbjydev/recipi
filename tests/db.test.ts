import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRecipe } from "../src/lib/recipe";

test("Postgres persists a household collection and isolates other households", async () => {
  const { saveRecipe, getRecipe, listRecipes, deleteRecipe } = await import("../src/lib/db");
  const household = `household:test-${crypto.randomUUID()}`;
  const otherHousehold = `household:test-${crypto.randomUUID()}`;
  const input = parseRecipe({
    title: "Test soup",
    ingredients: ["1 onion"],
    steps: ["Cook it"],
    tags: ["Dinner"],
  });
  const created = await saveRecipe(household, input);
  assert.ok(created);
  try {
    assert.deepEqual((await getRecipe(household, created.id))?.ingredients, ["1 onion"]);
    assert.equal(await getRecipe(otherHousehold, created.id), null);
    assert.equal(await saveRecipe(otherHousehold, { ...input, title: "Stolen" }, created.id), null);
    assert.equal((await listRecipes(household, "onion")).length, 1);
    assert.equal((await listRecipes(otherHousehold)).length, 0);
    const updated = await saveRecipe(
      household,
      { ...input, title: "Better soup", ingredients: ["2 onions"] },
      created.id,
    );
    assert.equal(updated?.title, "Better soup");
    assert.deepEqual(updated?.ingredients, ["2 onions"]);
  } finally {
    assert.equal(await deleteRecipe(household, created.id), true);
  }
});
