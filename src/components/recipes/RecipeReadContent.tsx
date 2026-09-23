import type { Recipe } from "@/lib/recipe";

export default function RecipeReadContent({
  recipe,
  imageUrl = recipe.imageUrl,
  showNotes = true,
}: {
  recipe: Recipe;
  imageUrl?: string;
  showNotes?: boolean;
}) {
  const total = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  return (
    <>
      {imageUrl && (
        <div
          className="detail-image"
          style={{ backgroundImage: `url("${imageUrl.replaceAll('"', "%22")}")` }}
        />
      )}
      <div className="detail-content">
        <div className="detail-tags">
          {recipe.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <h1>{recipe.title}</h1>
        {recipe.description && <p className="detail-description">{recipe.description}</p>}
        <div className="detail-facts">
          {recipe.servings && (
            <div>
              <span>SERVES</span>
              <strong>{recipe.servings}</strong>
            </div>
          )}
          {recipe.prepMinutes !== null && (
            <div>
              <span>PREP</span>
              <strong>{recipe.prepMinutes} min</strong>
            </div>
          )}
          {recipe.cookMinutes !== null && (
            <div>
              <span>COOK</span>
              <strong>{recipe.cookMinutes} min</strong>
            </div>
          )}
          {total > 0 && (
            <div>
              <span>TOTAL</span>
              <strong>{total} min</strong>
            </div>
          )}
        </div>
        <div className="detail-columns">
          <section>
            <h2>Ingredients</h2>
            {recipe.ingredients.length ? (
              <ul className="ingredients-list">
                {recipe.ingredients.map((item, index) => (
                  <li key={index}>
                    <label>
                      <input type="checkbox" />
                      <span>{item}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No ingredients added yet.</p>
            )}
          </section>
          <section>
            <h2>Method</h2>
            {recipe.steps.length ? (
              <ol className="steps-list">
                {recipe.steps.map((item, index) => (
                  <li key={index}>
                    <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                    <p>{item}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">No steps added yet.</p>
            )}
          </section>
        </div>
        {showNotes && recipe.notes && (
          <section className="notes-box">
            <span className="eyebrow">A NOTE TO SELF</span>
            <p>{recipe.notes}</p>
          </section>
        )}
        {recipe.sourceUrl && (
          <a
            className="source-link"
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View original recipe ↗
          </a>
        )}
      </div>
    </>
  );
}
