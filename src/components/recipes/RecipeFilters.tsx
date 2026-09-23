"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

type Props = {
  search: string;
  tag: string;
  favorites: boolean;
  tags: string[];
  count: number;
};

export default function RecipeFilters({ search, tag, favorites, tags, count }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<{ source: string; value: string } | null>(null);
  const query = draft?.source === search ? draft.value : search;

  useEffect(() => {
    if (query === search) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      if (tag) params.set("tag", tag);
      if (favorites) params.set("favorites", "true");
      router.replace(`/recipes${params.size ? `?${params}` : ""}`, { scroll: false });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, search, tag, favorites, router]);

  const searchSuffix = query ? `&search=${encodeURIComponent(query)}` : "";

  return (
    <>
      <section className="toolbar" aria-label="Recipe filters">
        <label className="search-box">
          <Icon name="search" size={17} />
          <input
            value={query}
            onChange={(event) => setDraft({ source: search, value: event.target.value })}
            placeholder="Search recipes, ingredients, tags..."
            aria-label="Search recipes"
          />
          {query && (
            <button
              onClick={() => setDraft({ source: search, value: "" })}
              aria-label="Clear search"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </label>
        <div className="filter-label">
          {favorites ? "Favorites" : tag || "All recipes"}
          <span>{count}</span>
        </div>
      </section>
      <nav className="mobile-filters" aria-label="Recipe categories">
        <Link
          className={!favorites && !tag ? "active" : ""}
          href={`/recipes${query ? `?search=${encodeURIComponent(query)}` : ""}`}
        >
          All
        </Link>
        <Link className={favorites ? "active" : ""} href={`/recipes?favorites=true${searchSuffix}`}>
          Favorites
        </Link>
        {tags.map((item) => (
          <Link
            key={item}
            className={tag === item ? "active" : ""}
            href={`/recipes?tag=${encodeURIComponent(item)}${searchSuffix}`}
          >
            {item}
          </Link>
        ))}
      </nav>
    </>
  );
}
