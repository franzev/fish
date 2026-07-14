import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import Link from "next/link";

/* The public front door. One marketing surface, still governed by the
 *  product's calm rules: monochrome ladder, hierarchy before color, one
 *  useful next action. The hero and the closing invite repeat the SAME
 *  primary action (create account) — a convenience for a long scroll,
 *  never a second competing choice. Everything renders on the server;
 *  the FAQ uses native <details>, so the page ships zero client JS. */

const SHELL = "mx-auto w-full max-w-marketing px-page md:px-xl";

const FEATURES = [
  {
    title: "One next step",
    body: "Your coach assigns exactly one thing to do. When it's done, the next one appears. Nothing to browse, nothing to decide.",
  },
  {
    title: "Assigned, never chosen",
    body: "No plan galleries, difficulty menus, or template pickers. Your coach picks what fits your goals; you just show up.",
  },
  {
    title: "Gaps never reset anything",
    body: "Life happens. Come back after a quiet week and FISH simply welcomes you back. There are no streaks here, so none can break.",
  },
  {
    title: "A real person in the chat",
    body: "Every step comes from your coach, who knows your goals, your job, and how your attention works.",
  },
];

const STEPS = [
  {
    title: "Meet your coach",
    body: "A short chat about your goals, your work, and the English you actually need.",
  },
  {
    title: "Get your one next step",
    body: "Your coach assigns a single, doable task, sized to fit a busy week.",
  },
  {
    title: "Chat, practice, repeat",
    body: "Feedback lands in the same calm conversation. Progress shows as milestones, never as a grade.",
  },
];

/* Placeholder voices for layout and tone — replace with real client quotes
   (with permission) before any public launch. */
const FEATURED_QUOTE = {
  quote:
    "Every other app buried me in choices until I stopped opening it. FISH gives me one thing to do, so I actually come back.",
  name: "Ana",
  role: "Product designer",
};

const SUPPORTING_QUOTES = [
  {
    quote:
      "I once lost a 214 day streak and never opened that app again. Here there is nothing to lose. It just says welcome back.",
    name: "Tomás",
    role: "Backend developer",
  },
  {
    quote:
      "My coach knows I hyperfocus, so she sizes each task for it. It feels like something built by people who get it.",
    name: "Rikke",
    role: "Data analyst",
  },
];

const FAQS = [
  {
    question: "Do I need a certain English level to start?",
    answer:
      "No. Your coach meets you where you are, from careful beginner to polishing talks for a conference.",
  },
  {
    question: "What happens if I disappear for a while?",
    answer:
      "Nothing breaks. There are no streaks to lose, and your next step waits patiently. Coming back is rewarded, never judged.",
  },
  {
    question: "Is this a course with lessons to pick from?",
    answer:
      "No. There is nothing to browse. Your coach assigns one next step at a time, chosen for you.",
  },
  {
    question: "Who are the coaches?",
    answer:
      "Experienced English coaches who work with neurodivergent professionals and adapt to how you focus, plan, and remember.",
  },
  {
    question: "Does it work on my phone?",
    answer:
      "Yes. FISH runs in the browser on your phone, tablet, and computer, and your chat stays in sync everywhere.",
  },
];

/* A miniature of the real product: the single assigned next step, backed by
   a quiet trail of finished ones. One decisive image instead of stock
   photography — presented as a figure to assistive tech, with the content
   summarized in the label. */
