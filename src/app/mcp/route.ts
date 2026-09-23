import {
  hostHeaderValidationResponse,
  originValidationResponse,
} from "@modelcontextprotocol/server";
import { verifyApiToken } from "@/lib/api-tokens";
import { mcpHandler } from "@/lib/mcp-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  const publicUrl = process.env.NEXTAUTH_URL;
  if (!publicUrl) return new Response("NEXTAUTH_URL is required", { status: 500 });
  const hostname = new URL(publicUrl).hostname;
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  const hosts = local ? ["localhost", "127.0.0.1"] : [hostname];
  const rejected =
    hostHeaderValidationResponse(request, hosts) ?? originValidationResponse(request, hosts);
  if (rejected) return rejected;

  const authorization = request.headers.get("authorization");
  const match = authorization && /^Bearer (\S{1,200})$/i.exec(authorization);
  const access = match ? await verifyApiToken(match[1]) : null;
  if (!access)
    return new Response("A valid Recipi API token is required", {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer", "Cache-Control": "no-store" },
    });

  const response = await mcpHandler.fetch(request, {
    authInfo: {
      token: "verified",
      clientId: access.householdId,
      scopes: access.permission === "write" ? ["recipes:read", "recipes:write"] : ["recipes:read"],
    },
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
