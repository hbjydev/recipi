import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RecipeReadContent from "@/components/recipes/RecipeReadContent";
import { getSharedRecipe } from "@/lib/db";
import { imageIdFromUrl } from "@/lib/image-policy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shared recipe — Recipi",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function SharedRecipePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await getSharedRecipe(token);
  if (!shared) notFound();

  const { recipe } = shared;
  const imageUrl = imageIdFromUrl(recipe.imageUrl) ? `/share/${token}/image` : recipe.imageUrl;

  return (
    <main className="public-share-page">
      <header className="public-share-header">
        <span className="public-share-brand">
          recipi<span className="brand-dot">.</span>
        </span>
        <span>Shared recipe</span>
      </header>
      <article className="detail-panel recipe-page-panel public-recipe-panel">
        <RecipeReadContent recipe={recipe} imageUrl={imageUrl} showNotes={false} />
      </article>
      <p className="public-share-footer">A good recipe is worth passing along.</p>
    </main>
  );
}
