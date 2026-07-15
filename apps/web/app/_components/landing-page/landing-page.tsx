import {
  TestimonialCarousel,
  type Testimonial,
} from "@/app/_components/testimonial-carousel";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { ThemePref } from "@/lib/prefs/theme-preference";
import { cn } from "@/lib/utils";
import { IconPlus } from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";

/* The public front door. One marketing surface, still governed by the
 *  product's calm rules: monochrome ladder, hierarchy before color, one
 *  useful next action. The hero and the closing invite repeat the SAME
 *  primary action (create account) — a convenience for a long scroll,
 *  never a second competing choice. Everything renders on the server
 *  except the testimonial carousel, the page's one client island; the
 *  FAQ uses native <details> and ships no JS. */

const SHELL = "mx-auto w-full max-w-marketing px-page md:px-xl";

/* Recognition, not persuasion — each line names a lived experience the
   audience already knows, restating in the page's own voice what the client
   testimonials just above it said. */
const MIRRORS = [
  "You've abandoned more language apps than you'd like to count — usually right after the first missed day.",
  "You rehearse a meeting in your head for days, then say a tenth of it.",
  "A deadline from a real person works. An open-ended plan quietly evaporates.",
  "Once something decides where to start for you, you can focus for hours.",
];

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

/* The differentiator is refusal. Each entry expands the hero's "No streaks.
   No leaderboards. No guilt." into a concrete promise — deliberately covering
   ground the features list doesn't already claim. */
