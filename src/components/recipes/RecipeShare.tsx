"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";

export default function RecipeShare({
  recipeId,
  initialUrl,
}: {
  recipeId: string;
  initialUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const linkInput = useRef<HTMLInputElement>(null);

  async function changeShare(method: "POST" | "DELETE") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/recipes/${recipeId}/share`, { method });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update the link");
      setUrl(method === "POST" ? result.url : null);
      setMessage(
        method === "POST" ? "Link ready to copy." : "Link revoked. It can no longer be opened.",
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function showShare() {
    setOpen(true);
    if (!url) await changeShare("POST");
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied.");
    } catch {
      linkInput.current?.select();
      setMessage("Select and copy the link above.");
    }
  }

  return (
    <>
      <button
        className="icon-button"
        type="button"
        onClick={() => (open ? setOpen(false) : void showShare())}
        aria-label="Share recipe"
        aria-expanded={open}
        title="Share recipe"
      >
        <Icon name="share" size={19} />
      </button>
      {open && (
        <section className="recipe-share-panel" aria-label="Public sharing">
          <div className="recipe-share-heading">
            <div>
              <span className="eyebrow">PUBLIC LINK</span>
              <h2>Share this recipe</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close sharing"
            >
              <Icon name="close" size={17} />
            </button>
          </div>
          <p>Anyone with this link can read the recipe. Your personal notes stay private.</p>
          {url ? (
            <div className="recipe-share-link">
              <input
                ref={linkInput}
                aria-label="Public recipe link"
                value={url}
                readOnly
                onFocus={(event) => event.target.select()}
              />
              <button className="button button-primary" type="button" onClick={() => void copy()}>
                Copy link
              </button>
            </div>
          ) : busy ? (
            <p className="recipe-share-status">Creating your link…</p>
          ) : (
            <button
              className="button button-primary"
              type="button"
              onClick={() => void changeShare("POST")}
            >
              Create link
            </button>
          )}
          <div className="recipe-share-bottom">
            <span
              className={error ? "recipe-share-error" : "recipe-share-status"}
              role={error ? "alert" : "status"}
            >
              {error || message}
            </span>
            {url && (
              <button
                className="text-button danger"
                type="button"
                disabled={busy}
                onClick={() => void changeShare("DELETE")}
              >
                Revoke link
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}
