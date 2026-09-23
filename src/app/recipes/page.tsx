import Link from "next/link";
import { listRecipes } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import Icon from "@/components/Icon";
import RecipeCard from "@/components/recipes/RecipeCard";
import RecipeFilters from "@/components/recipes/RecipeFilters";

type SearchParams = Promise<{
  search?: string | string[];
  tag?: string | string[];
  favorites?: string | string[];
}>;

export default async function RecipesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const search = (typeof params.search === "string" ? params.search : "").slice(0, 150);
  const tag = (typeof params.tag === "string" ? params.tag : "").slice(0, 40);
  const favorites = params.favorites === "true";
  const allRecipes = await listRecipes(user.householdId);
  const recipes =
    search || tag || favorites
      ? await listRecipes(user.householdId, search, tag, favorites)
      : allRecipes;
  const tags = [...new Set(allRecipes.flatMap((recipe) => recipe.tags))].sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <>
      <section className="page-intro">
        <div>
          <h1>
            Your recipes<span className="heading-period">.</span>
          </h1>
          <p>A little library of things worth making.</p>
        </div>
        <Link className="button button-primary new-button" href="/recipes/new">
          <Icon name="plus" size={17} /> Add recipe
        </Link>
      </section>
      <RecipeFilters
        search={search}
        tag={tag}
        favorites={favorites}
        tags={tags}
        count={recipes.length}
      />
      {recipes.length ? (
        <div className="recipe-grid">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>
            {search || tag || favorites ? "Nothing in the pantry yet" : "Your cookbook starts here"}
          </h2>
          <p>
            {search || tag || favorites
              ? "Try a different search or filter."
              : "Keep your first favorite recipe close at hand. Add it now and build from there."}
          </p>
          {!search && !tag && !favorites && (
            <Link className="button button-primary" href="/recipes/new">
              Add your first recipe <Icon name="arrow" size={15} />
            </Link>
          )}
        </div>
      )}
    </>
  );
}
