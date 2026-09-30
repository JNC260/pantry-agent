"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { AppHeader } from "@/components/app-header";
import {
  PANTRY_CATEGORIES,
  listPantryItems,
  type PantryItem,
} from "@/lib/pantry-api";
import { useRequireAuth } from "@/lib/use-require-auth";
import {
  filterItems,
  sortItems,
  type CategoryFilter,
  type SortKey,
  type SortState,
  type StatusFilter,
} from "./_lib/list-view";
import { AddItemModal } from "./_components/add-item-modal";
import { ExpiryNotices } from "./_components/expiry-notices";
import { PantryFilters } from "./_components/pantry-filters";
import { PantryTable } from "./_components/pantry-table";

export default function PantryPage() {
  useRequireAuth();

  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped by Retry to run the load effect again.
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  // A new key on each open remounts the modal, so it starts empty.
  const [addSession, setAddSession] = useState(0);

  const [sort, setSort] = useState<SortState>({
    key: "ingredient",
    dir: "asc",
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  useEffect(() => {
    let cancelled = false;
    listPantryItems()
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load your pantry.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  function retryLoad() {
    setLoading(true);
    setLoadError(null);
    setLoadAttempt((n) => n + 1);
  }

  function openAdd() {
    setAddSession((n) => n + 1);
    setAddOpen(true);
  }

  function replaceItem(updated: PantryItem) {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  // Only offer categories that have items. If the chosen one empties out
  // (last item deleted or recategorized), fall back to all categories.
  const presentCategories = PANTRY_CATEGORIES.filter((c) =>
    items.some((item) => item.category === c),
  );
  const activeCategory: CategoryFilter =
    categoryFilter !== "all" && presentCategories.includes(categoryFilter)
      ? categoryFilter
      : "all";

  const visible = sortItems(
    filterItems(items, {
      query: search,
      status: statusFilter,
      category: activeCategory,
    }),
    sort,
  );

  // Clicking the active column flips its direction; a new column starts
  // ascending.
  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-display text-[32px] font-medium leading-tight">
              Your pantry
            </h1>
            <Button onClick={openAdd}>Add item</Button>
          </div>

          <ExpiryNotices items={items} />

          <AddItemModal
            key={addSession}
            open={addOpen}
            onClose={() => setAddOpen(false)}
            items={items}
            onAdded={(item) => setItems((prev) => [...prev, item])}
          />

          {loading && (
            <p className="font-display italic text-walnut">
              Loading your pantry…
            </p>
          )}

          {!loading && loadError && (
            <Card className="flex items-center justify-between gap-3 border-paprika">
              <p className="text-sm text-paprika">{loadError}</p>
              <Button variant="secondary" onClick={retryLoad}>
                Retry
              </Button>
            </Card>
          )}

          {!loading && !loadError && items.length === 0 && (
            <p className="text-walnut">
              Your pantry is empty. Use Add item to stock it.
            </p>
          )}

          {!loading && !loadError && items.length > 0 && (
            <div className="flex flex-col gap-5">
              <PantryFilters
                search={search}
                onSearchChange={setSearch}
                status={statusFilter}
                onStatusChange={setStatusFilter}
                category={activeCategory}
                onCategoryChange={setCategoryFilter}
                categories={presentCategories}
                visibleCount={visible.length}
                totalCount={items.length}
                onClear={clearFilters}
              />

              {visible.length === 0 ? (
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-ink pt-5">
                  <p className="text-walnut">Nothing matches these filters.</p>
                  <Button variant="text" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <PantryTable
                  items={visible}
                  sort={sort}
                  onSort={toggleSort}
                  onItemChange={replaceItem}
                  onItemDelete={removeItem}
                />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
