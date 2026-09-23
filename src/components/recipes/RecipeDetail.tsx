import type { Recipe } from "@/lib/recipe";
import RecipeActions from "./RecipeActions";
import RecipeReadContent from "./RecipeReadContent";

export default function RecipeDetail({
  recipe,
  shareUrl,
}: {
  recipe: Recipe;
  shareUrl: string | null;
}) {
  return (
    <RecipeActions recipe={recipe} initialShareUrl={shareUrl}>
      <RecipeReadContent recipe={recipe} />
    </RecipeActions>
  );
}
