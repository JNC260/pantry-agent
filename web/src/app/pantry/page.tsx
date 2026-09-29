"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, SelectField, TextField } from "@/components/ui";
import { AppHeader } from "@/components/AppHeader";
import { AppleCoreIcon, CitrusIcon } from "@/components/graphics";
import {
  type PantryCategory,
  type PantryItem,
  PANTRY_CATEGORIES,
  CATEGORY_LABELS,
  listPantryItems,
  createPantryItem,
  updatePantryItem,
  deletePantryItem,
} from "@/lib/pantry-api";

type Draft = {
  ingredient: string;
  quantity: string;
  unit: string;
  expirationDate: string;
  category: PantryCategory;
};

const emptyDraft: Draft = {
  ingredient: "",
  quantity: "",
  unit: "",
  expirationDate: "",
  category: "other",
};

const categoryOptions = PANTRY_CATEGORIES.map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));

function toDraft(item: PantryItem): Draft {
  return {
    ingredient: item.ingredient,
    quantity: item.quantity !== null ? String(item.quantity) : "",
    unit: item.unit ?? "",
    expirationDate: item.expirationDate ?? "",
    category: item.category,
  };
}

function sortByIngredient(items: PantryItem[]): PantryItem[] {
  return [...items].sort((a, b) => a.ingredient.localeCompare(b.ingredient));
}

const USE_SOON_DAYS = 3;

// Expiration dates come from <input type="date">, i.e. "YYYY-MM-DD".
function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDate(value: string): string {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : value;
}

function daysUntil(value: string): number | null {
  const date = parseDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

type Freshness = "expired" | "soon" | "fresh" | "none";

function freshness(item: PantryItem): Freshness {
  if (!item.expirationDate) return "none";
  const days = daysUntil(item.expirationDate);
  if (days === null) return "fresh";
  if (days < 0) return "expired";
  if (days <= USE_SOON_DAYS) return "soon";
  return "fresh";
}

const freshnessStyles: Record<Freshness, string> = {
  expired: "text-paprika font-semibold before:bg-current",
  soon: "text-saffron font-semibold before:bg-current",
  fresh: "text-rosemary before:bg-current",
  none: "text-walnut before:border before:border-current",
};

function freshnessLabel(item: PantryItem): string {
  if (!item.expirationDate) return "No date";
  const date = formatDate(item.expirationDate);
  switch (freshness(item)) {
    case "expired":
      return `Expired ${date}`;
    case "soon":
      return `Use by ${date}`;
    default:
      return `Expires ${date}`;
  }
}

function itemAnchor(item: PantryItem): string {
  return `item-${item.id}`;
}

// A callout above the list naming items by expiry. Each name jumps to its row
// in the list below, where the edit/delete actions live.
function ExpiryNotice({
  icon,
  title,
  className,
  titleClassName = "",
  items,
  describe,
}: {
  icon: React.ReactNode;
  title: string;
  className: string;
  titleClassName?: string;
  items: PantryItem[];
  // Text after the item name, e.g. " by Oct 1, 2026".
  describe: (date: string) => string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-app px-4 py-3.5 ${className}`}
    >
      {icon}
      <h2 className={`font-display text-lg font-medium ${titleClassName}`}>
        {title}
      </h2>
      <p className="text-sm">
        {items.map((it, i) => (
          <span key={it.id}>
            {i > 0 && " · "}
            <a
              href={`#${itemAnchor(it)}`}
              className="underline decoration-current/40 underline-offset-[3px] transition-colors hover:decoration-current"
            >
              {it.ingredient}
            </a>
            {describe(formatDate(it.expirationDate!))}
          </span>
        ))}
      </p>
    </div>
  );
}

type SortKey = "ingredient" | "category" | "quantity" | "expires";
type SortState = { key: SortKey; dir: "asc" | "desc" };
type StatusFilter = "all" | "low" | "expiring";
type CategoryFilter = PantryCategory | "all";

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All items" },
  { value: "low", label: "Low stock" },
  { value: "expiring", label: "Expiring soon or expired" },
];

// Shared by the header row and item rows so the columns line up. The
// actions column is fixed (not auto) so every row resolves the same widths.
const TABLE_COLUMNS =
  "sm:grid-cols-[minmax(0,1fr)_170px_90px_175px_190px]";

const byName = (a: PantryItem, b: PantryItem) =>
  a.ingredient.localeCompare(b.ingredient);

