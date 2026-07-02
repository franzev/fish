import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Progress } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const swatches = [
  { name: "bg", className: "bg-bg" },
  { name: "surface", className: "bg-surface" },
  { name: "primary", className: "bg-primary" },
  { name: "accent-pink", className: "bg-accent-pink" },
  { name: "accent-yellow", className: "bg-accent-yellow" },
  { name: "body", className: "bg-body" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-[440px] px-5 py-12">
      <header className="mb-10">
        <Image
          src="/logo.svg"
          alt="FISH"
          width={72}
          height={72}
          priority
          className="mb-4"
        />
        <p className="mb-2 text-[14px] uppercase tracking-widest text-primary">
          FISH
        </p>
        <h1 className="text-4xl">Design system</h1>
        <p className="mt-3 text-body">
          The foundation every screen is built from. Calm, focused, one action
          at a time.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Color</h2>
        <div className="grid grid-cols-3 gap-3">
          {swatches.map((s) => (
            <div key={s.name}>
              <div
                className={cn(
                  "mb-2 h-16 w-full rounded-control border border-border",
                  s.className,
                )}
              />
              <p className="text-[13px] text-foreground">{s.name}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Buttons</h2>
        <div className="space-y-3">
          <Button>Get started</Button>
          <Button variant="secondary">I already have an account</Button>
          <Button variant="ghost" fullWidth={false}>
            Need help?
          </Button>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Inputs</h2>
        <div className="space-y-5">
          <Input label="Email" placeholder="you@work.com" type="email" />
          <Input
            label="Password"
            type="password"
            hint="At least 8 characters."
          />
          <Input
            label="Email"
            defaultValue="not-an-email"
            notice="That doesn't look like an email yet. Check the spelling?"
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl">Card &amp; progress</h2>
        <Card>
          <h3 className="text-lg">Today&apos;s focus</h3>
          <p className="mt-1 text-body">
            One small step, sized to fit your day.
          </p>
          <div className="mt-5">
            <Progress value={60} label="Your journey" />
          </div>
        </Card>
      </section>

      <p className="text-center text-[13px] text-muted">
        Foundation first. Patterns later.
      </p>
    </main>
  );
}
