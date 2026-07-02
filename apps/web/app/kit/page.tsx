import { KitThemeToggle } from "@/components/kit/theme-toggle";
import { Button } from "@/components/ui/button";

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

      <p className="text-center text-[13px] text-muted">
        Hierarchy before color. If it works in monochrome, it works.
      </p>
    </main>
  );
}