// Compare two possibly-missing values; missing always sorts last, whichever
// direction the column is sorted in.
function compareMissingLast<T>(
  a: T | null,
  b: T | null,
  compare: (a: T, b: T) => number,
  dir: 1 | -1,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compare(a, b) * dir;
}

function sortItems(items: PantryItem[], { key, dir }: SortState): PantryItem[] {
  const d = dir === "asc" ? 1 : -1;
  const primary: Record<SortKey, (a: PantryItem, b: PantryItem) => number> = {
    ingredient: (a, b) => byName(a, b) * d,
    category: (a, b) =>
      CATEGORY_LABELS[a.category].localeCompare(CATEGORY_LABELS[b.category]) *
      d,
    quantity: (a, b) =>
      compareMissingLast(a.quantity, b.quantity, (x, y) => x - y, d),
    // "YYYY-MM-DD" compares correctly as a string.
    expires: (a, b) =>
      compareMissingLast(
        a.expirationDate,
        b.expirationDate,
        (x, y) => x.localeCompare(y),
        d,
      ),
  };
  // Ties fall back to name A–Z, so e.g. sorting by category lists each
  // category's items alphabetically.
  return [...items].sort((a, b) => primary[key](a, b) || byName(a, b));
}

function matchesStatus(item: PantryItem, filter: StatusFilter): boolean {
  if (filter === "low") return item.lowStock;
  if (filter === "expiring") {
    const f = freshness(item);
    return f === "expired" || f === "soon";
  }
  return true;
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  column: SortKey;
  sort: SortState;
  onSort: (column: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`inline-flex cursor-pointer items-center gap-1 text-sm font-medium transition-colors ${
        active ? "text-ink" : "text-walnut hover:text-rosemary"
      } ${className}`}
    >
      {label}
      {active && (
        <>
          <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3">
            <path
              d={sort.dir === "asc" ? "M3 7.5l3-3 3 3" : "M3 4.5l3 3 3-3"}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="sr-only">
            , sorted {sort.dir === "asc" ? "ascending" : "descending"}
          </span>
        </>
      )}
    </button>
  );
}

