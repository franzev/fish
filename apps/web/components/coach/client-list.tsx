import { Card } from "@/components/ui/card";
import Link from "next/link";

export interface Client {
  id: string;
  displayName: string;
  email: string;
}

/** D-12..15/D-11: one calm Card, hairline dividers, alphabetical, each row a
 *  link to the coach's read-only client detail (/coach/clients/[id]) --
 *  monochrome, no color added to the row; the global :focus-visible outline
 *  gives keyboard-focusable links their visible focus for free. */
export function ClientList({ clients }: { clients: Client[] }) {
  const sorted = [...clients].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  return (
    <Card className="divide-y divide-border p-0">
      {sorted.map((client) => (
        <Link
          key={client.id}
          href={`/coach/clients/${client.id}`}
          className="flex flex-col gap-3xs p-md"
        >
          <span className="text-foreground">{client.displayName}</span>
          <span className="text-ui-sm text-muted">{client.email}</span>
        </Link>
      ))}
    </Card>
  );
}
