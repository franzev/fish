import { Card } from "@/components/ui/card";
import type { Icon } from "@tabler/icons-react";

interface EmptyStateProps {
  Icon: Icon;
  children: React.ReactNode;
}

/** D-17/D-18: one quiet icon + calm copy, zero actions — reassurance only. */
export function EmptyState({ Icon, children }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center gap-sm py-xl text-center">
      <Icon size={32} stroke={1.5} aria-hidden="true" className="text-muted" />
      <div className="text-body">{children}</div>
    </Card>
  );
}
