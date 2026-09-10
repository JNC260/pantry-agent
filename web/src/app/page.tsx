import Link from "next/link";
import { Button } from "./components/Button";

export default function LandingPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Pantry Agent
        </h1>
        <p className="text-base leading-relaxed text-muted">
          An AI agent that recommends recipes from my own Pinterest boards
          based on what I have on hand — verifying real ingredient lists, not
          just guessing from a title, with a general web search fallback when
          nothing in my pins fits.
        </p>
      </div>

      <div className="aspect-video w-full overflow-hidden rounded-app border border-border">
        {/* Swap in your actual video embed once it's recorded (Part 9) */}
        <iframe
          className="w-full h-full"
          src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
          title="Pantry Agent demo"
          allowFullScreen
        />
      </div>

      <div className="flex items-center gap-4">
        <Link href="/login">
          <Button>Log in</Button>
        </Link>
        <a
          href="https://github.com/JNC260/pantry-agent"
          className="text-sm font-medium text-muted underline underline-offset-4 hover:text-foreground"
        >
          View the repo
        </a>
      </div>
    </main>
  );
}
