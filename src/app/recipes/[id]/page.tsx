import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { getRecipe, getRecipeShare } from "@/lib/db";
import { isRecipeId } from "@/lib/recipe-url";
import { absoluteShareUrl } from "@/lib/share-token";
import RecipeDetail from "@/components/recipes/RecipeDetail";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!isRecipeId(id)) notFound();
  const recipe = await getRecipe(user.householdId, id);
  if (!recipe) notFound();
  const token = await getRecipeShare(user.householdId, id);
  return <RecipeDetail recipe={recipe} shareUrl={token ? absoluteShareUrl(token) : null} />;
}
