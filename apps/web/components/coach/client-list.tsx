import { Card } from "@/components/ui/card";

export interface Client {
  id: string;
  displayName: string;
  email: string;
}

/** D-12..15: one calm Card, hairline dividers, alphabetical, inert rows —
 *  nothing here is tappable yet (no destination exists this milestone). */
export function ClientList({ clients }: { clients: Client[] }) {
  const sorted = [...clients].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  return (
    <Card className="divide-y divide-border p-0">
      {sorted.map((client) => (
        <div key={client.id} className="flex flex-col gap-0.5 p-4">
          <span className="text-foreground">{client.displayName}</span>
          <span className="text-[14px] text-muted">{client.email}</span>
        </div>
      ))}
    </Card>
  );
}
