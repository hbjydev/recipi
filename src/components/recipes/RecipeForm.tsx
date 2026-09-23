"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { recipeInputFrom, type Recipe, type RecipeInput } from "@/lib/recipe";
import { recipeRequest } from "@/lib/recipe-api";
import Icon from "@/components/Icon";
import RecipeImageField from "./RecipeImageField";

const emptyRecipe: RecipeInput = {
  title: "",
  description: "",
  sourceUrl: "",
  imageUrl: "",
  servings: "",
  prepMinutes: null,
  cookMinutes: null,
  notes: "",
  favorite: false,
  ingredients: [],
  steps: [],
  tags: [],
};

export default function RecipeForm({ recipe }: { recipe?: Recipe }) {
  const router = useRouter();
  const [form, setForm] = useState<RecipeInput>(recipe ? recipeInputFrom(recipe) : emptyRecipe);
  const [ingredients, setIngredients] = useState((recipe?.ingredients ?? []).join("\n"));
  const [steps, setSteps] = useState((recipe?.steps ?? []).join("\n"));
  const [tags, setTags] = useState((recipe?.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const backUrl = recipe ? `/recipes/${recipe.id}` : "/recipes";

  function update<K extends keyof RecipeInput>(key: K, value: RecipeInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    setSaving(true);
    setError("");
    try {
      const payload: RecipeInput = {
        ...form,
        ingredients: ingredients
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        steps: steps
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        tags: tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
      const saved = await recipeRequest<Recipe>(
        recipe ? `/api/recipes/${recipe.id}` : "/api/recipes",
        {
          method: recipe ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      router.push(`/recipes/${saved.id}`);
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="editor-panel recipe-page-panel">
      <div className="panel-top">
        <Link className="back-button" href={backUrl}>
          <Icon name="back" size={16} /> Back
        </Link>
      </div>
      <form onSubmit={(event) => void save(event)}>
        <div className="editor-content">
          <h1>{recipe ? "Make it yours." : "Something good is cooking."}</h1>
          <p className="editor-subtitle">
            Add the details you want to remember. You can always come back and change them.
          </p>
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}

          <div className="form-section">
            <label className="field full">
              <span>
                Recipe name <b>*</b>
              </span>
              <input
                required
                maxLength={180}
                autoFocus
                placeholder="e.g. Sunday lemon pasta"
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
              />
            </label>
            <label className="field full">
              <span>Short description</span>
              <textarea
                rows={2}
                maxLength={1000}
                placeholder="What makes this one special?"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </label>
          </div>

          <div className="form-section two-col">
            <label className="field">
              <span>Prep time (min)</span>
              <input
                type="number"
                min="0"
                max="100000"
                placeholder="15"
                value={form.prepMinutes ?? ""}
                onChange={(event) =>
                  update("prepMinutes", event.target.value ? Number(event.target.value) : null)
                }
              />
            </label>
            <label className="field">
              <span>Cook time (min)</span>
              <input
                type="number"
                min="0"
                max="100000"
                placeholder="30"
                value={form.cookMinutes ?? ""}
                onChange={(event) =>
                  update("cookMinutes", event.target.value ? Number(event.target.value) : null)
                }
              />
            </label>
            <label className="field">
              <span>Servings</span>
              <input
                maxLength={80}
                placeholder="4 people"
                value={form.servings}
                onChange={(event) => update("servings", event.target.value)}
              />
            </label>
            <label className="field">
              <span>
                Tags <small>comma separated</small>
              </span>
              <input
                placeholder="Dinner, Vegetarian"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
              />
            </label>
          </div>

          <div className="form-section">
            <label className="field full">
              <span>
                Ingredients <small>one per line</small>
              </span>
              <textarea
                rows={7}
                placeholder={"2 tbsp olive oil\n1 onion, finely chopped\n400g tomatoes"}
                value={ingredients}
                onChange={(event) => setIngredients(event.target.value)}
              />
            </label>
            <label className="field full">
              <span>
                Method <small>one step per line</small>
              </span>
              <textarea
                rows={8}
                placeholder={
                  "Heat the oil in a large pan.\nAdd the onion and cook until softened.\nStir in the tomatoes and simmer."
                }
                value={steps}
                onChange={(event) => setSteps(event.target.value)}
              />
            </label>
          </div>

          <div className="form-section">
            <label className="field full">
              <span>Personal notes</span>
              <textarea
                rows={3}
                placeholder="What would you change next time?"
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
              />
            </label>
            <label className="field full">
              <span>Source URL</span>
              <input
                type="url"
                placeholder="https://..."
                value={form.sourceUrl}
                onChange={(event) => update("sourceUrl", event.target.value)}
              />
            </label>
            <RecipeImageField
              value={form.imageUrl}
              onChange={(url) => update("imageUrl", url)}
              onUploadingChange={setUploading}
            />
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.favorite}
                onChange={(event) => update("favorite", event.target.checked)}
              />
              <span>Add to favorites</span>
            </label>
          </div>
        </div>
        <div className="editor-footer">
          <Link className="button button-secondary" href={backUrl}>
            Cancel
          </Link>
          <button type="submit" className="button button-primary" disabled={saving || uploading}>
            {saving
              ? "Saving…"
              : uploading
                ? "Uploading image…"
                : recipe
                  ? "Save changes"
                  : "Save recipe"}{" "}
            <Icon name="arrow" size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}
