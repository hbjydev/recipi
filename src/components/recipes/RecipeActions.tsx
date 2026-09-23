"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { recipeInputFrom, type Recipe } from "@/lib/recipe";
import { recipeRequest } from "@/lib/recipe-api";
import Icon from "@/components/Icon";
import RecipeShare from "./RecipeShare";

export default function RecipeActions({
  recipe,
  initialShareUrl,
  children,
}: {
  recipe: Recipe;
  initialShareUrl: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggleFavorite() {
    setBusy(true);
    setError("");
    try {
      await recipeRequest<Recipe>(`/api/recipes/${recipe.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...recipeInputFrom(recipe), favorite: !recipe.favorite }),
      });
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${recipe.title}”? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      await recipeRequest<{ deleted: boolean }>(`/api/recipes/${recipe.id}`, { method: "DELETE" });
      router.push("/recipes");
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  }

  return (
    <article className="detail-panel recipe-page-panel">
      <div className="panel-top">
        <Link className="back-button" href="/recipes">
          <Icon name="back" size={16} /> Back to recipes
        </Link>
        <div>
          <button
            className="icon-button"
            disabled={busy}
            onClick={() => void toggleFavorite()}
            title={recipe.favorite ? "Remove favorite" : "Add favorite"}
            aria-label={recipe.favorite ? "Remove favorite" : "Add favorite"}
          >
            <Icon name="heart" size={19} filled={recipe.favorite} />
          </button>
          <RecipeShare recipeId={recipe.id} initialUrl={initialShareUrl} />
          <button
            className="icon-button"
            onClick={() => window.print()}
            title="Print recipe"
            aria-label="Print recipe"
          >
            <Icon name="print" size={19} />
          </button>
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {children}
      <div className="detail-actions">
        <Link className="button button-secondary" href={`/recipes/${recipe.id}/edit`}>
          Edit recipe
        </Link>
        <button className="text-button danger" disabled={busy} onClick={() => void remove()}>
          Delete recipe
        </button>
      </div>
    </article>
  );
}
