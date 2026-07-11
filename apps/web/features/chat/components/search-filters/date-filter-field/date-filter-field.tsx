import { Button } from "@/components/ui/button";
import type {
  ChatFilterCriterion,
  ChatSearchDateOperator,
} from "@/features/chat/model/search";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { DatePickerPopover } from "../date-picker-popover";

interface DateFilterFieldProps {
  criteria: Extract<ChatFilterCriterion, { kind: "date" }>[];
  onChange: (criteria: Extract<ChatFilterCriterion, { kind: "date" }>[]) => void;
}

export function DateFilterField({ criteria, onChange }: DateFilterFieldProps) {
  const update = (
    id: string,
    values: Partial<Extract<ChatFilterCriterion, { kind: "date" }>>
  ) => onChange(criteria.map((criterion) =>
    criterion.id === id ? { ...criterion, ...values } : criterion
  ));

  return (
    <section aria-labelledby="date-filter-label" className="flex flex-col gap-sm">
      <div>
        <h3 id="date-filter-label" className="font-sans text-heading-sm text-foreground">Date</h3>
        <p className="text-copy text-muted">When the message was sent</p>
      </div>
      {criteria.map((criterion, index) => (
        <div key={criterion.id} className="flex flex-wrap items-center gap-sm sm:flex-nowrap">
          <label className="sr-only" htmlFor={`${criterion.id}-operator`}>
            Date operator {index + 1}
          </label>
          <select
            id={`${criterion.id}-operator`}
            value={criterion.operator}
            onChange={(event) =>
              update(criterion.id, {
                operator: event.target.value as ChatSearchDateOperator,
                id: `${event.target.value}:${criterion.date}`,
              })
            }
            className="min-h-control w-full rounded-control border border-border bg-bg px-sm text-copy text-foreground sm:w-filter-operator"
          >
            <option value="before">Before</option>
            <option value="after">After</option>
            <option value="during">During</option>
          </select>
          <DatePickerPopover
            label={`Date ${index + 1}`}
            value={criterion.date}
            onChange={(date) => update(criterion.id, { date, id: `${criterion.operator}:${date}` })}
          />
          <button
            type="button"
            aria-label={`Remove date ${index + 1}`}
            onClick={() => onChange(criteria.filter((item) => item.id !== criterion.id))}
            className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
          >
            <IconTrash size={24} stroke={1.75} aria-hidden="true" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        fullWidth
        onClick={() => {
          const date = new Date().toISOString().slice(0, 10);
          onChange([...criteria, { id: `before:${date}:${criteria.length}`, kind: "date", operator: "before", date }]);
        }}
      >
        <span className="flex items-center gap-xs">
          <IconPlus size={22} stroke={1.75} aria-hidden="true" />
          Add date
        </span>
      </Button>
    </section>
  );
}
