"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, Card } from "@/components/ui";
import { AppHeader } from "@/components/app-header";
import {
  getRecipeIndexReport,
  refreshRecipeIndex,
  setRecipeAccepted,
  type RecipeIndexReport,
  type UnreadableRecipe,
} from "@/lib/recipe-index-api";
import { useRequireAuth } from "@/lib/use-require-auth";
import {
  blockedSiteCounts,
  groupUnreadable,
  siteName,
} from "./_lib/unreadable-groups";

// Recipe pins the agent can't search by ingredient, with links to the pins
// on Pinterest so the user can decide whether to keep them.
export default function PinsPage() {
  useRequireAuth();

  const [report, setReport] = useState<RecipeIndexReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped by Retry to run the load effect again.
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // What the last refresh came to, shown under its button.
  const [refreshNote, setRefreshNote] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  // Recipe links whose "looks fine" mark is being saved, and the last
  // failure to save one.
  const [marking, setMarking] = useState<Set<string>>(new Set());
  const [markError, setMarkError] = useState<string | null>(null);

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

  async function refresh() {
    setRefreshing(true);
    setRefreshNote(null);
    try {
      const { failedBoards, ...updated } = await refreshRecipeIndex();
      setReport(updated);
      setRefreshNote(
        failedBoards.length > 0
          ? {
              text: `Updated, except ${failedBoards.join(", ")}, which Pinterest didn't return. Try again later.`,
              error: true,
            }
          : { text: "Up to date with Pinterest.", error: false },
      );
    } catch {
      setRefreshNote({
        text: "Couldn't reach Pinterest. Try again in a bit.",
        error: true,
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function markAccepted(sourceLink: string, accepted: boolean) {
    setMarking((links) => new Set(links).add(sourceLink));
    setMarkError(null);
    try {
      setReport(await setRecipeAccepted(sourceLink, accepted));
    } catch {
      setMarkError(
        accepted
          ? "Couldn't mark that pin as fine. Try again."
          : "Couldn't move that pin back. Try again.",
      );
    } finally {
      setMarking((links) => {
        const next = new Set(links);
        next.delete(sourceLink);
        return next;
      });
    }
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
              ingredient. These are the ones it couldn&apos;t read. If a link
              works for you (a recipe video, say), mark it &ldquo;Looks
              fine&rdquo; and the agent will stop trying to read it.
            </p>
          </div>

          {loading && (
            <p className="font-display italic text-walnut">
              Loading your pins…
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

          {!loading && !loadError && report && (
            <>
              <Counts counts={report.counts} />

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Button
                  variant="secondary"
                  onClick={refresh}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing…" : "Refresh from Pinterest"}
                </Button>
                <p
                  role="status"
                  className={`text-sm ${refreshNote?.error ? "text-paprika" : "text-walnut"}`}
                >
                  {refreshNote?.text ??
                    "Deleted or fixed a pin on Pinterest? Refresh to update this list."}
                </p>
              </div>

              {markError && (
                <p role="alert" className="text-sm text-paprika">
                  {markError}
                </p>
              )}

              {groups.length === 0 ? (
                <p className="text-walnut">No unreadable pins so far.</p>
              ) : (
                groups.map((group) => (
                  <section key={group.reason} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1 border-t border-ink pt-5">
                      <h2 className="font-display text-xl font-medium">
                        {group.title}{" "}
                        <span className="text-walnut">
                          ({group.recipes.length})
                        </span>
                      </h2>
                      <p className="text-sm text-walnut">{group.description}</p>
                      {group.reason === "unreadable" && (
                        <BlockedSitesNote
                          sites={blockedSiteCounts(
                            group.recipes,
                            report.blockedSites,
                          )}
                        />
                      )}
                    </div>
                    <ul className="flex flex-col divide-y divide-rule">
                      {group.recipes.map((recipe) => (
                        <UnreadableRow
                          key={recipe.sourceLink}
                          recipe={recipe}
                          action={
                            <Button
                              variant="text"
                              disabled={marking.has(recipe.sourceLink)}
                              onClick={() =>
                                markAccepted(recipe.sourceLink, true)
                              }
                            >
                              Looks fine
                            </Button>
                          }
                        />
                      ))}
                    </ul>
                  </section>
                ))
              )}

              {report.accepted.length > 0 && (
                <details className="flex flex-col gap-3 border-t border-ink pt-5">
                  <summary className="cursor-pointer font-display text-xl font-medium">
                    Marked as fine{" "}
                    <span className="text-walnut">
                      ({report.accepted.length})
                    </span>
                  </summary>
                  <p className="mt-1 text-sm text-walnut">
                    You said these are fine even though the agent can&apos;t
                    read them. It recommends them by title, board, and Pinterest
                    description, and won&apos;t try to read them again.
                  </p>
                  <ul className="flex flex-col divide-y divide-rule">
                    {report.accepted.map((recipe) => (
                      <UnreadableRow
                        key={recipe.sourceLink}
                        recipe={recipe}
                        action={
                          <Button
                            variant="text"
                            disabled={marking.has(recipe.sourceLink)}
                            onClick={() =>
                              markAccepted(recipe.sourceLink, false)
                            }
                          >
                            Move back
                          </Button>
                        }
                      />
                    ))}
                  </ul>
                </details>
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
    ...(counts.accepted > 0
      ? [{ label: "Marked as fine", value: counts.accepted }]
      : []),
    { label: "Still to read", value: counts.pending },
  ];
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-4 sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none">
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

function BlockedSitesNote({
  sites,
}: {
  sites: { site: string; recipes: number }[];
}) {
  if (sites.length === 0) return null;
  return (
    <p className="text-sm text-walnut">
      These sites turned the agent away every time, so it no longer tries to
      read them:{" "}
      {sites.map(({ site, recipes }, i) => (
        <span key={site}>
          {i > 0 && ", "}
          <span className="font-medium text-ink">{site}</span> ({recipes})
        </span>
      ))}
      .
    </p>
  );
}

function UnreadableRow({
  recipe,
  action,
}: {
  recipe: UnreadableRecipe;
  // A button acting on the recipe ("Looks fine", "Move back").
  action: ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        {recipe.pins.map((pin) => (
          <div
            key={pin.id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
          >
            <a
              href={pin.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink underline decoration-rule underline-offset-[3px] hover:text-rosemary hover:decoration-current"
            >
              {pin.title || "Untitled pin"}
            </a>
            <span className="text-sm text-walnut">
              {pin.sectionName
                ? `${pin.boardName} / ${pin.sectionName}`
                : pin.boardName}
            </span>
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
      </div>
      <div className="shrink-0 pt-0.5">{action}</div>
    </li>
  );
}
