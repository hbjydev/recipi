import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";

const issuer = process.env.OIDC_ISSUER?.replace(/\/$/, "") ?? "";

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "kanidm",
      name: "Kanidm",
      type: "oauth",
      wellKnown: process.env.OIDC_WELL_KNOWN || `${issuer}/.well-known/openid-configuration`,
      authorization: { params: { scope: "openid profile email" } },
      idToken: true,
      checks: ["pkce", "state"],
      clientId: process.env.OIDC_CLIENT_ID ?? "",
      clientSecret: process.env.OIDC_CLIENT_SECRET ?? "",
      client: {
        authorization_signed_response_alg: "ES256",
        id_token_signed_response_alg: "ES256",
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username || profile.sub,
          email: profile.email || null,
          image: null,
        };
      },
    },
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/" },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export function configuredHouseholdId(): string {
  const id = process.env.HOUSEHOLD_ID;
  if (!id || !/^[a-z0-9-]{1,64}$/.test(id)) {
    throw new Error("HOUSEHOLD_ID must be set to a lowercase household identifier");
  }
  return `household:${id}`;
}

export async function currentMember(): Promise<{ householdId: string; userId: string } | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id
    ? { householdId: configuredHouseholdId(), userId: session.user.id }
    : null;
}

export async function currentHouseholdId(): Promise<string | null> {
  return (await currentMember())?.householdId ?? null;
}
