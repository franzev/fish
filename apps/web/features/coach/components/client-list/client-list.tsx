import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Avatar } from "@/features/chat";
import { PresenceSummary } from "@/features/presence/components/presence-summary/presence-summary";

export interface Client {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
}

/** D-12..15/D-11: one calm Card, hairline dividers, alphabetical, each row a
 *  link to the coach's read-only client detail (/coach/clients/[id]) --
 *  monochrome, no color added to the row; the global focus state handles
 *  keyboard navigation without a component-specific edge treatment. */
export function ClientList({ clients }: { clients: Client[] }) {
  const sorted = [...clients].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  return (
    <Card className="divide-y divide-divider p-0">
      {sorted.map((client) => (
        <Link
          key={client.id}
          href={`/coach/clients/${client.id}`}
          className="flex flex-col gap-3xs p-md"
        >
          <span className="flex items-center gap-sm text-foreground">
            <Avatar
              profileId={client.id}
              src={client.avatarUrl ?? undefined}
              name={client.displayName}
              size="md"
              alt=""
            />
            <span>{client.displayName}</span>
          </span>
          <span className="flex flex-col gap-3xs text-ui-sm text-muted">
            <span>{client.email}</span>
            <PresenceSummary userId={client.id} />
          </span>
        </Link>
      ))}
    </Card>
  );
}
