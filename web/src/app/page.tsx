import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="max-w-2xl mx-auto p-8 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Pantry Agent</h1>
      <p className="text-gray-600">
        An AI agent that recommends recipes from my own Pinterest boards based
        on what I have on hand — verifying real ingredient lists, not just
        guessing from a title, with a general web search fallback when nothing
        in my pins fits.
      </p>

      <div className="aspect-video w-full">
        {/* Swap in your actual video embed once it's recorded (Part 9) */}
        <iframe
          className="w-full h-full rounded"
          src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
          title="Pantry Agent demo"
          allowFullScreen
        />
      </div>

      <div className="flex gap-4">
        <a href="https://github.com/JNC260/pantry-agent" className="underline">
          View the repo
        </a>
        <Link href="/login" className="underline">
          Log in
        </Link>
      </div>
    </main>
  );
}
