"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import Icon from "@/components/Icon";

type Props = { userName: string; recipeCount: number; tags: string[] };

export default function CookbookSidebar({ userName, recipeCount, tags }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const onList = pathname === "/recipes";
  const favorites = params.get("favorites") === "true";
  const tag = params.get("tag") || "";

  return (
    <aside className="sidebar">
      <Link href="/recipes" className="brand">
        recipi<span className="brand-dot">.</span>
      </Link>
      <div className="sidebar-section-label">YOUR KITCHEN</div>
      <Link href="/recipes" className={`nav-item ${onList && !favorites && !tag ? "active" : ""}`}>
        <Icon name="book" /> All recipes <span className="nav-count">{recipeCount}</span>
      </Link>
      <Link
        href="/recipes?favorites=true"
        className={`nav-item ${onList && favorites ? "active" : ""}`}
      >
        <Icon name="heart" /> Favorites
      </Link>
      <Link
        href="/recipes/tokens"
        className={`nav-item ${pathname === "/recipes/tokens" ? "active" : ""}`}
      >
        <Icon name="key" /> API tokens
      </Link>
      <div className="sidebar-section-label tag-label">TAGS</div>
      <div className="sidebar-tags">
        {tags.length ? (
          tags.map((item) => (
            <Link
              key={item}
              href={`/recipes?tag=${encodeURIComponent(item)}`}
              className={`nav-item tag-nav ${onList && tag === item ? "active" : ""}`}
            >
              <span className="tag-dot" />
              {item}
            </Link>
          ))
        ) : (
          <span className="sidebar-hint">Tags appear as you add recipes.</span>
        )}
      </div>
      <div className="sidebar-bottom">
        <div className="avatar">{userName.slice(0, 1).toUpperCase()}</div>
        <div className="user-info">
          <strong>{userName}</strong>
          <span>Household cookbook</span>
        </div>
        <button
          className="signout"
          onClick={() => void signOut()}
          title="Sign out"
          aria-label="Sign out"
        >
          <Icon name="arrow" size={17} />
        </button>
      </div>
    </aside>
  );
}
