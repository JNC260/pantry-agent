import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import { Masthead } from "@/components/masthead";

export const metadata: Metadata = {
  title: "Privacy Policy — Pantry Whisperer",
};

// The policy lives once, in the repo root's privacy.md, and is read when
// the site is built. This page uses nothing dynamic, so Next prerenders it
// and the file is never needed at runtime.
async function readPolicy(): Promise<string> {
  return readFile(join(process.cwd(), "..", "privacy.md"), "utf8");
}

const policyComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-2 font-display text-[32px] font-medium leading-tight">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-8 font-display text-2xl font-medium">{children}</h2>
  ),
  p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
  em: ({ children }) => <em className="italic text-walnut">{children}</em>,
  ul: ({ children }) => (
    <ul className="mb-4 flex list-disc flex-col gap-1.5 pl-5 marker:text-rosemary">
      {children}
    </ul>
  ),
  code: ({ children }) => (
    <code className="rounded-app bg-linen px-1 py-0.5 text-[0.9em]">
      {children}
    </code>
  ),
  a: ({ children, ...props }) => (
    <a
      {...props}
      className="text-mulberry underline underline-offset-[3px] hover:text-mulberry-deep"
    >
      {children}
    </a>
  ),
};

export default async function PrivacyPage() {
  const policy = await readPolicy();

  return (
    <div className="flex min-h-screen flex-col">
      <Masthead>
        <Link
          href="/"
          className="text-[15px] font-medium text-walnut hover:text-rosemary"
        >
          Home
        </Link>
      </Masthead>
      <main className="flex-1 px-4 py-12 sm:px-6">
        <article className="mx-auto max-w-2xl">
          <ReactMarkdown components={policyComponents}>{policy}</ReactMarkdown>
        </article>
      </main>
    </div>
  );
}
