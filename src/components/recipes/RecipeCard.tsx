import Link from "next/link";
import type { RecipeSummary } from "@/lib/recipe";
import Icon from "@/components/Icon";

export default function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const total = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  return (
    <Link href={`/recipes/${recipe.id}`} className="recipe-card">
      <div
        className={`card-image ${recipe.imageUrl ? "has-image" : ""}`}
        style={
          recipe.imageUrl
            ? { backgroundImage: `url("${recipe.imageUrl.replaceAll('"', "%22")}")` }
            : undefined
        }
      >
        {!recipe.imageUrl && (
          <span className="image-placeholder" aria-hidden="true">
            recipi.
          </span>
        )}
        {recipe.favorite && (
          <span className="favorite-badge" aria-label="Favorite">
            <Icon name="heart" size={13} filled />
          </span>
        )}
      </div>
      <div className="card-body">
        <div className="card-tags">
          {recipe.tags.slice(0, 2).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <h2>{recipe.title}</h2>
        <p>{recipe.description || "A recipe in your collection."}</p>
        <div className="card-meta">
          <span>◷ &nbsp;{total ? `${total} min` : "Time not set"}</span>
          <span>•</span>
          <span>{recipe.ingredientCount} ingredients</span>
        </div>
      </div>
    </Link>
  );
}
