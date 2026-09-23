import { Suspense } from "react";
import Link from "next/link";
import { listRecipes } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import CookbookSidebar from "@/components/recipes/CookbookSidebar";
import SignOutButton from "@/components/recipes/SignOutButton";

export default async function RecipesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const recipes = await listRecipes(user.householdId);
  const tags = [...new Set(recipes.flatMap((recipe) => recipe.tags))].sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <div className="app-shell">
      <Suspense fallback={null}>
        <CookbookSidebar userName={user.name} recipeCount={recipes.length} tags={tags} />
      </Suspense>
      <main className="main-content">
        <header className="topbar">
          <Link href="/recipes" className="mobile-brand">
            recipi<span className="brand-dot">.</span>
          </Link>
          <span>Made to be cooked from, again and again.</span>
          <Link href="/recipes/tokens" className="mobile-tokens-link">
            API tokens
          </Link>
          <SignOutButton />
        </header>
        {children}
      </main>
    </div>
  );
}