export default function PantryPage() {
  const router = useRouter();

  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [addForm, setAddForm] = useState<Draft>(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [sort, setSort] = useState<SortState>({
    key: "ingredient",
    dir: "asc",
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [flagError, setFlagError] = useState<{
    id: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    listPantryItems()
      .then((data) => {
        if (cancelled) return;
        setItems(sortByIngredient(data));
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
  }, []);

  async function retryLoad() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listPantryItems();
      setItems(sortByIngredient(data));
    } catch {
      setLoadError("Couldn't load your pantry.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const ingredient = addForm.ingredient.trim();
    if (!ingredient) {
      setAddError("Ingredient is required.");
      return;
    }

    setAdding(true);
    setAddError(null);
    try {
      const input: Parameters<typeof createPantryItem>[0] = {
        ingredient,
        category: addForm.category,
      };
      if (addForm.quantity.trim()) input.quantity = Number(addForm.quantity);
      if (addForm.unit.trim()) input.unit = addForm.unit.trim();
      if (addForm.expirationDate.trim())
        input.expirationDate = addForm.expirationDate;

      const created = await createPantryItem(input);
      setItems((prev) => sortByIngredient([...prev, created]));
      setAddForm(emptyDraft);
    } catch {
      setAddError("Couldn't add that item. Try again.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(item: PantryItem) {
    setEditingId(item.id);
    setEditDraft(toDraft(item));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
    setEditError(null);
  }

  async function saveEdit(item: PantryItem) {
    if (!editDraft) return;
    const ingredient = editDraft.ingredient.trim();
    if (!ingredient) {
      setEditError("Ingredient is required.");
      return;
    }

    const updates: Parameters<typeof updatePantryItem>[1] = {};
    if (ingredient !== item.ingredient) updates.ingredient = ingredient;

    const quantityTrimmed = editDraft.quantity.trim();
    const currentQuantity = item.quantity !== null ? String(item.quantity) : "";
    if (quantityTrimmed && quantityTrimmed !== currentQuantity) {
      updates.quantity = Number(quantityTrimmed);
    }

    const unitTrimmed = editDraft.unit.trim();
    if (unitTrimmed && unitTrimmed !== (item.unit ?? "")) {
      updates.unit = unitTrimmed;
    }

    const expirationTrimmed = editDraft.expirationDate.trim();
    if (
      expirationTrimmed &&
      expirationTrimmed !== (item.expirationDate ?? "")
    ) {
      updates.expirationDate = expirationTrimmed;
    }

    if (editDraft.category !== item.category) {
      updates.category = editDraft.category;
    }

    if (Object.keys(updates).length === 0) {
      cancelEdit();
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      const updated = await updatePantryItem(item.id, updates);
      setItems((prev) =>
        sortByIngredient(prev.map((it) => (it.id === item.id ? updated : it))),
      );
      cancelEdit();
    } catch {
      setEditError("Couldn't save changes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function startDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
  }

  function cancelDelete() {
    setDeletingId(null);
    setDeleteError(null);
  }

  async function confirmDelete(id: string) {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePantryItem(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      setDeletingId(null);
    } catch {
      setDeleteError("Couldn't delete that item. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function setLowStock(item: PantryItem, lowStock: boolean) {
    const replace = (next: PantryItem) =>
      setItems((prev) => prev.map((it) => (it.id === item.id ? next : it)));

    // Optimistic: show the pill change immediately, revert if the save fails.
    replace({ ...item, lowStock });
    setFlaggingId(item.id);
    setFlagError(null);
    try {
      const updated = await updatePantryItem(item.id, { lowStock });
      // authedFetch doesn't throw on 4xx/5xx, so an error body lands here.
      if (updated?.id !== item.id) throw new Error("Update failed");
      replace(updated);
    } catch {
      replace(item);
      setFlagError({
        id: item.id,
        message: "Couldn't update low stock. Try again.",
      });
    } finally {
      setFlaggingId(null);
    }
  }

  const byExpiration = (a: PantryItem, b: PantryItem) =>
    a.expirationDate!.localeCompare(b.expirationDate!);
  const expired = items
    .filter((it) => freshness(it) === "expired")
    .sort(byExpiration);
  const useSoon = items
    .filter((it) => freshness(it) === "soon")
    .sort(byExpiration);

  // Only offer categories that have items. If the chosen one empties out
  // (last item deleted or recategorized), fall back to all categories.
  const presentCategories = PANTRY_CATEGORIES.filter((c) =>
    items.some((it) => it.category === c),
  );
  const activeCategory: CategoryFilter =
    categoryFilter !== "all" && presentCategories.includes(categoryFilter)
      ? categoryFilter
      : "all";
  const categoryFilterOptions = [
    { value: "all", label: "All categories" },
    ...presentCategories.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
  ];

  const filtering = statusFilter !== "all" || activeCategory !== "all";
  const visible = sortItems(
    items.filter(
      (it) =>
        matchesStatus(it, statusFilter) &&
        (activeCategory === "all" || it.category === activeCategory),
    ),
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
    setStatusFilter("all");
    setCategoryFilter("all");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-8">
          <h1 className="font-display text-[32px] font-medium leading-tight">
            Your pantry
          </h1>

          {(expired.length > 0 || useSoon.length > 0) && (
            <div className="flex flex-col gap-3">
              {expired.length > 0 && (
                <ExpiryNotice
                  icon={<AppleCoreIcon className="h-[22px] w-[22px] flex-none" />}
                  title="Expired — consider discarding"
                  className="bg-paprika-wash"
                  titleClassName="text-paprika"
                  items={expired}
                  describe={(date) => `, expired ${date}`}
                />
              )}
              {useSoon.length > 0 && (
                <ExpiryNotice
                  icon={<CitrusIcon className="h-[22px] w-[22px] flex-none" />}
                  title="Use these first"
                  className="bg-saffron-wash"
                  items={useSoon}
                  describe={(date) => ` by ${date}`}
                />
              )}
            </div>
          )}

          <form
            onSubmit={handleAdd}
            className="flex flex-col gap-3"
            aria-label="Add an item"
          >
            <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,0.45fr)_minmax(0,0.6fr)_minmax(0,1fr)_auto]">
              <TextField
                label="Ingredient"
                value={addForm.ingredient}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, ingredient: e.target.value }))
                }
                placeholder="e.g. Parmesan"
                className="col-span-2 lg:col-span-1"
              />
              <SelectField
                label="Category"
                value={addForm.category}
                onChange={(e) =>
                  setAddForm((f) => ({
                    ...f,
                    category: e.target.value as PantryCategory,
                  }))
                }
                options={categoryOptions}
                className="col-span-2 lg:col-span-1"
              />
              <TextField
                label="Quantity"
                value={addForm.quantity}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, quantity: e.target.value }))
                }
                placeholder="1"
                type="number"
              />
              <TextField
                label="Unit"
                value={addForm.unit}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, unit: e.target.value }))
                }
                placeholder="wedge"
              />
              <TextField
                label="Expires"
                value={addForm.expirationDate}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, expirationDate: e.target.value }))
                }
                type="date"
                className="col-span-2 lg:col-span-1"
              />
              <Button
                type="submit"
                disabled={adding}
                className="col-span-2 justify-self-start lg:col-span-1"
              >
                {adding ? "Adding…" : "Add item"}
              </Button>
            </div>
            {addError && <p className="text-sm text-paprika">{addError}</p>}
          </form>

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
              Your pantry is empty. Add your first item above.
            </p>
          )}

          {!loading && !loadError && items.length > 0 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
                <SelectField
                  label="Status"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                  options={statusOptions}
                  className="w-60"
                />
                <SelectField
                  label="Category"
                  value={activeCategory}
                  onChange={(e) =>
                    setCategoryFilter(e.target.value as CategoryFilter)
                  }
                  options={categoryFilterOptions}
                  className="w-56"
                />
                {filtering && (
                  <p className="basis-full pb-3 text-sm tabular-nums text-walnut sm:ml-auto sm:basis-auto">
                    Showing {visible.length} of {items.length}
                  </p>
                )}
              </div>

              {visible.length === 0 ? (
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-ink pt-5">
                  <p className="text-walnut">Nothing matches these filters.</p>
                  <Button variant="text" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div>
                  <div
                    className={`flex flex-wrap gap-x-5 gap-y-1 border-b border-ink pb-2 sm:grid ${TABLE_COLUMNS}`}
                  >
                    <SortHeader
                      label="Ingredient"
                      column="ingredient"
                      sort={sort}
                      onSort={toggleSort}
                      className="justify-self-start"
                    />
                    <SortHeader
                      label="Category"
                      column="category"
                      sort={sort}
                      onSort={toggleSort}
                      className="justify-self-start"
                    />
                    <SortHeader
                      label="Quantity"
                      column="quantity"
                      sort={sort}
                      onSort={toggleSort}
                      className="sm:justify-self-end"
                    />
                    <SortHeader
                      label="Expires"
                      column="expires"
                      sort={sort}
                      onSort={toggleSort}
                      className="justify-self-start"
                    />
                  </div>
                  <ul className="border-b border-rule">
                    {visible.map((item) => {
                      const isEditing = editingId === item.id;
                      const isDeleting = deletingId === item.id;

                      return (
                        <li
                          key={item.id}
                          id={itemAnchor(item)}
                          className="scroll-mt-6 border-rule py-4 transition-colors [&+&]:border-t target:bg-linen target:shadow-[-12px_0_0_var(--linen),12px_0_0_var(--linen)]"
                        >
                          {isEditing && editDraft ? (
                            <div className="flex flex-col gap-3">
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                                <TextField
                                  label="Ingredient"
                                  value={editDraft.ingredient}
                                  onChange={(e) =>
                                    setEditDraft((d) =>
                                      d ? { ...d, ingredient: e.target.value } : d,
                                    )
                                  }
                                  className="col-span-2 sm:col-span-4"
                                />
                                <SelectField
                                  label="Category"
                                  value={editDraft.category}
                                  onChange={(e) =>
                                    setEditDraft((d) =>
                                      d
                                        ? {
                                            ...d,
                                            category: e.target
                                              .value as PantryCategory,
                                          }
                                        : d,
                                    )
                                  }
                                  options={categoryOptions}
                                  className="col-span-2"
                                />
                                <TextField
                                  label="Quantity"
                                  value={editDraft.quantity}
                                  onChange={(e) =>
                                    setEditDraft((d) =>
                                      d ? { ...d, quantity: e.target.value } : d,
                                    )
                                  }
                                  type="number"
                                />
                                <TextField
                                  label="Unit"
                                  value={editDraft.unit}
                                  onChange={(e) =>
                                    setEditDraft((d) =>
                                      d ? { ...d, unit: e.target.value } : d,
                                    )
                                  }
                                />
                                <TextField
                                  label="Expires"
                                  value={editDraft.expirationDate}
                                  onChange={(e) =>
                                    setEditDraft((d) =>
                                      d
                                        ? { ...d, expirationDate: e.target.value }
                                        : d,
                                    )
                                  }
                                  type="date"
                                  className="col-span-2"
                                />
                              </div>
                              {editError && (
                                <p className="text-sm text-paprika">{editError}</p>
                              )}
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => saveEdit(item)}
                                  disabled={saving}
                                >
                                  {saving ? "Saving…" : "Save"}
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={cancelEdit}
                                  disabled={saving}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-5 gap-y-1 ${TABLE_COLUMNS}`}>
                              <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                                <span className="font-display text-[19px] font-medium">
                                  {item.ingredient}
                                </span>
                                {item.lowStock && (
                                  <span className="inline-flex items-center gap-1 self-center rounded-full bg-saffron-wash py-0.5 pl-2.5 pr-1 text-xs font-semibold text-saffron">
                                    Low stock
                                    <button
                                      type="button"
                                      onClick={() => setLowStock(item, false)}
                                      disabled={flaggingId === item.id}
                                      aria-label={`Remove low stock flag from ${item.ingredient}`}
                                      title="Remove low stock flag"
                                      className="grid size-4 cursor-pointer place-items-center rounded-full leading-none transition-colors hover:bg-saffron hover:text-saffron-wash focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-saffron disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <svg
                                        aria-hidden="true"
                                        viewBox="0 0 10 10"
                                        className="size-2"
                                      >
                                        <path
                                          d="M2 2l6 6M8 2l-6 6"
                                          stroke="currentColor"
                                          strokeWidth="1.6"
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                    </button>
                                  </span>
                                )}
                              </span>
                              {/* On phones the columns stack, so the category
                                  moves under the name instead. */}
                              <span className="text-sm text-walnut max-sm:col-span-2 max-sm:row-start-2 max-sm:-mt-1 max-sm:text-xs">
                                {CATEGORY_LABELS[item.category]}
                              </span>
                              <span
                                className={`text-right text-[15px] tabular-nums ${item.lowStock ? "text-saffron" : ""}`}
                              >
                                {item.quantity !== null && item.quantity}
                                {item.unit && (
                                  <span
                                    className={`text-sm ${item.lowStock ? "" : "text-walnut"}`}
                                  >
                                    {item.quantity !== null ? " " : ""}
                                    {item.unit}
                                  </span>
                                )}
                              </span>
                              <span
                                className={`inline-flex items-center gap-2 whitespace-nowrap text-sm tabular-nums before:size-[7px] before:flex-none before:rounded-full before:content-[''] ${freshnessStyles[freshness(item)]}`}
                              >
                                {freshnessLabel(item)}
                              </span>

                              {isDeleting ? (
                                <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 sm:col-span-1 sm:justify-self-end">
                                  <span className="text-sm">Delete this item?</span>
                                  <Button
                                    variant="danger-text"
                                    onClick={() => confirmDelete(item.id)}
                                    disabled={deleting}
                                  >
                                    {deleting ? "Deleting…" : "Delete"}
                                  </Button>
                                  <Button
                                    variant="text"
                                    onClick={cancelDelete}
                                    disabled={deleting}
                                  >
                                    Cancel
                                  </Button>
                                  {deleteError && (
                                    <span className="basis-full text-sm text-paprika">
                                      {deleteError}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex gap-4 justify-self-end">
                                  {/* Hidden rather than removed when flagged, so the
                                      actions column keeps its width and the
                                      quantity/expiry columns don't shift. */}
                                  <button
                                    type="button"
                                    onClick={() => setLowStock(item, true)}
                                    disabled={item.lowStock || flaggingId === item.id}
                                    aria-label={`Mark ${item.ingredient} as low stock`}
                                    className={`group inline-flex cursor-pointer items-center gap-1 text-sm text-walnut transition-colors hover:text-saffron disabled:cursor-not-allowed disabled:opacity-50 ${item.lowStock ? "invisible" : ""}`}
                                  >
                                    <svg
                                      aria-hidden="true"
                                      viewBox="0 0 12 12"
                                      className="size-3"
                                    >
                                      <path
                                        d="M2 6.5l2.5 2.5L10 3"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                    <span className="underline decoration-rule underline-offset-[3px] group-hover:decoration-current">
                                      Mark low
                                    </span>
                                  </button>
                                  <Button
                                    variant="text"
                                    onClick={() => startEdit(item)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="danger-text"
                                    onClick={() => startDelete(item.id)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              )}
                              {flagError?.id === item.id && (
                                <p className="col-span-full text-sm text-paprika">
                                  {flagError.message}
                                </p>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