const NEVERS = [
  {
    title: "No guilt notifications",
    body: "FISH never pings you at night to defend a metric. When your coach messages you, it's a person with something to say.",
  },
  {
    title: "No leaderboards",
    body: "You'll never be ranked against strangers. The only comparison FISH draws is you, a little further along than before.",
  },
  {
    title: "No scores or percentages",
    body: "Progress shows as milestones you've reached, never a number judging how you got there.",
  },
  {
    title: "No fake urgency",
    body: "Nothing expires, counts down, or pressures you to act today. Your next step waits as long as you need.",
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
   (with permission) before any public launch. Robohash portraits keep the
   placeholders honest: clearly not photos of real clients. */
const roboAvatar = (seed: string) =>
  `https://robohash.org/${seed}.png?size=88x88`;

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Every other app buried me in choices until I stopped opening it. FISH gives me one thing to do, so I actually come back.",
    name: "Ana",
    role: "Product designer",
    rating: 5,
    avatarUrl: roboAvatar("ana"),
  },
  {
    quote:
      "I once lost a 214 day streak and never opened that app again. Here there is nothing to lose. It just says welcome back.",
    name: "Tomás",
    role: "Backend developer",
    rating: 5,
    avatarUrl: roboAvatar("tomas"),
  },
  {
    quote:
      "My coach knows I hyperfocus, so she sizes each task for it. It feels like something built by people who get it.",
    name: "Rikke",
    role: "Data analyst",
    rating: 5,
    avatarUrl: roboAvatar("rikke"),
  },
  {
    quote:
      "I used to rehearse meetings in my head for days. Now I practice them once, in chat, and my coach tells me exactly what to keep.",
    name: "Priya",
    role: "Engineering manager",
    rating: 5,
    avatarUrl: roboAvatar("priya"),
  },
  {
    quote:
      "The app never pings me, never guilts me, never asks me to choose a lesson. That is why it is the one I still open.",
    name: "Jonas",
    role: "Technical writer",
    rating: 5,
    avatarUrl: roboAvatar("jonas"),
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

interface LandingPageProps {
  initialTheme: ThemePref;
}

export function LandingPage({ initialTheme }: LandingPageProps) {
  return (
    <>
      <header className={cn(SHELL, "flex items-center justify-between py-md")}>
        <Wordmark />
        <div className="-mr-sm flex items-center gap-2xs">
          <ThemeToggle initialTheme={initialTheme} />
          <Link
            href="/sign-in"
            className="inline-flex min-h-target-touch items-center px-sm text-ui font-medium text-body transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
        {/* Hero — the whole pitch in one fold, one action. */}
        <section
          className={cn(
            SHELL,
            "relative grid gap-2xl pb-3xl pt-xl animate-fade-in lg:grid-cols-2 lg:items-center lg:pt-2xl"
          )}
        >
          {/* Decorative artwork behind the vignette, rendered in its authored
              color and contrast in both themes. */}
          <Image
            src="/illustrations/landing-hero-mind-map.svg"
            alt=""
            width={500}
            height={500}
            sizes="(min-width: 1024px) 40vw, 0px"
            className="pointer-events-none absolute bottom-0 right-0 hidden h-auto w-full max-w-content object-contain select-none lg:block"
          />
          <div className="relative">
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
        </section>

        {/* Voices — proof placed before the page's own claims: real clients
            say it first. One calm carousel; swipe, arrows, and dots all
            reach every quote, and nothing advances on its own. */}
        <section aria-labelledby="voices-heading" className="bg-surface py-3xl md:py-4xl">
          <div className={SHELL}>
            <h2 id="voices-heading" className="text-heading-lg">
              From people who stopped abandoning apps
            </h2>
            <TestimonialCarousel
              testimonials={TESTIMONIALS}
              label="Client testimonials"
              className="mt-2xl"
            />
          </div>
        </section>

        {/* Audience mirror — after the client voices, the page names the
            lived experience in its own words. No action here; recognition
            is the whole job. */}
        <section aria-labelledby="mirror-heading" className="py-3xl md:py-4xl">
          <div className={SHELL}>
            <h2 id="mirror-heading" className="max-w-content text-heading-lg">
              Sound familiar?
            </h2>
            <p className="mt-md max-w-content text-lead text-body">
              FISH is built for neurodivergent professionals who are good at
              their jobs and done with apps that fight their attention.
            </p>
            <ul className="mt-2xl max-w-content space-y-lg">
              {MIRRORS.map((line) => (
                <li key={line} className="flex gap-md text-copy text-body">
                  <span aria-hidden="true" className="select-none text-muted">
                    —
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-2xl max-w-content text-copy font-medium text-foreground">
              If you nodded at any of these, you&apos;re exactly who FISH is
              for.
            </p>
          </div>
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

        {/* Anti-features — the other half of "Calm is the feature": what
            stays out. Single-column statements, visually distinct from the
            features grid above. */}
        <section aria-labelledby="never-heading" className="py-3xl md:py-4xl">
          <div className={SHELL}>
            <h2 id="never-heading" className="max-w-content text-heading-lg">
              What FISH will never do
            </h2>
            <p className="mt-md max-w-content text-lead text-body">
              Half of building a calm app is refusing to build the loud one.
            </p>
            <ul className="mt-2xl max-w-content space-y-lg">
              {NEVERS.map((item) => (
                <li key={item.title} className="text-copy text-body">
                  <strong className="font-semibold text-foreground">
                    {item.title}.
                  </strong>{" "}
                  {item.body}
                </li>
              ))}
            </ul>
            <p className="mt-2xl max-w-content text-ui-sm text-muted">
              If a feature would make someone feel bad for being human, it
              doesn&apos;t ship.
            </p>
          </div>
        </section>

        {/* How it works — three quiet numbered steps. */}
        <section aria-labelledby="how-heading" className="bg-surface py-3xl md:py-4xl">
          <div className={SHELL}>
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
          </div>
        </section>

        {/* FAQ — native details/summary, zero JS, divider hairlines only. */}
        <section aria-labelledby="faq-heading" className={cn(SHELL, "py-3xl md:py-4xl")}>
          <div className="mx-auto w-full max-w-content">
            <h2 id="faq-heading" className="text-heading-lg">
              Common questions
            </h2>
            <div className="mt-xl divide-y divide-divider">
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
