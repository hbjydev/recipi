import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, configuredHouseholdId } from "./auth";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  return {
    householdId: configuredHouseholdId(),
    userId: session.user.id,
    name: session.user.name || "Cook",
  };
}
