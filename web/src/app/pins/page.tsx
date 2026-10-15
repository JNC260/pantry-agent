"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { AppHeader } from "@/components/app-header";
import {
  getRecipeIndexReport,
  type RecipeIndexReport,
  type UnreadableRecipe,
} from "@/lib/recipe-index-api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { groupUnreadable, siteName } from "./_lib/unreadable-groups";

// Recipe pins the agent can't search by ingredient, with links to the pins
// on Pinterest so the user can decide whether to keep them.
export default function PinsPage() {
  useRequireAuth();

  const [report, setReport] = useState<RecipeIndexReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped by Retry to run the load effect again.
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getRecipeIndexReport()
      .then((data) => {
        if (cancelled) return;
        setReport(data);
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load your pins.");
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

  const groups = report ? groupUnreadable(report.unreadable) : [];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[32px] font-medium leading-tight">
              Recipe pins
            </h1>
            <p className="text-walnut">
              The agent reads each recipe pin once so it can find recipes by
              ingredient. These are the ones it couldn&apos;t read.
            </p>
          </div>

          {loading && (
            <p className="font-display italic text-walnut">Loading your pins…</p>
          )}

          {!loading && loadError && (
            <Card className="flex items-center justify-between gap-3 border-paprika">
              <p className="text-sm text-paprika">{loadError}</p>
              <Button variant="secondary" onClick={retryLoad}>
                Retry
              </Button>
            </Card>
          )}

          {!loading && !loadError && report && (
            <>
              <Counts counts={report.counts} />

              {groups.length === 0 ? (
                <p className="text-walnut">No unreadable pins so far.</p>
              ) : (
                groups.map((group) => (
                  <section key={group.reason} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1 border-t border-ink pt-5">
                      <h2 className="font-display text-xl font-medium">
                        {group.title}{" "}
                        <span className="text-walnut">({group.recipes.length})</span>
                      </h2>
                      <p className="text-sm text-walnut">{group.description}</p>
                    </div>
                    <ul className="flex flex-col divide-y divide-rule">
                      {group.recipes.map((recipe) => (
                        <UnreadableRow key={recipe.sourceLink} recipe={recipe} />
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Counts({ counts }: { counts: RecipeIndexReport["counts"] }) {
  const stats = [
    { label: "Recipe pins", value: counts.recipes },
    { label: "Searchable by ingredient", value: counts.indexed },
    { label: "Couldn't read", value: counts.unreadable },
    { label: "Still to read", value: counts.pending },
  ];
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <dt className="text-sm text-walnut">{stat.label}</dt>
            <dd className="font-display text-2xl font-medium">
              {stat.value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
      {counts.pending > 0 && (
        <p className="text-sm text-walnut">
          New pins are read in batches of 100 a day.
        </p>
      )}
    </div>
  );
}

function UnreadableRow({ recipe }: { recipe: UnreadableRecipe }) {
  return (
    <li className="flex flex-col gap-1.5 py-3">
      {recipe.pins.map((pin) => (
        <div key={pin.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <a
            href={pin.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink underline decoration-rule underline-offset-[3px] hover:text-rosemary hover:decoration-current"
          >
            {pin.title || "Untitled pin"}
          </a>
          <span className="text-sm text-walnut">{pin.boardName}</span>
        </div>
      ))}
      <p className="text-xs text-walnut">
        {siteName(recipe.sourceLink)} · {recipe.error} · last tried{" "}
        {new Date(recipe.lastTriedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
        {recipe.attempts > 1 && ` (${recipe.attempts} tries)`}
      </p>
    </li>
  );
}
