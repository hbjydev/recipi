"use client";

import { useRef, useState, type FormEvent } from "react";
import type { TokenSummary, TokenPermission } from "@/lib/api-tokens";

export default function TokenManager({
  initialTokens,
  mcpUrl,
}: {
  initialTokens: TokenSummary[];
  mcpUrl: string;
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [label, setLabel] = useState("");
  const [permission, setPermission] = useState<TokenPermission>("read");
  const [days, setDays] = useState<30 | 90 | 365 | null>(90);
  const [newToken, setNewToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const tokenInput = useRef<HTMLInputElement>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, permission, days }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create token");
      setTokens((current) => [body.summary, ...current]);
      setNewToken(body.token);
      setLabel("");
      setCopied(false);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
    } catch {
      tokenInput.current?.select();
    }
  }

  async function revoke(token: TokenSummary) {
    if (!window.confirm(`Revoke “${token.label}”? Apps using it will lose access immediately.`))
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tokens/${token.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Could not revoke token");
      }
      setTokens((current) => current.filter((item) => item.id !== token.id));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tokens-page">
      <section className="page-intro tokens-intro">
        <div>
          <span className="eyebrow">YOUR KITCHEN · INTEGRATIONS</span>
          <h1>
            API tokens<span className="heading-period">.</span>
          </h1>
          <p>Let your tools work with the household cookbook.</p>
        </div>
      </section>

      <div className="tokens-layout">
        <section className="tokens-card">
          <span className="eyebrow">NEW CONNECTION</span>
          <h2>Create a token</h2>
          <p>
            Use a token with the Recipi API or an MCP client. Choose an expiry or keep it active
            until you revoke it.
          </p>
          <form onSubmit={(event) => void create(event)}>
            <label className="field">
              <span>Name this token</span>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                maxLength={80}
                required
                placeholder="e.g. Kitchen assistant"
              />
            </label>
            <div className="token-form-row">
              <label className="field">
                <span>Access</span>
                <select
                  value={permission}
                  onChange={(event) => setPermission(event.target.value as TokenPermission)}
                >
                  <option value="read">Read only</option>
                  <option value="write">Read and write</option>
                </select>
              </label>
              <label className="field">
                <span>Expires in</span>
                <select
                  value={days ?? "never"}
                  onChange={(event) =>
                    setDays(event.target.value === "never" ? null : (Number(event.target.value) as 30 | 90 | 365))
                  }
                >
                  <option value="never">Never</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                </select>
              </label>
            </div>
            <button className="button button-primary" disabled={busy || Boolean(newToken)}>
              Create token
            </button>
          </form>
          {error && (
            <p className="token-error" role="alert">
              {error}
            </p>
          )}
        </section>

        <aside className="tokens-help">
          <span className="eyebrow">CONNECT VIA MCP</span>
          <h2>Your cookbook, where you work.</h2>
          <p>Point your MCP client at this endpoint and send your token as a Bearer header.</p>
          <code>{mcpUrl}</code>
          <p className="tokens-help-note">
            Read-only tokens can browse tags, read recipes, and view existing share links. Read and
            write tokens can also edit recipes and manage public links.
          </p>
        </aside>
      </div>

      {newToken && (
        <section className="token-reveal" aria-label="New API token">
          <div>
            <span className="eyebrow">COPY THIS NOW</span>
            <h2>Your new token</h2>
            <p>
              This is the only time Recipi will show it. Keep it in your MCP client or a secure
              secret store.
            </p>
          </div>
          <div className="token-reveal-row">
            <input
              ref={tokenInput}
              aria-label="New API token"
              value={newToken}
              readOnly
              onFocus={(event) => event.target.select()}
            />
            <button className="button button-primary" onClick={() => void copy()}>
              {copied ? "Copied" : "Copy token"}
            </button>
          </div>
          <button className="text-button token-done" onClick={() => setNewToken("")}>
            I’ve saved this token
          </button>
        </section>
      )}

      <section className="tokens-list-section">
        <div className="tokens-section-heading">
          <div>
            <span className="eyebrow">YOUR CONNECTIONS</span>
            <h2>Your tokens</h2>
          </div>
          <span>{tokens.length} total</span>
        </div>
        {tokens.length ? (
          <div className="tokens-list">
            {tokens.map((token) => {
              const lastUsedAt = token.lastUsedAt;
              const lastUsedLabel =
                lastUsedAt === null ? " · Never used" : ` · Used ${formatDate(lastUsedAt)}`;
              const expiresLabel = token.expired
                ? "Expired"
                : token.expiresAt
                  ? `Expires ${formatDate(token.expiresAt)}`
                  : "No expiry";
              return (
                <div className="token-row" key={token.id}>
                  <div>
                    <strong>{token.label}</strong>
                    <span>
                      {token.permission === "write" ? "Read and write" : "Read only"} ·{" "}
                      {expiresLabel}
                      {lastUsedLabel}
                    </span>
                  </div>
                  <button
                    className="text-button danger"
                    disabled={busy}
                    onClick={() => void revoke(token)}
                  >
                    Revoke
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="tokens-empty">
            No tokens yet. Create one when you’re ready to connect a tool.
          </p>
        )}
      </section>
    </div>
  );
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(date),
  );
}
