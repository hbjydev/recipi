import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignInButton from "@/components/SignInButton";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) redirect("/recipes");
  return (
    <main className="signin-page">
      <div className="signin-brand">
        recipi<span className="brand-dot">.</span>
      </div>
      <div className="signin-card">
        <h1>Every good recipe deserves a home.</h1>
        <p>
          Save the dishes you return to, keep your notes close, and find what you want to cook next.
        </p>
        <SignInButton />
        <span className="signin-foot">Private recipes, secured with Kanidm</span>
      </div>
    </main>
  );
}
