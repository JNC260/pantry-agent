"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, TextField } from "@/components/ui";
import { AppHeader } from "@/components/AppHeader";
import { CitrusIcon } from "@/components/graphics";
import {
  type PantryItem,
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
};

const emptyDraft: Draft = {
  ingredient: "",
  quantity: "",
  unit: "",
  expirationDate: "",
};

function toDraft(item: PantryItem): Draft {
  return {
    ingredient: item.ingredient,
    quantity: item.quantity !== null ? String(item.quantity) : "",
    unit: item.unit ?? "",
    expirationDate: item.expirationDate ?? "",
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
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
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

function groupByLetter(items: PantryItem[]): [string, PantryItem[]][] {
  const groups = new Map<string, PantryItem[]>();
  for (const item of items) {
    const first = item.ingredient.trim().charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(first) ? first : "#";
    groups.set(letter, [...(groups.get(letter) ?? []), item]);
  }
  return [...groups.entries()];
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
      const input: Parameters<typeof createPantryItem>[0] = { ingredient };
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

  const useFirst = items
    .filter((it) => {
      const f = freshness(it);
      return f === "soon" || f === "expired";
    })
    .sort((a, b) => a.expirationDate!.localeCompare(b.expirationDate!));

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          <h1 className="font-display text-[32px] font-medium leading-tight">
            Your pantry
          </h1>

          {useFirst.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-app bg-saffron-wash px-4 py-3.5">
              <CitrusIcon className="h-[22px] w-[22px] flex-none" />
              <h2 className="font-display text-lg font-medium">
                Use these first
              </h2>
              <p className="text-sm">
                {useFirst
                  .map((it) =>
                    freshness(it) === "expired"
                      ? `${it.ingredient}, expired ${formatDate(it.expirationDate!)}`
                      : `${it.ingredient} by ${formatDate(it.expirationDate!)}`,
                  )
                  .join(" · ")}
              </p>
            </div>
          )}

          <form
            onSubmit={handleAdd}
            className="flex flex-col gap-3"
            aria-label="Add an item"
          >
            <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
              <TextField
                label="Ingredient"
                value={addForm.ingredient}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, ingredient: e.target.value }))
                }
                placeholder="e.g. Parmesan"
                className="col-span-2 sm:col-span-1"
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
                className="col-span-2 sm:col-span-1"
              />
              <Button
                type="submit"
                disabled={adding}
                className="col-span-2 justify-self-start sm:col-span-1"
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
            <div className="border-t border-ink">
              {groupByLetter(items).map(([letter, group], groupIndex) => (
                <div
                  key={letter}
                  className="grid grid-cols-[32px_minmax(0,1fr)] gap-3.5 border-b border-rule sm:grid-cols-[40px_minmax(0,1fr)] sm:gap-5"
                >
                  <div
                    aria-hidden="true"
                    className={`mt-3.5 grid size-8 place-items-center rounded-app font-display text-[17px] font-semibold sm:size-10 sm:text-xl ${
                      groupIndex % 2 === 0
                        ? "bg-rosemary-fill text-on-rosemary"
                        : "bg-sage-wash text-rosemary"
                    }`}
                  >
                    {letter}
                  </div>
                  <ul>
                    {group.map((item) => {
                      const isEditing = editingId === item.id;
                      const isDeleting = deletingId === item.id;

                      return (
                        <li
                          key={item.id}
                          className="border-rule py-4 [&+&]:border-t"
                        >
                          {isEditing && editDraft ? (
                            <div className="flex flex-col gap-3">
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <TextField
                                  label="Ingredient"
                                  value={editDraft.ingredient}
                                  onChange={(e) =>
                                    setEditDraft((d) =>
                                      d ? { ...d, ingredient: e.target.value } : d,
                                    )
                                  }
                                  className="col-span-2 sm:col-span-1"
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
                                  className="col-span-2 sm:col-span-1"
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
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-5 gap-y-1 sm:grid-cols-[minmax(0,1fr)_110px_150px_auto]">
                              <span className="font-display text-[19px] font-medium">
                                {item.ingredient}
                              </span>
                              <span className="text-right text-[15px] tabular-nums">
                                {item.quantity !== null && item.quantity}
                                {item.unit && (
                                  <span className="text-sm text-walnut">
                                    {item.quantity !== null ? " " : ""}
                                    {item.unit}
                                  </span>
                                )}
                              </span>
                              <span
                                className={`inline-flex items-center gap-2 text-sm tabular-nums before:size-[7px] before:flex-none before:rounded-full before:content-[''] ${freshnessStyles[freshness(item)]}`}
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
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
