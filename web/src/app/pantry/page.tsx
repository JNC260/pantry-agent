"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, TextField } from "@/components/ui";
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
    if (expirationTrimmed && expirationTrimmed !== (item.expirationDate ?? "")) {
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

  return (
    <main className="flex flex-col min-h-screen max-w-2xl mx-auto w-full px-4 py-6 gap-6">
      <header className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        <h1 className="font-display text-base font-semibold tracking-tight text-foreground">
          Pantry
        </h1>
      </header>

      <Card>
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Add an item</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <TextField
              value={addForm.ingredient}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, ingredient: e.target.value }))
              }
              placeholder="Ingredient"
              className="col-span-2 sm:col-span-1"
            />
            <TextField
              value={addForm.quantity}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, quantity: e.target.value }))
              }
              placeholder="Quantity"
              type="number"
            />
            <TextField
              value={addForm.unit}
              onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))}
              placeholder="Unit"
            />
            <TextField
              value={addForm.expirationDate}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, expirationDate: e.target.value }))
              }
              type="date"
            />
          </div>
          {addError && <p className="text-sm text-danger">{addError}</p>}
          <Button type="submit" disabled={adding} className="self-start">
            {adding ? "Adding…" : "Add item"}
          </Button>
        </form>
      </Card>

      {loading && <p className="text-sm text-muted">Loading your pantry…</p>}

      {!loading && loadError && (
        <Card className="flex items-center justify-between gap-3">
          <p className="text-sm text-danger">{loadError}</p>
          <Button variant="secondary" onClick={retryLoad}>
            Retry
          </Button>
        </Card>
      )}

      {!loading && !loadError && items.length === 0 && (
        <p className="text-sm text-muted">
          Your pantry is empty. Add your first item above.
        </p>
      )}

      {!loading && !loadError && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const isEditing = editingId === item.id;
            const isDeleting = deletingId === item.id;

            return (
              <Card key={item.id} className="flex flex-col gap-3">
                {isEditing && editDraft ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <TextField
                        value={editDraft.ingredient}
                        onChange={(e) =>
                          setEditDraft((d) =>
                            d ? { ...d, ingredient: e.target.value } : d,
                          )
                        }
                        placeholder="Ingredient"
                        className="col-span-2 sm:col-span-1"
                      />
                      <TextField
                        value={editDraft.quantity}
                        onChange={(e) =>
                          setEditDraft((d) =>
                            d ? { ...d, quantity: e.target.value } : d,
                          )
                        }
                        placeholder="Quantity"
                        type="number"
                      />
                      <TextField
                        value={editDraft.unit}
                        onChange={(e) =>
                          setEditDraft((d) => (d ? { ...d, unit: e.target.value } : d))
                        }
                        placeholder="Unit"
                      />
                      <TextField
                        value={editDraft.expirationDate}
                        onChange={(e) =>
                          setEditDraft((d) =>
                            d ? { ...d, expirationDate: e.target.value } : d,
                          )
                        }
                        type="date"
                      />
                    </div>
                    {editError && <p className="text-sm text-danger">{editError}</p>}
                    <div className="flex gap-2">
                      <Button onClick={() => saveEdit(item)} disabled={saving}>
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
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {item.ingredient}
                      </span>
                      <span className="text-xs text-muted">
                        {[
                          item.quantity !== null
                            ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
                            : item.unit,
                          item.expirationDate ? `expires ${item.expirationDate}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No details"}
                      </span>
                    </div>

                    {isDeleting ? (
                      <div className="flex items-center gap-2">
                        {deleteError && (
                          <span className="text-xs text-danger">{deleteError}</span>
                        )}
                        <span className="text-sm text-foreground">
                          Delete this item?
                        </span>
                        <Button
                          variant="secondary"
                          onClick={() => confirmDelete(item.id)}
                          disabled={deleting}
                        >
                          {deleting ? "Deleting…" : "Confirm"}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={cancelDelete}
                          disabled={deleting}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => startEdit(item)}>
                          Edit
                        </Button>
                        <Button variant="secondary" onClick={() => startDelete(item.id)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
