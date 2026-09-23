import assert from "node:assert/strict";
import { test } from "node:test";

test("API tokens are scoped, expire, and can be revoked", async () => {
  const { createApiToken, listApiTokens, revokeApiToken, verifyApiToken } =
    await import("../src/lib/api-tokens");
  const { database } = await import("../src/lib/db");
  const household = `household:test-${crypto.randomUUID()}`;
  const user = `kanidm:${crypto.randomUUID()}`;
  const other = `kanidm:${crypto.randomUUID()}`;
  const first = await createApiToken(household, user, "My assistant", "read", 30);
  try {
    assert.match(first.token, /^rpi_/);
    assert.equal(first.summary.label, "My assistant");
    assert.equal((await verifyApiToken(first.token))?.householdId, household);
    assert.equal((await verifyApiToken(first.token))?.permission, "read");
    assert.equal(
      await verifyApiToken(first.token.slice(0, -1) + (first.token.endsWith("x") ? "y" : "x")),
      null,
    );
    assert.equal((await listApiTokens(household, user)).length, 1);
    assert.deepEqual(await listApiTokens(household, other), []);
    assert.equal(await revokeApiToken(household, other, first.summary.id), false);
    assert.equal(await revokeApiToken("household:other", user, first.summary.id), false);
    assert.ok(await verifyApiToken(first.token));
    const db = await database();
    const { eq, sql } = await import("drizzle-orm");
    const { apiTokens } = await import("../src/lib/schema");
    await db
      .update(apiTokens)
      .set({ expiresAt: sql`now() - interval '1 minute'` })
      .where(eq(apiTokens.id, first.summary.id));
    assert.equal(await verifyApiToken(first.token), null);
  } finally {
    await revokeApiToken(household, user, first.summary.id);
  }
  assert.equal(await verifyApiToken(first.token), null);
});

