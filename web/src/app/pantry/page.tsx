"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Button, Card } from "@/components/ui";
import { AppHeader } from "@/components/app-header";
import {
  PANTRY_CATEGORIES,
  listPantryItems,
  type PantryBatchResult,
  type PantryCategory,
  type PantryItem,
} from "@/lib/pantry-api";
import { useRequireAuth } from "@/lib/use-require-auth";
import {
  filterItems,
  sortItems,
  type SortKey,
  type SortState,
  type StatusFilter,
} from "./_lib/list-view";
import { AddItemModal } from "./_components/add-item-modal";
import { CookedLinkHandler } from "./_components/cooked-link-handler";
import { CookedRecipeModal } from "./_components/cooked-recipe-modal";
import { ExpiryNotices } from "./_components/expiry-notices";
import { ImportReceiptModal } from "./_components/import-receipt-modal";
import { PantryFilters } from "./_components/pantry-filters";
import { PantryTable } from "./_components/pantry-table";
import { ViewControls } from "./_components/view-controls";
import { loadPrefs, savePrefs, type ViewPrefs } from "./_lib/view-prefs";

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
  const [importOpen, setImportOpen] = useState(false);
  const [importSession, setImportSession] = useState(0);
  const [cookedOpen, setCookedOpen] = useState(false);
  const [cookedSession, setCookedSession] = useState(0);
  // Set when arriving from the chat's link; the modal starts reading it.
  const [cookedUrl, setCookedUrl] = useState<string | undefined>();

  const [sort, setSort] = useState<SortState>({
    key: "ingredient",
    dir: "asc",
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // Read on the first client render; the server render shows only the
  // loading state, which doesn't depend on it.
  const [prefs, setPrefs] = useState<ViewPrefs>(loadPrefs);

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

  function openImport() {
    setImportSession((n) => n + 1);
    setImportOpen(true);
  }

  // Stable, since CookedLinkHandler's effect depends on it.
  const openCooked = useCallback((url?: string) => {
    setCookedUrl(url);
    setCookedSession((n) => n + 1);
    setCookedOpen(true);
  }, []);

  // Folds a batch's results into the list without reloading it.
  function applyBatchResult(result: PantryBatchResult) {
    const updated = new Map(result.updated.map((item) => [item.id, item]));
    const deleted = new Set(result.deleted);
    setItems((prev) => [
      ...prev
        .filter((item) => !deleted.has(item.id))
        .map((item) => updated.get(item.id) ?? item),
      ...result.created,
    ]);
  }

  function replaceItem(updated: PantryItem) {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  const filters = { query: search, status: statusFilter };
  const filtering = search.trim() !== "" || statusFilter !== "all";
  const visible = sortItems(filterItems(items, filters), sort);

  function updatePrefs(changes: Partial<ViewPrefs>) {
    const next = { ...prefs, ...changes };
    setPrefs(next);
    savePrefs(next);
  }

  function toggleCategory(category: PantryCategory) {
    updatePrefs({
      collapsed: prefs.collapsed.includes(category)
        ? prefs.collapsed.filter((c) => c !== category)
        : [...prefs.collapsed, category],
    });
  }

  // Only categories with items, so one added later starts expanded.
  function collapseAll() {
    updatePrefs({
      collapsed: PANTRY_CATEGORIES.filter((c) =>
        items.some((item) => item.category === c),
      ),
    });
  }

  // A notice link is about to jump to this item's row, so make sure the row
  // is rendered: clear filters that hide it and expand its section. Flushed
  // synchronously because the browser follows the link right after this
  // click handler, and the row has to be in the DOM by then for the scroll
  // and :target highlight to land.
  function revealItem(item: PantryItem) {
    flushSync(() => {
      if (filterItems([item], filters).length === 0) clearFilters();
      if (prefs.collapsed.includes(item.category)) {
        updatePrefs({
          collapsed: prefs.collapsed.filter((c) => c !== item.category),
        });
      }
    });
  }

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
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => openCooked()}>
                Cooked a recipe
              </Button>
              <Button variant="secondary" onClick={openImport}>
                Import receipt
              </Button>
              <Button onClick={openAdd}>Add item</Button>
            </div>
          </div>

          <ExpiryNotices items={items} onReveal={revealItem} />

          <AddItemModal
            key={addSession}
            open={addOpen}
            onClose={() => setAddOpen(false)}
            items={items}
            onAdded={(item) => setItems((prev) => [...prev, item])}
          />

          <ImportReceiptModal
            key={`import-${importSession}`}
            open={importOpen}
            onClose={() => setImportOpen(false)}
            items={items}
            onApplied={applyBatchResult}
          />

          <CookedRecipeModal
            key={`cooked-${cookedSession}`}
            open={cookedOpen}
            onClose={() => setCookedOpen(false)}
            onApplied={applyBatchResult}
            initialUrl={cookedUrl}
          />
          <Suspense fallback={null}>
            <CookedLinkHandler onCookedLink={openCooked} />
          </Suspense>

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
                visibleCount={visible.length}
                totalCount={items.length}
                onClear={clearFilters}
              />

              <ViewControls
                compact={prefs.compact}
                onCompactChange={(compact) => updatePrefs({ compact })}
                filtering={filtering}
                onExpandAll={() => updatePrefs({ collapsed: [] })}
                onCollapseAll={collapseAll}
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
                  compact={prefs.compact}
                  collapsed={prefs.collapsed}
                  filtering={filtering}
                  onToggleCategory={toggleCategory}
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