function NextStepVignette() {
  return (
    <div
      role="img"
      aria-label="A FISH home screen. One next step is assigned by Maya, the coach: record a 60 second intro for your team. Two earlier steps are quietly checked off as done."
      className="w-full max-w-chat-preview rounded-card bg-surface p-md lg:justify-self-end"
    >
      <p className="text-ui-xs text-muted">Your next step</p>
      <p className="mt-2xs font-serif text-heading-sm font-semibold text-foreground">
        Record a 60 second intro for your team
      </p>
      <p className="mt-xs text-ui-sm text-muted">From Maya, your coach</p>
      <div className="mt-md rounded-control bg-surface-2 px-md py-sm">
        <p className="text-ui-xs text-muted">Done so far</p>
        <ul className="mt-xs space-y-xs">
          <li className="flex items-center gap-xs text-ui text-body">
            <IconCheck
              size={16}
              stroke={1.75}
              aria-hidden="true"
              className="shrink-0 text-muted"
            />
            Introduce yourself in three sentences
          </li>
          <li className="flex items-center gap-xs text-ui text-body">
            <IconCheck
              size={16}
              stroke={1.75}
              aria-hidden="true"
              className="shrink-0 text-muted"
            />
            Say what you do in one plain sentence
          </li>
        </ul>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <>
      <header className={cn(SHELL, "flex items-center justify-between py-md")}>
        <Wordmark />
        <Link
          href="/sign-in"
          className="inline-flex min-h-target-touch items-center px-sm text-ui font-medium text-body transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      <main>
        {/* Hero — the whole pitch in one fold, one action. */}
        <section
          className={cn(
            SHELL,
            "grid gap-2xl pb-3xl pt-xl animate-fade-in lg:grid-cols-2 lg:items-center lg:pt-2xl"
          )}
        >
          <div>
            <h1 className="max-w-content text-hero">
              English coaching that fits how your brain works.
            </h1>
            <p className="mt-lg max-w-content text-lead text-body">
              FISH pairs you with a real coach in a calm, one-to-one chat. You
              get one next step at a time, never a wall of choices.
            </p>
            <Button
              href="/signup"
              variant="primary"
              className="mt-xl px-lg"
            >
              Create account
            </Button>
            <p className="mt-md text-ui-sm text-muted">
              No streaks. No leaderboards. No guilt.
            </p>
          </div>
          <NextStepVignette />
        </section>

        {/* Features — spacious definition list, no icon-card grid. */}
        <section aria-labelledby="features-heading" className="bg-surface py-3xl md:py-4xl">
          <div className={SHELL}>
            <h2 id="features-heading" className="max-w-content text-heading-lg">
              Calm is the feature.
            </h2>
            <p className="mt-md max-w-content text-lead text-body">
              Most learning apps compete for your attention. FISH is built to
              protect it.
            </p>
            <dl className="mt-2xl grid gap-xl md:grid-cols-2 md:gap-2xl">
              {FEATURES.map((feature) => (
                <div key={feature.title}>
                  <dt className="font-serif text-heading-sm font-semibold text-foreground">
                    {feature.title}
                  </dt>
                  <dd className="mt-sm max-w-content text-body">{feature.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* How it works — three quiet numbered steps. */}
        <section aria-labelledby="how-heading" className={cn(SHELL, "py-3xl md:py-4xl")}>
          <h2 id="how-heading" className="text-heading-lg">
            How it works
          </h2>
          <ol className="mt-2xl max-w-content space-y-xl">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex items-start gap-md">
                <span
                  aria-hidden="true"
                  className="flex size-target-touch shrink-0 items-center justify-center rounded-pill bg-surface-2 font-serif text-heading-sm font-semibold text-foreground"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-heading-sm">{step.title}</h3>
                  <p className="mt-xs text-body">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Voices — one featured quote carries the section; two support it. */}
        <section aria-labelledby="voices-heading" className="bg-surface py-3xl md:py-4xl">
          <div className={SHELL}>
            <h2 id="voices-heading" className="text-heading-lg">
              From people who stopped abandoning apps
            </h2>
            <figure className="mt-2xl max-w-content">
              <blockquote className="font-serif text-heading-lg font-semibold text-foreground">
                “{FEATURED_QUOTE.quote}”
              </blockquote>
              <figcaption className="mt-md text-ui text-muted">
                {FEATURED_QUOTE.name}, {FEATURED_QUOTE.role}
              </figcaption>
            </figure>
            <div className="mt-2xl grid gap-xl md:grid-cols-2 md:gap-2xl">
              {SUPPORTING_QUOTES.map((entry) => (
                <figure key={entry.name} className="max-w-content">
                  <blockquote className="text-copy text-body">
                    “{entry.quote}”
                  </blockquote>
                  <figcaption className="mt-sm text-ui-sm text-muted">
                    {entry.name}, {entry.role}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ — native details/summary, zero JS, divider hairlines only. */}
        <section aria-labelledby="faq-heading" className={cn(SHELL, "py-3xl md:py-4xl")}>
          <h2 id="faq-heading" className="text-heading-lg">
            Common questions
          </h2>
          <div className="mt-xl max-w-content divide-y divide-divider">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group">
                <summary className="flex min-h-target-touch cursor-pointer list-none items-center justify-between gap-md py-md text-ui-md font-medium text-foreground">
                  {faq.question}
                  <IconPlus
                    size={20}
                    stroke={1.75}
                    aria-hidden="true"
                    className="shrink-0 text-muted transition-transform group-open:rotate-45"
                  />
                </summary>
                <p className="pb-lg text-body">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing invite — the same single action, restated once. */}
        <section
          aria-labelledby="cta-heading"
          className="mx-auto flex w-full max-w-content flex-col items-center px-page pb-3xl pt-lg text-center md:pb-4xl"
        >
          <h2 id="cta-heading" className="text-heading-lg">
            Ready for a quieter way to learn?
          </h2>
          <p className="mt-md text-lead text-body">
            One coach, one conversation, one next step at a time.
          </p>
          <Button
            href="/signup"
            variant="primary"
            className="mt-xl px-lg"
          >
            Create account
          </Button>
          <p className="mt-md text-ui-sm text-muted">
            Already coaching with us?{" "}
            <Link href="/sign-in" className="text-body underline">
              Sign in
            </Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-divider">
        <div className={cn(SHELL, "flex flex-col gap-lg py-xl md:flex-row md:items-end md:justify-between")}>
          <div>
            <p className="font-serif text-heading-sm font-semibold text-foreground">
              FISH
            </p>
            <p className="mt-2xs text-ui-sm text-muted">
              English coaching for brains that work differently.
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="flex gap-lg">
              <li>
                <Link
                  href="/sign-in"
                  className="inline-flex min-h-target-touch items-center text-ui-sm text-body underline"
                >
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  href="/signup"
                  className="inline-flex min-h-target-touch items-center text-ui-sm text-body underline"
                >
                  Create account
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </>
  );
}
