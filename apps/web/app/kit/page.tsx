import { KitThemeToggle } from "@/components/kit/theme-toggle";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, Progress } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
} from "@tabler/icons-react";

const tokenSwatches = [
  { name: "bg", className: "bg-bg" },
  { name: "surface", className: "bg-surface" },
  { name: "surface-2", className: "bg-surface-2" },
  { name: "border", className: "bg-border" },
  { name: "border-strong", className: "bg-border-strong" },
  { name: "foreground", className: "bg-foreground" },
  { name: "body", className: "bg-body" },
  { name: "muted", className: "bg-muted" },
  { name: "primary", className: "bg-primary" },
  { name: "on-primary", className: "bg-on-primary" },
  { name: "notice", className: "bg-notice" },
  { name: "warning", className: "bg-warning" },
  { name: "error", className: "bg-error" },
  { name: "success", className: "bg-success" },
];

const iconSamples = [
  { name: "IconInfoCircle (notice)", Icon: IconInfoCircle },
  { name: "IconAlertTriangle (warning)", Icon: IconAlertTriangle },
  { name: "IconAlertCircle (error)", Icon: IconAlertCircle },
  { name: "IconCircleCheck (success)", Icon: IconCircleCheck },
];

/* The design-system contract page (D-12). One long calm scroll, no nav,
   ships unlinked in production (D-15). The theme toggle is the page's own
   dev control — the only client island on an otherwise server page. */
export default function KitPage() {
  return (
    <main className="mx-auto max-w-[440px] px-5 py-12">
      <header className="mb-10">
        <p className="mb-2 text-[14px] uppercase tracking-widest text-muted">
          FISH
        </p>
        <h1 className="text-4xl">UI kit</h1>
        <p className="mt-3 text-body">
          The contract every screen is built from. Every component, every
          state, both themes.
        </p>
        <div className="mt-6">
          <KitThemeToggle />
        </div>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Tokens</h2>
        <div className="grid grid-cols-3 gap-3">
          {tokenSwatches.map((s) => (
            <div key={s.name} className="space-y-2">
              <div
                className={cn(
                  "h-12 w-full rounded-control border border-border",
                  s.className
                )}
              />
              <p className="text-[13px] text-muted">{s.name}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Typography</h2>
        <div className="space-y-5">
          <div>
            <p className="mb-1 text-[13px] text-muted">Display — 32px / 600 / Fraunces</p>
            <h1 className="text-[32px]">The whole job is to remove choices</h1>
          </div>
          <div>
            <p className="mb-1 text-[13px] text-muted">Heading — 20px / 600 / Fraunces</p>
            <h2 className="text-[20px]">Every screen, one action</h2>
          </div>
          <div>
            <p className="mb-1 text-[13px] text-muted">Body — 17px / 400 / Lexend</p>
            <p className="text-[17px] text-body">
              Calm, spacious copy that reads easily and never scolds.
            </p>
          </div>
          <div>
            <p className="mb-1 text-[13px] text-muted">Label — 14px / 400–500 / Lexend</p>
            <p className="text-[14px] text-muted">Field labels, hints, and captions.</p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Icons</h2>
        <div className="grid grid-cols-3 gap-3">
          {iconSamples.map(({ name, Icon }) => (
            <div key={name} className="space-y-2">
              <Icon size={20} stroke={1.75} aria-hidden="true" className="text-foreground" />
              <p className="text-[13px] text-muted">{name}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Button</h2>
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Variants</p>
            <Button>Get started</Button>
            <Button variant="secondary">I already have an account</Button>
            <Button variant="ghost" fullWidth={false}>
              Need help?
            </Button>
          </div>
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Disabled</p>
            <Button disabled>Get started</Button>
          </div>
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Loading</p>
            <Button loading>Saving</Button>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Input</h2>
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Default</p>
            <Input label="Email" placeholder="you@example.com" />
          </div>
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Disabled</p>
            <Input label="Email" placeholder="you@example.com" disabled />
          </div>
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Notice</p>
            <Input
              label="Email"
              defaultValue="frank@examplecom"
              notice="That doesn't look like an email yet. Check the spelling?"
            />
          </div>
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Error</p>
            <Input
              label="Email"
              error="Something needs your attention before you can continue."
            />
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Card</h2>
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-[14px] text-muted">Default</p>
            <Card>
              <p className="text-body">A calm container. The basic surface everything sits on.</p>
            </Card>
          </div>
          <div className="space-y-3">
            <p className="text-[14px] text-muted">
              Elevated (soft shadow in light, surface-step in dark)
            </p>
            <Card className="bg-surface-2">
              <p className="text-body">Elevation comes from a token, never a dark: branch.</p>
            </Card>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Progress</h2>
        <div className="space-y-3">
          <p className="text-[14px] text-muted">Visual only — never a grade</p>
          <Progress value={40} label="Step 2 of 5" />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Alert</h2>
        <div className="space-y-3">
          <Alert tone="notice">
            That doesn&apos;t look like an email yet. Check the spelling?
          </Alert>
          <Alert tone="warning">
            That didn&apos;t send — give it a minute and try again.
          </Alert>
          <Alert tone="error">
            Something needs your attention before you can continue.
          </Alert>
          <Alert tone="success">You&apos;re all set.</Alert>
        </div>
      </section>

      <p className="text-center text-[13px] text-muted">
        Hierarchy before color. If it works in monochrome, it works.
      </p>
    </main>
  );
}