test("MCP requires a token and only advertises permitted tools", async () => {
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  process.env.NEXTAUTH_SECRET = "test-recipi-mcp-share-secret";
  const { createApiToken, revokeApiToken } = await import("../src/lib/api-tokens");
  const { deleteRecipe, getSharedRecipe } = await import("../src/lib/db");
  const { POST } = await import("../src/app/mcp/route");
  const household = `household:test-${crypto.randomUUID()}`;
  const user = `kanidm:${crypto.randomUUID()}`;
  const read = await createApiToken(household, user, "Reader", "read", 30);
  const write = await createApiToken(household, user, "Writer", "write", 30);

  async function requestMcp(token: string | undefined, method: string, params?: unknown) {
    const request = new Request("http://localhost:3000/mcp", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params ? { params } : {}) }),
    });
    return POST(request);
  }

  const tools = (token?: string) => requestMcp(token, "tools/list");

  async function body(response: Response) {
    const text = await response.text();
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      const data = text.split("\n").find((line) => line.startsWith("data: "));
      assert.ok(data);
      return JSON.parse(data.slice(6));
    }
    return JSON.parse(text);
  }

  const createdIds: string[] = [];
  try {
    assert.equal((await tools()).status, 401);
    assert.equal((await tools("invalid")).status, 401);
    const readResponse = await tools(read.token);
    assert.equal(readResponse.status, 200);
    const readBody = await body(readResponse);
    const readNames = readBody.result.tools.map((item: { name: string }) => item.name);
    assert.ok(readNames.includes("list_recipes"));
    assert.ok(readNames.includes("get_recipe"));
    assert.ok(readNames.includes("list_tags"));
    assert.ok(readNames.includes("list_recipes_by_tag"));
    assert.ok(readNames.includes("get_recipe_share"));
    assert.ok(!readNames.includes("delete_recipe"));
    assert.ok(!readNames.includes("share_recipe"));
    assert.ok(!readNames.includes("revoke_recipe_share"));
    const forbiddenWrite = await requestMcp(read.token, "tools/call", {
      name: "create_recipe",
      arguments: { title: "Should not exist" },
    });
    const forbiddenBody = await body(forbiddenWrite);
    assert.ok(forbiddenBody.error || forbiddenBody.result?.isError);
    const crossOrigin = await POST(
      new Request("http://localhost:3000/mcp", {
        method: "POST",
        headers: {
          Host: "localhost:3000",
          Origin: "https://evil.example",
          Authorization: `Bearer ${read.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );
    assert.equal(crossOrigin.status, 403);
    const writeResponse = await tools(write.token);
    assert.equal(writeResponse.status, 200);
    const writeBody = await body(writeResponse);
    const writeNames = writeBody.result.tools.map((item: { name: string }) => item.name);
    assert.ok(writeNames.includes("create_recipe"));
    assert.ok(writeNames.includes("update_recipe"));
    assert.ok(writeNames.includes("delete_recipe"));
    assert.ok(writeNames.includes("share_recipe"));
    assert.ok(writeNames.includes("revoke_recipe_share"));
    const createdResponse = await requestMcp(write.token, "tools/call", {
      name: "create_recipe",
      arguments: {
        title: "MCP test soup",
        ingredients: ["Water"],
        steps: ["Boil"],
        notes: "Keep this private",
        tags: ["Dinner", "Quick"],
      },
    });
    assert.equal(createdResponse.status, 200);
    const createdBody = await body(createdResponse);
    const createdId = JSON.parse(createdBody.result.content[0].text).recipe.id as string;
    createdIds.push(createdId);
    const secondResponse = await requestMcp(write.token, "tools/call", {
      name: "create_recipe",
      arguments: { title: "Another dinner", tags: ["dinner"] },
    });
    const secondId = JSON.parse((await body(secondResponse)).result.content[0].text).recipe
      .id as string;
    createdIds.push(secondId);

    const tagsResponse = await requestMcp(read.token, "tools/call", {
      name: "list_tags",
      arguments: {},
    });
    const tags = JSON.parse((await body(tagsResponse)).result.content[0].text).tags as {
      tag: string;
      recipeCount: number;
    }[];
    assert.equal(tags.find((item) => item.tag.toLowerCase() === "dinner")?.recipeCount, 2);
    assert.equal(tags.find((item) => item.tag.toLowerCase() === "quick")?.recipeCount, 1);
    const taggedResponse = await requestMcp(read.token, "tools/call", {
      name: "list_recipes_by_tag",
      arguments: { tag: "DINNER" },
    });
    const tagged = JSON.parse((await body(taggedResponse)).result.content[0].text);
    assert.equal(tagged.total, 2);
    assert.deepEqual(
      new Set(tagged.recipes.map((recipe: { id: string }) => recipe.id)),
      new Set([createdId, secondId]),
    );

    const readRecipeResponse = await requestMcp(read.token, "tools/call", {
      name: "get_recipe",
      arguments: { id: createdId },
    });
    const readRecipeBody = await body(readRecipeResponse);
    assert.equal(JSON.parse(readRecipeBody.result.content[0].text).recipe.title, "MCP test soup");
    const absentShare = await requestMcp(read.token, "tools/call", {
      name: "get_recipe_share",
      arguments: { id: createdId },
    });
    assert.equal(JSON.parse((await body(absentShare)).result.content[0].text).url, null);
    const forbiddenShare = await requestMcp(read.token, "tools/call", {
      name: "share_recipe",
      arguments: { id: createdId },
    });
    const forbiddenShareBody = await body(forbiddenShare);
    assert.ok(forbiddenShareBody.error || forbiddenShareBody.result?.isError);
    const sharedResponse = await requestMcp(write.token, "tools/call", {
      name: "share_recipe",
      arguments: { id: createdId },
    });
    const shareUrl = JSON.parse((await body(sharedResponse)).result.content[0].text).url as string;
    assert.match(shareUrl, /^http:\/\/localhost:3000\/share\//);
    const repeatShare = await requestMcp(write.token, "tools/call", {
      name: "share_recipe",
      arguments: { id: createdId },
    });
    assert.equal(JSON.parse((await body(repeatShare)).result.content[0].text).url, shareUrl);
    const currentShare = await requestMcp(read.token, "tools/call", {
      name: "get_recipe_share",
      arguments: { id: createdId },
    });
    assert.equal(JSON.parse((await body(currentShare)).result.content[0].text).url, shareUrl);
    const shareToken = new URL(shareUrl).pathname.split("/").at(-1)!;
    assert.equal((await getSharedRecipe(shareToken))?.recipe.notes, "");
    const revokedShare = await requestMcp(write.token, "tools/call", {
      name: "revoke_recipe_share",
      arguments: { id: createdId },
    });
    assert.equal(JSON.parse((await body(revokedShare)).result.content[0].text).revoked, true);
    assert.equal(await getSharedRecipe(shareToken), null);
    const afterRevoke = await requestMcp(read.token, "tools/call", {
      name: "get_recipe_share",
      arguments: { id: createdId },
    });
    assert.equal(JSON.parse((await body(afterRevoke)).result.content[0].text).url, null);

    const updateResponse = await requestMcp(write.token, "tools/call", {
      name: "update_recipe",
      arguments: { id: createdId, changes: { title: "Better soup" } },
    });
    const updateBody = await body(updateResponse);
    assert.equal(JSON.parse(updateBody.result.content[0].text).recipe.title, "Better soup");
    const deleteResponse = await requestMcp(write.token, "tools/call", {
      name: "delete_recipe",
      arguments: { id: createdId },
    });
    const deleteBody = await body(deleteResponse);
    assert.equal(JSON.parse(deleteBody.result.content[0].text).deleted, true);
    createdIds.splice(createdIds.indexOf(createdId), 1);
    await revokeApiToken(household, user, write.summary.id);
    assert.equal((await tools(write.token)).status, 401);
  } finally {
    for (const id of createdIds) await deleteRecipe(household, id);
    await revokeApiToken(household, user, read.summary.id);
    await revokeApiToken(household, user, write.summary.id);
  }
});
