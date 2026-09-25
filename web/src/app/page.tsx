import Link from "next/link";
import { buttonClasses } from "@/components/ui";
import { Masthead } from "@/components/Masthead";
import { StillLife, Torchon } from "@/components/graphics";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Masthead>
        <Link
          href="/login"
          className="text-[15px] font-medium text-walnut hover:text-rosemary"
        >
          Log in
        </Link>
      </Masthead>

      <main className="flex-1 px-4 py-14 sm:px-6 md:py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            <h1 className="font-display text-[clamp(2.4rem,6vw,3.5rem)] font-medium leading-[1.04] tracking-tight">
              Dinner from what’s{" "}
              <em className="font-normal text-mulberry">already</em> in the
              fridge.
            </h1>
            <p className="max-w-[40ch] font-display text-xl italic leading-relaxed text-walnut">
              An AI agent that recommends recipes from my own Pinterest boards
              based on what I have on hand. It checks each recipe’s real
              ingredient list, not just the title, and searches the web when
              nothing I’ve saved fits.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Link href="/login" className={buttonClasses("primary")}>
                Log in
              </Link>
              <a
                href="https://github.com/JNC260/pantry-agent"
                className="font-medium text-mulberry underline underline-offset-[3px] hover:text-mulberry-deep"
              >
                View the repo
              </a>
            </div>
          </div>

          <div className="relative pl-11 pt-10">
            <StillLife className="absolute left-0 top-0 w-[78%]" />
            <figure className="relative flex flex-col gap-2.5">
              <div className="aspect-video w-full overflow-hidden border border-rule bg-linen">
                {/* Swap in your actual video embed once it's recorded (Part 9) */}
                <iframe
                  className="h-full w-full"
                  src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
                  title="Pantry Agent demo"
                  allowFullScreen
                />
              </div>
              <figcaption className="border-t border-rule pt-2 font-display text-sm italic text-walnut">
                A quick tour: asking for dinner from what’s in the pantry.
              </figcaption>
            </figure>
          </div>
        </div>
      </main>

      <footer className="px-4 pb-8 sm:px-6">
        <Torchon className="mx-auto max-w-5xl" />
      </footer>
    </div>
  );
}
