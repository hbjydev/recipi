import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { getRecipe } from "@/lib/db";
import { isRecipeId } from "@/lib/recipe-url";
import RecipeForm from "@/components/recipes/RecipeForm";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!isRecipeId(id)) notFound();
  const recipe = await getRecipe(user.householdId, id);
  if (!recipe) notFound();
  return <RecipeForm recipe={recipe} />;
}
