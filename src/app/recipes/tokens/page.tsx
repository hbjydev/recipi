import { requireUser } from "@/lib/current-user";
import { listApiTokens } from "@/lib/api-tokens";
import TokenManager from "@/components/recipes/TokenManager";

export default async function ApiTokensPage() {
  const user = await requireUser();
  const tokens = await listApiTokens(user.householdId, user.userId);
  const mcpUrl = new URL("/mcp", process.env.NEXTAUTH_URL || "http://localhost:3000").href;
  return <TokenManager initialTokens={tokens} mcpUrl={mcpUrl} />;
}
